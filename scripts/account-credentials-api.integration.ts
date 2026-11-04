/** Requires dev:account-review -- --email --no-google. Never sends real email. */
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
config({ path: '.env.local', quiet: true });
const base = 'http://localhost:3014';
const fetchOriginal = globalThis.fetch;
const fixtures: string[] = [];
class Browser {
  jar = new Map<string, string>();
  async call(path: string, init: RequestInit = {}) {
    const response = await fetchOriginal(base + path, { ...init, redirect: 'manual', headers: { Cookie: [...this.jar].map(([key,value]) => `${key}=${value}`).join('; '), ...init.headers } });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'); const index = pair.indexOf('=');
      this.jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
  post(path: string, body: unknown, origin = base) { return this.call('/api/account/' + path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
  async login(identifier: string, password: string) {
    const csrf = await (await this.call('/api/auth/csrf')).json();
    const response = await this.call('/api/auth/callback/credentials', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, identifier, password, callbackUrl: base + '/profile' }) });
    const result = await response.json();
    assert.ok(!result.url.includes('error='), 'credentials should authenticate');
  }
}
async function main() {
  const { AccountUser } = await import('../src/server/models/AccountUser');
  const { AccountRegistration, AccountToken, AuthRateLimit } = await import('../src/server/models/AccountSecurity');
  const { HillWallet } = await import('../src/server/models/Hill');
  await mongoose.connect(process.env.MONGODB_URI!, { dbName: 'vct_account_review_20261104' });
  const id = randomBytes(5).toString('hex'), username = 'api' + id, email = `${id}@example.invalid`, password = 'test password 123456', nextPassword = 'changed password 123456';
  fixtures.push(email);
  const browser = new Browser();
  const messages = async () => await (await fetchOriginal(base + '/__review/mail', { headers: { 'x-review-only': 'local-review-fixture' } })).json() as { to: string[]; text: string }[];
  const token = async () => (await messages()).find(message => message.to.includes(email))!.text.match(/#token=([a-f0-9]{64})/)![1];
  try {
    const providers = await (await browser.call('/api/auth/providers')).json();
    assert.ok(providers.credentials); assert.equal(providers.google, undefined, 'credentials independent of Google');
    assert.equal((await browser.post('register', {}, 'https://attacker.invalid')).status, 403);
    assert.equal((await browser.post('register', { username, email, name: 'API review', password, confirmation: password })).status, 200);
    const verification = await token();
    assert.equal(await AccountUser.countDocuments({ emailNormalized: email }), 0);
    const page = await browser.call('/verify-email');
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
    const html = await page.text(); assert.ok(!html.includes('static.cloudflareinsights.com'), 'token page has no analytics');
    assert.equal(await AccountUser.countDocuments({ emailNormalized: email }), 0, 'GET cannot confirm');
    assert.equal((await browser.post('verification/confirm', { token: verification })).status, 200);
    assert.equal((await browser.post('verification/confirm', { token: verification })).status, 400);
    await browser.login(username, password);
    const session = await (await browser.call('/api/auth/session')).json();
    const playerId = session.user.playerId;
    assert.equal(session.user.sessionVersion, 0);
    assert.equal((await browser.call(`/api/hill/wallet?playerId=${playerId}`)).status, 200);
    assert.equal((await browser.call('/profile')).status, 200);
    const { digest } = await import('../src/features/account/server/rate-limit');
    await AuthRateLimit.deleteOne({ key: digest(`mail-email-minute:${email}:${Math.floor(Date.now()/60000)}`) });
    assert.equal((await browser.post('password/forgot', { email })).status, 503);
    assert.equal((await browser.post('password/reset', { token: 'disabled', password: nextPassword, confirmation: nextPassword })).status, 503);
    assert.equal((await browser.post('password/change', { currentPassword: password, password: nextPassword, confirmation: nextPassword })).status, 200);
    assert.equal((await browser.call(`/api/hill/wallet?playerId=${playerId}`)).status, 403, 'old session cannot access wallet after password change');
    assert.equal((await browser.post('merge', { guestId: randomBytes(5).toString('hex') })).status, 401, 'old session cannot merge');
    assert.equal((await browser.post('password/change', { currentPassword: nextPassword, password, confirmation: password })).status, 401);
    await browser.login(email, nextPassword);
    assert.equal((await browser.call(`/api/hill/wallet?playerId=${playerId}`)).status, 200, 'new password restores owner access');
    console.log('Credentials HTTP passed: Google-disabled providers, CSRF origin, verification GET/POST, token replay, real Auth.js login, disabled recovery, password change and revoked wallet/merge/security sessions.');
  } finally {
    const users = await AccountUser.find({ emailNormalized: { $in: fixtures } }).lean();
    const ids = users.map(user => user.playerId);
    await AccountRegistration.deleteMany({ emailNormalized: { $in: fixtures } });
    await AccountToken.deleteMany({ playerId: { $in: ids } });
    await HillWallet.deleteMany({ playerId: { $in: ids } });
    await AccountUser.deleteMany({ emailNormalized: { $in: fixtures } });
    await mongoose.disconnect();
  }
}
main().catch(error => { console.error('Credentials HTTP failed', { name: error?.name, code: error?.code, actual: error?.actual, expected: error?.expected, location: error?.stack?.split('\n').find((line:string) => line.includes('/scripts/')) }); process.exitCode = 1; });
