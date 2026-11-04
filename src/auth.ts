import { isAdminEmail } from '@/features/community/admin-access';
import { cookies } from 'next/headers';
import { INTENT_COOKIE } from '@/features/account/server/google';
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { dbConnect } from '@/server/db/mongodb';
import { AccountUser } from '@/server/models/AccountUser';
import { authEnabled, emailLoginEnabled, googleLoginEnabled } from '@/features/account/server/config';
import { checkPassword, normalizeEmail, normalizeUsername } from '@/features/account/server/password';
import { requestIp, takeLimit } from '@/features/account/server/rate-limit';
import { findGoogleUser, handleGoogleIntent } from '@/features/account/server/google';
export { authEnabled, emailLoginEnabled, googleLoginEnabled };

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: '/login', error: '/login' },
  providers: [
    ...(googleLoginEnabled ? [Google({ authorization: { params: { prompt: 'select_account' } } })] : []),
    ...(emailLoginEnabled ? [Credentials({
      credentials: { identifier: {}, password: {} },
      async authorize(credentials, request) {
        const identifier = typeof credentials.identifier === 'string' && credentials.identifier.length <= 254 ? credentials.identifier.trim().toLowerCase() : '';
        const password = typeof credentials.password === 'string' && credentials.password.length <= 128 ? credentials.password : '';
        await dbConnect();
        if (!await takeLimit('login-ip', requestIp(request.headers), 30, 900000) || !await takeLimit('login-id', identifier, 10, 900000)) return null;
        const user = await AccountUser.findOne(identifier.includes('@') ? { emailNormalized: normalizeEmail(identifier) } : { username: normalizeUsername(identifier) }).select('+passwordHash').lean();
        const matched = await checkPassword(user?.passwordHash, password);
        if (!user?.emailVerifiedAt || user.disabledAt || !matched) return null;
        return { id: user.playerId, playerId: user.playerId, name: user.name, email: user.email, image: user.image, sessionVersion: user.sessionVersion ?? 0 };
      },
    })] : []),
  ],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'credentials') return true;
      if (account?.provider !== 'google' || profile?.email_verified !== true || typeof profile.email !== 'string' || !profile.sub) return false;
      await dbConnect();
      try {
        if (await handleGoogleIntent({ sub: profile.sub, email: profile.email, auth_time: typeof profile.auth_time === 'number' ? profile.auth_time : undefined })) return '/account/security?google=done';
        await findGoogleUser(profile as { sub: string; email: string; name?: string; picture?: string });
        return true;
      } catch { (await cookies()).delete(INTENT_COOKIE); return '/login?error=AccountLink'; }
    },
    async jwt({ token, account, profile, user }) {
      await dbConnect();
      if (account?.provider === 'credentials' && user) {
        token.playerId = user.playerId; token.sessionVersion = user.sessionVersion;
      } else if (account?.provider === 'google' && profile?.sub) {
        const owner = await AccountUser.findOne({ googleSubject: profile.sub }).orFail().lean();
        token.playerId = owner.playerId; token.sessionVersion = owner.sessionVersion ?? 0;
      }
      if (typeof token.playerId !== 'string') return null;
      const owner = await AccountUser.findOne({ playerId: token.playerId }).lean();
      if (!owner || owner.disabledAt || (owner.sessionVersion ?? 0) !== (token.sessionVersion ?? 0)) return null;
      token.name = owner.name; token.email = owner.email; token.picture = owner.image;
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.playerId === 'string') {
        session.user.playerId = token.playerId;
        session.user.isAdmin = isAdminEmail(token.email);
        session.user.sessionVersion = typeof token.sessionVersion === 'number' ? token.sessionVersion : 0;
      }
      return session;
    },
    redirect({ url, baseUrl }) {
      if (url.startsWith('/') && !url.startsWith('//') && !url.includes('\\')) return `${baseUrl}${url}`;
      try { if (new URL(url).origin === baseUrl) return url; } catch { /* Invalid redirect. */ }
      return baseUrl;
    },
  },
});
