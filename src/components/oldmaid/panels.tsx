"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAX_SEATS,
  MIN_PLAYERS,
  PAIR_RULE_LABELS,
  ROUNDS_TO_PLAY,
  TURN_SECONDS,
  type OldMaidClientMessage,
  type OldMaidConfig,
  type OldMaidPlayer,
  type PublicOldMaidState,
} from "@shared/oldMaidTypes";
import type { Quality } from "./scene/Table3D";
import { SEAT_COLORS } from "./scene/PigAvatar";

// The HTML panels laid over the 3D table: lobby, round result, final podium,
// chat, scoreboard and settings. On a phone they slide up from the bottom;
// on a wide screen they sit on the right so the table stays in view.

export const panelClass =
  "absolute inset-x-2 bottom-2 z-30 max-h-[62vh] overflow-y-auto rounded-3xl bg-[#1d130c]/92 p-4 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-16 sm:max-h-none sm:w-[23rem]";
export const btnPrimary =
  "rounded-2xl bg-gradient-to-b from-[#ffd36e] to-[#f59e0b] px-5 py-3 font-draw-display text-lg font-extrabold text-[#3b1d0b] shadow-[0_4px_0_#92400e] transition hover:brightness-110 active:translate-y-[2px] active:shadow-[0_2px_0_#92400e] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-y-0";
export const btnGhost =
  "rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/15 transition hover:bg-white/15 active:scale-[0.98] disabled:opacity-40";

/** Re-renders every `ms` while mounted, for countdowns. */
export function useNow(ms = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(timer);
  }, [ms]);
  return now;
}

export function seatDot(seat: number | null) {
  return seat === null ? "#9ca3af" : SEAT_COLORS[seat % SEAT_COLORS.length];
}

export function Scoreboard({ players, myId, compact = false }: { players: OldMaidPlayer[]; myId: string; compact?: boolean }) {
  const rows = players
    .filter((player) => player.rounds > 0 || player.seat !== null)
    .sort((a, b) => a.pigs / Math.max(1, a.rounds) - b.pigs / Math.max(1, b.rounds) || b.firsts - a.firsts || a.name.localeCompare(b.name));
  if (!rows.some((player) => player.rounds > 0)) return compact ? null : <p className="text-sm text-white/50">Chưa có ván nào.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-[11px] uppercase tracking-wider text-white/45">
        <tr>
          <th className="py-1 pr-2 font-bold">Người chơi</th>
          <th className="py-1 pr-2 text-right font-bold" title="Số lần làm heo">🐷</th>
          <th className="py-1 pr-2 text-right font-bold" title="Số lần thoát đầu">🥇</th>
          <th className="py-1 text-right font-bold" title="Số ván">Ván</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((player) => (
          <tr key={player.id} className={`border-t border-white/10 ${player.id === myId ? "text-amber-200" : ""}`}>
            <td className="max-w-[9rem] truncate py-1.5 pr-2 font-semibold">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: seatDot(player.seat) }} />
              {player.name}
              {player.id === myId && " (bạn)"}
            </td>
            <td className="py-1.5 pr-2 text-right font-black text-pink-300">{player.pigs}</td>
            <td className="py-1.5 pr-2 text-right font-bold">{player.firsts}</td>
            <td className="py-1.5 text-right text-white/60">{player.rounds}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Choice<T extends string | number | boolean>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  disabled: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/45">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
              option.value === value ? "bg-amber-300 text-amber-950" : "bg-white/10 text-white/80 hover:bg-white/15"
            } disabled:cursor-default ${disabled && option.value !== value ? "opacity-40" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LobbyPanel({
  state,
  myId,
  send,
  onInvite,
  inviteCopied,
}: {
  state: PublicOldMaidState;
  myId: string;
  send: (msg: OldMaidClientMessage) => void;
  onInvite: () => void;
  inviteCopied: boolean;
}) {
  const me = state.players.find((player) => player.id === myId);
  const isHost = state.hostId === myId;
  const seated = state.players.filter((player) => player.seat !== null);
  const waiting = seated.filter((player) => !player.isBot && player.id !== state.hostId && (!player.ready || !player.connected));
  const freeSeat = Array.from({ length: MAX_SEATS }, (_, seat) => seat).find((seat) => !seated.some((player) => player.seat === seat));
  const config = state.config;
  const set = (patch: Partial<OldMaidConfig>) => send({ type: "update_config", config: patch });
  const reason =
    seated.length < MIN_PLAYERS ? "Cần ít nhất 2 người — thêm bot nếu chưa đủ bạn." : waiting.length ? `Chờ ${waiting.map((player) => player.name).join(", ")} sẵn sàng…` : "";

  return (
    <section className={panelClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Mã phòng</p>
          <p className="font-mono text-3xl font-black tracking-[0.25em] text-amber-200">{state.roomId}</p>
        </div>
        <button type="button" onClick={onInvite} className={btnGhost}>
          {inviteCopied ? "✓ Đã chép link" : "🔗 Mời bạn"}
        </button>
      </div>

      <p className="mt-3 rounded-2xl bg-white/5 px-3 py-2 text-sm text-white/75">
        🪑 {seated.length}/{MAX_SEATS} ghế ·{" "}
        {me?.seat === null ? <b className="text-amber-200">bạn đang xem — bấm “＋ Ngồi đây” trên bàn</b> : "bấm “＋ Ngồi đây” trên bàn để đổi ghế"}
        <span className="mt-1 block text-xs text-white/50">Ghế quyết định thứ tự: bạn rút bài người ngồi bên phải, người bên trái rút bài bạn.</span>
      </p>

      <div className="mt-4 space-y-3">
        <Choice
          label="Thời gian rút"
          value={config.turnSeconds}
          options={TURN_SECONDS.map((seconds) => ({ value: seconds as number, label: `${seconds} giây` }))}
          disabled={!isHost}
          onChange={(turnSeconds) => set({ turnSeconds })}
        />
        <Choice
          label="Luật đôi"
          value={config.pairRule}
          options={(Object.keys(PAIR_RULE_LABELS) as OldMaidConfig["pairRule"][]).map((rule) => ({ value: rule, label: PAIR_RULE_LABELS[rule] }))}
          disabled={!isHost}
          onChange={(pairRule) => set({ pairRule })}
        />
        <Choice
          label="Chung cuộc"
          value={config.roundsToPlay}
          options={ROUNDS_TO_PLAY.map((rounds) => ({ value: rounds as number, label: rounds ? `${rounds} ván` : "Chơi mãi" }))}
          disabled={!isHost}
          onChange={(roundsToPlay) => set({ roundsToPlay })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Choice
            label="Heo chia bài"
            value={config.pigDeals}
            options={[
              { value: true, label: "Bật" },
              { value: false, label: "Tắt" },
            ]}
            disabled={!isHost}
            onChange={(pigDeals) => set({ pigDeals })}
          />
          <Choice
            label="Bot"
            value={config.botLevel}
            options={[
              { value: "easy", label: "Dễ" },
              { value: "smart", label: "Khôn" },
            ]}
            disabled={!isHost}
            onChange={(botLevel) => set({ botLevel })}
          />
        </div>
        <Choice
          label="Phòng"
          value={config.isPublic}
          options={[
            { value: true, label: "🌐 Công khai" },
            { value: false, label: "🔒 Riêng tư" },
          ]}
          disabled={!isHost}
          onChange={(isPublic) => set({ isPublic })}
        />
      </div>

      <div className="mt-5 space-y-2">
        {isHost ? (
          <>
            <button type="button" disabled={!!reason} onClick={() => send({ type: "start_game" })} className={`${btnPrimary} w-full`}>
              🃏 Chia bài!
            </button>
            {freeSeat !== undefined && (
              <button type="button" onClick={() => send({ type: "add_bot", seat: freeSeat })} className={`${btnGhost} w-full`}>
                🤖 Thêm bot vào ghế trống
              </button>
            )}
          </>
        ) : me?.seat !== null ? (
          <button type="button" onClick={() => send({ type: "set_ready", ready: !me?.ready })} className={`${me?.ready ? btnGhost : btnPrimary} w-full`}>
            {me?.ready ? "✓ Đã sẵn sàng — bấm để huỷ" : "✋ Sẵn sàng"}
          </button>
        ) : null}
        {reason && <p className="text-center text-xs text-white/55">{reason}</p>}
        {!isHost && <p className="text-center text-xs text-white/45">Chủ phòng sẽ chia bài khi mọi người sẵn sàng.</p>}
      </div>

      {state.round > 0 && (
        <div className="mt-5">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/45">Bảng điểm</p>
          <Scoreboard players={state.players} myId={myId} />
        </div>
      )}

      <details className="mt-5 rounded-2xl bg-white/5 px-3 py-2 text-sm text-white/75 [&_summary]:cursor-pointer">
        <summary className="font-bold text-white">📖 Cách chơi</summary>
        <ul className="mt-2 space-y-1.5 pl-1">
          <li>🃏 Chia hết 52 lá + 1 Joker <b>(con heo 🐷)</b>, ai có đôi cùng số thì tự bỏ ra giữa bàn.</li>
          <li>👉 Tới lượt: rút úp <b>1 lá</b> từ tay người ngồi bên phải bạn. Thành đôi thì bỏ.</li>
          <li>☝️ Bị rút thì <b>nhử</b> 1 lá hoặc <b>xào</b> bài để lừa người rút. Ai cũng thấy người rút đang nhắm lá nào!</li>
          <li>🎉 Hết bài là thoát. Người cuối cùng ôm Joker là <b>HEO</b>.</li>
        </ul>
      </details>
    </section>
  );
}

export function RoundEndPanel({ state, myId, send }: { state: PublicOldMaidState; myId: string; send: (msg: OldMaidClientMessage) => void }) {
  const now = useNow();
  const summary = state.lastRound;
  if (!summary) return null;
  const isHost = state.hostId === myId;
  const iAmPig = summary.pigId === myId;
  const unlucky = [...summary.rows].sort((a, b) => b.jokerDraws - a.jokerDraws)[0];
  const humans = state.players.filter((player) => player.seat !== null && !player.isBot && player.connected);
  const ready = humans.filter((player) => state.nextReadyIds.includes(player.id)).length;
  const iAmReady = state.nextReadyIds.includes(myId);
  const seconds = state.phaseEndsAt ? Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000)) : 0;
  const amSeated = state.players.find((player) => player.id === myId)?.seat !== null;

  return (
    <section className={`${panelClass} om-pop`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Ván {summary.round}</p>
      <h2 className="mt-1 font-draw-display text-3xl font-extrabold leading-tight text-pink-200">
        {iAmPig ? "Bạn là HEO! 🐷" : `🐷 ${summary.pigName} là HEO!`}
      </h2>
      {iAmPig && <p className="mt-1 text-sm text-white/65">Ván sau bạn chia bài và rút trước — gỡ lại đi!</p>}

      <ol className="mt-4 space-y-1.5">
        {summary.rows.map((row) => {
          const pig = row.id === summary.pigId;
          return (
            <li key={row.id} className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${pig ? "bg-pink-500/20 ring-1 ring-pink-400/40" : "bg-white/5"}`}>
              <span className="w-7 text-center font-draw-display text-lg font-extrabold">{pig ? "🐷" : row.place === 1 ? "🥇" : row.place === 2 ? "🥈" : row.place === 3 ? "🥉" : `#${row.place}`}</span>
              <span className={`min-w-0 flex-1 truncate font-bold ${row.id === myId ? "text-amber-200" : ""}`}>
                {row.name}
                {row.id === myId && " (bạn)"}
              </span>
              <span className="text-xs text-white/55">rút {row.draws}</span>
              {row.jokerDraws > 0 && <span className="rounded-full bg-pink-500/30 px-2 py-0.5 text-[11px] font-bold text-pink-100">dính heo {row.jokerDraws}</span>}
            </li>
          );
        })}
      </ol>
      {unlucky && unlucky.jokerDraws >= 2 && (
        <p className="mt-3 rounded-2xl bg-white/5 px-3 py-2 text-sm text-white/80">
          😭 <b>Pha rút oan nhất:</b> {unlucky.name} bốc trúng con heo {unlucky.jokerDraws} lần.
        </p>
      )}

      <div className="mt-4">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-white/45">Bảng điểm</p>
        <Scoreboard players={state.players} myId={myId} />
      </div>

      <div className="mt-5 space-y-2">
        {amSeated && (
          <button type="button" disabled={iAmReady} onClick={() => send({ type: "next_round" })} className={`${btnPrimary} w-full`}>
            {iAmReady ? `Chờ mọi người… (${ready}/${humans.length})` : "▶ Ván tiếp"}
          </button>
        )}
        <p className="text-center text-xs text-white/55">Tự chia ván mới sau {seconds}s</p>
        {isHost && (
          <button type="button" onClick={() => send({ type: "back_to_lobby" })} className={`${btnGhost} w-full`}>
            ⚙️ Về sảnh đổi luật / bot
          </button>
        )}
      </div>
    </section>
  );
}

export function FinalPanel({ state, myId, send }: { state: PublicOldMaidState; myId: string; send: (msg: OldMaidClientMessage) => void }) {
  const isHost = state.hostId === myId;
  const players = state.players.filter((player) => player.rounds > 0);
  const best = [...players].sort((a, b) => a.pigs - b.pigs || b.firsts - a.firsts)[0];
  const worst = [...players].sort((a, b) => b.pigs - a.pigs || a.firsts - b.firsts)[0];
  return (
    <section className={`${panelClass} om-pop`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Chung cuộc · {state.round} ván</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {best && (
          <div className="rounded-2xl bg-amber-300/15 p-3 text-center ring-1 ring-amber-300/40">
            <p className="text-3xl">👑</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200">Vua né heo</p>
            <p className="truncate font-draw-display text-lg font-extrabold">{best.name}</p>
            <p className="text-xs text-white/60">{best.pigs} lần làm heo</p>
          </div>
        )}
        {worst && worst.pigs > 0 && (
          <div className="rounded-2xl bg-pink-500/15 p-3 text-center ring-1 ring-pink-400/40">
            <p className="text-3xl">🐷</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-pink-200">Heo của buổi tối</p>
            <p className="truncate font-draw-display text-lg font-extrabold">{worst.name}</p>
            <p className="text-xs text-white/60">{worst.pigs} lần làm heo</p>
          </div>
        )}
      </div>
      <div className="mt-4">
        <Scoreboard players={state.players} myId={myId} />
      </div>
      <div className="mt-5 space-y-2">
        {isHost ? (
          <>
            <button type="button" onClick={() => send({ type: "new_set" })} className={`${btnPrimary} w-full`}>
              🔁 Chơi bộ mới
            </button>
            <button type="button" onClick={() => send({ type: "back_to_lobby" })} className={`${btnGhost} w-full`}>
              ⚙️ Về sảnh
            </button>
          </>
        ) : (
          <p className="text-center text-sm text-white/60">Chờ chủ phòng chọn chơi tiếp…</p>
        )}
      </div>
    </section>
  );
}

export function ChatPanel({ state, myId, onSend, onClose }: { state: PublicOldMaidState; myId: string; onSend: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [state.chat.length]);
  return (
    <section className="absolute inset-x-2 bottom-2 z-40 flex max-h-[60vh] flex-col rounded-3xl bg-[#1d130c]/95 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md sm:inset-x-auto sm:bottom-3 sm:left-3 sm:top-16 sm:max-h-none sm:w-80">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <p className="font-bold">💬 Trò chuyện</p>
        <button type="button" aria-label="Đóng" onClick={onClose} className="rounded-full px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white">
          ✕
        </button>
      </div>
      <div ref={list} className="min-h-[8rem] flex-1 space-y-1.5 overflow-y-auto px-4 py-3 text-sm">
        {state.chat.length === 0 && <p className="text-white/45">Chưa có tin nhắn nào.</p>}
        {state.chat.map((entry) =>
          entry.system ? (
            <p key={entry.id} className="text-xs italic text-white/45">
              {entry.text}
            </p>
          ) : (
            <p key={entry.id}>
              <b className={entry.playerId === myId ? "text-amber-200" : "text-white"}>{entry.playerName}:</b> <span className="text-white/85">{entry.text}</span>
            </p>
          ),
        )}
      </div>
      <form
        className="flex gap-2 border-t border-white/10 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          onSend(text);
          setText("");
        }}
      >
        <input
          value={text}
          maxLength={200}
          onChange={(event) => setText(event.target.value)}
          placeholder="Nhắn gì đó…"
          className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-amber-300"
        />
        <button type="submit" className="rounded-xl bg-amber-300 px-3 py-2 text-sm font-bold text-amber-950">
          Gửi
        </button>
      </form>
    </section>
  );
}

export function SettingsPanel({
  quality,
  muted,
  onQuality,
  onMute,
  onClose,
}: {
  quality: Quality;
  muted: boolean;
  onQuality: (quality: Quality) => void;
  onMute: (muted: boolean) => void;
  onClose: () => void;
}) {
  return (
    <section className="absolute right-2 top-16 z-40 w-[min(20rem,calc(100%-1rem))] space-y-3 rounded-3xl bg-[#1d130c]/95 p-4 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <p className="font-bold">⚙️ Cài đặt</p>
        <button type="button" aria-label="Đóng" onClick={onClose} className="rounded-full px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white">
          ✕
        </button>
      </div>
      <Choice
        label="Đồ họa"
        value={quality}
        options={[
          { value: "high", label: "✨ Cao" },
          { value: "low", label: "⚡ Thấp (máy yếu)" },
        ]}
        disabled={false}
        onChange={onQuality}
      />
      <Choice
        label="Âm thanh"
        value={muted}
        options={[
          { value: false, label: "🔊 Bật" },
          { value: true, label: "🔇 Tắt" },
        ]}
        disabled={false}
        onChange={onMute}
      />
      <p className="text-xs text-white/45">Camera chỉ vào góc nhìn thứ nhất khi tới lượt bạn rút.</p>
    </section>
  );
}
