import * as THREE from "three";
import { JOKER, MAX_SEATS, SKILLS, SKILL_ORDER, isSkill, skillOf, type SkillType } from "@shared/oldMaidTypes";
import { drawCard } from "@/components/cards/shareCard";

// Everything the 3D table shares: card textures (one atlas painted on a
// canvas at runtime — no image files), geometry, materials, and where things
// sit round the table.

export const CARD_W = 0.62;
export const CARD_H = CARD_W * 1.4;

export const TABLE_R = 3;
export const TABLE_TOP = 0.8;
export const SEAT_R = 4.15;
/** A hand held at rest: chest high, clear of the pig's snout even while it leans in to draw. */
export const FAN_R = 3.3;
export const FAN_Y = 1.4;
export const EYE_Y = 2.2;

const COLS = 11;
const ROWS = 6;
const CELL_W = 160;
const CELL_H = 224;
const BACK_CELL = 53;
/** The six skill faces follow the back. */
const SKILL_CELL = 54;

function roundedCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, w * 0.1);
}

/** The pig jester: the card nobody wants. */
function drawJoker(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  const h = w * 1.4;
  const paper = ctx.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
  paper.addColorStop(0, "#ffe4ee");
  paper.addColorStop(1, "#ffb3cb");
  ctx.fillStyle = paper;
  roundedCard(ctx, cx, cy, w, h);
  ctx.fill();
  ctx.strokeStyle = "#d61f6b";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = "rgba(214, 31, 107, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2 + 8, cy - h / 2 + 8, w - 16, h - 16, w * 0.07);
  ctx.stroke();
  // Jester hat: three floppy points with bells.
  const hatY = cy - h * 0.2;
  const colors = ["#7c3aed", "#f59e0b", "#16a34a"];
  [-1, 0, 1].forEach((side, index) => {
    ctx.fillStyle = colors[index];
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, hatY + 6);
    ctx.quadraticCurveTo(cx + side * w * 0.2, hatY - h * 0.2, cx + side * w * 0.32, hatY - h * 0.14 + Math.abs(side) * 10);
    ctx.lineTo(cx + w * 0.2, hatY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(cx + side * w * 0.32, hatY - h * 0.14 + Math.abs(side) * 10, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${w * 0.5}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText("🐷", cx, cy + h * 0.04);
  ctx.fillStyle = "#be185d";
  ctx.font = `900 ${w * 0.17}px Georgia, serif`;
  ctx.fillText("HEO", cx, cy + h * 0.33);
  ctx.font = `800 ${w * 0.1}px Georgia, serif`;
  for (const flip of [false, true]) {
    ctx.save();
    ctx.translate(cx, cy);
    if (flip) ctx.rotate(Math.PI);
    ctx.fillText("J", -w / 2 + w * 0.12, -h / 2 + h * 0.08);
    ctx.fillText("O", -w / 2 + w * 0.12, -h / 2 + h * 0.15);
    ctx.fillText("K", -w / 2 + w * 0.12, -h / 2 + h * 0.22);
    ctx.restore();
  }
}

/** Card back: deep red with a gold lattice and a pig snout medallion. */
function drawBack(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number) {
  const h = w * 1.4;
  ctx.save();
  roundedCard(ctx, cx, cy, w, h);
  const red = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  red.addColorStop(0, "#9f1239");
  red.addColorStop(1, "#5c0b22");
  ctx.fillStyle = red;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = "rgba(224, 184, 74, 0.28)";
  ctx.lineWidth = 2;
  for (let offset = -h; offset < w + h; offset += 16) {
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + offset, cy - h / 2);
    ctx.lineTo(cx - w / 2 + offset - h, cy + h / 2);
    ctx.moveTo(cx - w / 2 + offset - h, cy - h / 2);
    ctx.lineTo(cx - w / 2 + offset, cy + h / 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "#fff4dc";
  ctx.lineWidth = 7;
  roundedCard(ctx, cx, cy, w - 7, h - 7);
  ctx.stroke();
  ctx.strokeStyle = "#e0b84a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2 + 12, cy - h / 2 + 12, w - 24, h - 24, 8);
  ctx.stroke();
  // Snout medallion.
  ctx.fillStyle = "#2a0610";
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e0b84a";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#f7a8b8";
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.14, w * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#7a2440";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * w * 0.05, cy, w * 0.028, w * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A skill card: violet with a gold frame, the skill's icon big in the middle, its name and what it does. */
function drawSkill(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, type: SkillType) {
  const h = w * 1.4;
  const skill = SKILLS[type];
  const paper = ctx.createLinearGradient(cx, cy - h / 2, cx, cy + h / 2);
  paper.addColorStop(0, "#7c3aed");
  paper.addColorStop(1, "#3b0764");
  ctx.fillStyle = paper;
  roundedCard(ctx, cx, cy, w, h);
  ctx.fill();
  ctx.strokeStyle = "#fcd34d";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = "rgba(252, 211, 77, 0.45)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2 + 9, cy - h / 2 + 9, w - 18, h - 18, w * 0.07);
  ctx.stroke();
  const glow = ctx.createRadialGradient(cx, cy - h * 0.08, 0, cx, cy - h * 0.08, w * 0.42);
  glow.addColorStop(0, "rgba(255, 236, 170, 0.55)");
  glow.addColorStop(1, "rgba(255, 236, 170, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fde68a";
  ctx.font = `800 ${w * 0.085}px Georgia, serif`;
  ctx.fillText("KỸ NĂNG", cx, cy - h * 0.39);
  ctx.font = `${w * 0.44}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.fillText(skill.icon, cx, cy - h * 0.08);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${w * 0.13}px Georgia, serif`;
  ctx.fillText(skill.name, cx, cy + h * 0.24);
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = `700 ${w * 0.075}px sans-serif`;
  ctx.fillText(skill.short, cx, cy + h * 0.34);
}

let atlas: THREE.CanvasTexture | null = null;
const cardTextures = new Map<number, THREE.Texture>();
const faceMaterials = new Map<number, THREE.MeshStandardMaterial>();
let backMaterial: THREE.MeshStandardMaterial | null = null;
let glowTexture: THREE.CanvasTexture | null = null;

function getAtlas(): THREE.CanvasTexture {
  if (atlas) return atlas;
  const canvas = document.createElement("canvas");
  canvas.width = COLS * CELL_W;
  canvas.height = ROWS * CELL_H;
  const ctx = canvas.getContext("2d")!;
  const w = CELL_W - 8;
  for (let cell = 0; cell < SKILL_CELL + SKILL_ORDER.length; cell++) {
    const cx = (cell % COLS) * CELL_W + CELL_W / 2;
    const cy = Math.floor(cell / COLS) * CELL_H + CELL_H / 2;
    if (cell < JOKER) drawCard(ctx, cell, cx, cy, w, 0, false);
    else if (cell === JOKER) drawJoker(ctx, cx, cy, w);
    else if (cell === BACK_CELL) drawBack(ctx, cx, cy, w);
    else drawSkill(ctx, cx, cy, w, SKILL_ORDER[cell - SKILL_CELL]);
  }
  atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.anisotropy = 4;
  return atlas;
}

function cellTexture(cell: number): THREE.Texture {
  const cached = cardTextures.get(cell);
  if (cached) return cached;
  const texture = getAtlas().clone();
  texture.repeat.set(1 / COLS, 1 / ROWS);
  texture.offset.set((cell % COLS) / COLS, 1 - (Math.floor(cell / COLS) + 1) / ROWS);
  texture.needsUpdate = true;
  cardTextures.set(cell, texture);
  return texture;
}

export function faceMaterial(card: number): THREE.MeshStandardMaterial {
  // Every copy of a skill shares its type's face.
  const cell = isSkill(card) ? SKILL_CELL + SKILL_ORDER.indexOf(skillOf(card)) : card;
  let material = faceMaterials.get(cell);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ map: cellTexture(cell), alphaTest: 0.5, roughness: 0.55, metalness: 0 });
    faceMaterials.set(cell, material);
  }
  return material;
}

export function getBackMaterial(): THREE.MeshStandardMaterial {
  backMaterial ??= new THREE.MeshStandardMaterial({ map: cellTexture(BACK_CELL), alphaTest: 0.5, roughness: 0.5, metalness: 0.05 });
  return backMaterial;
}

/** Soft gold halo drawn behind a highlighted card (additive, so it glows). */
export function getGlowTexture(): THREE.CanvasTexture {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext("2d")!;
  ctx.shadowColor = "rgba(255, 210, 90, 1)";
  ctx.shadowBlur = 38;
  ctx.strokeStyle = "rgba(255, 236, 170, 1)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(48, 48, 160, 224, 16);
  ctx.stroke();
  ctx.stroke();
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export const cardGeometry = new THREE.PlaneGeometry(CARD_W, CARD_H);
export const glowGeometry = new THREE.PlaneGeometry(CARD_W * 1.6, CARD_H * 1.43);

// ---------- table layout ----------

/**
 * Each seat has a fixed place round the table, running clockwise seen from
 * above from seat 0 at the front (+z). The camera comes round to yours, so
 * whoever draws from you (the next seat) sits on your left, the one you draw
 * from on your right.
 */
export function seatAngle(seat: number): number {
  return (seat * Math.PI * 2) / MAX_SEATS;
}

export function onCircle(angle: number, radius: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(-radius * Math.sin(angle), y, radius * Math.cos(angle));
}

export interface FanSlot {
  x: number;
  y: number;
  z: number;
  /** Rotation about the fan's facing axis, so the cards splay from a pivot below. */
  tilt: number;
}

/**
 * How a hand is held: "rest" in front of its owner, "table" held out to a
 * drawer across the felt (what everyone else watches), "pov" right in front of
 * your eyes when it's you drawing.
 */
export type FanMode = "rest" | "table" | "pov";

/**
 * A hand held as a fan, in the fan's own frame: +z faces whoever looks at the
 * backs, the holder is behind at -z, and slot 0 is at the holder's left (+x).
 */
export function fanLayout(count: number, mode: FanMode, aspect: number): FanSlot[] {
  if (!count) return [];
  // In front of your eyes it opens wide (narrower on a tall phone screen); held out over the table, a little; at rest, a tight bunch.
  const pivot = mode === "pov" ? (aspect < 0.8 ? 0.75 : 1.05) : mode === "table" ? 0.8 : 0.5;
  const maxSpread = mode === "pov" ? (aspect < 0.8 ? 2.6 : 2.1) : mode === "table" ? Math.min(1.6, 0.16 * count) : Math.min(1.2, 0.09 * count);
  const step = count > 1 ? Math.min(mode === "pov" ? 0.2 : mode === "table" ? 0.16 : 0.09, maxSpread / (count - 1)) : 0;
  const mid = (count - 1) / 2;
  return Array.from({ length: count }, (_, index) => {
    const angle = (mid - index) * step;
    return { x: pivot * Math.sin(angle), y: pivot * Math.cos(angle) - pivot, z: index * 0.004, tilt: -angle };
  });
}

/** How far in front of the drawer's eyes an offered fan floats, so it fills the view on any screen. */
export function offerDistance(count: number, aspect: number): number {
  const fanWidth = (aspect < 0.8 ? 2 * 0.75 * Math.sin(1.3) : 2 * 1.05 * Math.sin(Math.min(1.05, 0.1 * count))) + CARD_W;
  const viewHeight = 2 * Math.tan((50 / 2) * (Math.PI / 180));
  return Math.max(1.55, (fanWidth / (viewHeight * aspect)) * 1.18, (CARD_H * 2.2) / viewHeight);
}
