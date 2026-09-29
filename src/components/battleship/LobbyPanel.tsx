"use client";

import {
  MAX_BATTLESHIP_PLAYERS,
  MAX_TEAM_SIZE,
  MODE_LABELS,
  type BattleshipClientMessage,
  type BattleshipConfig,
  type BattleshipMode,
  type BattleshipPlayer,
  type BattleshipTeam,
  type PublicBattleshipState,
} from "@shared/battleshipTypes";
import { PlayerBadge, TEAM_BG, TEAM_COLOR, btnGhost, btnPrimary, card } from "./ui";

const MODE_HINT: Record<BattleshipMode, string> = {
  solo: "2 người (hoặc 1 người + bot). Lần lượt bắn, trúng được bắn tiếp. Lưới 10×10, 5 tàu.",
  ffa: "3–8 người, mỗi vòng ai cũng bắn cùng lúc vào lưới một đối thủ. Người cuối cùng còn tàu thắng. Lưới 8×8, 4 tàu.",
  team: "2 đội, mỗi đội chung một lưới 10×10 và 5 tàu. Mỗi vòng cả đội cùng bắn vào lưới đội kia.",
};

interface LobbyPanelProps {
  state: PublicBattleshipState;
  self: BattleshipPlayer;
  send: (message: BattleshipClientMessage) => void;
}

export function LobbyPanel({ state, self, send }: LobbyPanelProps) {
  const { config } = state;
  const isHost = self.isHost;
  const humans = state.players.filter((player) => !player.isBot && player.connected);
  const update = (patch: Partial<BattleshipConfig>) => send({ type: "update_config", config: { ...config, ...patch } });
  const botOptions = Array.from({ length: MAX_BATTLESHIP_PLAYERS - Math.max(1, humans.length) + 1 }, (_, count) => count);

  return (
    <div className="space-y-4">
      <section className={`${card} p-4`}>
        <h2 className="text-lg font-bold text-sky-50">Chế độ chơi</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(Object.keys(MODE_LABELS) as BattleshipMode[]).map((mode) => (
            <button
              key={mode}
              disabled={!isHost}
              onClick={() => update({ mode })}
              className={`rounded-md border px-2 py-2.5 text-sm font-semibold transition ${
                config.mode === mode ? "border-amber-300 bg-amber-300/15 text-amber-200" : "border-white/10 text-sky-100/70 enabled:hover:bg-white/5"
              }`}
            >
              {MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-sky-100/60">{MODE_HINT[config.mode]}</p>
      </section>

      {config.mode === "team" ? (
        <TeamColumns state={state} self={self} send={send} />
      ) : (
        <section className={`${card} p-4`}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-sky-100/60">Thủy thủ ({humans.length})</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {state.players.filter((player) => !player.isBot).map((player) => (
              <li key={player.id} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-sky-50">
                <PlayerBadge player={player} suffix={player.id === self.id ? "(bạn)" : undefined} />
                <span className="text-xs text-sky-100/60">{player.isHost || player.ready ? "✓ sẵn sàng" : "đang chờ"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${card} p-4 text-sm text-sky-50`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-sky-100/60">Cài đặt phòng</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Setting label={config.mode === "solo" ? "Thời gian mỗi lượt" : "Thời gian mỗi vòng"}>
            <select disabled={!isHost} value={config.turnSeconds} onChange={(event) => update({ turnSeconds: Number(event.target.value) })} className={selectClass}>
              {[10, 15, 20].map((seconds) => <option key={seconds} value={seconds}>{seconds} giây</option>)}
            </select>
          </Setting>
          {config.mode !== "solo" && (
            <Setting label="Bot lấp chỗ">
              <select disabled={!isHost} value={config.botCount} onChange={(event) => update({ botCount: Number(event.target.value) })} className={selectClass}>
                {botOptions.map((count) => <option key={count} value={count}>{count === 0 ? "Không" : `${count} bot`}</option>)}
              </select>
            </Setting>
          )}
          <Setting label="Độ khó bot">
            <select disabled={!isHost} value={config.botLevel} onChange={(event) => update({ botLevel: event.target.value === "easy" ? "easy" : "normal" })} className={selectClass}>
              <option value="easy">Dễ</option>
              <option value="normal">Thường</option>
            </select>
          </Setting>
          <Toggle disabled={!isHost} label="Tàu không được đặt sát nhau" checked={config.noTouching} onChange={(value) => update({ noTouching: value })} />
          {config.mode === "solo" && (
            <Toggle disabled={!isHost} label="Bắn trúng được bắn tiếp" checked={config.hitAgain} onChange={(value) => update({ hitAgain: value })} />
          )}
        </div>
        {config.mode === "solo" && humans.length < 2 && (
          <p className="mt-3 text-xs text-sky-100/60">Chỉ có 1 người: vào trận sẽ tự thêm 1 bot làm đối thủ.</p>
        )}
        {!isHost && <p className="mt-3 text-xs text-sky-100/40">Chỉ chủ phòng chỉnh được cài đặt.</p>}
      </section>

      {isHost ? (
        <button onClick={() => send({ type: "start_game" })} className={`${btnPrimary} w-full py-3 text-base`}>
          ⚓ Ra khơi!
        </button>
      ) : (
        <button onClick={() => send({ type: "set_ready", ready: !self.ready })} className={`${self.ready ? btnGhost : btnPrimary} w-full py-3 text-base`}>
          {self.ready ? "✓ Đã sẵn sàng (bấm để hủy)" : "Tôi đã sẵn sàng"}
        </button>
      )}
    </div>
  );
}

const selectClass = "w-full rounded-md border border-white/10 bg-slate-800 px-2 py-2 text-sky-50 disabled:opacity-60";

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-sky-100/60">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={`flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 ${disabled ? "opacity-70" : "cursor-pointer"}`}>
      <span>{label}</span>
      <input type="checkbox" disabled={disabled} checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-amber-400" />
    </label>
  );
}

function TeamColumns({ state, self, send }: LobbyPanelProps) {
  const members = (team: BattleshipTeam) => state.players.filter((player) => !player.isBot && player.team === team);
  return (
    <section className={`${card} p-4`}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-sky-100/60">Chia đội</h2>
        {self.isHost && <button onClick={() => send({ type: "shuffle_teams" })} className={btnGhost}>🎲 Chia ngẫu nhiên</button>}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {(["A", "B"] as const).map((team) => (
          <div key={team} className={`rounded-md border p-3 ${TEAM_BG[team]}`}>
            <div className="flex items-center justify-between">
              <span className={`font-bold ${TEAM_COLOR[team]}`}>Đội {team === "A" ? "Xanh" : "Đỏ"} ({members(team).length}/{MAX_TEAM_SIZE})</span>
              {self.team !== team && (
                <button onClick={() => send({ type: "choose_team", team })} className={btnGhost}>Vào đội</button>
              )}
            </div>
            <ul className="mt-2 space-y-1 text-sm text-sky-50">
              {members(team).map((player) => (
                <li key={player.id} className="flex justify-between gap-2">
                  <PlayerBadge player={player} suffix={player.id === self.id ? "(bạn)" : undefined} />
                  <span className="text-xs text-sky-100/60">{player.isHost || player.ready ? "✓" : "…"}</span>
                </li>
              ))}
              {members(team).length === 0 && <li className="text-xs text-sky-100/40">Chưa có ai</li>}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-sky-100/50">Bot (nếu có) tự vào đội ít người hơn. Hai đội chênh nhau tối đa 1 người; đội ít hơn được bắn bù cho bằng.</p>
    </section>
  );
}
