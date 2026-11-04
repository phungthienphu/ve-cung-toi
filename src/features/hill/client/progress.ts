import type { HillBoard, HillMapId, HillRunSubmission, HillWallet } from "@shared/hill/types";

const key = (playerId: string) => `vct_hill_${playerId}`;
interface Progress { wallet: HillWallet; bests: Record<string, number>; pending: HillRunSubmission[]; rejected?: { run: HillRunSubmission; reason: string }[] }
const empty = (): Progress => ({ wallet: { coins: 0, unlocked: ["jeep"] }, bests: {}, pending: [] });
export const hillRecordKey = (map: HillMapId, day: string | null) => `${map}:${day ?? "all"}`;
export function readHillProgress(id: string): Progress {
  try {
    const stored = JSON.parse(localStorage.getItem(key(id)) ?? "null");
    if (stored && stored.wallet && Array.isArray(stored.wallet.unlocked) && stored.bests && Array.isArray(stored.pending)) return stored;
  } catch { /* Storage is optional: callers can still play. */ }
  return empty();
}
function write(id: string, progress: Progress) { localStorage.setItem(key(id), JSON.stringify(progress)); }
export function cacheHillRun(run: HillRunSubmission) {
  const progress = readHillProgress(run.playerId);
  const record = hillRecordKey(run.map, run.day);
  progress.bests[record] = Math.max(progress.bests[record] ?? 0, run.distance);
  if (!progress.pending.some(r => r.runId === run.runId)) progress.pending.push(run);
  write(run.playerId, progress);
  return progress;
}
export function hillWalletView(progress: Progress): HillWallet { return { ...progress.wallet, coins: progress.wallet.coins + progress.pending.reduce((sum, run) => sum + run.coins, 0) }; }
export class HillRequestError extends Error { constructor(message: string, readonly status: number) { super(message); } }
async function jsonRequest<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000), ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new HillRequestError(data.error ?? "Không kết nối được máy chủ", response.status);
  return data;
}
const syncing = new Map<string, Promise<Progress>>();
export function syncHillProgress(id: string): Promise<Progress> {
  const current = syncing.get(id);
  if (current) return current;
  const promise = performSync(id).finally(() => syncing.delete(id)); syncing.set(id, promise);
  return promise;
}
async function performSync(id: string) {
  const wallet = await jsonRequest<HillWallet & { bests?: Record<string, number> }>(`/api/hill/wallet?playerId=${id}`);
  let progress = readHillProgress(id);
  progress.wallet = { coins:wallet.coins, unlocked:wallet.unlocked };
  for (const [record, distance] of Object.entries(wallet.bests ?? {})) progress.bests[record] = Math.max(progress.bests[record] ?? 0, distance);
  write(id, progress);
  for (const run of progress.pending) {
    try {
      const result = await jsonRequest<{ wallet: HillWallet }>("/api/hill/runs", run);
      const latest = readHillProgress(id); latest.wallet = result.wallet;
      latest.pending = latest.pending.filter(r => r.runId !== run.runId); write(id, latest);
    } catch (error) {
      if (!(error instanceof HillRequestError) || !(error.status === 400 ||
          (error.status === 409 && ['Đường ngày này đã khóa sổ', 'Mã lượt chạy không hợp lệ'].includes(error.message)))) throw error;
      // A closed daily board must not hold all future runs behind it forever.
      const latest = readHillProgress(id);
      latest.pending = latest.pending.filter(r => r.runId !== run.runId);
      latest.rejected = [...(latest.rejected ?? []), { run, reason: error.message }]; write(id, latest);
    }
  }
  progress = readHillProgress(id);
  return progress;
}
export async function buyHillVehicle(id: string, vehicle: string) {
  const wallet = await jsonRequest<HillWallet>("/api/hill/wallet", { playerId: id, vehicle });
  const progress = readHillProgress(id); progress.wallet = wallet; write(id, progress);
  return progress;
}
export async function loadHillBoard(map: HillMapId, day: string | null, id: string): Promise<HillBoard> {
  return jsonRequest(`/api/hill/runs?map=${map}&playerId=${id}${day ? `&day=${day}` : ""}`);
}

/** Move only pending submissions/cache; the server alone transfers the real balance. */
export function transferHillCache(guestId: string, accountId: string) {
  const source = readHillProgress(guestId), target = readHillProgress(accountId);
  for (const [record, distance] of Object.entries(source.bests)) target.bests[record] = Math.max(target.bests[record] ?? 0, distance);
  for (const run of source.pending) {
    if (!target.pending.some(existing => existing.runId === run.runId)) target.pending.push({ ...run, playerId:accountId });
  }
  // Write destination first. Retrying after interruption is safe by runId.
  write(accountId, target);
  source.pending = [];
  source.wallet = { coins:0, unlocked:['jeep'] };
  write(guestId, source);
}
