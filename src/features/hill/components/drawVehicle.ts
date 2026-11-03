import { HILL_VEHICLES, type HillSnapshot } from "@shared/hill/types";
import { drawBeetleBody } from "./drawBeetle";
import { drawBusBody, drawCityWheel } from "./drawBus";
import { drawJeepBody, drawJeepWheel } from "./drawJeep";

/** One wheel, centred at the origin in physics metres: hubcaps on the city cars, knobbly tyres on the off-roaders. */
export function drawWheel(ctx: CanvasRenderingContext2D, vehicle: HillSnapshot["vehicle"]) {
  const radius = HILL_VEHICLES[vehicle].wheelRadius;
  if (vehicle === "bus" || vehicle === "beetle") drawCityWheel(ctx, radius);
  else drawJeepWheel(ctx, radius);
}

export function drawVehicle(ctx: CanvasRenderingContext2D, state: Pick<HillSnapshot, "vehicle" | "grounded">) {
  if (state.vehicle === "jeep") { drawJeepBody(ctx, state); return; }
  if (state.vehicle === "bus") { drawBusBody(ctx, state); return; }
  if (state.vehicle === "beetle") { drawBeetleBody(ctx, state); return; }
  const car = HILL_VEHICLES[state.vehicle];
  const paint = ctx.createLinearGradient(0, -0.35, 0, 1);
  paint.addColorStop(0, "#3d648e");
  paint.addColorStop(1, "#a1c4e3");
  ctx.strokeStyle = "#284349"; ctx.lineWidth = 0.06; ctx.lineJoin = "round";
  const panel = (x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient) => {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.stroke();
  };
  panel(-car.halfWidth, -0.35, car.halfWidth * 2, 0.7, 0.15, paint);
  // What's left is the monster truck: pickup bed and angular enclosed cabin above oversized wheels.
  panel(-1.8, 0.25, 1.25, 0.29, 0.06, paint);
  panel(-0.6, 0.25, 1.55, 0.8, 0.12, paint);
  panel(-0.43, 0.52, 0.53, 0.37, 0.04, "#30516c");
  panel(0.23, 0.52, 0.52, 0.37, 0.04, "#30516c");
  panel(1, 0.2, 0.73, 0.18, 0.03, "#c3e4e7");
  ctx.strokeStyle = "#303f4d"; ctx.lineWidth = 0.12;
  ctx.beginPath(); ctx.moveTo(-1.7, -0.3); ctx.lineTo(1.7, -0.3); ctx.stroke();
  panel(car.halfWidth - 0.11, -0.02, 0.14, 0.2, 0.03, "#ffefac");
  panel(-car.halfWidth - 0.02, -0.04, 0.1, 0.16, 0.02, "#d74840");
  panel(car.halfWidth - 0.15, -0.31, 0.27, 0.11, 0.04, "#374c52");
  for (const x of [0.35, 0.61]) {
    ctx.beginPath(); ctx.ellipse(x, 0.7, 0.075, state.grounded ? 0.09 : 0.13, 0, 0, Math.PI * 2); ctx.fillStyle = "#fff9e7"; ctx.fill();
    ctx.beginPath(); ctx.arc(x + 0.02, 0.7, 0.035, 0, Math.PI * 2); ctx.fillStyle = "#18333c"; ctx.fill();
  }
}
