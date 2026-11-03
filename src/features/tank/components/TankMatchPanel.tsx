'use client';

import type { ClientTankPublicState } from '../hooks/useTankRoom';

interface Props {
  state: ClientTankPublicState;
  selfId: string;
  open: boolean;
  onClose: () => void;
}

/** On-demand match scoreboard, grouped by team. */
export function TankMatchPanel({ state, selfId, open, onClose }: Props) {
  const players = [...state.players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const groups = state.mode === 'team'
    ? [{ label: 'Đội A', team: 'A', players: players.filter(p => p.team === 'A') }, { label: 'Đội B', team: 'B', players: players.filter(p => p.team === 'B') }]
    : [{ label: 'Đấu tự do', team: '', players }];

  if (!open) return null;

  return <aside role="dialog" aria-modal="true" className="tg-roster" data-open={open} data-mode={state.mode} aria-label="Bảng điểm trận đấu">
    <header><div><small>TRONG TRẬN</small><h2>Bảng điểm</h2></div><button onClick={onClose} aria-label="Đóng bảng điểm">×</button></header>
    <div className="tg-roster-list">
      {groups.map(group => <section key={group.label} data-team={group.team}>
        <h3>{group.label} · {group.players.length} người<span>{group.team ? state.teamScores[group.team as 'A' | 'B'] + ' điểm' : 'Điểm'}</span></h3>
        <ol>{group.players.map((p, index) => <li key={p.id} data-self={p.id === selfId}>
          <span className="tg-roster-rank">{index + 1}</span>
          <i style={{ background: p.color }} aria-hidden="true" />
          <div><strong>{p.name}{p.id.startsWith('bot:') && <em> BOT</em>}{p.id === selfId && <em> Bạn</em>}</strong><small>{p.alive ? 'Đang chiến đấu' : 'Chờ hồi sinh'}</small></div>
          <b>{p.score}</b>
        </li>)}</ol>
      </section>)}
    </div>
    <p className="tg-roster-tip">Giữ Tab để xem nhanh bảng điểm.</p>
  </aside>;
}
