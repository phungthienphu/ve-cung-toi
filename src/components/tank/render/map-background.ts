// Everything about drawing the map itself: the static floor/wall/road
// background (cached per map id), the minimap, and the animated bushes/
// hazards/monster-nest decals that live on top of it.

import {
  BUSH_REVEAL_RADIUS,
  NEST_PUDDLE_RADIUS,
  TILE_SIZE,
  VIEWPORT_H,
  VIEWPORT_W,
  getMap,
  mapCanvasSize,
  type TankPlayer,
  type TankPublicState,
  type TankTimeOfDay,
} from "@shared/tankTypes";
import { getSprite } from "@/lib/imageCache";
import { mulberry32 } from "./sprite-utils";

export function clampCamera(pos: number, viewport: number, mapSize: number): number {
  const half = viewport / 2;
  if (mapSize <= viewport) return mapSize / 2;
  return Math.min(Math.max(pos, half), mapSize - half);
}

export function tileCharAt(m: ReturnType<typeof getMap>, x: number, y: number): string {
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  return m.layout[row]?.[col] ?? "#";
}

/** Same "server sends everything, client just doesn't render it" trick used
 * for the blind item's fog-of-war: bushes and smoke hide enemy tanks standing
 * in them unless the viewer is close enough to have spotted them anyway. */
export function isCoverHidden(m: ReturnType<typeof getMap>, target: TankPlayer, self: TankPlayer): boolean {
  const tile = tileCharAt(m, target.x, target.y);
  if (tile !== "B" && tile !== "S") return false;
  return Math.hypot(target.x - self.x, target.y - self.y) > BUSH_REVEAL_RADIUS;
}

function isWallTile(m: ReturnType<typeof getMap>, row: number, col: number): boolean {
  return (m.layout[row]?.[col] ?? "#") === "#";
}

function isRoadTile(m: ReturnType<typeof getMap>, row: number, col: number): boolean {
  return m.layout[row]?.[col] === "R";
}

/** Picks the right connected-road sprite name (Kenney "Tanks" pack naming)
 * for a road tile based on which of its 4 orthogonal neighbors are also
 * road — a straight, corner, T-junction ("Split"), or 4-way crossing. */
function roadTileName(n: boolean, s: boolean, e: boolean, w: boolean): string {
  const count = [n, s, e, w].filter(Boolean).length;
  if (count >= 4) return "roadCrossing";
  if (count === 3) {
    if (!s) return "roadSplitN";
    if (!n) return "roadSplitS";
    if (!w) return "roadSplitE";
    return "roadSplitW";
  }
  if (count === 2) {
    if (n && s) return "roadNorth";
    if (e && w) return "roadEast";
    if (n && w) return "roadCornerUL";
    if (n && e) return "roadCornerUR";
    if (s && w) return "roadCornerLL";
    if (s && e) return "roadCornerLR";
  }
  // Dead-end or isolated tile: fall back to whichever straight piece matches
  // the one connection it does have (the pack has no dedicated end-cap art).
  if (n || s) return "roadNorth";
  return "roadEast";
}

function drawEdgeTufts(ctx: CanvasRenderingContext2D, x: number, y: number, side: "top" | "bottom" | "left" | "right", rng: () => number) {
  ctx.strokeStyle = "rgba(21,128,61,0.6)";
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const t = 4 + rng() * (TILE_SIZE - 8);
    const len = 6 + rng() * 3;
    let bx = x;
    let by = y;
    let dx = 0;
    let dy = 0;
    if (side === "top") {
      bx = x + t;
      by = y + 2;
      dy = len;
    } else if (side === "bottom") {
      bx = x + t;
      by = y + TILE_SIZE - 2;
      dy = -len;
    } else if (side === "left") {
      bx = x + 2;
      by = y + t;
      dx = len;
    } else {
      bx = x + TILE_SIZE - 2;
      by = y + t;
      dx = -len;
    }
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + dx, by + dy);
    ctx.stroke();
  }
}

/**
 * Pre-renders the whole map's static ground/walls to an offscreen canvas
 * once per map (cached by mapId) — real Kenney floor tiles (grass or sand,
 * per the map's `terrain`) plus procedural wall shading and hazard tint, no
 * per-tile grid lines. Bushes/trees and hazard glow are animated, so those
 * are drawn live every frame instead. Returns null (and draws nothing) if
 * the floor tile sprites haven't finished loading yet — the caller should
 * fall back to a plain fill and retry next frame rather than cache a blank.
 */
export function buildMapBackground(m: ReturnType<typeof getMap>): HTMLCanvasElement | null {
  const floorSrcs =
    m.terrain === "sand" ? ["/Retina/tileSand1.png", "/Retina/tileSand2.png"] : ["/Retina/tileGrass1.png", "/Retina/tileGrass2.png"];
  const floorTiles = floorSrcs.map(getSprite);
  if (floorTiles.some((img) => !img)) return null;
  const hasIce = m.layout.some((row) => row.includes("I"));
  const iceTiles = [getSprite("/ices/iceBlock.png"), getSprite("/ices/iceBlockAlt.png")];
  if (hasIce && iceTiles.some((img) => !img)) return null;

  // Only this map's actually-used road variants need to be ready — gating on
  // the full 18-sprite set would delay every map's first paint needlessly.
  const roadPrefix = m.terrain === "sand" ? "tileSand" : "tileGrass";
  const neededRoadSrcs = new Set<string>();
  for (let row = 0; row < m.layout.length; row++) {
    for (let col = 0; col < m.layout[row].length; col++) {
      if (!isRoadTile(m, row, col)) continue;
      const name = roadTileName(isRoadTile(m, row - 1, col), isRoadTile(m, row + 1, col), isRoadTile(m, row, col + 1), isRoadTile(m, row, col - 1));
      neededRoadSrcs.add(`/Retina/${roadPrefix}_${name}.png`);
    }
  }
  if ([...neededRoadSrcs].some((src) => !getSprite(src))) return null;

  const { w, h } = mapCanvasSize(m);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  for (let row = 0; row < m.layout.length; row++) {
    for (let col = 0; col < m.layout[row].length; col++) {
      const tile = m.layout[row][col];
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;
      const rng = mulberry32(row * 7919 + col * 104729);

      if (tile === "#") {
        // Ground shows underneath (sandbag art doesn't fill a perfect square),
        // then a real sandbag sprite as the obstacle itself.
        ctx.drawImage(floorTiles[rng() > 0.5 ? 1 : 0]!, x, y, TILE_SIZE, TILE_SIZE);
        const wallImg = getSprite(rng() > 0.5 ? "/Retina/sandbagBeige.png" : "/Retina/sandbagBrown.png");
        if (wallImg) {
          ctx.drawImage(wallImg, x - 1, y - 1, TILE_SIZE + 2, TILE_SIZE + 2);
        } else {
          ctx.fillStyle = "#8a7355";
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        }
        // Soft contact shadow where this wall meets open floor, for depth.
        if (!isWallTile(m, row - 1, col)) {
          ctx.fillStyle = "rgba(255,255,255,0.14)";
          ctx.fillRect(x, y, TILE_SIZE, 3);
        }
        if (!isWallTile(m, row + 1, col)) {
          ctx.fillStyle = "rgba(0,0,0,0.28)";
          ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
        }
        continue;
      }

      const floorImg = floorTiles[rng() > 0.75 ? 1 : 0]!;
      ctx.drawImage(floorImg, x, y, TILE_SIZE, TILE_SIZE);

      if (tile === "R") {
        const prefix = m.terrain === "sand" ? "tileSand" : "tileGrass";
        const name = roadTileName(isRoadTile(m, row - 1, col), isRoadTile(m, row + 1, col), isRoadTile(m, row, col + 1), isRoadTile(m, row, col - 1));
        const roadImg = getSprite(`/Retina/${prefix}_${name}.png`);
        if (roadImg) ctx.drawImage(roadImg, x, y, TILE_SIZE, TILE_SIZE);
      }

      if (tile === "H") {
        ctx.fillStyle = "rgba(127,29,29,0.16)";
        ctx.beginPath();
        ctx.ellipse(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 2 - 2, TILE_SIZE / 2 - 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (tile === "I") {
        // The supplied ice block has transparent rounded corners. A matching
        // underlay keeps adjacent I cells visually continuous at tile scale.
        ctx.fillStyle = "#8addec";
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        const iceImg = iceTiles[(row + col) % iceTiles.length];
        if (iceImg) ctx.drawImage(iceImg, x, y, TILE_SIZE, TILE_SIZE);
      }

      if (isWallTile(m, row - 1, col)) drawEdgeTufts(ctx, x, y, "top", rng);
      if (isWallTile(m, row + 1, col)) drawEdgeTufts(ctx, x, y, "bottom", rng);
      if (isWallTile(m, row, col - 1)) drawEdgeTufts(ctx, x, y, "left", rng);
      if (isWallTile(m, row, col + 1)) drawEdgeTufts(ctx, x, y, "right", rng);

      // Scattered twig/pebble litter on plain floor tiles — purely decorative
      // ground clutter, baked into the static background so it costs nothing
      // per frame. Sparse (~1 in 9 tiles) so it reads as texture, not noise.
      if (tile === "." && rng() < 0.11) {
        const twigImg = getSprite(m.terrain === "sand" ? "/Retina/treeBrown_twigs.png" : "/Retina/treeGreen_twigs.png");
        if (twigImg) {
          const size = TILE_SIZE * 0.7;
          ctx.save();
          ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2);
          ctx.rotate(rng() * Math.PI * 2);
          ctx.drawImage(twigImg, -size / 2, -size / 2, size, size);
          ctx.restore();
        }
      }
    }
  }
  // A light overall darkening so bright foreground elements (bullets, tanks,
  // pickups) read clearly against the floor art instead of blending into it.
  ctx.fillStyle = "rgba(15,23,42,0.12)";
  ctx.fillRect(0, 0, w, h);
  return canvas;
}

export const MINIMAP_W = 110;
export const MINIMAP_H = 82;

/** Small always-visible overview of the whole map — walls, hazards, every
 * tank's dot, and a frame showing the main camera's current viewport. */
// The minimap's walls/hazards/bushes never change during a match — pre-
// render them once per map instead of re-scanning every tile every frame.
const minimapBgCache = new Map<string, HTMLCanvasElement>();
function getMinimapBackground(m: ReturnType<typeof getMap>): HTMLCanvasElement {
  const cached = minimapBgCache.get(m.id);
  if (cached) return cached;

  const { w: mapW, h: mapH } = mapCanvasSize(m);
  const scaleX = MINIMAP_W / mapW;
  const scaleY = MINIMAP_H / mapH;
  const off = document.createElement("canvas");
  off.width = MINIMAP_W;
  off.height = MINIMAP_H;
  const octx = off.getContext("2d")!;
  octx.fillStyle = "#0f172a";
  octx.fillRect(0, 0, MINIMAP_W, MINIMAP_H);

  for (let row = 0; row < m.layout.length; row++) {
    for (let col = 0; col < m.layout[row].length; col++) {
      const tile = m.layout[row][col];
      if (tile === "#") octx.fillStyle = "#475569";
      else if (tile === "H") octx.fillStyle = "#dc2626";
      else if (tile === "B") octx.fillStyle = "#166534";
      else if (tile === "I") octx.fillStyle = "#7dd3fc";
      else if (tile === "S") octx.fillStyle = "#94a3b8";
      else continue;
      octx.fillRect(col * TILE_SIZE * scaleX, row * TILE_SIZE * scaleY, TILE_SIZE * scaleX + 0.5, TILE_SIZE * scaleY + 0.5);
    }
  }
  minimapBgCache.set(m.id, off);
  return off;
}

export function drawMinimap(
  canvas: HTMLCanvasElement | null,
  s: TankPublicState,
  m: ReturnType<typeof getMap>,
  selfId: string,
  camX: number,
  camY: number
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { w: mapW, h: mapH } = mapCanvasSize(m);
  const scaleX = MINIMAP_W / mapW;
  const scaleY = MINIMAP_H / mapH;

  ctx.clearRect(0, 0, MINIMAP_W, MINIMAP_H);
  ctx.drawImage(getMinimapBackground(m), 0, 0);

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect((camX - VIEWPORT_W / 2) * scaleX, (camY - VIEWPORT_H / 2) * scaleY, VIEWPORT_W * scaleX, VIEWPORT_H * scaleY);

  ctx.fillStyle = "#92400e";
  for (const crate of s.crates) {
    ctx.fillRect(crate.x * scaleX - 1.5, crate.y * scaleY - 1.5, 3, 3);
  }

  for (const monster of s.monsters) {
    if (!monster.alive) continue;
    ctx.fillStyle = "#a855f7";
    const mx = monster.x * scaleX;
    const my = monster.y * scaleY;
    ctx.beginPath();
    ctx.moveTo(mx, my - 2.5);
    ctx.lineTo(mx + 2.5, my);
    ctx.lineTo(mx, my + 2.5);
    ctx.lineTo(mx - 2.5, my);
    ctx.closePath();
    ctx.fill();
  }

  const self = s.players.find((candidate) => candidate.id === selfId);
  for (const p of s.players) {
    if (!p.alive) continue;
    const isAlly = p.id === selfId || (s.mode === "team" && !!self && p.team === self.team);
    if (!isAlly && self && isCoverHidden(m, p, self)) continue;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x * scaleX, p.y * scaleY, p.id === selfId ? 3 : 2.2, 0, Math.PI * 2);
    ctx.fill();
    if (p.id === selfId) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

/** Persistent smoke cover. Adjacent cells overlap slightly so a cluster
 * reads as one tactical cloud instead of separate square decals. */
export function drawSmoke(ctx: CanvasRenderingContext2D, tileX: number, tileY: number, row: number, col: number, time: number, opacity: number) {
  const rng = mulberry32(row * 7919 + col * 104729 + 83);
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const baseX = tileX + (0.1 + rng() * 0.8) * TILE_SIZE;
    const baseY = tileY + (0.15 + rng() * 0.7) * TILE_SIZE;
    const radius = TILE_SIZE * (0.28 + rng() * 0.2);
    const phase = time / (850 + rng() * 500) + i * 1.7 + row;
    const x = baseX + Math.sin(phase) * 3;
    const y = baseY + Math.cos(phase * 0.8) * 2;
    const grad = ctx.createRadialGradient(x, y, radius * 0.12, x, y, radius);
    grad.addColorStop(0, `rgba(241,245,249,${opacity * 0.9})`);
    grad.addColorStop(0.58, `rgba(148,163,184,${opacity * 0.72})`);
    grad.addColorStop(1, "rgba(71,85,105,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawHazardSpikes(ctx: CanvasRenderingContext2D, tileX: number, tileY: number, time: number) {
  const pulse = 0.5 + 0.5 * Math.sin(time / 300);
  const cx0 = tileX + TILE_SIZE / 2;
  const cy0 = tileY + TILE_SIZE / 2;
  const glow = ctx.createRadialGradient(cx0, cy0, 2, cx0, cy0, TILE_SIZE / 2);
  glow.addColorStop(0, `rgba(248,113,113,${0.32 + 0.22 * pulse})`);
  glow.addColorStop(1, "rgba(248,113,113,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(tileX, tileY, TILE_SIZE, TILE_SIZE);

  const spikeCount = 3;
  const spikeW = TILE_SIZE / spikeCount;
  for (let i = 0; i < spikeCount; i++) {
    const cx = tileX + spikeW * i + spikeW / 2;
    const tip = tileY + 5 - pulse * 1.5;
    const grad = ctx.createLinearGradient(cx, tip, cx, tileY + TILE_SIZE - 3);
    grad.addColorStop(0, "#fca5a5");
    grad.addColorStop(1, "#b91c1c");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - spikeW / 2 + 2, tileY + TILE_SIZE - 3);
    ctx.lineTo(cx, tip);
    ctx.lineTo(cx + spikeW / 2 - 2, tileY + TILE_SIZE - 3);
    ctx.closePath();
    ctx.fill();
  }
}

/** Marks a monster's nest on the ground — a muddy puddle, present even while
 * the monster is dead/respawning so the territory always reads as claimed.
 * Also mechanically douses a burning tank that steps into it. */
export function drawNestPuddle(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const ripple = 0.5 + 0.5 * Math.sin(time / 700);
  ctx.save();
  ctx.fillStyle = "rgba(87,65,45,0.55)";
  ctx.beginPath();
  ctx.ellipse(x, y, NEST_PUDDLE_RADIUS, NEST_PUDDLE_RADIUS * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(96,165,250,${0.25 + 0.1 * ripple})`;
  ctx.beginPath();
  ctx.ellipse(x, y, NEST_PUDDLE_RADIUS * 0.65, NEST_PUDDLE_RADIUS * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(191,219,254,${0.3 + 0.2 * ripple})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, NEST_PUDDLE_RADIUS * (0.3 + 0.25 * ripple), NEST_PUDDLE_RADIUS * (0.2 + 0.16 * ripple), 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export interface BushBias {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export function bushNeighborBias(m: ReturnType<typeof getMap>, row: number, col: number): BushBias {
  return {
    top: isWallTile(m, row - 1, col),
    bottom: isWallTile(m, row + 1, col),
    left: isWallTile(m, row, col - 1),
    right: isWallTile(m, row, col + 1),
  };
}

const BUSH_SPRITES = ["/Retina/treeGreen_large.png", "/Retina/treeGreen_small.png", "/Retina/treeBrown_large.png"];

/**
 * Real tree/bush sprite, deterministically picked+placed per tile (row/col)
 * so it stays stable frame to frame — only the `time`-driven sway moves.
 * `bias` nudges it toward any adjacent wall so it reads as growing out of
 * the terrain instead of floating mid-tile. `opacity` lets the same call be
 * reused as a lighter "foliage in front" overlay for whichever tank is
 * currently standing in this tile (so you can see yourself under the leaves).
 */
export function drawBush(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  row: number,
  col: number,
  bias: BushBias,
  time: number,
  opacity: number
) {
  const rng = mulberry32(row * 7919 + col * 104729 + 17);
  const img = getSprite(BUSH_SPRITES[Math.floor(rng() * BUSH_SPRITES.length)]);
  const dx = bias.left ? -4 : bias.right ? 4 : 0;
  const dy = bias.top ? -4 : bias.bottom ? 4 : 0;
  const cx = tileX + TILE_SIZE / 2 + dx;
  const cy = tileY + TILE_SIZE / 2 + dy;
  const sway = Math.sin(time / 650 + row * 2.1 + col * 1.7) * 0.06;

  ctx.save();
  ctx.globalAlpha = opacity;
  if (img) {
    const size = TILE_SIZE * 1.2;
    ctx.translate(cx, cy + size * 0.3);
    ctx.rotate(sway);
    ctx.drawImage(img, -size / 2, -size * 0.8, size, size);
  } else {
    ctx.fillStyle = "#166534";
    ctx.beginPath();
    ctx.arc(cx, cy, TILE_SIZE * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** One of TANK_TIME_OF_DAY, rolled once per match server-side (see
 * tank-server.ts's handleStartGame) so every viewer sees the same lighting.
 * Drawn in screen space over the whole viewport, after the world content but
 * before the blind item's fog-of-war overlay — blind stays fully dominant
 * regardless of the ambient lighting underneath it. "day" draws nothing. */
export function drawTimeOfDayOverlay(ctx: CanvasRenderingContext2D, timeOfDay: TankTimeOfDay) {
  if (timeOfDay === "day") return;
  ctx.save();
  if (timeOfDay === "sunset") {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEWPORT_H);
    grad.addColorStop(0, "rgba(251,146,60,0.16)");
    grad.addColorStop(1, "rgba(190,24,93,0.16)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
  } else {
    // night
    ctx.fillStyle = "rgba(15,23,42,0.42)";
    ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
    const vignette = ctx.createRadialGradient(
      VIEWPORT_W / 2,
      VIEWPORT_H / 2,
      VIEWPORT_H * 0.25,
      VIEWPORT_W / 2,
      VIEWPORT_H / 2,
      VIEWPORT_H * 0.72
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
  }
  ctx.restore();
}
