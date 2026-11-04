/** Read-only by default. Run --apply only after backup and review of the audit. */
import { config } from 'dotenv';
import mongoose from 'mongoose';
config({ path: '.env.local', quiet: true });
export async function migrateAccountAuth(apply = false) {
  const { dbConnect } = await import('../src/server/db/mongodb');
  const { AccountUser } = await import('../src/server/models/AccountUser');
  await dbConnect();
  const collection = AccountUser.collection;
  const duplicates = await collection.aggregate([
    { $match: { email: { $type: 'string' } } },
    { $project: { normalized: { $toLower: { $trim: { input: '$email' } } } } },
    { $group: { _id: '$normalized', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }, { $count: 'count' },
  ]).toArray();
  const missing = await collection.countDocuments({ $or: [{ email: { $exists: false } }, { email: null }, { email: '' }] });
  const unknown = await collection.countDocuments({ googleSubject: { $not: { $type: 'string' } }, emailVerifiedAt: null });
  const report = { duplicateEmailGroups: duplicates[0]?.count ?? 0, missingEmails: missing, unverifiedWithoutGoogle: unknown, apply };
  console.log('Account auth migration audit (no private data):', report);
  if (report.duplicateEmailGroups || missing || unknown) throw new Error('Resolve the audit before enabling credentials; no accounts were merged or deleted.');
  if (!apply) return;
  // Existing app only accepted verified Google identities. Do not mark records
  // from unknown imports as verified: review provenance before --apply.
  await collection.updateMany({ email: { $type: 'string' } }, [
    { $set: { emailNormalized: { $toLower: { $trim: { input: '$email' } } }, sessionVersion: { $ifNull: ['$sessionVersion', 0] } } },
  ]);
  await collection.updateMany({ googleSubject: { $type: 'string' }, emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } });
  await collection.updateMany({ googleSubject: null }, { $unset: { googleSubject: '' } });
  await AccountUser.createCollection();
  const indexes = await collection.indexes();
  const google = indexes.find(index => index.name === 'googleSubject_1');
  if (google && !google.partialFilterExpression) await collection.dropIndex('googleSubject_1');
  await AccountUser.createIndexes();
  const { AccountRegistration, AccountToken, AuthRateLimit } = await import('../src/server/models/AccountSecurity');
  await Promise.all([AccountRegistration.createIndexes(), AccountToken.createIndexes(), AuthRateLimit.createIndexes()]);
  console.log('Migration complete. Player IDs and progress preserved.');
}
if (process.argv[1]?.endsWith('account-auth-migrate.ts')) {
  migrateAccountAuth(process.argv.includes('--apply')).catch(error => { console.error('Migration stopped:', { name: error?.name, code: error?.code }); process.exitCode = 1; }).finally(() => mongoose.disconnect());
}
