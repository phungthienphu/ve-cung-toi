import { SHIP_SIZE, type ShipPlacement } from "@shared/battleshipTypes";

// Top-down ships drawn straight onto a canvas (no image assets). Everything is
// authored at a 44px cell and scaled, so it stays crisp at any board size.
const BASE = 44;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hullPath(ctx: CanvasRenderingContext2D, length: number, width: number) {
  const L = length / 2;
  const H = width / 2;
  ctx.beginPath();
  ctx.moveTo(L, 0);
  ctx.bezierCurveTo(L - H * 0.9, -H * 1.02, L - H * 1.9, -H, L - H * 2.4, -H);
  ctx.lineTo(-L + H * 0.6, -H);
  ctx.quadraticCurveTo(-L, -H, -L, -H * 0.4);
  ctx.lineTo(-L, H * 0.4);
  ctx.quadraticCurveTo(-L, H, -L + H * 0.6, H);
  ctx.lineTo(L - H * 2.4, H);
  ctx.bezierCurveTo(L - H * 1.9, H, L - H * 0.9, H * 1.02, L, 0);
  ctx.closePath();
}

function turret(ctx: CanvasRenderingContext2D, x: number, r: number, angle: number) {
  ctx.save();
  ctx.translate(x, 0);
  ctx.fillStyle = "#4a5566";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2c333d";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.rotate(angle);
  ctx.fillStyle = "#2c333d";
  ctx.fillRect(r * 0.3, -1.6, r * 1.7, 1.3);
  ctx.fillRect(r * 0.3, 0.4, r * 1.7, 1.3);
  ctx.restore();
}

function surfaceShip(ctx: CanvasRenderingContext2D, ship: ShipPlacement, sunk: boolean) {
  const size = SHIP_SIZE[ship.kind];
  const length = size * BASE - 10;
  const width = BASE * 0.56;
  const L = length / 2;

  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.save();
  ctx.translate(2, 3);
  hullPath(ctx, length, width + 4);
  ctx.fill();
  ctx.restore();

  hullPath(ctx, length, width);
  ctx.fillStyle = sunk ? "#5b5f63" : "#8d99a8";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#39424e";
  ctx.stroke();
  hullPath(ctx, length - 8, width - 8);
  ctx.fillStyle = sunk ? "#6f7377" : "#b7c0cb";
  ctx.fill();

  if (ship.kind === "carrier") {
    ctx.fillStyle = sunk ? "#55585c" : "#6c7682";
    roundRect(ctx, -L + 6, -width / 2 + 4, length - 14, width - 8, 3);
    ctx.fill();
    ctx.strokeStyle = "#f3f5f7";
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-L + 12, 0);
    ctx.lineTo(L - 16, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#3b4450";
    roundRect(ctx, L * 0.1, -width / 2 + 1, 22, 9, 2);
    ctx.fill();
    ctx.fillStyle = "#d8dde3";
    for (const x of [-L * 0.55, -L * 0.2]) {
      ctx.save();
      ctx.translate(x, 4);
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(-6, -6);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    return;
  }

  const bridgeX = size === 2 ? -L * 0.15 : -L * 0.12;
  ctx.fillStyle = sunk ? "#4d5155" : "#5d6877";
  roundRect(ctx, bridgeX - 10, -width / 2 + 6, 20, width - 12, 3);
  ctx.fill();
  ctx.fillStyle = "#9fd3ff";
  ctx.fillRect(bridgeX + 5, -4, 3, 8);
  if (size >= 3) {
    ctx.fillStyle = "#3b4450";
    ctx.beginPath();
    ctx.arc(bridgeX - 16, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  const turrets = size === 2 ? [L * 0.45] : size === 3 ? [L * 0.5, -L * 0.62] : [L * 0.55, L * 0.28, -L * 0.6];
  for (const x of turrets) turret(ctx, x, size >= 4 ? 8 : 6, x < 0 ? Math.PI : 0);
}

function submarine(ctx: CanvasRenderingContext2D, ship: ShipPlacement, sunk: boolean) {
  const length = SHIP_SIZE[ship.kind] * BASE - 10;
  const width = BASE * 0.42;
  const L = length / 2;
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  roundRect(ctx, -L + 2, -width / 2 + 3, length, width, width / 2);
  ctx.fill();
  roundRect(ctx, -L, -width / 2, length, width, width / 2);
  ctx.fillStyle = sunk ? "#4a4d50" : "#3e4b58";
  ctx.fill();
  ctx.strokeStyle = "#222a33";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = sunk ? "#5a5d60" : "#56687a";
  roundRect(ctx, -L + 8, -width / 2 + 4, length - 16, width - 8, (width - 8) / 2);
  ctx.fill();
  ctx.fillStyle = sunk ? "#3a3c3f" : "#2a333d";
  roundRect(ctx, -6, -width / 2 + 3, 18, width - 6, 4);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-L, 0);
  ctx.lineTo(-L - 6, -6);
  ctx.lineTo(-L - 6, 6);
  ctx.closePath();
  ctx.fill();
}

/** Draws `ship` on a grid whose top-left cell starts at (originX, originY). */
export function drawShip(
  ctx: CanvasRenderingContext2D,
  ship: ShipPlacement,
  cell: number,
  originX: number,
  originY: number,
  options: { sunk?: boolean; alpha?: number; outline?: string } = {},
) {
  const length = SHIP_SIZE[ship.kind];
  const w = ship.vertical ? 1 : length;
  const h = ship.vertical ? length : 1;
  const cx = originX + (ship.x + w / 2) * cell;
  const cy = originY + (ship.y + h / 2) * cell;
  ctx.save();
  if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
  if (options.outline) {
    ctx.strokeStyle = options.outline;
    ctx.lineWidth = 2.5;
    roundRect(ctx, originX + ship.x * cell + 2, originY + ship.y * cell + 2, w * cell - 4, h * cell - 4, 5);
    ctx.stroke();
  }
  ctx.translate(cx, cy);
  if (ship.vertical) ctx.rotate(Math.PI / 2);
  const scale = cell / BASE;
  ctx.scale(scale, scale);
  if (ship.kind === "submarine") submarine(ctx, ship, !!options.sunk);
  else surfaceShip(ctx, ship, !!options.sunk);
  ctx.restore();
}

export function drawFire(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  const s = cell / BASE;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(40,40,40,0.35)";
  ctx.beginPath();
  ctx.arc(4, -8, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.quadraticCurveTo(0, -14, 6, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fde68a";
  ctx.beginPath();
  ctx.arc(0, 1, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
