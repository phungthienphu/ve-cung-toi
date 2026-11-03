import type { PipelineStage } from "mongoose";
import { HILL_BASE_SEED, hillDailySeed, hillDay, isHillMap, isHillVehicle, type HillBoard, type HillRunSubmission } from "@shared/hill/types";
import { HillRun, HillWallet } from "../../../server/models/Hill";

export const validHillPlayer = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9]{10}$/.test(v);
export function parseHillRun(value: unknown): HillRunSubmission | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (!validHillPlayer(r.playerId) || typeof r.runId !== "string" || !/^[a-zA-Z0-9_-]{16,64}$/.test(r.runId) ||
      typeof r.name !== "string" || r.name.trim().length < 1 || r.name.trim().length > 24 ||
      !isHillMap(r.map) || !isHillVehicle(r.vehicle)) return null;
  if (![r.distance, r.coins, r.duration, r.seed].every(v => typeof v === "number" && Number.isFinite(v))) return null;
  const run = r as unknown as HillRunSubmission;
  if (run.duration < 1 || run.duration > 7200 || run.distance < 0 || run.distance > run.duration * 65 ||
      !Number.isInteger(run.coins) || run.coins < 0 || run.coins > run.duration * 15 + 20 ||
      (run.day !== null && (typeof run.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(run.day))) ||
      run.seed !== (run.day ? hillDailySeed(run.day) : HILL_BASE_SEED)) return null;
  return { runId: run.runId, playerId: run.playerId, name: run.name.trim(), map: run.map, vehicle: run.vehicle,
    seed: run.seed, day: run.day, distance: Math.floor(run.distance), coins: run.coins, duration: run.duration };
}
export async function ensureHillWallet(playerId: string) {
  // A concurrent first request may lose the unique-index race; its retry reads the winner.
  try { return await HillWallet.findOneAndUpdate({ playerId }, { $setOnInsert: { playerId } }, { upsert: true, new: true }).lean(); }
  catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    return await HillWallet.findOne({ playerId }).orFail().lean();
  }
}
export async function hillBoard(map: string, day: string | null, playerId: string): Promise<HillBoard> {
  const pipeline: PipelineStage[] = [
    { $match: { map, day } },
    { $sort: { distance: -1, duration: 1, createdAt: 1, runId: 1 } },
    { $group: { _id: "$playerId", playerId: { $first: "$playerId" }, name: { $first: "$name" }, distance: { $first: "$distance" }, duration: { $first: "$duration" }, playedAt: { $first: "$createdAt" } } },
    { $setWindowFields: { sortBy: { distance: -1 }, output: { rank: { $rank: {} } } } },
    { $project: { _id: 0, playerId: 1, name: 1, distance: 1, rank: 1 } },
  ];
  const [result] = await HillRun.aggregate<{ leaders: HillBoard["leaders"]; personal: HillBoard["leaders"] }>([...pipeline,
    { $facet: { leaders: [{ $sort: { rank: 1, playerId: 1 } }, { $limit: 10 }], personal: [{ $match: { playerId } }] } },
  ]);
  const personal = result?.personal[0] ?? null;
  const nearby = personal ? await HillRun.aggregate<HillBoard["leaders"][number]>([...pipeline,
    { $match: { playerId: { $ne: playerId }, rank: { $gte: Math.max(1, personal.rank - 2), $lte: personal.rank + 2 } } },
    { $sort: { rank: 1, playerId: 1 } }, { $limit: 3 },
  ]) : [];
  return { leaders: result?.leaders ?? [], personal, nearby };
}
export function currentHillDay() { return hillDay(); }
