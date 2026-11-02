import { HILL_VEHICLES, type HillSnapshot } from "@shared/hillTypes";
import { drawJeepBody } from "./drawJeep";

export function drawVehicle(ctx: CanvasRenderingContext2D, state: HillSnapshot) {
  if (state.vehicle === "jeep") { drawJeepBody(ctx, state); return; }
  const car = HILL_VEHICLES[state.vehicle];
  const paint = ctx.createLinearGradient(0, -0.35, 0, 1);
  paint.addColorStop(0, state.vehicle === "beetle" ? "#b84349" : state.vehicle === "bus" ? "#227a84" : "#3d648e");
  paint.addColorStop(1, state.vehicle === "beetle" ? "#ffaaa0" : state.vehicle === "bus" ? "#9ae1cb" : "#a1c4e3");
  ctx.strokeStyle = "#284349"; ctx.lineWidth = 0.06; ctx.lineJoin = "round";
  const panel = (x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) => {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
  };
  panel(-car.halfWidth, -0.35, car.halfWidth * 2, 0.7, 0.15, paint);
  if (state.vehicle === "beetle") {
    ctx.beginPath(); ctx.moveTo(-1.25, 0.2); ctx.bezierCurveTo(-1.2, 1.27, 0.38, 1.4, 0.97, 0.25); ctx.closePath(); ctx.fillStyle = paint; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-0.72, 0.47); ctx.quadraticCurveTo(-0.5, 1.05, -0.1, 1.03); ctx.lineTo(-0.1, 0.47); ctx.closePath(); ctx.fillStyle = "#365c6b"; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.02, 0.47); ctx.lineTo(0.02, 1.03); ctx.quadraticCurveTo(0.53, 0.96, 0.68, 0.47); ctx.closePath(); ctx.fill();
    panel(-0.42, -0.2, 0.85, 0.5, 0.1, paint);
  } else if (state.vehicle === "bus") {
    panel(-car.cabinWidth - 0.1, 0.25, car.cabinWidth * 2 + 0.2, 0.82, 0.17, paint);
    for (let i = 0; i < 7; i++) panel(-2.15 + i * 0.59, 0.52, 0.48, 0.39, 0.045, "#305b6e");
    panel(-2.5, 0.08, 5, 0.1, 0.02, "#f8e8aa");
    panel(1.85, -0.23, 0.35, 0.63, 0.02, "#538e98");
  } else {
    // Pickup bed and angular enclosed cabin above oversized wheels.
    panel(-1.8, 0.25, 1.25, 0.29, 0.06, paint);
    panel(-0.6, 0.25, 1.55, 0.8, 0.12, paint);
    panel(-0.43, 0.52, 0.53, 0.37, 0.04, "#30516c");
    panel(0.23, 0.52, 0.52, 0.37, 0.04, "#30516c");
    panel(1, 0.2, 0.73, 0.18, 0.03, "#c3e4e7");
    ctx.strokeStyle = "#303f4d"; ctx.lineWidth = 0.12;
    ctx.beginPath(); ctx.moveTo(-1.7, -0.3); ctx.lineTo(1.7, -0.3); ctx.stroke();
  }
  panel(car.halfWidth - 0.11, -0.02, 0.14, 0.2, 0.03, "#ffefac");
  panel(-car.halfWidth - 0.02, -0.04, 0.1, 0.16, 0.02, "#d74840");
  panel(car.halfWidth - 0.15, -0.31, 0.27, 0.11, 0.04, "#374c52");
  const eyeOffset = state.vehicle === "bus" ? 1.5 : 0;
  for (const x of [0.35, 0.61]) {
    ctx.beginPath(); ctx.ellipse(x + eyeOffset, 0.7, 0.075, state.grounded ? 0.09 : 0.13, 0, 0, Math.PI * 2); ctx.fillStyle = "#fff9e7"; ctx.fill();
    ctx.beginPath(); ctx.arc(x + eyeOffset + 0.02, 0.7, 0.035, 0, Math.PI * 2); ctx.fillStyle = "#18333c"; ctx.fill();
  }
}
