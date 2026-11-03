import { TILE_SIZE } from '@shared/tank/types';

const INK = '#465336';

/** Decorative art stays inside the tile; collisions still use the shared map. */
export function drawMeadowTile(ctx: CanvasRenderingContext2D, x: number, y: number, sand: boolean, variant: number) {
  ctx.fillStyle = sand ? '#e0c58b' : '#91bd59';
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  ctx.strokeStyle = sand ? '#af90531a' : '#527c2d12';
  ctx.lineWidth = .6;
  ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
  if (variant > .86) {
    ctx.fillStyle = sand ? '#ead39f' : '#9ac564';
    ctx.beginPath(); ctx.ellipse(x + 14, y + 19, 9, 4, -.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = sand ? '#c3a771' : '#719d42';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 12, y + 18); ctx.lineTo(x + 10, y + 15);
    ctx.moveTo(x + 12, y + 18); ctx.lineTo(x + 14, y + 14); ctx.stroke();
  }
}

export function drawDirtRoad(ctx: CanvasRenderingContext2D, x: number, y: number, north: boolean, south: boolean, east: boolean, west: boolean) {
  const size = TILE_SIZE, half = size / 2;
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    for (const [active, dx, dy] of [[north, half, 0], [south, half, size], [east, size, half], [west, 0, half]] as const) {
      if (active) { ctx.moveTo(half, half); ctx.lineTo(dx, dy); }
    }
    if (!north && !south && !east && !west) { ctx.moveTo(0, half); ctx.lineTo(size, half); }
  };
  ctx.strokeStyle = '#b49d60'; ctx.lineWidth = size * .83; path(); ctx.stroke();
  ctx.strokeStyle = '#d4be88'; ctx.lineWidth = size * .72; path(); ctx.stroke();
  ctx.fillStyle = '#d4be88'; ctx.beginPath(); ctx.arc(half, half, size * .36, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#c4ad76'; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); path(); ctx.stroke();
  ctx.restore();
}

export function drawCanopy(ctx: CanvasRenderingContext2D, cx: number, cy: number, phase: number, opacity: number) {
  ctx.save(); ctx.globalAlpha = opacity;
  ctx.fillStyle = '#304d292a'; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 8, 18, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(cx, cy); ctx.rotate(Math.sin(phase) * .025);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  for (const [x, y, r, color] of [[-7, 2, 11, '#518c39'], [5, 4, 12, '#619c40'], [0, -6, 12, '#76ad48']] as const) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.strokeStyle = '#9ac763'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-1, -7, 7, 3.5, 4.8); ctx.stroke(); ctx.restore();
}

export function drawWoodenCrate(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save(); ctx.translate(x - size / 2, y - size / 2);
  ctx.fillStyle = '#49341f38'; ctx.beginPath(); ctx.roundRect(2, 4, size, size, 3); ctx.fill();
  ctx.fillStyle = '#a3703b'; ctx.strokeStyle = '#604428'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(0, 0, size, size, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#b98749'; ctx.fillRect(3, 3, size - 6, size - 6);
  ctx.strokeStyle = '#95632e'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(3, size * i / 3); ctx.lineTo(size - 3, size * i / 3); ctx.stroke(); }
  ctx.strokeStyle = '#d1a368'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(size - 4, size - 4); ctx.stroke();
  ctx.fillStyle = '#63472b';
  for (const [nx, ny] of [[3, 3], [size - 4, 3], [3, size - 4], [size - 4, size - 4]]) ctx.fillRect(nx, ny, 1.5, 1.5);
  ctx.restore();
}
