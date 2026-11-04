/** Local-only fixtures; these OAuth/JWT values must never be used for deployment. */
import { createServer } from 'node:http';
import next from 'next';
if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('Account review server is local-only');
const guestOnly = process.argv.includes('--guest-only');
Object.assign(process.env, {
  MONGODB_DB_NAME:'vct_account_review_20261104',
  AUTH_GOOGLE_ID:guestOnly ? '' : 'review-only',
  AUTH_GOOGLE_SECRET:guestOnly ? '' : 'review-only',
  AUTH_SECRET:guestOnly ? '' : 'account-review-only-secret-not-for-production',
  AUTH_URL:'http://localhost:3014',
  AUTH_TRUST_HOST:'true',
});
const app = next({ dev:true, hostname:'127.0.0.1', port:3014, conf:{ distDir:'.next-account-review', reactStrictMode:true } });
async function main() {
  await app.prepare();
  createServer(app.getRequestHandler()).listen(3014,'127.0.0.1',()=>console.log('Account review only: http://localhost:3014 — OAuth placeholders, isolated DB'));
}
void main();
