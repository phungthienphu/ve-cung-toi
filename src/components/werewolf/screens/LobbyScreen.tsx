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
      <h2 className="text-xl font-bold">Đang chờ dân làng</h2>
      <p className="mt-1 text-sm text-slate-400">
        Cần {MIN_WEREWOLF_PLAYERS}–{MAX_WEREWOLF_PLAYERS} người. Chia sẻ mã hoặc link phòng.
      </p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {state.players.map((player) => (
          <div key={player.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <PlayerAvatar player={player} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {player.name}{player.id === self.id ? " (Bạn)" : ""}
              </div>
              <div className="text-xs text-slate-500">{lobbyStatus(player)}</div>
            </div>
            <span>{player.ready || player.isHost ? "✓" : "○"}</span>
          </div>
        ))}
      </div>

      {self.isHost ? (
        <HostControls state={state} connectedCount={connectedCount} send={send} />
      ) : (
        <button
          onClick={() => send({ type: "set_ready", ready: !self.ready })}
          className={`mt-6 w-full rounded-xl py-3 font-bold ${self.ready ? "bg-emerald-600" : "bg-violet-500"}`}
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
    <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
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
      <button
        disabled={connectedCount < MIN_WEREWOLF_PLAYERS}
        onClick={() => send({ type: "start_game" })}
        className="mt-4 w-full rounded-xl bg-violet-500 py-3 font-bold disabled:opacity-40"
      >
        Bắt đầu ván
      </button>
    </div>
  );
}

function TimeSelect({ label, value, options, onChange }: { label: string; value: number; options: number[]; onChange: (value: number) => void }) {
  return (
    <label className="text-sm">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 block w-full rounded-lg bg-slate-800 p-2"
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

