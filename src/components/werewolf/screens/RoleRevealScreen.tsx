import { ROLE_EMOJI, type WerewolfPlayer, type WerewolfRole } from "@shared/werewolfTypes";
import { GAME_CONTENT } from "../gameContent";

interface RoleRevealScreenProps {
  role: WerewolfRole | null;
  teammateIds: string[];
  players: WerewolfPlayer[];
  showingRole: boolean;
  setShowingRole: (show: boolean) => void;
  onConfirm: () => void;
}

export function RoleRevealScreen(props: RoleRevealScreenProps) {
  const { role, teammateIds, players, showingRole, setShowingRole, onConfirm } = props;
  const content = role ? GAME_CONTENT.roleReveal.roles[role] : null;
  const teammateNames = teammateIds
    .map((id) => players.find((player) => player.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="text-center">
      <p className="text-slate-400">{GAME_CONTENT.roleReveal.privacyHint}</p>
      <button
        onPointerDown={() => setShowingRole(true)}
        onPointerUp={() => setShowingRole(false)}
        onPointerLeave={() => setShowingRole(false)}
        className={`mt-6 w-full rounded-2xl border p-8 transition ${showingRole ? "border-violet-400 bg-violet-500/15" : "border-white/10 bg-white/5"}`}
      >
        {showingRole && role && content ? (
          <>
            <div className="text-6xl">{ROLE_EMOJI[role]}</div>
            <div className="mt-3 text-2xl font-bold">{content.title}</div>
            <p className="mt-2 text-sm text-slate-300">{content.instruction}</p>
            {role === "wolf" && teammateNames && (
              <p className="mt-3 text-sm text-rose-300">Đồng đội: {teammateNames}</p>
            )}
          </>
        ) : (
          <>
            <div className="text-5xl">🌑</div>
            <div className="mt-3 font-semibold">{GAME_CONTENT.roleReveal.hiddenTitle}</div>
          </>
        )}
      </button>
      <button onClick={onConfirm} className="mt-5 rounded-xl bg-violet-500 px-8 py-3 font-bold">
        {GAME_CONTENT.roleReveal.confirmButton}
      </button>
    </div>
  );
}

