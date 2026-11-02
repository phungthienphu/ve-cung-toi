/** Only run against the local Next server configured with the same isolated review DB. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { HillRun, HillWallet } from "../src/lib/models/Hill";
import { hillDay, hillDailySeed } from "../shared/hillTypes";

async function main() {
  assert.equal(process.env.MONGODB_DB_NAME, "vct_hill_review_20261102", "Requires isolated review database");
  const ids = [randomBytes(5).toString("hex"), randomBytes(5).toString("hex")];
  const base = "http://localhost:3011/api/hill";
  const call = async (path: string, body?: unknown) => {
    const response = await fetch(base + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    return { status: response.status, data: await response.json() };
  };
  try {
    const wallet = await call(`/wallet?playerId=${ids[0]}`);
    assert.equal(wallet.status, 200); assert.equal(wallet.data.coins, 0); assert.deepEqual(wallet.data.unlocked, ["jeep"]);
    const run = { runId: randomUUID(), playerId: ids[0], name: "API review", map: "tea", vehicle: "jeep", seed: 20261102, day: null, distance: 200, coins: 200, duration: 30 };
    const first = await call("/runs", run); assert.equal(first.status, 200); assert.equal(first.data.wallet.coins, 200);
    const duplicate = await Promise.all([call("/runs", run), call("/runs", run)]);
    duplicate.forEach(r => { assert.equal(r.status, 200); assert.equal(r.data.wallet.coins, 200); });
    const purchases = await Promise.all([call("/wallet", { playerId: ids[0], vehicle: "beetle" }), call("/wallet", { playerId: ids[0], vehicle: "beetle" })]);
    purchases.forEach(r => { assert.equal(r.status, 200); assert.equal(r.data.coins, 50); assert.ok(r.data.unlocked.includes("beetle")); });
    const locked = await call("/runs", { ...run, runId: randomUUID(), vehicle: "monster" }); assert.equal(locked.status, 403);
    const poor = await call("/wallet", { playerId: ids[0], vehicle: "bus" }); assert.equal(poor.status, 409);
    const invalid = await call("/runs", { ...run, coins: -1 }); assert.equal(invalid.status, 400);
    const other = await call("/runs", { ...run, playerId: ids[1], runId: randomUUID(), distance: 210, coins: 0 }); assert.equal(other.status, 200);
    const board = await call(`/runs?map=tea&playerId=${ids[0]}`); assert.equal(board.status, 200);
    assert.ok(board.data.leaders.some((r: {playerId: string}) => r.playerId === ids[0]));
    assert.ok(board.data.leaders.some((r: {playerId: string}) => r.playerId === ids[1]), "same name still has two independent records");
    assert.ok(board.data.personal.rank > 1);
    const day = hillDay();
    const daily = await call("/runs", { ...run, runId: randomUUID(), day, seed: hillDailySeed(day), coins: 0 }); assert.equal(daily.status, 200);
    const old = "2020-01-01";
    assert.equal((await call("/runs", { ...run, runId: randomUUID(), day: old, seed: hillDailySeed(old) })).status, 409);
    console.log("API integration passed: persist/rank, daily closure, same-name identities, locked vehicles, concurrent duplicate credits and purchases.");
  } finally {
    // Delete only this test's randomly generated IDs in the explicitly named review DB.
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME });
      await HillRun.deleteMany({ playerId: { $in: ids } }); await HillWallet.deleteMany({ playerId: { $in: ids } });
      await mongoose.disconnect();
    }
  }
}
void main();
