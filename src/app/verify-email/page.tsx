import type { Metadata } from 'next';
import { AuthPage } from '@/features/account/components/AuthPage';
export const metadata: Metadata = { title: 'Xác minh email', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';
export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) { return <AuthPage mode="verify" searchParams={searchParams} />; }
