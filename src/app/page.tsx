import HomePage from '@/features/home/components/HomePage';
import { homeFonts } from '@/features/home/fonts';
import { newsPage } from '@/features/home/data/news';
import '@/features/home/home.css';

// The homepage shell never waits for database queries. Dynamic cards load separately.
export default function GamePickerPage() {
  return <div className={homeFonts}><HomePage initialNews={newsPage()!} /></div>;
}
