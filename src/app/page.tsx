import HomePage from '@/features/home/components/HomePage';
import { homeFonts } from '@/features/home/fonts';
import { newsPage } from '@/features/home/data/news';
import '@/features/home/home.css';

export default function GamePickerPage() {
  return <div className={homeFonts}><HomePage initialNews={newsPage()!} /></div>;
}
