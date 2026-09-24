import { MAX_WEREWOLF_PLAYERS, MIN_WEREWOLF_PLAYERS, type PublicWerewolfState, type WerewolfClientMessage, type WerewolfPlayer } from "@shared/werewolfTypes";
import { PlayerAvatar } from "../ui";

interface LobbyScreenProps {
  state: PublicWerewolfState;
  self: WerewolfPlayer;
  send: (message: WerewolfClientMessage) => void;
}

export function LobbyScreen({ state, self, send }: LobbyScreenProps) {
  const connectedCount = state.players.filter((player) => player.connected).length;

  return (
    <div>
      <h2 className="font-ww-display text-xl font-bold text-[var(--ww-text)]">Đang chờ dân làng</h2>
      <p className="mt-1 text-sm text-[var(--ww-text-muted)]">
        Cần {MIN_WEREWOLF_PLAYERS}–{MAX_WEREWOLF_PLAYERS} người. Chia sẻ mã hoặc link phòng.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {state.players.map((player) => (
          <div key={player.id} className="flex items-center gap-3 rounded-xl border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] p-3">
            <PlayerAvatar player={player} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-[var(--ww-text)]">
                {player.name}{player.id === self.id ? " (Bạn)" : ""}
              </div>
              <div className="text-xs text-[var(--ww-text-faint)]">{lobbyStatus(player)}</div>
            </div>
            <span className="text-[var(--ww-text-muted)]">{player.ready || player.isHost ? "✓" : "○"}</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-[var(--ww-text-faint)]">
        Khi chết: {state.config.revealRoleOnDeath ? "vai bị lộ cho cả làng" : "vai được giữ kín"} · hồn ma chỉ được theo dõi, không chat được
      </p>

      {self.isHost ? (
        <HostControls state={state} connectedCount={connectedCount} send={send} />
      ) : (
        <button
          onClick={() => send({ type: "set_ready", ready: !self.ready })}
          className={`mt-6 w-full rounded-xl py-3 font-bold text-[var(--ww-accent-ink)] transition hover:opacity-90 ${self.ready ? "bg-[var(--ww-safe)]" : "bg-[var(--ww-accent-strong)]"}`}
        >
          {self.ready ? "✓ Đã sẵn sàng" : "Tôi đã sẵn sàng"}
        </button>
      )}
    </div>
  );
}

function HostControls({ state, connectedCount, send }: Omit<LobbyScreenProps, "self"> & { connectedCount: number }) {
  const updateNumber = (field: "discussionSeconds" | "votingSeconds", value: number) => {
    send({ type: "update_config", config: { ...state.config, [field]: value } });
  };

  return (
    <div className="mt-6 rounded-2xl border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TimeSelect
          label="Thảo luận"
          value={state.config.discussionSeconds}
          options={[60, 120, 180]}
          onChange={(value) => updateNumber("discussionSeconds", value)}
        />
        <TimeSelect
          label="Bỏ phiếu"
          value={state.config.votingSeconds}
          options={[20, 30, 45]}
          onChange={(value) => updateNumber("votingSeconds", value)}
        />
      </div>
      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-[var(--ww-surface-soft)] px-3 py-2.5 text-sm text-[var(--ww-text)]">
        <span>
          Lộ vai khi chết
          <span className="block text-xs text-[var(--ww-text-faint)]">Tắt: người chết không bị lộ vai cho cả làng (hồn ma vẫn biết hết)</span>
        </span>
        <input
          type="checkbox"
          checked={state.config.revealRoleOnDeath}
          onChange={(event) => send({ type: "update_config", config: { ...state.config, revealRoleOnDeath: event.target.checked } })}
          className="h-5 w-5 shrink-0 accent-[var(--ww-accent-strong)]"
        />
      </label>
      <button
        disabled={connectedCount < MIN_WEREWOLF_PLAYERS}
        onClick={() => send({ type: "start_game" })}
        className="mt-4 w-full rounded-xl bg-[var(--ww-accent-strong)] py-3 font-bold text-[var(--ww-accent-ink)] transition hover:opacity-90 disabled:opacity-40"
      >
        Bắt đầu ván
      </button>
    </div>
  );
}

function TimeSelect({ label, value, options, onChange }: { label: string; value: number; options: number[]; onChange: (value: number) => void }) {
  return (
    <label className="text-sm text-[var(--ww-text-muted)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 block w-full rounded-lg border border-[var(--ww-border)] bg-[var(--ww-surface-strong)] p-2 text-[var(--ww-text)]"
      >
        {options.map((seconds) => <option key={seconds} value={seconds}>{seconds} giây</option>)}
      </select>
    </label>
  );
}

function lobbyStatus(player: WerewolfPlayer): string {
  if (player.isHost) return "Chủ phòng";
  return player.ready ? "Đã sẵn sàng" : "Chưa sẵn sàng";
}

