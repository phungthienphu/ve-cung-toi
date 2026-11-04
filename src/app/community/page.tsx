import { AuthSurface } from '@/features/account/components/AuthSurface';
import { homeFonts } from '@/features/home/fonts';
import { CommunityPanel } from '@/features/community/CommunityPanel';
import '@/features/account/components/auth-pages.css';
export default async function Page(){ return <AuthSurface fonts={homeFonts} wide><CommunityPanel /></AuthSurface>; }
