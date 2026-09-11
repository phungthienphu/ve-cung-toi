"use client";

// The brawler's whole pre-game flow: character → weapon → headgear (once,
// for a fresh join) → a waiting room (roster, team switch, host controls)
// → "start". See party/brawler-server.ts's doc for why `status: "playing"`
// currently lands on a placeholder instead of a real match — this file only
// covers getting a group of players into that state cleanly.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBrawlerRoom } from "@/lib/useBrawlerRoom";
import { playClick } from "@/lib/sound";
import CharacterPreview from "./CharacterPreview";
import {
  BRAWLER_CHARACTERS,
  BRAWLER_HEADGEAR_OPTIONS,
  BRAWLER_ROOM_MODE_LABELS,
  BRAWLER_WEAPON_CONFIG,
  BRAWLER_WEAPONS,
  BRAWLER_CHARACTER_LABELS,
  BRAWLER_WEAPON_LABELS,
  BRAWLER_HEADGEAR_LABELS,
  MIN_BRAWLER_PLAYERS,
  type BrawlerCharacter,
  type BrawlerHeadgear,
  type BrawlerTeam,
  type BrawlerWeapon,
} from "@shared/brawlerTypes";

interface Props {
  roomId: string;
  playerId: string;
  name: string;
}

function OptionGrid<T extends string>({
  options,
  selected,
  onPick,
  labelFor,
  iconSrcFor,
}: {
  options: readonly T[];
  selected: T | null;
  onPick: (v: T) => void;
  labelFor: (v: T) => string;
  iconSrcFor: (v: T) => string | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {options.map((opt) => {
        const src = iconSrcFor(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onPick(opt)}
            className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition ${
              selected === opt ? "border-amber-500 bg-amber-50" : "border-cream-200 hover:border-amber-300"
            }`}
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="h-12 w-12 object-contain" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center text-2xl text-ink/30">🚫</span>
            )}
            <span className="text-center text-xs font-medium text-ink/70">{labelFor(opt)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function BrawlerGameRoom({ roomId, playerId, name }: Props) {
  const router = useRouter();
  const { state, kicked, send } = useBrawlerRoom(roomId, playerId, name);
  const [editing, setEditing] = useState<"character" | "weapon" | "headgear" | null>(null);

  const self = state?.players.find((p) => p.id === playerId);
  const setupDoneKey = `vct_brawler_setup_done:${roomId}`;
  const [setupDone, setSetupDone] = useState(false);
  useEffect(() => {
    if (self?.ready && sessionStorage.getItem(setupDoneKey) === "1") setSetupDone(true);
  }, [self?.ready, setupDoneKey]);

  // Explicit, button-driven wizard position — NOT derived from whether
  // self.character/self.weapon are already set. Picking an option in
  // OptionGrid only sends the choice (so the live preview/showcase updates
  // instantly); advancing to the next step is a separate "Tiếp theo" click,
  // so there's time to actually see the weapon's showcase animation before
  // moving on instead of the screen jumping away the instant a pick lands.
  const [wizardStep, setWizardStep] = useState<"character" | "weapon" | "headgear">("character");
  const seededWizardRef = useRef(false);
  useEffect(() => {
    if (seededWizardRef.current || !self) return;
    seededWizardRef.current = true;
    if (self.character === null) setWizardStep("character");
    else if (self.weapon === null) setWizardStep("weapon");
    else setWizardStep("headgear");
  }, [self]);

  useEffect(() => {
    if (kicked) router.push("/brawler");
  }, [kicked, router]);

  if (!state || !self) {
    return (
      <main className="flex min-h-app items-center justify-center bg-brawler-scene px-4">
        <p className="text-sm text-ink/50">Đang kết nối...</p>
      </main>
    );
  }

  function handleLeave() {
    playClick();
    send({ type: "leave_room" });
    router.push("/brawler");
  }

  // ---------- Placeholder for "playing"/"ended" — no match simulation yet ----------
  if (state.status === "playing" || state.status === "ended") {
    return (
      <main className="flex min-h-app items-center justify-center bg-brawler-scene px-4 py-10">
        <div className="w-full max-w-md rounded-xl border border-cream-200 bg-white p-8 text-center shadow-xl">
          <div className="mb-3 text-4xl">🚧</div>
          <h2 className="mb-2 text-lg font-bold text-ink">Trận đấu đang được xây dựng</h2>
          <p className="mb-6 text-sm text-ink/60">
            Phần chọn nhân vật/vũ khí/đội đã sẵn sàng — phần thi đấu thực tế (di chuyển, va chạm, chiến đấu) sẽ có ở bản cập nhật sau.
          </p>
          <div className="flex justify-center gap-2">
            {state.hostId === playerId && (
              <button
                onClick={() => {
                  playClick();
                  send({ type: "play_again" });
                }}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Quay lại phòng chờ
              </button>
            )}
            <button
              onClick={handleLeave}
              className="rounded-lg border border-cream-200 px-4 py-2 text-sm font-medium text-ink/70 transition hover:border-amber-400"
            >
              Rời phòng
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------- Step wizard: character → weapon → headgear (first-time setup) ----------
  const step: "character" | "weapon" | "headgear" | null = editing ?? (!setupDone ? wizardStep : null);

  if (step === "character" || step === "weapon" || step === "headgear") {
    const stepIndex = { character: 1, weapon: 2, headgear: 3 }[step];
    return (
      <main className="flex min-h-app items-center justify-center bg-brawler-scene px-4 py-10">
        <div className="w-full max-w-2xl rounded-xl border border-cream-200 bg-white p-6 shadow-xl">
          <div className="mb-1 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-ink">
                {step === "character" ? "Chọn nhân vật" : step === "weapon" ? "Chọn vũ khí" : "Chọn trang bị (tùy chọn)"}
              </h2>
              <span className="text-xs font-medium text-ink/40">Bước {stepIndex}/3</span>
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <CharacterPreview character={self.character} weapon={self.weapon} headgear={self.headgear} sizeClassName="h-16 w-16" />
              <span className="text-[10px] font-medium text-ink/40">Xem trước</span>
            </div>
          </div>
          <p className="mb-4 text-xs text-ink/50">
            {step === "character" && "Đại diện cho bạn trên chiến trường — sẽ hiện với người chơi khác."}
            {step === "weapon" && "Vũ khí chính dùng để chiến đấu — có thể đổi lại sau ở phòng chờ."}
            {step === "headgear" && "Không bắt buộc — có thể để \"Không đội gì\" và tiếp tục."}
          </p>

          {step === "character" && (
            <OptionGrid
              options={BRAWLER_CHARACTERS}
              selected={self.character}
              onPick={(character: BrawlerCharacter) => {
                playClick();
                send({ type: "choose_character", character });
              }}
              labelFor={(c) => BRAWLER_CHARACTER_LABELS[c]}
              iconSrcFor={(c) => `/brawler/character_${c}.png`}
            />
          )}
          {step === "weapon" && (
            <OptionGrid
              options={BRAWLER_WEAPONS}
              selected={self.weapon}
              onPick={(weapon: BrawlerWeapon) => {
                playClick();
                send({ type: "choose_weapon", weapon });
              }}
              labelFor={(w) => BRAWLER_WEAPON_LABELS[w]}
              iconSrcFor={(w) => `/brawler/item_${w}.png`}
            />
          )}
          {step === "weapon" && self.weapon && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-cream-200 bg-amber-50 px-3 py-2.5">
              <span className="shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                {
                  { "melee-swing": "Cận chiến", "melee-thrust": "Cận chiến", ranged: "Tầm xa", hook: "Móc câu" }[
                    BRAWLER_WEAPON_CONFIG[self.weapon].attackType
                  ]
                }
              </span>
              <p className="text-xs leading-snug text-ink/70">{BRAWLER_WEAPON_CONFIG[self.weapon].description}</p>
            </div>
          )}
          {step === "weapon" && self.weapon && (
            <div className="mt-3 flex items-center gap-4 rounded-lg border border-cream-200 bg-slate-50 p-3">
              <CharacterPreview character={self.character} weapon={self.weapon} headgear={self.headgear} sizeClassName="h-24 w-24 shrink-0" animate />
              <p className="text-xs leading-snug text-ink/60">
                Đúng kiểu đánh thật của vũ khí này (cận chiến/tầm xa/móc câu) — tốc độ và tầm chính xác sẽ tinh chỉnh khi làm engine chiến đấu.
              </p>
            </div>
          )}
          {step === "headgear" && (
            <OptionGrid
              options={BRAWLER_HEADGEAR_OPTIONS}
              selected={self.headgear}
              onPick={(headgear: BrawlerHeadgear) => {
                playClick();
                send({ type: "choose_headgear", headgear });
              }}
              labelFor={(h) => BRAWLER_HEADGEAR_LABELS[h]}
              iconSrcFor={(h) => (h === "none" ? null : `/brawler/item_${h}.png`)}
            />
          )}

          <div className="mt-6 flex justify-end gap-2">
            {!editing && step === "character" && (
              <button
                onClick={() => {
                  playClick();
                  setWizardStep("weapon");
                }}
                disabled={!self.character}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tiếp theo →
              </button>
            )}
            {!editing && step === "weapon" && (
              <button
                onClick={() => {
                  playClick();
                  setWizardStep("headgear");
                }}
                disabled={!self.weapon}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tiếp theo →
              </button>
            )}
            {!editing && step === "headgear" && (
              <button
                onClick={() => {
                  playClick();
                  sessionStorage.setItem(setupDoneKey, "1");
                  setSetupDone(true);
                }}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Xong, vào phòng chờ →
              </button>
            )}
            {editing && (
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-700"
              >
                Đồng ý
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ---------- Waiting room: roster, team switch, host controls ----------
  const teamA = state.players.filter((p) => p.team === "A");
  const teamB = state.players.filter((p) => p.team === "B");
  const isHost = state.hostId === playerId;
  const connectedCount = state.players.filter((p) => p.connected).length;
  const everyoneReady = state.players.every((p) => p.ready);

  const playerRow = (p: (typeof state.players)[number]) => (
    <div key={p.id} className={`flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm ${!p.connected ? "opacity-40" : ""}`}>
      <CharacterPreview character={p.character} weapon={p.weapon} headgear={p.headgear} sizeClassName="h-9 w-9 shrink-0" />
      <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
      {p.isHost && <span className="shrink-0">👑</span>}
    </div>
  );

  return (
    <main className="flex min-h-app items-center justify-center bg-brawler-scene px-4 py-10">
      <div className="w-full max-w-md min-w-0 rounded-xl border border-cream-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold tracking-tight text-ink">Phòng chờ</h2>
          <span className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700">Mã: {roomId}</span>
        </div>

        {isHost && (
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Chế độ chơi</label>
            <div className="flex gap-2">
              {(["ffa", "team", "practice"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => send({ type: "set_mode", mode: m })}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    state.mode === m ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 text-slate-700 hover:border-slate-500"
                  }`}
                >
                  {BRAWLER_ROOM_MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        )}

        {state.mode === "team" ? (
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600">Đội A ({teamA.length})</div>
              <div className="space-y-1">{teamA.map(playerRow)}</div>
            </div>
            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-600">Đội B ({teamB.length})</div>
              <div className="space-y-1">{teamB.map(playerRow)}</div>
            </div>
          </div>
        ) : (
          <div className="mb-5 space-y-1.5">{state.players.map(playerRow)}</div>
        )}

        {state.mode === "team" && (
          <button
            type="button"
            onClick={() => send({ type: "choose_team", team: (self.team === "A" ? "B" : "A") as BrawlerTeam })}
            className="mb-3 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500"
          >
            Chuyển sang Đội {self.team === "A" ? "B" : "A"}
          </button>
        )}

        <div className="mb-5 flex gap-2">
          <button
            type="button"
            onClick={() => setEditing("character")}
            className="flex-1 rounded-lg border border-cream-200 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-amber-400"
          >
            Đổi nhân vật
          </button>
          <button
            type="button"
            onClick={() => setEditing("weapon")}
            className="flex-1 rounded-lg border border-cream-200 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-amber-400"
          >
            Đổi vũ khí
          </button>
          <button
            type="button"
            onClick={() => setEditing("headgear")}
            className="flex-1 rounded-lg border border-cream-200 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-amber-400"
          >
            Đổi trang bị
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {isHost ? (
            <button
              onClick={() => {
                playClick();
                send({ type: "start_game" });
              }}
              disabled={(state.mode !== "practice" && connectedCount < MIN_BRAWLER_PLAYERS) || !everyoneReady}
              className="min-w-0 flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {!everyoneReady
                ? "Còn người chưa chọn xong đồ"
                : state.mode !== "practice" && connectedCount < MIN_BRAWLER_PLAYERS
                  ? `Cần ít nhất ${MIN_BRAWLER_PLAYERS} người`
                  : "Bắt đầu trận đấu"}
            </button>
          ) : (
            <p className="min-w-0 flex-1 py-2.5 text-center text-sm text-slate-500">Đang chờ chủ phòng bắt đầu...</p>
          )}
          <button
            onClick={handleLeave}
            className="shrink-0 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-red-600 transition hover:border-red-400 hover:bg-red-50"
          >
            Rời phòng
          </button>
        </div>
      </div>
    </main>
  );
}
