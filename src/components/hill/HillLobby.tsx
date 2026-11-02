'use client';

import { HILL_MAPS, HILL_VEHICLES, type HillVehicleId } from '@shared/hillTypes';
import type { HillRaceCar, HillRaceConfig, HillRaceState } from '@shared/hillRaceTypes';
import { VehicleArt } from './HillArt';
import { MapPicker, Segmented, StatBars, VehiclePicker } from './HillUi';
import { VEHICLE_INFO, formatNumber } from './hillUiData';

// The race room before and after a race. The lineup shows everyone's actual
// car like a starting grid; your car and the track are picked visually, the
// same pickers as the solo garage. Only the host edits the track.

const MAX_PLAYERS = 6;

export function HillLobby({
  state,
  myId,
  onVehicle,
  onConfig,
  onInvite,
}: {
  state: HillRaceState;
  myId: string;
  onVehicle: (vehicle: HillVehicleId) => void;
  onConfig: (patch: Partial<HillRaceConfig>) => void;
  onInvite: () => void;
}) {
  const me = state.players.find((player) => player.id === myId);
  const host = state.host === myId;
  const config = state.config;
  const forced = config.vehicle === 'choice' ? null : config.vehicle;
  const shown = forced ?? me?.vehicle ?? 'jeep';
  const empty = Math.max(0, MAX_PLAYERS - state.players.length);

  return (
    <>
      <section>
        <h2 className="mb-2 font-draw-display text-lg font-extrabold">🏁 Vạch xuất phát · {state.players.filter((player) => player.connected).length}/{MAX_PLAYERS}</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {state.players.map((player) => (
            <div
              key={player.id}
              className={`flex flex-col items-center rounded-2xl border-2 px-1.5 pb-2 pt-1.5 text-center ${
                player.id === myId ? 'border-amber-300 bg-amber-300/10' : 'border-white/10 bg-white/5'
              } ${player.connected ? '' : 'opacity-50'}`}
            >
              <VehicleArt vehicle={forced ?? player.vehicle} width={92} height={46} />
              <p className="mt-1 w-full truncate text-sm font-bold">
                {player.id === state.host && '👑 '}
                {player.name}
              </p>
              <span
                className={`mt-0.5 rounded-full px-2 text-[11px] font-bold ${
                  !player.connected ? 'bg-red-500/20 text-red-200' : player.ready ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-emerald-100/70'
                }`}
              >
                {!player.connected ? 'Mất mạng' : player.ready ? '✓ Sẵn sàng' : 'Đang chọn…'}
              </span>
            </div>
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <button
              key={`empty-${i}`}
              onClick={onInvite}
              className="flex min-h-[6.5rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 text-xs font-bold text-emerald-100/45 transition hover:border-amber-300/60 hover:text-amber-200"
            >
              <span className="text-xl">＋</span>
              Mời bạn
            </button>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-end justify-between gap-2">
            <h2 className="font-draw-display text-lg font-extrabold">🚙 Xe của bạn</h2>
            <span className="truncate text-xs font-semibold text-amber-200">{VEHICLE_INFO[shown].tagline}</span>
          </div>
          <p className="font-draw-display text-2xl font-extrabold leading-tight">{HILL_VEHICLES[shown].name}</p>
          <StatBars vehicle={shown} className="mt-2" />
          <div className="mt-3">
            <VehiclePicker value={shown} onChange={onVehicle} only={forced ?? undefined} disabled={Boolean(forced)} />
          </div>
          <p className="mt-2 text-xs text-emerald-100/60">
            {forced ? `Chủ phòng cho cả phòng đi chung ${HILL_VEHICLES[forced].name}.` : 'Đua cùng bạn được đi cả 4 xe. Đổi xe sẽ bỏ "sẵn sàng".'}
          </p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 flex items-end justify-between gap-2">
            <h2 className="font-draw-display text-lg font-extrabold">🗺️ Đường đua</h2>
            {!host && <span className="text-xs text-emerald-100/55">Chủ phòng 👑 chỉnh</span>}
          </div>
          <MapPicker value={config.map} onChange={(map) => onConfig({ map })} random disabled={!host} />
          <div className="mt-4 space-y-3">
            <Setting label="Thể thức">
              <Segmented
                label="Thể thức"
                value={config.mode}
                disabled={!host}
                onChange={(mode) => onConfig({ mode })}
                options={[
                  { value: 'race', label: '🏁 Về đích' },
                  { value: 'distance', label: '⛽ Đi xa nhất' },
                ]}
              />
            </Setting>
            {config.mode === 'race' && (
              <Setting label="Độ dài">
                <Segmented
                  label="Độ dài"
                  value={config.length}
                  disabled={!host}
                  onChange={(length) => onConfig({ length })}
                  options={[
                    { value: 600, label: '600 m' },
                    { value: 1200, label: '1.200 m' },
                    { value: 2000, label: '2.000 m' },
                  ]}
                />
              </Setting>
            )}
            <Setting label="Số ván">
              <Segmented
                label="Số ván"
                value={config.rounds}
                disabled={!host}
                onChange={(rounds) => onConfig({ rounds })}
                options={[
                  { value: 1, label: '1 ván' },
                  { value: 3, label: '3 ván' },
                  { value: 5, label: '5 ván' },
                ]}
              />
            </Setting>
            <Setting label="Va chạm">
              <Segmented
                label="Va chạm"
                value={config.collisions ? 'solid' : 'ghost'}
                disabled={!host}
                onChange={(value) => onConfig({ collisions: value === 'solid' })}
                options={[
                  { value: 'solid', label: '💥 Xe đặc' },
                  { value: 'ghost', label: '👻 Xe ma' },
                ]}
              />
            </Setting>
            <Setting label="Xe">
              <select
                aria-label="Loại xe chung"
                disabled={!host}
                value={config.vehicle}
                onChange={(event) => onConfig({ vehicle: event.target.value as HillRaceConfig['vehicle'] })}
                className="w-full rounded-xl border-2 border-white/15 bg-emerald-950 px-3 py-2 text-sm font-bold text-white outline-none focus:border-amber-300 disabled:opacity-60"
              >
                <option value="choice">Mỗi người tự chọn</option>
                {(Object.keys(HILL_VEHICLES) as HillVehicleId[]).map((id) => (
                  <option key={id} value={id}>
                    Cả phòng đi {HILL_VEHICLES[id].name}
                  </option>
                ))}
              </select>
            </Setting>
          </div>
        </section>
      </div>

      <p className="mt-4 rounded-2xl bg-black/20 px-4 py-3 text-xs leading-relaxed text-emerald-100/70">
        🗼 Xuất phát chồng tháp, mỗi xe 35⚡ · Bàn đạp trái/phải để lái (A/D) · ↑ / W nhảy hoặc bật lật · Space lao tới húc xe · Lật ngửa có 3 giây cứu xe, hồi sinh mỗi 150 m.
      </p>
    </>
  );
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-100/60">{label}</p>
      {children}
    </div>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

/** A fun title for whoever did most of something this round. */
function titles(cars: HillRaceCar[]) {
  const best = (score: (car: HillRaceCar) => number) => {
    const top = [...cars].sort((a, b) => score(b) - score(a))[0];
    return top && score(top) > 0 ? top.id : null;
  };
  return [
    { id: best((car) => car.stomps), label: '🦶 Vua giẫm đầu' },
    { id: best((car) => car.air), label: '✈️ Phi công' },
    { id: best((car) => car.squashed), label: '🥞 Nạn nhân của năm' },
    { id: best((car) => car.crashes), label: '🙃 Chuyên gia chổng vó' },
  ].filter((title): title is { id: string; label: string } => title.id !== null);
}

export function HillRaceResults({ state, order, cars, title }: { state: HillRaceState; order: string[]; cars: HillRaceCar[]; title?: string }) {
  const player = (id: string) => state.players.find((item) => item.id === id);
  const car = (id: string) => cars.find((item) => item.id === id);
  const vehicleOf = (id: string) => car(id)?.state.vehicle ?? player(id)?.vehicle ?? 'jeep';
  const podium = order.slice(0, 3);
  // 2nd · 1st · 3rd, like a real podium.
  const arranged = [podium[1], podium[0], podium[2]].filter(Boolean);
  const awards = titles(cars);

  return (
    <section>
      <h2 className="text-center font-draw-display text-3xl font-extrabold">{title ?? (state.seriesOver ? '🏆 Tổng kết chặng đua' : `🏁 Kết quả ván ${state.round}/${state.config.rounds}`)}</h2>
      <p className="mt-1 text-center text-sm text-emerald-100/60">
        {HILL_MAPS[cars[0]?.state.map ?? 'tea'].name} · {state.config.mode === 'race' ? `về đích ${formatNumber(state.config.length)} m` : 'ai đi xa nhất'}
      </p>

      <div className="mt-6 flex items-end justify-center gap-2">
        {arranged.map((id) => {
          const place = podium.indexOf(id);
          return (
            <div key={id} className="flex w-28 flex-col items-center sm:w-36">
              <VehicleArt vehicle={vehicleOf(id)} width={96} height={48} />
              <p className="mt-1 w-full truncate text-center text-sm font-bold">{player(id)?.name}</p>
              <div
                className={`mt-1 flex w-full flex-col items-center justify-start rounded-t-2xl pt-2 font-draw-display font-extrabold ${
                  place === 0 ? 'h-28 bg-amber-400 text-emerald-950' : place === 1 ? 'h-20 bg-slate-300 text-slate-800' : 'h-14 bg-orange-300 text-orange-900'
                }`}
              >
                <span className="text-3xl">{MEDALS[place]}</span>
                <span className="text-sm">{player(id)?.points ?? 0} điểm</span>
              </div>
            </div>
          );
        })}
      </div>

      {awards.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {awards.map((award) => (
            <span key={award.label} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
              {award.label}: {player(award.id)?.name}
            </span>
          ))}
        </div>
      )}

      <ol className="mt-6 space-y-2">
        {[...state.players]
          .sort((a, b) => b.points - a.points || order.indexOf(a.id) - order.indexOf(b.id))
          .map((racer, index) => {
            const stats = car(racer.id);
            return (
              <li key={racer.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
                <span className="w-6 text-center font-draw-display text-lg font-extrabold text-amber-200">{index + 1}</span>
                <VehicleArt vehicle={vehicleOf(racer.id)} width={56} height={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{racer.name}</span>
                  {stats && (
                    <span className="mt-0.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-emerald-100/65">
                      <span>{stats.finishTick ? `🏁 ${(stats.finishTick / 60).toFixed(1)}s` : `📏 ${formatNumber(stats.state.distance)} m`}</span>
                      <span>🦶 {stats.stomps}</span>
                      <span>🥞 {stats.squashed}</span>
                      <span>🙃 {stats.crashes}</span>
                      <span>✈️ {stats.air.toFixed(1)}s</span>
                    </span>
                  )}
                </span>
                <span className="font-draw-display text-xl font-extrabold">
                  {racer.points}
                  <span className="ml-0.5 text-xs font-bold text-emerald-100/60">đ</span>
                </span>
              </li>
            );
          })}
      </ol>
      <p className="mt-2 text-center text-[11px] text-emerald-100/45">🦶 giẫm đầu · 🥞 bị giẫm · 🙃 chổng vó · ✈️ thời gian bay</p>
    </section>
  );
}
