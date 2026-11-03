/** Run: node --import tsx scripts/hill-phase2.test.ts */
import assert from "node:assert/strict";
import { Vec2 } from "planck";
import { HillSim } from "../shared/hill/sim";
import { HILL_VEHICLES, HILL_MAPS, hillDay, hillDailySeed, type HillVehicleId, type HillMapId, type HillRunSubmission } from "../shared/hill/types";
import { hillHeight } from "../shared/hill/terrain";
import { parseHillRun } from "../src/features/hill/server/runs";
import { cacheHillRun, readHillProgress, syncHillProgress, hillWalletView } from "../src/features/hill/client/progress";
const idle = { gas: false, brake: false };
const step = (s: HillSim, n: number, jump = false) => { for (let i = 0; i < n; i++) s.step({ ...idle, jump }); };

async function main() {
  assert.equal(hillDay(new Date("2026-11-01T16:59:59Z")), "2026-11-01");
  assert.equal(hillDay(new Date("2026-11-01T17:00:00Z")), "2026-11-02");
  assert.equal(hillDailySeed("2026-11-02"), 20261102);
  assert.equal(new Set(Object.keys(HILL_MAPS).map(map => hillHeight(5, 133, map as HillMapId))).size, 4);
  for (const vehicle of Object.keys(HILL_VEHICLES) as HillVehicleId[]) {
    for (const map of Object.keys(HILL_MAPS) as HillMapId[]) {
      const s = new HillSim(20261102, { map, vehicle }); step(s, 120);
      assert.equal(s.snapshot().vehicle, vehicle); assert.equal(s.snapshot().map, map);
      assert.ok(s.snapshot().grounded, `${vehicle}/${map} settles on wheels`);
      const before = s.snapshot(); step(s, 1, true); const after = s.snapshot();
      assert.ok(after.energy > 64 && after.energy < 66, "jump costs 35 energy");
      assert.ok(s.chassis.getLinearVelocity().y > 4, "jump lifts the complete assembly");
      step(s, 60, true);
      assert.equal(s.drainEvents().filter(e => e === "jump").length, 1, "holding jump never repeats");
      assert.ok(Number.isFinite(before.chassis.y));
    }
  }
  const dash = new HillSim(1); step(dash, 120);
  dash.step({ ...idle, dash: true });
  assert.ok(dash.snapshot().energy > 74 && dash.snapshot().energy < 76);
  assert.ok(dash.chassis.getLinearVelocity().x > 7);
  assert.equal(dash.snapshot().dashCooldown, 2);
  for (let i = 0; i < 60; i++) dash.step({ ...idle, dash: true });
  assert.equal(dash.drainEvents().filter(e => e === "dash").length, 1, "holding Space does not repeat dash");
  dash.step(idle); dash.step({ ...idle, dash: true });
  assert.equal(dash.drainEvents().filter(e => e === "dash").length, 0, "dash cooldown blocks rapid tapping");
  const insufficient = new HillSim(1); step(insufficient, 120); Reflect.set(insufficient, "energy", 24);
  insufficient.step({ ...idle, dash: true }); assert.ok(!insufficient.drainEvents().includes("dash"));
  const capped = new HillSim(1); step(capped, 120);
  for (const body of [capped.chassis, ...capped.wheels]) body.setLinearVelocity(Vec2(29, 0));
  capped.step({ ...idle, dash: true }); assert.ok(capped.chassis.getLinearVelocity().x <= 30.1, "dash caps forward velocity");
  const coast = new HillSim(1); step(coast, 120);
  Reflect.set(coast, "fuel", 0);
  for (const body of [coast.chassis, ...coast.wheels]) body.setLinearVelocity(Vec2(-8, 0));
  step(coast, 3600);
  assert.equal(coast.snapshot().finished, "fuel", "rolling resistance eventually stops an empty car on flat ground");
  const coyote = new HillSim(1); step(coyote, 120);
  for (const body of [coyote.chassis, ...coyote.wheels]) body.setTransform(Vec2(body.getPosition().x, body.getPosition().y + 2), 0);
  step(coyote, 3); step(coyote, 1, true);
  assert.ok(coyote.drainEvents().includes("jump"), "coyote time allows a jump just after leaving ground");
  const air = new HillSim(1); step(air, 120); step(air, 1, true); step(air, 12); step(air, 1, true);
  assert.equal(air.drainEvents().filter(e => e === "jump").length, 1, "no second jump in flight");
  const low = new HillSim(1); step(low, 120);
  // Two jumps leave less than a third jump's cost; test the energy guard without waiting for regeneration.
  Reflect.set(low, "energy", 34); step(low, 1, true);
  assert.equal(low.drainEvents().filter(e => e === "jump").length, 0);
  const rescue = new HillSim(1);
  rescue.chassis.setTransform(Vec2(5, 1.2), Math.PI);
  rescue.wheels[0].setTransform(Vec2(6.25, 2.1), Math.PI); rescue.wheels[1].setTransform(Vec2(3.75, 2.1), Math.PI);
  step(rescue, 60); step(rescue, 1, true); step(rescue, 120);
  assert.equal(rescue.snapshot().finished, null, "rescue must right an overturned Jeep in time");
  assert.ok(rescue.drainEvents().includes("recovered"));
  const airborneRescue = new HillSim(1);
  airborneRescue.chassis.setTransform(Vec2(5, 1.2), Math.PI);
  airborneRescue.wheels[0].setTransform(Vec2(6.25, 2.1), Math.PI);
  airborneRescue.wheels[1].setTransform(Vec2(3.75, 2.1), Math.PI);
  step(airborneRescue, 60);
  assert.notEqual(airborneRescue.snapshot().overturnRemaining, null);
  Reflect.set(airborneRescue, "overturn", 9.99);
  airborneRescue.chassis.setTransform(Vec2(5, 30), 0);
  airborneRescue.wheels[0].setTransform(Vec2(3.75, 29.1), 0);
  airborneRescue.wheels[1].setTransform(Vec2(6.25, 29.1), 0);
  for (const body of [airborneRescue.chassis, ...airborneRescue.wheels]) {
    body.setLinearVelocity(Vec2(0, 0)); body.setAngularVelocity(0);
  }
  step(airborneRescue, 1);
  assert.equal(airborneRescue.snapshot().grounded, false, "rescue happens before touching down");
  assert.equal(airborneRescue.snapshot().overturnRemaining, null, "righting in midair clears the countdown");
  assert.equal(airborneRescue.snapshot().finished, null, "righting at the deadline prevents overturn death");
  assert.ok(airborneRescue.drainEvents().includes("recovered"));
  const valid: HillRunSubmission = { runId: "review-run-0000001", playerId: "abc123def4", name: "Phú", map: "tea", vehicle: "jeep", seed: 20261102, day: null, distance: 300, coins: 25, duration: 30 };
  assert.ok(parseHillRun(valid));
  for (const patch of [{ coins: -1 }, { distance: Infinity }, { duration: 0 }, { vehicle: "truck" }, { day: "2026-11-03", seed: 20261102 }, { playerId: { $ne: "" } }]) assert.equal(parseHillRun({ ...valid, ...patch }), null);
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) }, configurable: true });
  cacheHillRun(valid); cacheHillRun(valid);
  assert.equal(readHillProgress(valid.playerId).pending.length, 1);
  assert.equal(hillWalletView(readHillProgress(valid.playerId)).coins, 25);
  const originalFetch = globalThis.fetch;
  let fail = true, calls = 0;
  globalThis.fetch = async (_url, options) => {
    if (!options?.method) return Response.json({ coins: 0, unlocked: ["jeep"] });
    calls++; assert.equal(JSON.parse(String(options.body)).runId, valid.runId);
    if (fail) return Response.json({ error: "Offline" }, { status: 503 });
    return Response.json({ wallet: { coins: 25, unlocked: ["jeep"] } });
  };
  await assert.rejects(() => syncHillProgress(valid.playerId));
  assert.equal(readHillProgress(valid.playerId).pending.length, 1, "temporary failure preserves pending run");
  fail = false; await syncHillProgress(valid.playerId);
  assert.equal(readHillProgress(valid.playerId).pending.length, 0);
  assert.equal(readHillProgress(valid.playerId).wallet.coins, 25);
  assert.equal(calls, 2, "retry sends the same run ID");
  cacheHillRun({ ...valid, runId: "review-closed-00001", day: "2026-11-01" });
  globalThis.fetch = async (_url, options) => options?.method ? Response.json({ error: "Đã khóa sổ" }, { status: 409 }) : Response.json({ coins: 25, unlocked: ["jeep"] });
  const closed = await syncHillProgress(valid.playerId);
  assert.equal(closed.pending.length, 0); assert.equal(closed.rejected?.length, 1);
  assert.equal(hillWalletView(closed).coins, 25, "rejected runs never add spendable coins");
  globalThis.fetch = originalFetch;
  console.log("Phase 2 passed: 16 map/car combinations, jump/coyote/energy/rescue/dash, Vietnam daily rollover, run validation, offline retry and closed daily boards.");
}
void main();
