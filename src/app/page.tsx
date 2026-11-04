import { dbConnect } from '@/server/db/mongodb';
import { GameSetting } from '@/server/models/Community';
import HomePage from '@/features/home/components/HomePage';
import { homeFonts } from '@/features/home/fonts';
import { newsPage } from '@/features/home/data/news';
import '@/features/home/home.css';

export default async function GamePickerPage() {
  let disabledGames: string[] = [];
  try { await dbConnect(); disabledGames = (await GameSetting.find({ enabled: false }).lean()).map(g => g.gameId as string); } catch { /* Guest homepage remains available. */ }
  return <div className={homeFonts}><HomePage disabledGames={disabledGames} initialNews={newsPage()!} /></div>;
}
