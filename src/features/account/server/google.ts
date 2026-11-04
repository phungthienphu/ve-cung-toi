import { getToken } from 'next-auth/jwt';
import { headers } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { AccountUser } from '@/server/models/AccountUser';
import { AccountToken } from '@/server/models/AccountSecurity';
import { withTransactionRetry } from '@/server/db/transaction';
import { digest } from './rate-limit';
import { normalizeEmail } from './password';
export const INTENT_COOKIE = 'vct_account_intent';

/** Never links by matching email. Only an authenticated, recent explicit intent can link. */
export async function handleGoogleIntent(profile: { sub?: string; email?: string; auth_time?: number }) {
  const jar = await cookies();
  const raw = jar.get(INTENT_COOKIE)?.value;
  if (!raw) return false;
  const current = await getToken({ req: { headers: await headers() }, secret: process.env.AUTH_SECRET!, secureCookie: process.env.NODE_ENV === 'production' });
  await completeGoogleIntent(raw, current ? { playerId: current.playerId, sessionVersion: current.sessionVersion } : null, profile);
  const intent = await AccountToken.findOne({ tokenHash: digest(raw), purpose: 'add-password' }).lean();
  if (!intent) jar.delete(INTENT_COOKIE);
  return true;
}

/** Separated from request cookies so security/race rules can be integration-tested. */
export async function completeGoogleIntent(raw: string, current: { playerId?: unknown; sessionVersion?: unknown } | null, profile: { sub?: string; email?: string; auth_time?: number }) {
  if (!/^[a-f0-9]{64}$/.test(raw)) throw new Error('Invalid linking intent');
  const tokenHash = digest(raw);
  const intent = await AccountToken.findOne({ tokenHash, expiresAt: { $gt: new Date() }, purpose: { $in: ['link-google', 'add-password'] } }).lean();
  if (!intent) throw new Error('Expired linking intent');
  if (current?.playerId !== intent.playerId || (current?.sessionVersion ?? 0) !== intent.sessionVersion) throw new Error('Linking session mismatch');
  if (intent.purpose === 'add-password' && (typeof profile.auth_time !== 'number' || profile.auth_time * 1000 < intent.createdAt.getTime() - 60000 || profile.auth_time * 1000 > Date.now() + 60000)) throw new Error('Google reauthentication required');
  await withTransactionRetry(async session => {
    const user = await AccountUser.findOne({ playerId: intent.playerId }).session(session);
    if (!user || (user.sessionVersion ?? 0) !== intent.sessionVersion || user.emailNormalized !== normalizeEmail(profile.email)) throw new Error('Google account mismatch');
    if (intent.purpose === 'add-password') {
      if (user.googleSubject !== profile.sub) throw new Error('Google subject mismatch');
      const proved = await AccountToken.updateOne({ _id: intent._id, provedAt: { $exists: false }, expiresAt: { $gt: new Date() } }, { $set: { provedAt: new Date(), expiresAt: new Date(Date.now() + 300000) } }, { session });
      if (!proved.modifiedCount) throw new Error('Reauthentication already used');
    } else {
      const proof = await AccountToken.findOneAndDelete({ _id: intent._id, expiresAt: { $gt: new Date() } }, { session });
      if (!proof || user.googleSubject) throw new Error('Invalid linking intent');
      if (await AccountUser.exists({ googleSubject: profile.sub }).session(session)) throw new Error('Google account already linked');
      user.googleSubject = profile.sub;
      await user.save({ session });
    }
  });
}


export async function findGoogleUser(profile: { sub: string; email?: string; name?: string; picture?: string }) {
  let user = await AccountUser.findOne({ googleSubject: profile.sub }).lean();
  if (user) return user;
  const email = normalizeEmail(profile.email);
  if (await AccountUser.exists({ $or: [{ emailNormalized: email }, { email }] })) throw new Error('Use the existing sign-in method and link Google in account security');
  try {
    user = (await AccountUser.create({ googleSubject: profile.sub, email, emailNormalized: email, emailVerifiedAt: new Date(), name: profile.name ?? '', image: profile.picture ?? '', playerId: randomBytes(5).toString('hex'), sessionVersion: 0 })).toObject();
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    user = await AccountUser.findOne({ googleSubject: profile.sub }).orFail().lean();
  }
  return user;
}
