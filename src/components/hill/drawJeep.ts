import { HILL_JEEP, type HillSnapshot } from "@shared/hillTypes";

/** Vector artwork in physics metres, with Y pointing up. */
export function drawJeepBody(ctx: CanvasRenderingContext2D, state: HillSnapshot) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const panel = (x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string) => {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.045; ctx.stroke(); }
  };
  // Undercarriage and rear-mounted spare tyre.
  panel(-1.57, -0.34, 3.12, 0.2, 0.07, "#26383a");
  panel(-1.78, -0.12, 0.27, 0.7, 0.1, "#263237", "#17262b");
  panel(-1.72, 0.02, 0.07, 0.4, 0.025, "#536166");

  const paint = ctx.createLinearGradient(0, -0.3, 0, 0.55);
  paint.addColorStop(0, "#ca6b1c"); paint.addColorStop(0.45, "#ee9c25"); paint.addColorStop(1, "#ffd264");
  ctx.beginPath();
  ctx.moveTo(-1.62, -0.19); ctx.lineTo(-1.62, 0.4);
  ctx.quadraticCurveTo(-1.61, 0.5, -1.46, 0.51);
  ctx.lineTo(0.7, 0.51); ctx.lineTo(0.89, 0.38); ctx.lineTo(1.48, 0.33);
  ctx.quadraticCurveTo(1.65, 0.31, 1.65, 0.14); ctx.lineTo(1.65, -0.22);
  ctx.lineTo(1.5, -0.3); ctx.lineTo(-1.48, -0.3); ctx.closePath();
  ctx.fillStyle = paint; ctx.fill(); ctx.strokeStyle = "#714c2e"; ctx.lineWidth = 0.065; ctx.stroke();

  // Sloped windscreen, cream hardtop, and deep blue glazing.
  ctx.beginPath(); ctx.moveTo(-1.16, 0.47); ctx.lineTo(-1.12, 0.96);
  ctx.quadraticCurveTo(-1.1, 1.05, -0.94, 1.05); ctx.lineTo(0.25, 1.05);
  ctx.quadraticCurveTo(0.4, 1.05, 0.46, 0.93); ctx.lineTo(0.75, 0.46); ctx.closePath();
  ctx.fillStyle = "#f4e8c5"; ctx.fill(); ctx.strokeStyle = "#665d46"; ctx.lineWidth = 0.055; ctx.stroke();
  const glass = ctx.createLinearGradient(0, 0.48, 0, 1);
  glass.addColorStop(0, "#24464f"); glass.addColorStop(1, "#60949d");
  panel(-1.01, 0.57, 0.47, 0.36, 0.045, glass);
  ctx.beginPath(); ctx.moveTo(-0.43, 0.57); ctx.lineTo(-0.43, 0.94); ctx.lineTo(0.24, 0.94);
  ctx.lineTo(0.47, 0.57); ctx.closePath(); ctx.fillStyle = glass; ctx.fill();
  ctx.strokeStyle = "#a1c4bf"; ctx.lineWidth = 0.035;
  ctx.beginPath(); ctx.moveTo(-0.94, 0.87); ctx.lineTo(-0.64, 0.87); ctx.moveTo(-0.32, 0.89); ctx.lineTo(-0.2, 0.89); ctx.stroke();
  panel(-1.19, 1.01, 1.62, 0.1, 0.055, "#fff3d3", "#796b4d");
  // Roof rack and two small lamps.
  panel(-0.99, 1.11, 1.15, 0.045, 0.02, "#344747");
  for (const x of [-0.75, -0.12]) {
    panel(x, 1.08, 0.045, 0.14, 0.015, "#344747");
    panel(x - 0.025, 1.17, 0.15, 0.12, 0.035, "#344747");
    panel(x + 0.01, 1.19, 0.09, 0.065, 0.02, "#ffedaa");
  }

  // Door seams, handle, hood highlight, running board and mirror.
  ctx.strokeStyle = "#b7762e"; ctx.lineWidth = 0.025;
  ctx.beginPath(); ctx.moveTo(-0.47, 0.49); ctx.lineTo(-0.47, -0.12); ctx.lineTo(0.52, -0.12); ctx.lineTo(0.52, 0.43); ctx.stroke();
  panel(-0.36, 0.31, 0.22, 0.06, 0.025, "#534936");
  panel(0.86, 0.27, 0.61, 0.045, 0.02, "#ffe49a");
  panel(-0.55, -0.31, 1.12, 0.1, 0.04, "#344343");
  panel(0.55, 0.53, 0.22, 0.13, 0.045, "#30474b", "#182f35");
  panel(0.58, 0.56, 0.12, 0.07, 0.02, "#7dabae");
  // Dark wheel arches make the body read as an off-road vehicle.
  for (const x of [-1.25, 1.25]) {
    ctx.beginPath(); ctx.arc(x, -0.57, 0.66, 0, Math.PI);
    ctx.strokeStyle = "#283b3b"; ctx.lineWidth = 0.18; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, -0.57, 0.68, 0.08, Math.PI - 0.08);
    ctx.strokeStyle = "#50605a"; ctx.lineWidth = 0.035; ctx.stroke();
  }
  panel(1.52, -0.02, 0.14, 0.22, 0.04, "#fff0b0", "#756747");
  panel(-1.63, 0.04, 0.09, 0.16, 0.02, "#c64735");
  panel(1.49, -0.29, 0.25, 0.13, 0.04, "#364849");
  panel(-1.72, -0.29, 0.22, 0.13, 0.04, "#364849");

  // A small mountain badge, readable without lettering at mobile sizes.
  ctx.beginPath(); ctx.arc(0.13, 0.13, 0.16, 0, Math.PI * 2); ctx.fillStyle = "#fff0c1"; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 0.06); ctx.lineTo(0.12, 0.23); ctx.lineTo(0.25, 0.06); ctx.closePath(); ctx.fillStyle = "#48746a"; ctx.fill();
  // Eyes stay on the glass; no exposed driver.
  for (const x of [-0.18, 0.11]) {
    ctx.fillStyle = "#fff8e4"; ctx.beginPath(); ctx.ellipse(x, 0.73, 0.09, state.grounded ? 0.1 : 0.14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#193740"; ctx.beginPath(); ctx.arc(x + 0.025, 0.72, 0.045, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawJeepWheel(ctx: CanvasRenderingContext2D, radius: number = HILL_JEEP.wheelRadius) {
  const r = HILL_JEEP.wheelRadius;
  ctx.save(); ctx.scale(radius / r, radius / r);
  const tire = ctx.createRadialGradient(-0.13, 0.15, 0.04, 0, 0, r);
  tire.addColorStop(0, "#526167"); tire.addColorStop(0.62, "#2c383d"); tire.addColorStop(1, "#15252b");
  ctx.fillStyle = tire; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#13242a"; ctx.lineWidth = 0.045; ctx.stroke();
  ctx.save();
  for (let i = 0; i < 16; i++) {
    ctx.rotate(Math.PI / 8); ctx.fillStyle = "#526065";
    ctx.beginPath(); ctx.roundRect(-0.045, r - 0.12, 0.09, 0.09, 0.015); ctx.fill();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, 0.32, 0, Math.PI * 2); ctx.fillStyle = "#bacbc8"; ctx.fill();
  ctx.strokeStyle = "#718b8c"; ctx.lineWidth = 0.035; ctx.stroke();
  ctx.save();
  for (let i = 0; i < 5; i++) {
    ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.roundRect(-0.045, 0.12, 0.09, 0.13, 0.025); ctx.fillStyle = "#30464b"; ctx.fill();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(0, 0, 0.1, 0, Math.PI * 2); ctx.fillStyle = "#e5d3a1"; ctx.fill();
  ctx.strokeStyle = "#6a7a75"; ctx.lineWidth = 0.025; ctx.stroke();
  ctx.restore();
}
