// The small fast car, drawn after VinFast's VF3 (owner's request): a boxy
// little city SUV — upright windscreen, almost no bonnet, flat roof in a
// contrast colour, square tail, chunky black cladding round the wheels, a
// horizontal LED strip across the nose. Vector art in physics metres, Y up,
// front facing +x, fitted round the "beetle" collision boxes
// (half-width 1.35 m, wheels at ±1.0 m, cabin up to ~1.05 m).

const OUTLINE = "#3a3320";
const GLASS_TOP = "#1f3a44";
const GLASS_BOTTOM = "#5c8f99";
const CLADDING = "#2b2f31";

export function drawBeetleBody(ctx: CanvasRenderingContext2D, state: { grounded: boolean }) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const panel = (x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.035;
      ctx.stroke();
    }
  };
  const glassFill = (top: number, bottom: number) => {
    const fill = ctx.createLinearGradient(0, top, 0, bottom);
    fill.addColorStop(0, GLASS_TOP);
    fill.addColorStop(1, GLASS_BOTTOM);
    return fill;
  };

  // The box: square tail, flat roof, steep windscreen, stubby nose.
  const body = new Path2D();
  body.moveTo(-1.3, -0.32);
  body.lineTo(1.26, -0.32);
  body.quadraticCurveTo(1.37, -0.32, 1.37, -0.2);
  body.lineTo(1.37, 0.3);
  body.quadraticCurveTo(1.36, 0.42, 1.22, 0.45);
  body.lineTo(0.92, 0.5);
  body.lineTo(0.6, 1.02);
  body.quadraticCurveTo(0.55, 1.1, 0.45, 1.1);
  body.lineTo(-1.15, 1.1);
  body.quadraticCurveTo(-1.33, 1.1, -1.35, 0.92);
  body.lineTo(-1.37, -0.2);
  body.quadraticCurveTo(-1.37, -0.32, -1.3, -0.32);
  body.closePath();
  const paint = ctx.createLinearGradient(0, 1.1, 0, -0.32);
  paint.addColorStop(0, "#ffdc55");
  paint.addColorStop(1, "#e9b10f");
  ctx.fillStyle = paint;
  ctx.fill(body);

  ctx.save();
  ctx.clip(body);
  // Contrast roof.
  ctx.fillStyle = "#f6f5ee";
  ctx.fillRect(-1.4, 1.0, 2.1, 0.15);
  // Black cladding along the sill and round the wheel wells.
  ctx.fillStyle = CLADDING;
  ctx.fillRect(-1.4, -0.36, 2.8, 0.22);
  for (const x of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x, -0.78, 0.62, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.05;
  ctx.stroke(body);

  // Windows: rear quarter and door glass, a black B-pillar between them, and the windscreen edge.
  ctx.beginPath();
  ctx.roundRect(-1.2, 0.55, 0.72, 0.4, 0.06);
  ctx.fillStyle = glassFill(0.95, 0.55);
  ctx.fill();
  panel(-0.48, 0.5, 0.12, 0.5, 0.02, CLADDING);
  ctx.beginPath();
  ctx.moveTo(-0.32, 0.55);
  ctx.lineTo(0.78, 0.55);
  ctx.lineTo(0.52, 0.96);
  ctx.lineTo(-0.32, 0.96);
  ctx.closePath();
  ctx.fillStyle = glassFill(0.96, 0.55);
  ctx.fill();
  ctx.strokeStyle = "#1d2326";
  ctx.lineWidth = 0.035;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.86, 0.53);
  ctx.lineTo(0.58, 0.99);
  ctx.strokeStyle = GLASS_TOP;
  ctx.lineWidth = 0.07;
  ctx.stroke();
  // Glints.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 0.03;
  for (const [x, y] of [[-1.05, 0.62], [-0.15, 0.62]]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.18, y + 0.28);
    ctx.stroke();
  }

  // Door line, handle and mirror.
  ctx.strokeStyle = "rgba(58, 51, 32, 0.55)";
  ctx.lineWidth = 0.025;
  ctx.beginPath();
  ctx.moveTo(-0.36, -0.12);
  ctx.lineTo(-0.36, 0.52);
  ctx.moveTo(0.82, -0.12);
  ctx.lineTo(0.84, 0.5);
  ctx.stroke();
  panel(0.1, 0.36, 0.18, 0.05, 0.02, CLADDING);
  ctx.fillStyle = CLADDING;
  ctx.beginPath();
  ctx.ellipse(0.76, 0.58, 0.1, 0.06, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Nose: the LED strip along the top of the face, a headlamp below, and the tail lamp.
  ctx.strokeStyle = "#fffbe6";
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(0.98, 0.47);
  ctx.lineTo(1.32, 0.4);
  ctx.stroke();
  panel(1.22, 0.12, 0.15, 0.16, 0.06, "#fff7cc", OUTLINE);
  panel(1.24, -0.28, 0.14, 0.12, 0.03, CLADDING);
  panel(-1.38, 0.3, 0.07, 0.36, 0.03, "#e0453a");

  // Cartoon eyes in the door glass, like every car here; wide open in the air.
  for (const x of [0.12, 0.36]) {
    ctx.beginPath();
    ctx.ellipse(x, 0.76, 0.075, state.grounded ? 0.09 : 0.13, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff9e7";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 0.02, 0.76, 0.035, 0, Math.PI * 2);
    ctx.fillStyle = "#18333c";
    ctx.fill();
  }
}
