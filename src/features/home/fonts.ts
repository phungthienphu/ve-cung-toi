import { Baloo_2, Be_Vietnam_Pro } from 'next/font/google';
const display = Baloo_2({ subsets: ['latin', 'vietnamese'], weight: ['700', '800'], variable: '--home-display' });
const body = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700'], variable: '--home-body' });
export const homeFonts = `${display.variable} ${body.variable}`;
