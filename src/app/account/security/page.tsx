import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth, authEnabled } from '@/auth';
import { emailLoginEnabled, googleLoginEnabled } from '@/features/account/server/config';
import { AccountUser } from '@/server/models/AccountUser';
import { AccountToken } from '@/server/models/AccountSecurity';
import { dbConnect } from '@/server/db/mongodb';
import { INTENT_COOKIE } from '@/features/account/server/google';
import { digest } from '@/features/account/server/rate-limit';
import { homeFonts } from '@/features/home/fonts';
import { AuthSurface } from '@/features/account/components/AuthSurface';
import { AuthForm } from '@/features/account/components/AuthForm';
import '@/features/account/components/auth-pages.css';
export const metadata: Metadata = { title: 'Bảo mật tài khoản', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function SecurityPage() {
  const session = authEnabled ? await auth() : null;
  if (!session?.user?.playerId) redirect('/login?next=/account/security');
  await dbConnect();
  const user = await AccountUser.findOne({ playerId: session.user.playerId }).select('+passwordHash').orFail().lean();
  const raw = (await cookies()).get(INTENT_COOKIE)?.value;
  const proved = raw ? !!await AccountToken.exists({ tokenHash: digest(raw), purpose: 'add-password', playerId: user.playerId, sessionVersion: session.user.sessionVersion, expiresAt: { $gt: new Date() }, provedAt: { $gt: new Date(Date.now() - 300000) } }) : false;
  return <AuthSurface fonts={homeFonts} backHref="/profile" backLabel="Về hồ sơ"><AuthForm mode="security" emailEnabled={emailLoginEnabled} googleEnabled={googleLoginEnabled} hasPassword={!!user.passwordHash} hasGoogle={!!user.googleSubject} email={user.email} username={user.username ?? undefined} proved={proved} /></AuthSurface>;
}
