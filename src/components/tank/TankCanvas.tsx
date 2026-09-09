"use client";

import { useEffect, useRef } from "react";
import {
  MAX_BOOST_ENERGY,
  TANK_SIZE,
  TICK_MS,
  TILE_SIZE,
  VIEWPORT_H,
  VIEWPORT_W,
  VISION_RADIUS,
  getMap,
  mapCanvasSize,
  type TankClientMessage,
  type TankPublicState,
} from "@shared/tankTypes";
import { skinForColor } from "./render/sprite-utils";
import {
  buildMapBackground,
  bushNeighborBias,
  clampCamera,
  drawBush,
  drawHazardSpikes,
  drawMinimap,
  drawNestPuddle,
  isBushHidden,
  MINIMAP_H,
  MINIMAP_W,
} from "./render/map-background";
import { drawBurningOverlay, drawCrate, drawHealthPickup, drawItemPickup, drawMonster, drawTank, drawTrap } from "./render/entities";
import { drawBigBullet, drawBlindBullet, drawFireBullet, drawNormalBullet } from "./render/bullets";
import {
  MARK_DURATION_MS,
  MUZZLE_FLASH_DURATION_MS,
  LEAF_PARTICLE_DURATION_MS,
  OIL_SPILL_DURATION_MS,
  drawExplosion,
  drawLeafParticle,
  drawMuzzleFlash,
  drawOilSpill,
  drawSkidMark,
  explosionDurationFor,
} from "./render/effects";
import { BOMB_FALL_MS, drawBombDangerZone, drawBombPlane, drawBombTargetIcon, drawFallingBomb } from "./render/airstrike";
import { useTankEffects } from "./useTankEffects";
import { useTankInput } from "./useTankInput";

interface Props {
  state: TankPublicState;
  selfId: string;
  send: (msg: TankClientMessage) => void;
}

export default function TankCanvas({ state, selfId, send }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  // The previous server snapshot + when the current one arrived — lets the
  // draw loop smoothly slide tanks between the two instead of them sitting
  // still for ~3 rendered frames and then jumping, which is what a server
  // tick rate of 20Hz looks like on a ~60fps screen with no interpolation.
  const prevStateRef = useRef<TankPublicState | null>(null);
  const stateChangedAtRef = useRef(performance.now());
  if (stateRef.current !== state) {
    prevStateRef.current = stateRef.current;
    stateChangedAtRef.current = performance.now();
    stateRef.current = state;
  }

  const { explosionsRef, marksRef, oilSpillsRef, muzzleFlashesRef, leavesRef, killFeed } = useTankEffects(state, selfId);
  const input = useTankInput({ send, selfId, stateRef, canvasRef });

  const bgCacheRef = useRef<{ mapId: string; canvas: HTMLCanvasElement } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render at native device resolution so curves (tanks, monsters, bushes)
    // stay smooth instead of the browser nearest-neighbor-upscaling a lower
    // internal resolution — that mismatch was the main source of the
    // "blocky/low-res" look. All drawing below still happens in the same
    // logical VIEWPORT_W x VIEWPORT_H coordinate space thanks to this scale.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = VIEWPORT_W * dpr;
    canvas.height = VIEWPORT_H * dpr;
    ctx.scale(dpr, dpr);

    let raf = 0;
    function draw() {
      if (!ctx) return;
      const s = stateRef.current;
      const prevS = prevStateRef.current;
      const m = getMap(s.mapId);
      const { w: mapW, h: mapH } = mapCanvasSize(m);
      const self = s.players.find((p) => p.id === selfId);
      const isBlinded = !!self && !!self.blindedUntil && self.blindedUntil > s.serverNow;

      // Server ticks at 20Hz but the screen paints at ~60fps — without this,
      // every tank (and the camera that follows the local one) would sit
      // still for ~3 frames and then jump, reading as constant stutter while
      // moving. Slide smoothly from each entity's last known spot toward its
      // current one instead, snapping only on a big jump (e.g. a respawn).
      const tickT = Math.min(1, (performance.now() - stateChangedAtRef.current) / TICK_MS);
      function renderPos(id: string, curX: number, curY: number): { x: number; y: number } {
        const prev = prevS?.players.find((p) => p.id === id);
        if (!prev) return { x: curX, y: curY };
        if (Math.hypot(curX - prev.x, curY - prev.y) > TANK_SIZE * 3) return { x: curX, y: curY };
        return { x: prev.x + (curX - prev.x) * tickT, y: prev.y + (curY - prev.y) * tickT };
      }
      const selfRender = self ? renderPos(self.id, self.x, self.y) : null;

      // Same idea, extended to a free-running clock: airstrike bombers fly
      // on a fixed timeline independent of tank positions, so instead of a
      // 0..1 blend between two snapshots they need a continuously-advancing
      // estimate of "what time is it on the server right now".
      const estServerNow = s.serverNow + (performance.now() - stateChangedAtRef.current);

      // Follow-camera: center on the local player, clamped so the viewport
      // never scrolls past the map edge. Everything below is drawn in world
      // coordinates inside this translate — only the visible slice ends up
      // on screen, matching a MOBA-style zoomed-in view.
      const camX = clampCamera(selfRender ? selfRender.x : mapW / 2, VIEWPORT_W, mapW);
      const camY = clampCamera(selfRender ? selfRender.y : mapH / 2, VIEWPORT_H, mapH);
      const offsetX = Math.round(VIEWPORT_W / 2 - camX);
      const offsetY = Math.round(VIEWPORT_H / 2 - camY);
      input.cameraOffsetRef.current.x = offsetX;
      input.cameraOffsetRef.current.y = offsetY;

      ctx.clearRect(0, 0, VIEWPORT_W, VIEWPORT_H);
      ctx.save();
      ctx.translate(offsetX, offsetY);

      if (!bgCacheRef.current || bgCacheRef.current.mapId !== s.mapId) {
        const built = buildMapBackground(m);
        if (built) bgCacheRef.current = { mapId: s.mapId, canvas: built };
      }
      if (bgCacheRef.current && bgCacheRef.current.mapId === s.mapId) {
        ctx.drawImage(bgCacheRef.current.canvas, 0, 0);
      } else {
        // Floor sprites still loading — flat fallback so the frame isn't blank.
        ctx.fillStyle = m.terrain === "sand" ? "#dcc794" : "#dde9c9";
        ctx.fillRect(0, 0, mapCanvasSize(m).w, mapCanvasSize(m).h);
      }

      const now = performance.now();

      // Monster nests are marked on the ground regardless of whether the
      // monster is currently alive or mid-respawn — the territory is fixed.
      for (const monster of s.monsters) {
        drawNestPuddle(ctx, monster.nestX, monster.nestY, now);
      }

      for (let row = 0; row < m.layout.length; row++) {
        for (let col = 0; col < m.layout[row].length; col++) {
          const tile = m.layout[row][col];
          if (tile === "H") drawHazardSpikes(ctx, col * TILE_SIZE, row * TILE_SIZE, now);
          else if (tile === "B") drawBush(ctx, col * TILE_SIZE, row * TILE_SIZE, row, col, bushNeighborBias(m, row, col), now, 0.9);
        }
      }

      marksRef.current = marksRef.current.filter((mk) => now - mk.start < MARK_DURATION_MS);
      for (const mk of marksRef.current) {
        drawSkidMark(ctx, mk.x, mk.y, (now - mk.start) / MARK_DURATION_MS);
      }

      oilSpillsRef.current = oilSpillsRef.current.filter((o) => now - o.start < OIL_SPILL_DURATION_MS);
      for (const o of oilSpillsRef.current) {
        drawOilSpill(ctx, o.x, o.y, (now - o.start) / OIL_SPILL_DURATION_MS);
      }

      for (const crate of s.crates) {
        drawCrate(ctx, crate);
      }

      // Traps are only ever drawn for their own owner — everyone else's
      // client received the same data but simply chooses not to render it.
      for (const trap of s.traps) {
        if (trap.ownerId === selfId) drawTrap(ctx, trap.x, trap.y, now);
      }

      // Airstrike bomb markers — unlike traps, everyone sees these; they're
      // an environmental warning, not a player-set ambush. Ground danger
      // zones draw first so falling bombs and their shadows sit on top.
      for (const strike of s.airstrikes) {
        for (const bomb of strike.bombs) {
          const msUntilStrike = bomb.strikeAt - estServerNow;
          if (msUntilStrike <= 0) continue;
          drawBombDangerZone(ctx, bomb.x, bomb.y, msUntilStrike, bomb.radius, now);
        }
      }
      for (const strike of s.airstrikes) {
        for (const bomb of strike.bombs) {
          const msUntilStrike = bomb.strikeAt - estServerNow;
          if (msUntilStrike <= 0) continue;
          if (msUntilStrike <= BOMB_FALL_MS) {
            drawFallingBomb(ctx, bomb.x, bomb.y, 1 - msUntilStrike / BOMB_FALL_MS, now);
          } else {
            drawBombTargetIcon(ctx, bomb.x, bomb.y, now);
          }
        }
      }

      for (const pu of s.pickups) {
        if (pu.kind === "health") drawHealthPickup(ctx, pu.x, pu.y);
        else drawItemPickup(ctx, pu.x, pu.y, pu.kind);
      }

      for (const b of s.bullets) {
        if (b.kind === "big") {
          drawBigBullet(ctx, b.x, b.y, b.angle, now);
        } else if (b.kind === "fire") {
          drawFireBullet(ctx, b.x, b.y, b.angle, now);
        } else if (b.kind === "blind") {
          drawBlindBullet(ctx, b.x, b.y, b.angle);
        } else {
          const owner = s.players.find((p) => p.id === b.ownerId);
          drawNormalBullet(ctx, b.x, b.y, b.angle, owner ? skinForColor(owner.color) : "blue");
        }
      }

      for (const monster of s.monsters) {
        if (monster.alive) drawMonster(ctx, monster);
      }

      const visiblePlayers = s.players.filter((p) => p.alive && (p.id === selfId || !self || !isBushHidden(m, p, self)));
      for (const p of visiblePlayers) {
        const isAlly = p.id === selfId || (s.mode === "team" && !!self && p.team === self.team);
        const rp = renderPos(p.id, p.x, p.y);
        drawTank(ctx, rp.x, rp.y, p.color, p.dir, p.name, p.hp, p.id === selfId, isAlly, p.isBoosting, p.shieldHitsLeft, p.aimAngle);
        if (p.burningUntil && p.burningUntil > s.serverNow) drawBurningOverlay(ctx, rp.x, rp.y, now);
      }

      // Whoever's standing in a bush (self included) gets a second, lighter
      // pass of foliage drawn on top afterward — reads as grass partially
      // covering the tank, instead of the bush only ever sitting underneath.
      for (const p of visiblePlayers) {
        const row = Math.floor(p.y / TILE_SIZE);
        const col = Math.floor(p.x / TILE_SIZE);
        if ((m.layout[row]?.[col] ?? "#") !== "B") continue;
        drawBush(ctx, col * TILE_SIZE, row * TILE_SIZE, row, col, bushNeighborBias(m, row, col), now, 0.5);
      }

      explosionsRef.current = explosionsRef.current.filter((ex) => now - ex.start < explosionDurationFor(ex.kind));
      for (const ex of explosionsRef.current) {
        const duration = explosionDurationFor(ex.kind);
        drawExplosion(ctx, ex.x, ex.y, (now - ex.start) / duration, ex.kind, ex.radius);
      }

      leavesRef.current = leavesRef.current.filter((l) => now - l.start < LEAF_PARTICLE_DURATION_MS);
      for (const l of leavesRef.current) {
        drawLeafParticle(ctx, l, (now - l.start) / LEAF_PARTICLE_DURATION_MS);
      }

      muzzleFlashesRef.current = muzzleFlashesRef.current.filter((f) => now - f.start < MUZZLE_FLASH_DURATION_MS);
      for (const f of muzzleFlashesRef.current) {
        drawMuzzleFlash(ctx, f, (now - f.start) / MUZZLE_FLASH_DURATION_MS);
      }

      // Bombers fly above everything else in the scene. Small in the
      // distance, bulging bigger right around the moment it releases its
      // bombs, then shrinking away again as it exits — not a constant-size
      // sprite gliding past at a fixed altitude.
      for (const strike of s.airstrikes) {
        const totalFlight = strike.planeArriveAt - strike.planeDepartAt;
        const flightT = Math.max(0, Math.min(1, (estServerNow - strike.planeDepartAt) / totalFlight));
        const releaseT = (strike.strikeAt - strike.planeDepartAt) / totalFlight;
        const planeX = strike.planeFromX + (strike.planeToX - strike.planeFromX) * flightT;
        const planeY = strike.planeFromY + (strike.planeToY - strike.planeFromY) * flightT;
        const angle = Math.atan2(strike.planeToY - strike.planeFromY, strike.planeToX - strike.planeFromX);
        const sigma = 0.22;
        const bump = Math.exp(-((flightT - releaseT) ** 2) / (2 * sigma * sigma));
        const sizeScale = 0.55 + 0.85 * bump;
        drawBombPlane(ctx, planeX, planeY, angle, now, sizeScale);
      }

      ctx.restore();

      // Fog of war: purely a local rendering restriction — the browser still
      // has the full state above, it just chooses to paint over most of it.
      // Drawn in screen space (post-restore), so it has to re-derive where
      // the local tank landed on screen after the camera translate above.
      if (isBlinded && self) {
        const screenX = self.x + offsetX;
        const screenY = self.y + offsetY;
        ctx.save();
        ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
        ctx.beginPath();
        ctx.rect(0, 0, VIEWPORT_W, VIEWPORT_H);
        ctx.arc(screenX, screenY, VISION_RADIUS, 0, Math.PI * 2, true);
        ctx.fill("evenodd");
        ctx.restore();
      }

      drawMinimap(minimapRef.current, s, m, selfId, camX, camY);

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // The ref objects below are stable for the component's whole lifetime
    // (returned once each from useTankEffects/useTankInput and never
    // reassigned) — including them here doesn't change when this effect
    // re-runs, it just satisfies the linter, which can't see through the
    // custom hooks to verify that stability itself.
  }, [selfId, input.cameraOffsetRef, explosionsRef, marksRef, oilSpillsRef, muzzleFlashesRef, leavesRef]);

  const self = state.players.find((p) => p.id === selfId);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={VIEWPORT_W}
          height={VIEWPORT_H}
          onMouseMove={input.handleAimMove}
          onMouseLeave={input.handleAimLeave}
          onMouseDown={input.handleMouseDown}
          onMouseUp={input.handleMouseUp}
          className="block w-full touch-none rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{ aspectRatio: `${VIEWPORT_W} / ${VIEWPORT_H}` }}
        />
        <canvas
          ref={minimapRef}
          width={MINIMAP_W}
          height={MINIMAP_H}
          className="absolute left-2 top-2 rounded-md border border-white/50 shadow-lg md:bottom-2 md:left-auto md:right-2 md:top-auto"
        />
        {killFeed.length > 0 && (
          <div className="pointer-events-none absolute right-2 top-2 flex max-w-[70%] flex-col items-end gap-1">
            {killFeed.map((f) => (
              <div key={f.id} className="truncate rounded bg-black/70 px-2 py-1 text-[11px] font-medium text-white shadow">
                {f.text}
              </div>
            ))}
          </div>
        )}

        {/* Touch controls — desktop has keyboard (WASD/arrows, space, Shift),
            so these only render on small/touch-sized viewports. */}
        <div
          ref={input.joyBaseRef}
          onPointerDown={input.handleJoyPointerDown}
          onPointerMove={input.handleJoyPointerMove}
          onPointerUp={input.resetJoystick}
          onPointerCancel={input.resetJoystick}
          className="absolute bottom-3 left-3 h-24 w-24 touch-none rounded-full border border-white/40 bg-black/25 md:hidden"
        >
          <div
            ref={input.joyKnobRef}
            className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 shadow"
          />
        </div>
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            input.setBoost(true);
          }}
          onPointerUp={() => input.setBoost(false)}
          onPointerCancel={() => input.setBoost(false)}
          className="absolute bottom-24 right-3 flex h-14 w-14 touch-none items-center justify-center rounded-full border border-white/40 bg-amber-400/80 text-xl shadow-lg md:hidden"
        >
          ⚡
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            input.startShooting();
          }}
          onPointerUp={input.stopShooting}
          onPointerCancel={input.stopShooting}
          className="absolute bottom-3 right-3 flex h-16 w-16 touch-none items-center justify-center rounded-full border border-white/40 bg-red-500/80 text-xs font-bold text-white shadow-lg md:hidden"
        >
          BẮN
        </button>
      </div>
      {self && (
        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-xl">
          <span className="shrink-0 text-xs font-medium text-slate-500">⚡ Tăng tốc (Shift)</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-amber-400 transition-[width]"
              style={{ width: `${Math.max(0, Math.min(100, (self.boostEnergy / MAX_BOOST_ENERGY) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
