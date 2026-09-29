"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBattleshipRoom } from "@/lib/useBattleshipRoom";
import { playClick, playClockTick, playCannon, playShipHit, playShipSunk, playSplash } from "@/lib/sound";
import { MID_GAME_JOIN_MESSAGE, MODE_LABELS, type BattleshipPlayer, type PublicBattleshipState } from "@shared/battleshipTypes";
import { LobbyPanel } from "./LobbyPanel";
import { PlacementPanel } from "./PlacementPanel";
import { BattlePanel } from "./BattlePanel";
import { EndPanel } from "./EndPanel";
import { ChatBox, PlayerBadge, TEAM_COLOR, btnGhost, btnPrimary, card, shipsLeft, useCountdown } from "./ui";

const PHASE_LABEL = { lobby: "Sảnh chờ", placement: "Xếp tàu", battle: "Giao tranh", gameEnd: "Kết thúc" } as const;

export default function BattleshipRoom({ roomId, playerId, name }: { roomId: string; playerId: string; name: string }) {
  const router = useRouter();
  const room = useBattleshipRoom(roomId, playerId, name);
  const { state, privateState: priv } = room;
  const self = state?.players.find((player) => player.id === playerId);
  const seconds = useCountdown(state?.phaseEndsAt);
  const [chatTab, setChatTab] = useState<"all" | "team">("all");
  useShotSounds(state);

  // Tick through the last 5 seconds when it's on you to act.
  const mustAct = !!state && state.phase === "battle" && !state.revealUntil && (
    state.config.mode === "solo" ? state.turnPlayerId === playerId : !priv?.locked && !!priv?.shotsAllowed
  );
  useEffect(() => {
    if (mustAct && seconds !== null && seconds > 0 && seconds <= 5) playClockTick();
  }, [seconds, mustAct]);

  if (state && !self && state.phase !== "lobby") {
    return (
      <main className="bg-sea flex min-h-app flex-col items-center justify-center gap-4 px-6 text-center text-sky-50">
        <div className="text-6xl">⚓</div>
        <p className="max-w-sm text-xl font-bold">{MID_GAME_JOIN_MESSAGE}</p>
        <button onClick={() => router.push("/battleship")} className={btnPrimary}>Về sảnh Hải Chiến</button>
      </main>
    );
  }
  if (!state || !self) {
    return <main className="bg-sea flex min-h-app items-center justify-center text-sky-100">Đang ra bến tàu…</main>;
  }

  const leave = () => {
    room.send({ type: "leave_room" });
    router.push("/battleship");
  };
  const teamMode = state.config.mode === "team" && state.phase !== "lobby";

  return (
    <main
      className="bg-sea min-h-app px-3 py-4 text-sky-50 sm:px-5 sm:py-6"
      onClickCapture={(event) => {
        const button = (event.target as HTMLElement).closest("button");
        if (button && !button.disabled) playClick();
      }}
    >
      <div className="mx-auto max-w-6xl space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-lg font-extrabold tracking-tight">⚓ Hải Chiến <span className="text-sm font-semibold text-amber-300">· {MODE_LABELS[state.config.mode]}</span></div>
            <div className="text-xs text-sky-100/60">
              Phòng <span className="font-mono font-bold tracking-widest text-sky-50">{roomId}</span> · {PHASE_LABEL[state.phase]}
              {state.phase === "battle" && state.config.mode !== "solo" ? ` · vòng ${state.round}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {seconds !== null && (
              <span className={`rounded-md px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${seconds <= 5 ? "bg-rose-500/25 text-rose-100" : "bg-white/10"}`}>{seconds}s</span>
            )}
            <button onClick={() => navigator.clipboard?.writeText(window.location.href)} className={btnGhost}>Mời bạn</button>
            <button onClick={leave} className={btnGhost}>Rời phòng</button>
          </div>
        </header>

        {!room.connected && <div className="rounded-md bg-amber-500/15 px-3 py-2 text-sm text-amber-100">Mất kết nối — đang thử kết nối lại…</div>}
        {room.error && (
          <button onClick={room.clearError} className="w-full rounded-md bg-rose-500/15 px-3 py-2 text-left text-sm text-rose-100">
            {room.error} · bấm để đóng
          </button>
        )}
        <DisconnectNotice players={state.players} />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {state.phase === "lobby" && <LobbyPanel state={state} self={self} send={room.send} />}
            {state.phase === "placement" && <PlacementPanel state={state} priv={priv} self={self} send={room.send} />}
            {state.phase === "battle" && <BattlePanel state={state} priv={priv} self={self} send={room.send} />}
            {state.phase === "gameEnd" && <EndPanel state={state} self={self} send={room.send} />}
          </div>

          <aside className="space-y-3">
            <section className={`${card} p-3`}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-sky-100/60">Thuyền trưởng ({state.players.length})</h3>
              <ul className="space-y-1 text-sm">
                {state.players.map((player) => (
                  <li key={player.id} className="flex items-center justify-between gap-2">
                    <span className={player.team && state.config.mode === "team" ? TEAM_COLOR[player.team] : ""}>
                      <PlayerBadge player={player} suffix={player.id === self.id ? "(bạn)" : undefined} />
                    </span>
                    <span className="shrink-0 text-xs text-sky-100/60">{statusOf(state, player)}</span>
                  </li>
                ))}
              </ul>
            </section>

            {state.phase !== "lobby" && state.log.length > 0 && (
              <section className={`${card} p-3`}>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-sky-100/60">Nhật ký trận</h3>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-sky-100/80">
                  {[...state.log].reverse().map((entry) => <li key={entry.id}>{entry.text}</li>)}
                </ul>
              </section>
            )}

            <section className={`${card} flex h-72 flex-col overflow-hidden`}>
              {teamMode && (
                <div className="flex border-b border-white/10 text-xs">
                  {(["all", "team"] as const).map((tab) => (
                    <button key={tab} onClick={() => setChatTab(tab)} className={`flex-1 py-2 font-semibold ${chatTab === tab ? "bg-white/10 text-amber-200" : "text-sky-100/60"}`}>
                      {tab === "all" ? "Chat chung" : "Chat đội"}
                    </button>
                  ))}
                </div>
              )}
              {teamMode && chatTab === "team" ? (
                <ChatBox entries={priv?.teamChat ?? []} selfId={self.id} empty="Bàn chiến thuật với đồng đội…" onSend={(text) => room.send({ type: "chat", text, teamOnly: true })} />
              ) : (
                <ChatBox entries={state.chat} selfId={self.id} empty="Chào cả bến tàu 👋" onSend={(text) => room.send({ type: "chat", text })} />
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function statusOf(state: PublicBattleshipState, player: BattleshipPlayer): string {
  if (!player.connected) return "mất kết nối";
  if (state.phase === "lobby") return player.isHost || player.ready ? "sẵn sàng" : "đang chờ";
  if (state.phase === "placement") return player.isBot || player.ready ? "đã xếp xong" : "đang xếp";
  const board = state.boards.find((candidate) => (state.config.mode === "team" ? candidate.team === player.team : candidate.id === player.id));
  if (state.phase === "battle") {
    if (board && !board.alive) return "đã chìm";
    if (state.config.mode === "solo") return state.turnPlayerId === player.id ? "đang bắn 🎯" : `${shipsLeft(board)} tàu`;
    return state.lockedPlayerIds.includes(player.id) ? "đã khai hỏa" : "đang ngắm";
  }
  return state.winnerIds.includes(player.id) ? "🏆" : "";
}

function DisconnectNotice({ players }: { players: BattleshipPlayer[] }) {
  const [now, setNow] = useState(Date.now());
  const offline = players.filter((player) => !player.connected && player.disconnectedUntil);
  useEffect(() => {
    if (!offline.length) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [offline.length]);
  if (!offline.length) return null;
  return (
    <div className="max-h-20 overflow-y-auto rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
      📡 {offline.map((player) => `${player.name} (${Math.max(0, Math.ceil(((player.disconnectedUntil ?? 0) - now) / 1000))}s)`).join(", ")} mất kết nối — có 30s để quay lại
    </div>
  );
}

/** Cannon + splash/hit/sink sounds for each new batch of shots. */
function useShotSounds(state: PublicBattleshipState | null) {
  const seen = useRef(new Set<string>());
  const batch = state?.lastShots ?? [];
  const key = batch.map((shot) => shot.id).join(",");
  useEffect(() => {
    const fresh = batch.filter((shot) => !seen.current.has(shot.id));
    for (const shot of batch) seen.current.add(shot.id);
    if (!fresh.length) return;
    playCannon();
    const worst = fresh.some((shot) => shot.result === "sunk") ? "sunk" : fresh.some((shot) => shot.result === "hit") ? "hit" : "miss";
    const timer = setTimeout(() => (worst === "sunk" ? playShipSunk() : worst === "hit" ? playShipHit() : playSplash()), 260);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
