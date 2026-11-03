import localFont from 'next/font/local';

const display = localFont({
  src: './assets/fonts/baloo-2-800.ttf',
  weight: '800',
  display: 'swap',
  variable: '--home-display',
});
const body = localFont({
  src: [
    { path: './assets/fonts/be-vietnam-pro-400.ttf', weight: '400' },
    { path: './assets/fonts/be-vietnam-pro-500.ttf', weight: '500' },
    { path: './assets/fonts/be-vietnam-pro-600.ttf', weight: '600' },
    { path: './assets/fonts/be-vietnam-pro-700.ttf', weight: '700' },
  ],
  display: 'swap',
  variable: '--home-body',
});
export const homeFonts = `${display.variable} ${body.variable}`;
