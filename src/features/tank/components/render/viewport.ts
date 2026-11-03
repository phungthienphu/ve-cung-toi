import { useEffect, useState } from 'react';
import { TILE_SIZE } from '@shared/tank/types';

// Camera framing only; simulation and weapon ranges stay unchanged.
export const VIEWPORT_W = 19 * TILE_SIZE;
export const VIEWPORT_H = 9 * TILE_SIZE;

export function useTankViewport() {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width:600px) and (orientation:portrait)');
    const update = () => setPortrait(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return portrait ? { width: 12 * TILE_SIZE, height: 18 * TILE_SIZE } : { width: VIEWPORT_W, height: VIEWPORT_H };
}
