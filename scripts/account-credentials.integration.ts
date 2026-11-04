/** Real Argon2 + isolated Mongo transactions; email transport is stubbed. */
import { config } from 'dotenv';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
config({ path: '.env.local', quiet: true });
process.env.MONGODB_DB_NAME = 'vct_account_review_20261104';
process.env.AUTH_PUBLIC_ORIGIN = 'http://localhost:3014';
const originalFetch = globalThis.fetch;
const mail: { to: string[]; text: string }[] = [];
globalThis.fetch = async (url, init) => {
  assert.equal(String(url), 'https://api.resend.com/emails');
  mail.push(JSON.parse(String(init?.body)));
  return new Response('{}');
};
const takeToken = () => mail.at(-1)!.text.match(/#token=([a-f0-9]{64})/)![1];
async function main() {
  const { dbConnect } = await import('../src/server/db/mongodb');
  const { AccountUser } = await import('../src/server/models/AccountUser');
  const { AccountToken, AccountRegistration, AuthRateLimit } = await import('../src/server/models/AccountSecurity');
  const { registerAccount, confirmRegistration, resendVerification, forgotPassword, resetPassword, changePassword, addPassword, newToken } = await import('../src/features/account/server/credentials');
  const { completeGoogleIntent, findGoogleUser } = await import('../src/features/account/server/google');
  const { takeLimit, digest } = await import('../src/features/account/server/rate-limit');
  const { checkPassword } = await import('../src/features/account/server/password');
  await dbConnect();
  // Only the isolated review DB: migrate before creating fixtures.
  const { migrateAccountAuth } = await import('./account-auth-migrate');
  await migrateAccountAuth(true);
  const prefix = randomBytes(5).toString('hex');
  const email = `${prefix}@example.invalid`, googleEmail = `g${email}`, otherEmail = `o${email}`;
  const username = `u${prefix}`, password = '  long mật khẩu 123  ', nextPassword = 'new password 123456';
  const ids: string[] = [];
  try {
    await registerAccount({ username, email: email.toUpperCase(), name: 'Người chơi', password, confirmation: password });
    assert.equal(await AccountUser.countDocuments({ emailNormalized: email }), 0, 'registration is pending only');
    const first = takeToken();
    await resendVerification(email);
    const second = takeToken(); assert.notEqual(first, second);
    await assert.rejects(confirmRegistration(first));
    const confirmations = await Promise.allSettled([confirmRegistration(second), confirmRegistration(second)]);
    assert.equal(confirmations.filter(result => result.status === 'fulfilled').length, 1);
    const user = await AccountUser.findOne({ emailNormalized: email }).select('+passwordHash').orFail().lean(); ids.push(user.playerId);
    assert.ok(user.passwordHash!.startsWith('$argon2id$'));
    assert.ok(await checkPassword(user.passwordHash, password));
    assert.equal(await checkPassword(user.passwordHash, password.trim()), false, 'password whitespace preserved');
    await assert.rejects(findGoogleUser({ sub: randomUUID(), email }), 'email match cannot automatically link Google');
    const plain = await AccountUser.findOne({ emailNormalized: email }).lean();
    assert.equal(plain?.passwordHash, undefined);
    await forgotPassword(email); const reset = takeToken();
    const resets = await Promise.allSettled([resetPassword({ token: reset, password: nextPassword, confirmation: nextPassword }), resetPassword({ token: reset, password: nextPassword, confirmation: nextPassword })]);
    assert.equal(resets.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal((await AccountUser.findOne({ playerId: user.playerId }).orFail()).sessionVersion, 1);
    await assert.rejects(changePassword(user.playerId, 0, { currentPassword: nextPassword, password, confirmation: password }), 'old session version cannot change password');
    await changePassword(user.playerId, 1, { currentPassword: nextPassword, password, confirmation: password });
    assert.equal((await AccountUser.findOne({ playerId: user.playerId }).orFail()).sessionVersion, 2);
    const link = newToken(), sub = randomUUID();
    await AccountToken.create({ tokenHash: digest(link), playerId: user.playerId, purpose: 'link-google', sessionVersion: 2, expiresAt: new Date(Date.now() + 300000) });
    await assert.rejects(completeGoogleIntent(link, { playerId: 'wrong', sessionVersion: 2 }, { sub, email }));
    await assert.rejects(completeGoogleIntent(link, { playerId: user.playerId, sessionVersion: 2 }, { sub, email: otherEmail }));
    await completeGoogleIntent(link, { playerId: user.playerId, sessionVersion: 2 }, { sub, email });
    await assert.rejects(completeGoogleIntent(link, { playerId: user.playerId, sessionVersion: 2 }, { sub, email }));
    assert.equal((await findGoogleUser({ sub, email })).playerId, user.playerId, 'linked Google keeps player identity');
    const google = await AccountUser.create({ googleSubject: randomUUID(), email: googleEmail, emailNormalized: googleEmail, emailVerifiedAt: new Date(), playerId: randomBytes(5).toString('hex') }); ids.push(google.playerId);
    const proof = newToken();
    await AccountToken.create({ tokenHash: digest(proof), playerId: google.playerId, purpose: 'add-password', sessionVersion: 0, expiresAt: new Date(Date.now() + 300000) });
    const profile = { sub: google.googleSubject!, email: googleEmail };
    await assert.rejects(completeGoogleIntent(proof, { playerId: google.playerId, sessionVersion: 0 }, profile), 'Google reauth needs auth_time');
    await completeGoogleIntent(proof, { playerId: google.playerId, sessionVersion: 0 }, { ...profile, auth_time: Math.floor(Date.now()/1000) });
    await addPassword(google.playerId, 0, proof, { username: `g${username}`, password, confirmation: password });
    await assert.rejects(addPassword(google.playerId, 0, proof, { username: `g${username}`, password, confirmation: password }));
    assert.equal((await AccountUser.findOne({ playerId: google.playerId }).orFail()).sessionVersion, 1);
    const limits = await Promise.all(Array.from({ length: 12 }, () => takeLimit('test-credentials', prefix, 3, 60000)));
    assert.equal(limits.filter(Boolean).length, 3, 'atomic distributed rate limiting');
    console.log('Credentials integration passed: Argon2, pending verification, token rotation, concurrent single use, session revocation, explicit Google link, recent reauth, password addition and distributed limits.');
  } finally {
    await AccountToken.deleteMany({ playerId: { $in: ids } });
    await AccountRegistration.deleteMany({ emailNormalized: { $in: [email, googleEmail, otherEmail] } });
    await AccountUser.deleteMany({ emailNormalized: { $in: [email, googleEmail, otherEmail] } });
    globalThis.fetch = originalFetch;
    await mongoose.disconnect();
  }
}
main().catch(error => { console.error('Credentials integration failed', { name: error?.name, code: error?.code, actual: error?.actual, expected: error?.expected, location: error?.stack?.split('\n').find((line: string) => line.includes('/scripts/') || line.includes('/src/')) }); process.exitCode = 1; });
