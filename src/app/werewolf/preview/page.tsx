"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_WEREWOLF_CONFIG,
  type PrivateWerewolfState,
  type PublicWerewolfState,
  type WerewolfClientMessage,
  type WerewolfPhase,
  type WerewolfPlayer,
  type WerewolfRole,
  type WerewolfTeam,
} from "@shared/werewolfTypes";
import { GAME_CONTENT } from "@/components/werewolf/gameContent";
import { DisconnectNotice } from "@/components/werewolf/DisconnectNotice";
import { NarratorLine } from "@/components/werewolf/NarratorLine";
import { werewolfFontClass } from "@/lib/werewolfFonts";
import { describeWerewolfSound, useWerewolfSound } from "@/lib/werewolfSound";
import { LobbyScreen } from "@/components/werewolf/screens/LobbyScreen";
import { RoleRevealScreen } from "@/components/werewolf/screens/RoleRevealScreen";
import { NightScreen } from "@/components/werewolf/screens/NightScreen";
import {
  DawnScreen,
  DiscussionScreen,
  GameEndScreen,
  VoteResultScreen,
  VotingScreen,
} from "@/components/werewolf/screens/DayScreens";
import { PlayerStrip } from "@/components/werewolf/ui";
import { SuspicionChart } from "@/components/werewolf/SuspicionChart";
import { WerewolfHistoryDetail, type WerewolfHistoryDetailData } from "@/components/werewolf/WerewolfHistoryDetail";

const ROLES: WerewolfRole[] = ["villager", "wolf", "seer", "guardian", "witch"];
type PreviewScene = WerewolfPhase | "suspicion" | "history";

const SCENES: Array<{ id: PreviewScene; label: string }> = [
  { id: "lobby", label: GAME_CONTENT.phaseLabels.lobby },
  { id: "roleReveal", label: GAME_CONTENT.phaseLabels.roleReveal },
  { id: "nightExplore", label: GAME_CONTENT.phaseLabels.nightExplore },
  { id: "wolfLock", label: GAME_CONTENT.phaseLabels.wolfLock },
  { id: "nightResolve", label: GAME_CONTENT.phaseLabels.nightResolve },
  { id: "dawn", label: GAME_CONTENT.phaseLabels.dawn },
  { id: "discussion", label: GAME_CONTENT.phaseLabels.discussion },
  { id: "suspicion", label: "Biểu đồ nghi ngờ" },
  { id: "voting", label: GAME_CONTENT.phaseLabels.voting },
  { id: "voteResult", label: GAME_CONTENT.phaseLabels.voteResult },
  { id: "gameEnd", label: GAME_CONTENT.phaseLabels.gameEnd },
  { id: "history", label: "Lịch sử trận đã lưu" },
];

// Mirrors WerewolfGameRoom.tsx's day/night split so the design tool matches
// what players actually see instead of the pre-redesign flat dark shell.
const NIGHT_PHASES: WerewolfPhase[] = ["roleReveal", "nightExplore", "wolfLock", "nightResolve"];

const VIEWPORTS = {
  mobile: { label: "Mobile · 390px", width: 390 },
  tablet: { label: "Tablet · 768px", width: 768 },
  desktop: { label: "Desktop · 1180px", width: 1180 },
} as const;

type Viewport = keyof typeof VIEWPORTS;

export default function WerewolfPreviewPage() {
  const [role, setRole] = useState<WerewolfRole>("villager");
  const [scene, setScene] = useState<PreviewScene>("nightExplore");
  const [viewport, setViewport] = useState<Viewport>("mobile");
  const [winner, setWinner] = useState<WerewolfTeam>("village");
  const [canvasMode, setCanvasMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedRole = params.get("role") as WerewolfRole | null;
    const requestedScene = params.get("scene") as PreviewScene | null;
    const requestedWinner = params.get("winner") as WerewolfTeam | null;
    if (requestedRole && ROLES.includes(requestedRole)) setRole(requestedRole);
    if (requestedScene && SCENES.some((item) => item.id === requestedScene)) setScene(requestedScene);
    if (requestedWinner === "village" || requestedWinner === "wolves") setWinner(requestedWinner);
    setCanvasMode(params.get("mode") === "canvas");
  }, []);

  if (canvasMode) return <PreviewCanvas role={role} scene={scene} winner={winner} />;

  const iframeUrl = `/werewolf/preview?mode=canvas&role=${role}&scene=${scene}&winner=${winner}`;

  return (
    <main className="min-h-app bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Design tool</p>
            <h1 className="mt-1 text-2xl font-bold">View as — Ma Sói</h1>
            <p className="mt-1 text-sm text-slate-400">Render trực tiếp component production với dữ liệu mẫu.</p>
          </div>
          <Link href="/werewolf" className="rounded-md border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">
            ← Về game
          </Link>
        </header>

        <section className="mb-5 grid gap-3 rounded-md border border-white/10 bg-slate-900 p-4 md:grid-cols-4">
          <PreviewSelect label="View as role" value={role} onChange={(value) => setRole(value as WerewolfRole)}>
            {ROLES.map((item) => <option key={item} value={item}>{GAME_CONTENT.roleReveal.roles[item].title}</option>)}
          </PreviewSelect>
          <PreviewSelect label="Scene / phase" value={scene} onChange={(value) => setScene(value as PreviewScene)}>
            {SCENES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </PreviewSelect>
          <PreviewSelect label="Viewport" value={viewport} onChange={(value) => setViewport(value as Viewport)}>
            {Object.entries(VIEWPORTS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </PreviewSelect>
          <PreviewSelect label="Winning faction" value={winner} onChange={(value) => setWinner(value as WerewolfTeam)}>
            <option value="village">Phe Dân thắng</option>
            <option value="wolves">Phe Sói thắng</option>
          </PreviewSelect>
        </section>

        <div className="overflow-auto rounded-md border border-white/10 bg-black/40 p-3 sm:p-6">
          <iframe
            key={iframeUrl}
            title={`Preview ${role} ${scene}`}
            allow="autoplay"
            src={iframeUrl}
            style={{ width: VIEWPORTS[viewport].width, height: 820 }}
            className="mx-auto block max-w-none rounded-md border border-white/10 bg-slate-950 shadow-2xl"
          />
        </div>
      </div>
    </main>
  );
}

function PreviewCanvas({ role, scene, winner }: { role: WerewolfRole; scene: PreviewScene; winner: WerewolfTeam }) {
  const [showingRole, setShowingRole] = useState(true);
  const [lastAction, setLastAction] = useState<WerewolfClientMessage | null>(null);
  const phase: WerewolfPhase = scene === "suspicion" || scene === "history" ? "discussion" : scene;
  const state = useMemo(() => createPublicState(phase, winner), [phase, winner]);
  const privateState = useMemo(() => createPrivateState(role), [role]);
  const send = (message: WerewolfClientMessage) => setLastAction(message);
  const sound = useWerewolfSound(state);
  const isNight = NIGHT_PHASES.includes(phase);
  const sceneClass = isNight ? "bg-werewolf-scene" : "bg-werewolf-scene-day";

  return (
    <main
      data-time={isNight ? "night" : "day"}
      className={`${werewolfFontClass} werewolf-root ${sceneClass} flex min-h-app flex-col px-4 py-5 text-[var(--ww-text)] transition-colors duration-500 sm:py-8 md:h-dvh md:overflow-hidden`}
    >
      <div className="mx-auto flex w-full min-h-0 max-w-5xl flex-1 flex-col">
        <header className="mb-4 shrink-0 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 font-ww-display text-xs uppercase tracking-widest text-[var(--ww-accent)]">
              <span aria-hidden>{isNight ? "🌙" : "☀️"}</span> {GAME_CONTENT.phaseLabels[phase]}
            </div>
            <div className="font-mono text-sm text-[var(--ww-text-muted)]">VIEW AS · {role}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={sound.replay}
              title={describeWerewolfSound(state)}
              className="rounded-full border border-[var(--ww-border-strong)] bg-[var(--ww-accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--ww-accent)]"
            >
              🔊 Nghe cảnh này
            </button>
            <span className="rounded-full bg-[var(--ww-surface-soft)] px-4 py-2 font-mono font-bold text-[var(--ww-text)]">18s</span>
          </div>
        </header>
        <p className="-mt-2 mb-3 text-right font-mono text-[11px] text-[var(--ww-text-faint)]">{describeWerewolfSound(state)}</p>

        {lastAction && (
          <button onClick={() => setLastAction(null)} className="mb-3 w-full rounded-md bg-[var(--ww-safe)]/15 p-2 text-left text-xs text-[var(--ww-safe)]">
            Action preview: {JSON.stringify(lastAction)}
          </button>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <DisconnectNotice players={state.players} />
          <PlayerStrip players={state.players} onLeave={() => setLastAction({ type: "leave_room" })} />
          {phase !== "lobby" && <NarratorLine state={state} />}
          <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-[var(--ww-border)] bg-[var(--ww-surface)] p-5 shadow-2xl backdrop-blur-md sm:p-7 md:overflow-y-auto">
            <PreviewPhase
              state={state}
              scene={scene}
              winner={winner}
              privateState={privateState}
              role={role}
              showingRole={showingRole}
              setShowingRole={setShowingRole}
              send={send}
            />
          </section>
        </div>
      </div>
    </main>
  );
}

interface PreviewPhaseProps {
  state: PublicWerewolfState;
  scene: PreviewScene;
  winner: WerewolfTeam;
  privateState: PrivateWerewolfState;
  role: WerewolfRole;
  showingRole: boolean;
  setShowingRole: (show: boolean) => void;
  send: (message: WerewolfClientMessage) => void;
}

function PreviewPhase(props: PreviewPhaseProps) {
  const { state, scene, winner, privateState, role, showingRole, setShowingRole, send } = props;
  const self = state.players[0];

  if (scene === "suspicion") {
    return <SuspicionChart history={privateState.suspicionHistory} players={state.players} />;
  }
  if (scene === "history") {
    return <WerewolfHistoryDetail detail={createHistoryDetail(state.players, winner)} winner={winner} />;
  }

  switch (state.phase) {
    case "lobby":
      return <LobbyScreen state={state} self={self} send={send} />;
    case "roleReveal":
      return <RoleRevealScreen role={role} teammateIds={privateState.teammates} players={state.players} showingRole={showingRole} setShowingRole={setShowingRole} onConfirm={() => send({ type: "ack_role" })} />;
    case "nightExplore":
    case "wolfLock":
    case "nightResolve":
      return <NightScreen phase={state.phase} role={role} selfId={self.id} players={state.players} privateState={privateState} send={send} />;
    case "dawn":
      return <DawnScreen state={state} />;
    case "discussion":
      return <DiscussionScreen state={state} role={role} privateState={privateState} isHost self={self} send={send} />;
    case "voting":
      return <VotingScreen players={state.players} self={self} selected={privateState.voteTargetId} initialReason={privateState.voteReason} votedIds={state.votedPlayerIds} isHost teammateIds={role === "wolf" ? privateState.teammates : undefined} send={send} />;
    case "voteResult":
      return <VoteResultScreen state={state} self={self} send={send} />;
    case "gameEnd":
      return <GameEndScreen state={state} isHost send={send} />;
  }
}

function PreviewSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 block w-full rounded-md border border-white/10 bg-slate-800 px-3 py-2 text-sm normal-case tracking-normal text-white">
        {children}
      </select>
    </label>
  );
}

function createPublicState(phase: WerewolfPhase, winner: WerewolfTeam): PublicWerewolfState {
  const players = createPlayers();
  if (["dawn", "discussion", "voting", "voteResult", "gameEnd"].includes(phase)) {
    players[8].alive = false;
    players[8].revealedRole = "villager";
  }
  if (phase === "gameEnd") {
    const roles: WerewolfRole[] = ["seer", "wolf", "guardian", "villager", "wolf", "witch", "villager", "villager", "villager"];
    players.forEach((player, index) => { player.revealedRole = roles[index]; });
  }
  return {
    roomId: "DESIGN",
    phase,
    day: 2,
    hostId: "p1",
    players,
    config: { ...DEFAULT_WEREWOLF_CONFIG },
    phaseEndsAt: Date.now() + 18_000,
    phaseStartedAt: Date.now(),
    narrationSeed: 7,
    nightDeaths: ["p9"],
    lastVoteResult: [{ playerId: "p5", votes: 4 }, { playerId: "p2", votes: 2 }],
    lastVotes: [
      { voterId: "p1", targetId: "p5", reason: "Đổi lời khai từ đầu ngày, nghe không ổn." },
      { voterId: "p2", targetId: "p5", reason: "" },
      { voterId: "p3", targetId: "p2", reason: "Bình cứ hùa theo người khác." },
      { voterId: "p4", targetId: "p5", reason: "Hạnh né câu hỏi của Chi." },
      { voterId: "p5", targetId: "p2", reason: "Bình mới là sói, tôi chắc!" },
      { voterId: "p6", targetId: "p5", reason: "Theo Tiên tri." },
      { voterId: "p7", targetId: null, reason: "" },
      { voterId: "p8", targetId: null, reason: "" },
    ],
    votedPlayerIds: ["p1", "p2", "p3", "p5"],
    resultAckedIds: ["p2", "p3"],
    chat: [
      { id: "c1", playerId: "p2", playerName: "Bình", text: "Tôi thấy Hạnh đổi lời khai từ đầu ngày.", sentAt: Date.now() - 60_000 },
      { id: "c2", playerId: "p1", playerName: "Bạn · An", text: "Tối qua mình cũng đang nghi Hạnh.", sentAt: Date.now() - 40_000 },
      { id: "c3", playerId: "p5", playerName: "Hạnh", text: "Khoan, tôi chỉ đang trả lời câu hỏi của Chi thôi!", sentAt: Date.now() - 20_000 },
      ...Array.from({ length: 14 }, (_, i) => ({ id: `x${i}`, playerId: i % 2 ? "p3" : "p6", playerName: i % 2 ? "Chi" : "Minh", text: `Tin nhắn dài thử cuộn số ${i + 1}: mình vẫn chưa chắc ai là sói cả.`, sentAt: Date.now() - 10_000 + i })),
      { id: "c4", playerId: "p2", playerName: "Bình", text: "Khoan, tôi chỉ đang trả lời câu hỏi của Chi thôi!", sentAt: Date.now() - 15_000 },
      { id: "c5", playerId: "p5", playerName: "Vạnh", text: "Khoan, tôi chỉ đang trả lời câu hỏi của Chi thôi!", sentAt: Date.now() - 10_000 },
    ],
    events: [
      { id: "night-1", day: 1, type: "peaceful_night", playerIds: [] },
      { id: "vote-1", day: 1, type: "vote_elimination", playerIds: ["p9"] },
      { id: "night-2", day: 2, type: "night_death", playerIds: ["p6"] },
    ],
    suspicionStats: [
      { playerId: "p5", nightVotes: 5, dayVotes: 6, weightedScore: 17, percentage: 35 },
      { playerId: "p2", nightVotes: 4, dayVotes: 4, weightedScore: 12, percentage: 25 },
      { playerId: "p6", nightVotes: 3, dayVotes: 3, weightedScore: 9, percentage: 19 },
      { playerId: "p3", nightVotes: 2, dayVotes: 2, weightedScore: 6, percentage: 13 },
      { playerId: "p1", nightVotes: 2, dayVotes: 1, weightedScore: 4, percentage: 8 },
    ],
    lastNightSuspicion: {
      night: 2,
      totalVotes: 8,
      results: [
        { playerId: "p5", votes: 4, percentage: 50 },
        { playerId: "p2", votes: 2, percentage: 25 },
        { playerId: "p6", votes: 1, percentage: 13 },
        { playerId: "p3", votes: 1, percentage: 13 },
      ],
    },
    winner: phase === "gameEnd" ? winner : null,
  };
}

function createHistoryDetail(players: WerewolfPlayer[], winner: WerewolfTeam): WerewolfHistoryDetailData {
  const roles: WerewolfRole[] = ["seer", "wolf", "guardian", "villager", "wolf", "witch", "villager", "villager", "villager"];
  return {
    players: players.map((player, index) => {
      const role = roles[index];
      const team: WerewolfTeam = role === "wolf" ? "wolves" : "village";
      return { playerId: player.id, name: player.name, role, team, survived: index < 5, won: team === winner };
    }),
    events: [],
    suspicionStats: [
      { playerId: "p5", nightVotes: 5, dayVotes: 6, weightedScore: 17, percentage: 35 },
      { playerId: "p2", nightVotes: 4, dayVotes: 4, weightedScore: 12, percentage: 25 },
      { playerId: "p6", nightVotes: 3, dayVotes: 3, weightedScore: 9, percentage: 19 },
    ],
    daysPlayed: 3,
  };
}

function createPrivateState(role: WerewolfRole): PrivateWerewolfState {
  return {
    role,
    teammates: role === "wolf" ? ["p2"] : [],
    previewTargetId: "p5",
    lockedTargetId: null,
    wolfChoices: [
      { wolfId: "p1", targetId: "p5", locked: false },
      { wolfId: "p2", targetId: "p5", locked: true },
    ],
    witchVictimId: "p5",
    healAvailable: true,
    poisonAvailable: true,
    witchDecision: null,
    seerHistory: [
      { night: 1, targetId: "p2", isWolf: true },
      { night: 2, targetId: "p6", isWolf: false },
    ],
    suspicionHistory: [
      { night: 1, targetId: "p5" },
      { night: 2, targetId: "p5" },
      { night: 3, targetId: "p2" },
    ],
    lastGuardedPlayerId: "p3",
    suspicionTargetId: "p6",
    voteTargetId: "p5",
    voteReason: "Đổi lời khai từ đầu ngày, nghe không ổn.",
    allRoles: null,
    nightDone: false,
  };
}

function createPlayers(): WerewolfPlayer[] {
  const names = ["Bạn · An", "Bình", "Chi", "Dũng", "Hạnh", "Minh", "Ngọc", "Phú", "Trang"];
  return names.map((name, index) => ({
    id: `p${index + 1}`,
    name,
    avatarSeed: `werewolf-preview-${index + 1}`,
    connected: ![5, 6, 7].includes(index),
    disconnectedUntil: [5, 6, 7].includes(index) ? Date.now() + 27_000 - index * 4000 : null,
    alive: true,
    ready: index !== 6,
    isHost: index === 0,
    revealedRole: null,
  }));
}
