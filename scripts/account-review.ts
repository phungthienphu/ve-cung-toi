/** Local-only fixtures; these OAuth/JWT values must never be used for deployment. */
import { createServer } from 'node:http';
import next from 'next';
if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('Account review server is local-only');
const emailReview = process.argv.includes('--email');
const noGoogle = process.argv.includes('--no-google');
const messages: unknown[] = [];
const realFetch = globalThis.fetch;
if (emailReview) globalThis.fetch = async (input, init) => {
  if (String(input) === 'https://api.resend.com/emails') {
    messages.push(JSON.parse(String(init?.body)));
    if (messages.length > 50) messages.shift();
    return new Response(JSON.stringify({ id: 'review-only' }), { status: 200 });
  }
  return realFetch(input, init);
};
const guestOnly = process.argv.includes('--guest-only');
Object.assign(process.env, {
  NEXT_PUBLIC_COMMUNITY_HOST:process.env.COMMUNITY_REVIEW_HOST || '127.0.0.1:1999',
  NEXT_BUILD_DIR:'.next-account-review',
  MONGODB_DB_NAME:'vct_account_review_20261104',
  AUTH_GOOGLE_ID:guestOnly || noGoogle ? '' : 'review-only',
  AUTH_GOOGLE_SECRET:guestOnly || noGoogle ? '' : 'review-only',
  AUTH_SECRET:guestOnly ? '' : 'account-review-only-secret-not-for-production',
  AUTH_URL:'http://localhost:3014',
  AUTH_TRUST_HOST:'true',
  AUTH_EMAIL_ENABLED:emailReview && !guestOnly ? 'true' : 'false',
  RESEND_API_KEY:emailReview ? 'review-only-no-real-email' : '',
  AUTH_EMAIL_FROM:'review@example.invalid',
  AUTH_PUBLIC_ORIGIN:'http://localhost:3014',
});
const app = next({ dev:true, hostname:'127.0.0.1', port:3014, conf:{ distDir:'.next-account-review', reactStrictMode:true } });
async function main() {
  await app.prepare();
  const handler = app.getRequestHandler();
  createServer((req, res) => {
    if (emailReview && req.url === '/__review/mail' && req.headers['x-review-only'] === 'local-review-fixture') {
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(messages.splice(0))); return;
    }
    void handler(req, res);
  }).listen(3014,'127.0.0.1',()=>console.log('Account review only: http://localhost:3014 — OAuth placeholders, isolated DB'));
}
void main();
