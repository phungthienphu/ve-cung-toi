"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWerewolfRoom } from "@/lib/useWerewolfRoom";
import type { WerewolfClientMessage, WerewolfPhase, WerewolfPlayer } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "./gameContent";
import { PlayerSidebar } from "./ui";
import { LobbyScreen } from "./screens/LobbyScreen";
import { RoleRevealScreen } from "./screens/RoleRevealScreen";
import { NightScreen } from "./screens/NightScreen";
import { DawnScreen, DiscussionScreen, GameEndScreen, VoteResultScreen, VotingScreen } from "./screens/DayScreens";
import { RoleQuickView } from "./RoleQuickView";

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

  return (
    <main className="bg-werewolf-scene min-h-app px-4 py-5 text-white sm:py-8">
      <div className="mx-auto max-w-5xl">
        <RoomHeader
          roomId={roomId}
          phaseLabel={GAME_CONTENT.phaseLabels[room.state.phase]}
          secondsRemaining={secondsRemaining}
          canViewRole={Boolean(room.privateState?.role && room.state.phase !== "lobby" && room.state.phase !== "roleReveal")}
          onViewRole={() => setQuickRoleOpen(true)}
        />

        {!room.connected && <ConnectionWarning />}
        {room.error && <ErrorBanner message={room.error} onClose={room.clearError} />}

        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <section className="rounded-2xl border border-white/10 bg-slate-900/75 p-5 shadow-2xl backdrop-blur sm:p-7">
            <PhaseScreen
              playerId={playerId}
              self={self}
              room={room}
              showingRole={showingRole}
              setShowingRole={setShowingRole}
            />
          </section>
          <PlayerSidebar players={room.state.players} onLeave={leaveRoom} />
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
          send={room.send}
        />
      );
    case "voteResult":
      return <VoteResultScreen state={state} />;
    case "gameEnd":
      return <GameEndScreen state={state} isHost={self.isHost} send={room.send} />;
  }
}

function RoomHeader({ roomId, phaseLabel, secondsRemaining, canViewRole, onViewRole }: { roomId: string; phaseLabel: string; secondsRemaining: number | null; canViewRole: boolean; onViewRole: () => void }) {
  const copyInviteLink = () => navigator.clipboard.writeText(window.location.href);

  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-widest text-violet-300">{phaseLabel}</div>
        <div className="font-mono text-sm text-slate-400">Phòng {roomId}</div>
      </div>
      <div className="flex items-center gap-2">
        {canViewRole && (
          <button onClick={onViewRole} className="rounded-full border border-violet-300/20 bg-violet-500/20 px-3 py-2 text-sm font-semibold text-violet-100">
            Vai của tôi
          </button>
        )}
        {secondsRemaining !== null && (
          <span className="rounded-full bg-white/10 px-4 py-2 font-mono font-bold">{secondsRemaining}s</span>
        )}
        <button onClick={copyInviteLink} className="rounded-full bg-white/10 px-3 py-2 text-sm">
          Mời bạn
        </button>
      </div>
    </header>
  );
}

function ConnectionWarning() {
  return <div className="mb-4 rounded-xl bg-amber-500/20 p-3 text-sm text-amber-200">Mất kết nối — đang thử kết nối lại…</div>;
}

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <button onClick={onClose} className="mb-4 w-full rounded-xl bg-rose-500/20 p-3 text-left text-sm text-rose-200">
      {message} · bấm để đóng
    </button>
  );
}

function LoadingRoom() {
  return <main className="flex min-h-app items-center justify-center bg-slate-950 text-slate-300">Đang kết nối tới ngôi làng…</main>;
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
