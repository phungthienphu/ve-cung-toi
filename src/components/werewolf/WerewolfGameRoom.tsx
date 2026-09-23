"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWerewolfRoom } from "@/lib/useWerewolfRoom";
import { werewolfFontClass } from "@/lib/werewolfFonts";
import type { WerewolfClientMessage, WerewolfPhase, WerewolfPlayer } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "./gameContent";
import { PlayerSidebar } from "./ui";
import { LobbyScreen } from "./screens/LobbyScreen";
import { RoleRevealScreen } from "./screens/RoleRevealScreen";
import { NightScreen } from "./screens/NightScreen";
import { DawnScreen, DiscussionScreen, GameEndScreen, VoteResultScreen, VotingScreen } from "./screens/DayScreens";
import { RoleQuickView } from "./RoleQuickView";

// Night phases get the dark "ma mị" (eerie) treatment; everything else
// reads as daylight. This is keyed on the *game's* phase, deliberately not
// the viewer's OS light/dark preference (see the data-time attribute
// below). roleReveal is grouped with night too — it's the game's most
// suspenseful beat (discovering your secret role), not narratively "day".
const NIGHT_PHASES: WerewolfPhase[] = ["roleReveal", "nightExplore", "wolfLock", "nightResolve"];

interface WerewolfGameRoomProps {
  roomId: string;
  playerId: string;
  name: string;
}

export default function WerewolfGameRoom({ roomId, playerId, name }: WerewolfGameRoomProps) {
  const router = useRouter();
  const room = useWerewolfRoom(roomId, playerId, name);
  const [showingRole, setShowingRole] = useState(false);
  const [quickRoleOpen, setQuickRoleOpen] = useState(false);
  const secondsRemaining = useCountdown(room.state?.phaseEndsAt);
  const self = room.state?.players.find((player) => player.id === playerId);

  if (!room.state || !self) return <LoadingRoom />;

  const leaveRoom = () => {
    room.send({ type: "leave_room" });
    router.push("/werewolf");
  };

  const isNight = NIGHT_PHASES.includes(room.state.phase);
  const sceneClass = isNight ? "bg-werewolf-scene" : "bg-werewolf-scene-day";

  return (
    <main
      data-time={isNight ? "night" : "day"}
      className={`${werewolfFontClass} werewolf-root ${sceneClass} flex min-h-app flex-col px-4 py-5 text-[var(--ww-text)] transition-colors duration-500 sm:py-8 md:h-dvh md:overflow-hidden`}
    >
      <div className="mx-auto flex w-full min-h-0 max-w-5xl flex-1 flex-col gap-3">
        <RoomHeader
          roomId={roomId}
          phaseLabel={GAME_CONTENT.phaseLabels[room.state.phase]}
          isNight={isNight}
          secondsRemaining={secondsRemaining}
          canViewRole={Boolean(room.privateState?.role && room.state.phase !== "lobby" && room.state.phase !== "roleReveal")}
          onViewRole={() => setQuickRoleOpen(true)}
        />

        {!room.connected && <ConnectionWarning />}
        {room.error && <ErrorBanner message={room.error} onClose={room.clearError} />}

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[1fr_260px]">
          <section className="min-h-0 rounded-3xl border border-[var(--ww-border)] bg-[var(--ww-surface)] p-5 shadow-2xl backdrop-blur-md sm:p-7 md:overflow-y-auto">
            <PhaseScreen
              playerId={playerId}
              self={self}
              room={room}
              showingRole={showingRole}
              setShowingRole={setShowingRole}
            />
          </section>
          <div className="min-h-0 md:overflow-y-auto">
            <PlayerSidebar players={room.state.players} onLeave={leaveRoom} />
          </div>
        </div>
      </div>
      {quickRoleOpen && room.privateState?.role && (
        <RoleQuickView role={room.privateState.role} onClose={() => setQuickRoleOpen(false)} />
      )}
    </main>
  );
}

interface PhaseScreenProps {
  playerId: string;
  self: WerewolfPlayer;
  room: ReturnType<typeof useWerewolfRoom>;
  showingRole: boolean;
  setShowingRole: (show: boolean) => void;
}

function PhaseScreen({ playerId, self, room, showingRole, setShowingRole }: PhaseScreenProps) {
  const state = room.state;
  if (!state) return null;

  switch (state.phase) {
    case "lobby":
      return <LobbyScreen state={state} self={self} send={room.send} />;
    case "roleReveal":
      return (
        <RoleRevealScreen
          role={room.privateState?.role ?? null}
          teammateIds={room.privateState?.teammates ?? []}
          players={state.players}
          showingRole={showingRole}
          setShowingRole={setShowingRole}
          onConfirm={() => room.send({ type: "ack_role" })}
        />
      );
    case "nightExplore":
    case "wolfLock":
    case "nightResolve":
      if (!room.privateState?.role) return null;
      return (
        <NightScreen
          phase={state.phase}
          role={room.privateState.role}
          selfId={playerId}
          players={state.players}
          privateState={room.privateState}
          send={room.send}
        />
      );
    case "dawn":
      return <DawnScreen state={state} />;
    case "discussion":
      return (
        <DiscussionScreen
          state={state}
          role={room.privateState?.role ?? null}
          privateState={room.privateState}
          isHost={self.isHost}
          self={self}
          send={room.send}
        />
      );
    case "voting":
      return (
        <VotingScreen
          players={state.players}
          self={self}
          selected={room.privateState?.voteTargetId ?? null}
          teammateIds={room.privateState?.role === "wolf" ? room.privateState.teammates : undefined}
          send={room.send}
        />
      );
    case "voteResult":
      return <VoteResultScreen state={state} />;
    case "gameEnd":
      return <GameEndScreen state={state} isHost={self.isHost} send={room.send} />;
  }
}

function RoomHeader({ roomId, phaseLabel, isNight, secondsRemaining, canViewRole, onViewRole }: { roomId: string; phaseLabel: string; isNight: boolean; secondsRemaining: number | null; canViewRole: boolean; onViewRole: () => void }) {
  const copyInviteLink = () => navigator.clipboard.writeText(window.location.href);

  return (
    <header className="flex shrink-0 items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-1.5 font-ww-display text-sm font-bold uppercase tracking-widest text-[var(--ww-accent)]">
          <span aria-hidden>{isNight ? "🌙" : "☀️"}</span> {phaseLabel}
        </div>
        <div className="font-mono text-xs text-[var(--ww-text-muted)]">Phòng {roomId}</div>
      </div>
      <div className="flex items-center gap-2">
        {canViewRole && (
          <button onClick={onViewRole} className="rounded-full border border-[var(--ww-border-strong)] bg-[var(--ww-accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--ww-accent)]">
            Vai của tôi
          </button>
        )}
        {secondsRemaining !== null && (
          <span className="rounded-full bg-[var(--ww-surface-soft)] px-4 py-2 font-mono font-bold tabular-nums text-[var(--ww-text)]">{secondsRemaining}s</span>
        )}
        <button onClick={copyInviteLink} className="rounded-full bg-[var(--ww-surface-soft)] px-3 py-2 text-sm text-[var(--ww-text)] transition hover:bg-[var(--ww-surface-soft-hover)]">
          Mời bạn
        </button>
      </div>
    </header>
  );
}

function ConnectionWarning() {
  return (
    <div className="shrink-0 rounded-xl bg-[var(--ww-warn-soft)] p-3 text-sm text-[var(--ww-warn)]">
      Mất kết nối — đang thử kết nối lại…
    </div>
  );
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <button onClick={onClose} className="w-full shrink-0 rounded-xl bg-[var(--ww-danger-soft)] p-3 text-left text-sm text-[var(--ww-danger)]">
      {message} · bấm để đóng
    </button>
  );
}

function LoadingRoom() {
  return (
    <main className={`${werewolfFontClass} bg-werewolf-scene flex min-h-app items-center justify-center text-slate-300`}>
      Đang kết nối tới ngôi làng…
    </main>
  );
}

function useCountdown(endsAt: number | null | undefined): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;
}

// Re-exported for screen-level tests and future Storybook stories.
export type WerewolfSend = (message: WerewolfClientMessage) => void;
export type NightPhase = Extract<WerewolfPhase, "nightExplore" | "wolfLock" | "nightResolve">;
