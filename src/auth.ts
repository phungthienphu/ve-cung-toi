import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { randomBytes } from 'node:crypto';
import { dbConnect } from '@/server/db/mongodb';
import { AccountUser } from '@/server/models/AccountUser';

export const googleLoginEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: googleLoginEnabled ? [Google] : [],
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async signIn({ account, profile }) {
      return account?.provider === 'google' && profile?.email_verified === true && typeof profile.email === 'string' && !!profile.sub;
    },
    async jwt({ token, account, profile }) {
      if (account?.provider === 'google' && profile?.sub) {
        await dbConnect();
        await AccountUser.init();
        // Google subject is the identity; email changes never create/link accounts.
        const update = { $set: { email: profile.email, name: profile.name ?? '', image: profile.picture ?? '' },
          $setOnInsert: { playerId: randomBytes(5).toString('hex') } };
        let user;
        try { user = await AccountUser.findOneAndUpdate({ googleSubject: profile.sub }, update, { upsert: true, new: true }).lean(); }
        catch (error) {
          if ((error as { code?: number }).code !== 11000) throw error;
          user = await AccountUser.findOne({ googleSubject: profile.sub }).orFail().lean();
        }
        token.playerId = user!.playerId;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.playerId === 'string') session.user.playerId = token.playerId;
      return session;
    },
  },
});
