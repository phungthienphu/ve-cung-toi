// Red's ultimate: an artillery barrage. The actual telegraphed danger zones
// once committed reuse render/airstrike.ts's drawBombDangerZone (it's
// already generic over position/radius/time) — this file only adds the
// trap-scope reticle look, used both for that post-commit marker and for
// Red's own local pre-commit aim preview (see useTankInput.ts's
// isTargetingRef — that phase never reaches the server, so only Red's own
// client ever calls this for a "preview", not a real bomb).

import { TILE_SIZE } from "@shared/tankTypes";
import { getTintedSprite } from "./sprite-utils";

const RETICLE_COLOR = "#dc2626";

export function drawTrapScopeReticle(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const pulse = 0.6 + 0.4 * Math.sin(time / 200);
  const tinted = getTintedSprite("/tank/trap_scope.png", RETICLE_COLOR);
  const size = TILE_SIZE * 0.7;
  if (tinted) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * pulse;
    ctx.drawImage(tinted, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    ctx.restore();
  }
}

/** A dashed ring around Red's own pending aim point, roughly the size of
 * the barrage's eventual spread — just a rough "this is about the area
 * you'll hit" preview, not a precise guarantee. */
export function drawAreaPreviewRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(220,38,38,0.5)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
