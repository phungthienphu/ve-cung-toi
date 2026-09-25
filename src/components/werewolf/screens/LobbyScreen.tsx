import { MAX_WEREWOLF_PLAYERS, MIN_WEREWOLF_PLAYERS, ROLE_EMOJI, ROLE_LABELS, rolesForPlayerCount, type PublicWerewolfState, type WerewolfClientMessage, type WerewolfPlayer, type WerewolfRole } from "@shared/werewolfTypes";
import { DiscussionChat } from "../DiscussionChat";
import { PlayerAvatar } from "../ui";

interface LobbyScreenProps {
  state: PublicWerewolfState;
  self: WerewolfPlayer;
  send: (message: WerewolfClientMessage) => void;
}

export function LobbyScreen({ state, self, send }: LobbyScreenProps) {
  const connectedCount = state.players.filter((player) => player.connected).length;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6">
      <div className="min-w-0">
        <h2 className="font-ww-display text-xl font-bold text-[var(--ww-text)]">Đang chờ dân làng</h2>
        <p className="mt-1 text-sm text-[var(--ww-text-muted)]">
          Cần {MIN_WEREWOLF_PLAYERS}–{MAX_WEREWOLF_PLAYERS} người. Chia sẻ mã hoặc link phòng.
        </p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {state.players.map((player) => (
            <div key={player.id} className="flex items-center gap-3 rounded-md border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] p-3">
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

        <RoomSettingsCard state={state} playerCount={connectedCount + state.config.botCount} botCount={state.config.botCount} showSettings={!self.isHost} />

        {self.isHost ? (
          <HostControls state={state} connectedCount={connectedCount} send={send} />
        ) : (
          <button
            onClick={() => send({ type: "set_ready", ready: !self.ready })}
            className={`mt-6 w-full rounded-md py-3 font-bold text-[var(--ww-accent-ink)] transition hover:opacity-90 ${self.ready ? "bg-[var(--ww-safe)]" : "bg-[var(--ww-accent-strong)]"}`}
          >
            {self.ready ? "✓ Đã sẵn sàng" : "Tôi đã sẵn sàng"}
          </button>
        )}
      </div>

      <div className="mt-6 flex h-72 min-h-0 flex-col lg:sticky lg:top-0 lg:mt-0 lg:h-[520px] lg:self-start">
        <p className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wider text-[var(--ww-text-faint)]">💬 Trò chuyện trong sảnh</p>
        <DiscussionChat
          entries={state.chat}
          selfId={self.id}
          canSend
          onSend={(text) => send({ type: "chat", text })}
          emptyText="Chào mọi người trước khi vào ván nhé 👋"
          placeholder="Nói gì đó với cả phòng…"
        />
      </div>
    </div>
  );
}

// Read-only view of the room's rules, so everyone (not just the host) can see
// what the game will run with and speak up if the host missed something. The
// role line is computed from the current head-count with the same function the
// server uses to deal roles, so it updates live as people join or leave.
function RoomSettingsCard({ state, playerCount, botCount, showSettings }: { state: PublicWerewolfState; playerCount: number; botCount: number; showSettings: boolean }) {
  const dealt = Math.min(MAX_WEREWOLF_PLAYERS, Math.max(MIN_WEREWOLF_PLAYERS, playerCount));
  const counts = new Map<WerewolfRole, number>();
  for (const role of rolesForPlayerCount(dealt)) counts.set(role, (counts.get(role) ?? 0) + 1);
  const { config } = state;

  return (
    <section className="mt-5 rounded-md border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] p-4 text-sm">
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--ww-text-faint)]">⚙️ Cài đặt phòng</h3>

      <div className="mt-3">
        <div className="text-xs text-[var(--ww-text-muted)]">
          Vai trong ván ({dealt} người{botCount > 0 ? `, gồm ${botCount} 🤖 bot` : ""}{playerCount < MIN_WEREWOLF_PLAYERS ? ` — đang có ${playerCount}, cần tối thiểu ${MIN_WEREWOLF_PLAYERS}` : ""})
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {[...counts].map(([role, count]) => (
            <span key={role} className="rounded-full bg-[var(--ww-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--ww-text)]">
              {ROLE_EMOJI[role]} {count} {ROLE_LABELS[role]}
            </span>
          ))}
        </div>
      </div>

      {showSettings && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <dt className="text-[var(--ww-text-muted)]">Thảo luận</dt>
          <dd className="text-right font-semibold text-[var(--ww-text)]">{config.discussionSeconds} giây</dd>
          <dt className="text-[var(--ww-text-muted)]">Bỏ phiếu</dt>
          <dd className="text-right font-semibold text-[var(--ww-text)]">{config.votingSeconds} giây</dd>
          <dt className="text-[var(--ww-text-muted)]">Lộ vai khi chết</dt>
          <dd className="text-right font-semibold text-[var(--ww-text)]">{config.revealRoleOnDeath ? "Có" : "Không"}</dd>
          <dt className="text-[var(--ww-text-muted)]">Phù thủy tự cứu mình</dt>
          <dd className="text-right font-semibold text-[var(--ww-text)]">{config.witchCanSelfSave ? "Được" : "Không"}</dd>
        </dl>
      )}
      <p className="mt-3 text-[11px] text-[var(--ww-text-faint)]">Người chết chỉ được theo dõi (biết vai mọi người), không chat được.</p>
    </section>
  );
}

function HostControls({ state, connectedCount, send }: Omit<LobbyScreenProps, "self"> & { connectedCount: number }) {
  const updateNumber = (field: "discussionSeconds" | "votingSeconds", value: number) => {
    send({ type: "update_config", config: { ...state.config, [field]: value } });
  };

  return (
    <div className="mt-6 rounded-md border border-[var(--ww-border)] bg-[var(--ww-surface-soft)] p-4">
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
      <label className="mt-4 flex items-center justify-between gap-3 rounded-md bg-[var(--ww-surface-soft)] px-3 py-2.5 text-sm text-[var(--ww-text)]">
        <span>
          🤖 Chơi cùng dân làng AI
          <span className="block text-xs text-[var(--ww-text-faint)]">Bot tự chơi theo luật, vào làng khi bắt đầu. Ván có bot không lưu vào lịch sử.</span>
        </span>
        <select
          value={state.config.botCount}
          onChange={(event) => send({ type: "update_config", config: { ...state.config, botCount: Number(event.target.value) } })}
          className="shrink-0 rounded-md border border-[var(--ww-border)] bg-[var(--ww-surface-strong)] p-1.5 text-[var(--ww-text)]"
        >
          {Array.from({ length: MAX_WEREWOLF_PLAYERS - Math.max(1, connectedCount) + 1 }, (_, count) => (
            <option key={count} value={count}>{count === 0 ? "Không dùng" : `${count} bot`}</option>
          ))}
        </select>
      </label>
      <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-md bg-[var(--ww-surface-soft)] px-3 py-2.5 text-sm text-[var(--ww-text)]">
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
      <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-md bg-[var(--ww-surface-soft)] px-3 py-2.5 text-sm text-[var(--ww-text)]">
        <span>
          Phù thủy được tự cứu mình
          <span className="block text-xs text-[var(--ww-text-faint)]">Tắt: Phù thủy không thể cứu chính mình khi bị Sói cắn</span>
        </span>
        <input
          type="checkbox"
          checked={state.config.witchCanSelfSave}
          onChange={(event) => send({ type: "update_config", config: { ...state.config, witchCanSelfSave: event.target.checked } })}
          className="h-5 w-5 shrink-0 accent-[var(--ww-accent-strong)]"
        />
      </label>
      <button
        disabled={connectedCount + state.config.botCount < MIN_WEREWOLF_PLAYERS}
        onClick={() => send({ type: "start_game" })}
        className="mt-4 w-full rounded-md bg-[var(--ww-accent-strong)] py-3 font-bold text-[var(--ww-accent-ink)] transition hover:opacity-90 disabled:opacity-40"
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
        className="mt-1 block w-full rounded-md border border-[var(--ww-border)] bg-[var(--ww-surface-strong)] p-2 text-[var(--ww-text)]"
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

