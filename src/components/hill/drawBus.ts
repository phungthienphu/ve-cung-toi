// A Vietnamese electric city bus, played for laughs. Livery after the
// lime-green VinBus buses on Hà Nội streets (from the owner's photo): lime
// body and roof, one long black window band, blue "circuit" lines, big
// dark windscreen, rabbit-ear mirrors. The owner chose to carry the VinBus
// name (02/11/2026); the badge is a plain drawn "V", not their logo artwork. Vector art in physics metres, Y up,
// front facing +x, fitted around the bus's collision boxes (HILL_VEHICLES.bus).

const OUTLINE = "#1d2a1c";
const GLASS_TOP = "#11181b";
const GLASS_BOTTOM = "#33474c";

export function drawBusBody(ctx: CanvasRenderingContext2D, state: { grounded: boolean }) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const panel = (x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 0.04;
      ctx.stroke();
    }
  };
  const glass = (x: number, y: number, w: number, h: number) => {
    const fill = ctx.createLinearGradient(0, y + h, 0, y);
    fill.addColorStop(0, GLASS_TOP);
    fill.addColorStop(1, GLASS_BOTTOM);
    panel(x, y, w, h, 0.05, fill, OUTLINE);
    // A glint across the pane.
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 0.035;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.2, y + h * 0.8);
    ctx.lineTo(x + w * 0.45, y + h * 0.35);
    ctx.stroke();
  };
  /** Text the right way up (the canvas is flipped for physics) at a size in metres. */
  const text = (label: string, x: number, y: number, size: number, color: string, stroke?: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 20, -size / 20);
    ctx.font = "900 20px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (stroke) {
      ctx.lineWidth = 5;
      ctx.strokeStyle = stroke;
      ctx.strokeText(label, 0, 0);
    }
    ctx.fillStyle = color;
    ctx.fillText(label, 0, 0);
    ctx.restore();
  };

  // Roof cargo first, so the body overlaps its bottom edge: sacks, a box, and a chicken coop — the country coach spirit.
  ctx.fillStyle = "#d4b77c";
  ctx.strokeStyle = "#7a6238";
  ctx.lineWidth = 0.04;
  for (const [x, y, rx, ry] of [[-2.08, 1.3, 0.34, 0.21], [-1.5, 1.27, 0.28, 0.17]] as const) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 0.06, y + ry - 0.03);
    ctx.lineTo(x + 0.04, y + ry + 0.06);
    ctx.stroke();
  }
  panel(-1.18, 1.1, 0.42, 0.34, 0.03, "#c99a54", "#6e4f2c");
  ctx.strokeStyle = "#6e4f2c";
  for (let x = -1.1; x < -0.78; x += 0.08) {
    ctx.beginPath();
    ctx.moveTo(x, 1.12);
    ctx.lineTo(x, 1.42);
    ctx.stroke();
  }
  // The chicken peeking out.
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath();
  ctx.arc(-0.97, 1.5, 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0453a";
  ctx.beginPath();
  ctx.arc(-0.99, 1.6, 0.04, 0, Math.PI * 2);
  ctx.arc(-0.93, 1.59, 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2a531";
  ctx.beginPath();
  ctx.moveTo(-0.89, 1.5);
  ctx.lineTo(-0.82, 1.48);
  ctx.lineTo(-0.89, 1.46);
  ctx.fill();
  ctx.fillStyle = "#1d2b2f";
  ctx.beginPath();
  ctx.arc(-0.94, 1.52, 0.015, 0, Math.PI * 2);
  ctx.fill();
  // Rope over the load.
  ctx.strokeStyle = "#8a7550";
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  ctx.moveTo(-2.4, 1.12);
  ctx.quadraticCurveTo(-1.8, 1.55, -1.2, 1.14);
  ctx.stroke();
  // Roof battery and air-conditioning housing, painted like the body.
  panel(-0.55, 1.08, 1.4, 0.17, 0.06, "#b4de4c", OUTLINE);
  for (let x = -0.4; x < 0.75; x += 0.18) panel(x, 1.13, 0.1, 0.06, 0.02, "#7fae2c");

  // Body: white, with a rounded nose.
  const body = new Path2D();
  body.moveTo(-2.62, -0.36);
  body.lineTo(2.5, -0.36);
  body.quadraticCurveTo(2.66, -0.36, 2.66, -0.2);
  body.lineTo(2.66, 0.62);
  body.quadraticCurveTo(2.64, 1.08, 2.28, 1.12);
  body.lineTo(-2.45, 1.12);
  body.quadraticCurveTo(-2.66, 1.12, -2.66, 0.92);
  body.lineTo(-2.66, -0.2);
  body.quadraticCurveTo(-2.66, -0.36, -2.62, -0.36);
  body.closePath();
  const paint = ctx.createLinearGradient(0, 1.12, 0, -0.36);
  paint.addColorStop(0, "#c2e85a");
  paint.addColorStop(1, "#8dc234");
  ctx.fillStyle = paint;
  ctx.fill(body);
  // Livery inside the body: darker skirt, the long black window band, blue circuit lines, wheel arches.
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = "#6f9f26";
  ctx.fillRect(-2.7, -0.4, 5.4, 0.26);
  ctx.fillStyle = "#151d20";
  ctx.fillRect(-2.7, 0.42, 4.2, 0.6);
  ctx.strokeStyle = "#2f8fe8";
  ctx.lineWidth = 0.035;
  for (const line of [
    [[-2.7, 0.14], [-1.62, 0.14], [-1.48, 0.03], [0.48, 0.03], [0.62, 0.18], [2.7, 0.18]],
    [[-2.7, -0.04], [-0.22, -0.04], [-0.08, -0.17], [2.7, -0.17]],
    [[-2.7, 0.33], [-2.25, 0.33], [-2.12, 0.24], [-1.3, 0.24]],
  ]) {
    ctx.beginPath();
    line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    // A node at each bend, like a circuit board.
    ctx.fillStyle = "#2f8fe8";
    for (const [x, y] of line.slice(1, -1)) {
      ctx.beginPath();
      ctx.arc(x, y, 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#151d20";
  for (const x of [-2.05, 2.05]) {
    ctx.beginPath();
    ctx.arc(x, -0.8, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.06;
  ctx.stroke(body);

  // Side windows, and the two doors (rear "XUỐNG", front "LÊN").
  for (const x of [-2.42, -1.8, -0.5, 0.12]) glass(x, 0.48, 0.52, 0.5);
  for (const [x, label] of [[-1.16, "XUỐNG"], [0.76, "LÊN"]] as const) {
    panel(x, -0.3, 0.56, 1.3, 0.04, "#3a4d52", OUTLINE);
    glass(x + 0.05, 0.02, 0.21, 0.92);
    glass(x + 0.3, 0.02, 0.21, 0.92);
    text(label, x + 0.28, -0.15, 0.13, "#ffffff");
  }
  // Big front windscreen, the bus's face.
  const shield = ctx.createLinearGradient(0, 1.04, 0, 0.42);
  shield.addColorStop(0, GLASS_TOP);
  shield.addColorStop(1, GLASS_BOTTOM);
  ctx.beginPath();
  ctx.moveTo(1.42, 0.36);
  ctx.lineTo(2.6, 0.36);
  ctx.lineTo(2.6, 0.82);
  ctx.quadraticCurveTo(2.56, 1.03, 2.25, 1.04);
  ctx.lineTo(1.42, 1.04);
  ctx.closePath();
  ctx.fillStyle = shield;
  ctx.fill();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.04;
  ctx.stroke();
  // Route display over the windscreen.
  panel(1.5, 0.9, 0.86, 0.13, 0.03, "#141c1f");
  text("01 HOÀNG KIM", 1.93, 0.965, 0.09, "#ffb84d");

  // The name between the doors, and a round "V" badge on the nose.
  text("VinBus", 0.08, 0.28, 0.26, "#ffffff", "#2f5a12");
  ctx.fillStyle = "#151d20";
  ctx.beginPath();
  ctx.arc(2.42, 0.17, 0.12, 0, Math.PI * 2);
  ctx.fill();
  text("V", 2.42, 0.17, 0.15, "#e8eef0");

  // "CÒN CHỖ!" — a cardboard sign wedged in the front door, slightly crooked.
  ctx.save();
  ctx.translate(1.04, 0.62);
  ctx.rotate(0.12);
  panel(-0.24, -0.11, 0.48, 0.22, 0.02, "#fffdf5", "#a33");
  ctx.restore();
  text("CÒN CHỖ!", 1.04, 0.63, 0.1, "#d32f2f");

  // Rabbit-ear mirror arching off the front.
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(2.45, 1.08);
  ctx.quadraticCurveTo(2.95, 1.25, 2.92, 0.92);
  ctx.stroke();
  ctx.fillStyle = "#1d2b2f";
  ctx.beginPath();
  ctx.ellipse(2.92, 0.8, 0.06, 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lights and bumpers.
  panel(2.5, 0.02, 0.15, 0.2, 0.04, "#fff3b8", OUTLINE);
  panel(-2.67, 0.08, 0.1, 0.24, 0.03, "#e0453a");
  panel(2.4, -0.42, 0.3, 0.18, 0.05, "#37474f");
  panel(2.52, -0.33, 0.16, 0.1, 0.015, "#f5d33d", OUTLINE);
  panel(-2.7, -0.42, 0.3, 0.18, 0.05, "#37474f");

  // Cartoon eyes on the windscreen, like every car here; wide open in the air.
  for (const x of [1.98, 2.3]) {
    ctx.beginPath();
    ctx.ellipse(x, 0.68, 0.085, state.grounded ? 0.1 : 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#fff9e7";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 0.025, 0.68, 0.04, 0, Math.PI * 2);
    ctx.fillStyle = "#18333c";
    ctx.fill();
  }
}

/** A city wheel (bus, VF3-style mini): smooth tyre, silver hub with a ring of bolts. The off-roaders keep knobbly tyres. */
export function drawCityWheel(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.fillStyle = "#1f2a2e";
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#11191c";
  ctx.lineWidth = 0.04;
  ctx.stroke();
  const hub = ctx.createRadialGradient(-0.05, 0.05, 0.02, 0, 0, radius * 0.6);
  hub.addColorStop(0, "#f2f5f6");
  hub.addColorStop(1, "#9aa6aa");
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#59666a";
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * radius * 0.4, Math.sin(angle) * radius * 0.4, radius * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#3c474b";
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
}
