import { HOME_GAMES } from '@/features/home/data/games';
/** Canonical room paths only: solo, friends and preview screens are not rooms. */
export function roomGame(path: string) {
  const parts = path.split('/');
  if (parts.length !== 3 || !/^[A-Z0-9_-]{4,12}$/.test(parts[2])) return undefined;
  const route = `/${parts[1]}`;
  return HOME_GAMES.find(game => (game.id === 'draw' ? '/room' : game.href) === route && !['fortune'].includes(game.id));
}
