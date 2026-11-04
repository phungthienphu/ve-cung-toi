/** Additive indexes only. Never drop or synchronize existing indexes. */
import { config } from 'dotenv';
import mongoose from 'mongoose';
config({ path: '.env.local', quiet: true });
async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required');
  const test = process.argv.includes('--test');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: test ? 'vct_account_review_20261104' : process.env.MONGODB_DB_NAME || undefined });
  try {
    const specs = [
      ['friendships', { from: 1, status: 1 }], ['friendships', { to: 1, status: 1 }],
      ['playerblocks', { to: 1, from: 1 }],
      ['chatmessages', { from: 1, to: 1, createdAt: -1, _id: -1 }],
      ['chatmessages', { to: 1, from: 1, createdAt: -1, _id: -1 }],
      ['chatmessages', { to: 1, readAt: 1, from: 1 }],
      ['roominvites', { to: 1, readAt: 1, expiresAt: 1 }],
    ] as const;
    for (const [name, key] of specs) {
      await mongoose.connection.db!.collection(name).createIndex(key);
      console.log(`Ready: ${name} (${Object.keys(key).join(', ')})`);
    }
  } finally { await mongoose.disconnect(); }
}
main().catch(() => { console.error('Community index migration failed; credentials omitted.'); process.exitCode = 1; });
