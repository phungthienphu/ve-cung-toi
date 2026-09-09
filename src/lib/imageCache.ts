"use client";

// Tiny lazy-load-and-cache helper for the tank game's sprite assets (Kenney
// "Tanks" pack, public/Retina). A sprite is requested by src every frame;
// this avoids creating a new Image() each time and just returns whatever's
// already loaded (undefined until then — callers should skip drawing that
// frame rather than block on load).
const cache = new Map<string, HTMLImageElement>();

export function getSprite(src: string): HTMLImageElement | undefined {
  let img = cache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    cache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : undefined;
}
