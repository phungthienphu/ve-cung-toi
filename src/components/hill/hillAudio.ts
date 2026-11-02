import { getAudioContext, isMuted, MUTE_CHANGE_EVENT, playHillBrake, playHillCountdown, playHillStart, playHillThrottle, playHillWaterFlow } from '@/lib/sound';
import { hillWaterLevel } from '@shared/hillTerrain';
import { HILL_VEHICLES, type HillInput, type HillSnapshot } from '@shared/hillTypes';

export const HILL_RACE_MUSIC = '/racing/sound/alex-morgan-car-car-music-545487.mp3';
/** One owner per active race canvas. No global music that can leak into another screen. */
export class HillAudio {
  private music = new Audio(HILL_RACE_MUSIC);
  private engine: { oscillator: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; context: AudioContext } | null = null;
  private active = false;
  private gas = false;
  private brake = false;
  private tick: number | null = null;
  private countdown = 0;
  private seed: number | null = null;
  private waterAt = 0;
  private retry = true;
  private pending = false;
  private disposed = false;
  constructor() {
    this.music.loop = true; this.music.volume = .3; this.music.preload = 'none';
    window.addEventListener(MUTE_CHANGE_EVENT, this.sync);
    document.addEventListener('visibilitychange', this.sync);
    window.addEventListener('pointerdown', this.unlock);
    window.addEventListener('keydown', this.unlock);
  }
  private unlock = () => { if (!this.active) return; this.retry = true; getAudioContext(); this.sync(); };
  private sync = () => {
    const audible = this.active && !isMuted() && !document.hidden;
    if (!audible) {
      this.music.pause(); this.retry = true;
      if (this.engine) this.engine.gain.gain.setTargetAtTime(0, this.engine.context.currentTime, .02);
      return;
    }
    if (this.music.paused && this.retry && !this.pending) {
      this.retry = false; this.pending = true;
      void this.music.play().then(() => {
        if (this.disposed || !this.active || isMuted() || document.hidden) this.music.pause();
      }).catch(() => { /* Browser requires another user gesture; unlock retries. */ }).finally(() => { this.pending = false; });
    }
  };
  update(state: HillSnapshot, input: HillInput, seed: number, tick: number, active: boolean, driving = active && tick >= 0) {
    if (this.seed !== seed || (this.tick !== null && tick < this.tick - 1)) { this.seed = seed; this.tick = null; this.countdown = 0; this.gas = this.brake = false; this.music.currentTime = 0; }
    this.active = active;
    this.sync();
    const audible = active && !isMuted() && !document.hidden;
    if (active) {
      const count = tick < 0 ? Math.ceil(-tick / 60) : 0;
      if (count > 0 && count !== this.countdown && audible) playHillCountdown();
      if (this.tick !== null && this.tick < 0 && tick >= 0 && audible) playHillStart();
      this.countdown = count;
    }
    this.tick = tick;
    if (driving && audible) {
      if (input.gas && !this.gas && state.fuel > 0) playHillThrottle();
      if (input.brake && !this.brake && state.speed > 1) playHillBrake(state.speed);
      if (!this.engine) {
        const context = getAudioContext();
        if (context) {
          const oscillator = context.createOscillator(), filter = context.createBiquadFilter(), gain = context.createGain();
          oscillator.type = 'sawtooth'; filter.type = 'lowpass'; filter.frequency.value = 300; gain.gain.value = 0;
          oscillator.connect(filter); filter.connect(gain); gain.connect(context.destination); oscillator.start(); this.engine = { oscillator, filter, gain, context };
        }
      }
      const now = performance.now();
      const wet = state.wheels.some(wheel => { const level = hillWaterLevel(seed, wheel.x, state.map); return level !== null && wheel.y - HILL_VEHICLES[state.vehicle].wheelRadius < level; });
      if (wet && state.speed > .6 && now - this.waterAt > 260) { playHillWaterFlow(state.speed); this.waterAt = now; }
    }
    if (this.engine) {
      const { oscillator, filter, gain, context } = this.engine;
      const pitch = state.vehicle === 'beetle' ? 1.3 : state.vehicle === 'bus' ? .75 : 1;
      oscillator.frequency.setTargetAtTime((38 + Math.min(105, state.speed * 3.6) + (input.gas ? 42 : 0)) * pitch, context.currentTime, .08);
      filter.frequency.setTargetAtTime(input.gas ? 520 : 220, context.currentTime, .08);
      gain.gain.setTargetAtTime(driving && audible && state.fuel > 0 ? input.gas ? .035 : .012 : 0, context.currentTime, .04);
    }
    this.gas = !!input.gas; this.brake = !!input.brake;
  }
  /** Also used on blur/pause before the next animation frame. */
  silence() { this.active = false; this.sync(); }
  dispose() {
    this.disposed = true; this.silence(); this.music.removeAttribute('src'); this.music.load();
    if (this.engine) { this.engine.oscillator.stop(); this.engine.oscillator.disconnect(); this.engine.filter.disconnect(); this.engine.gain.disconnect(); this.engine = null; }
    window.removeEventListener(MUTE_CHANGE_EVENT, this.sync); document.removeEventListener('visibilitychange', this.sync);
    window.removeEventListener('pointerdown', this.unlock); window.removeEventListener('keydown', this.unlock);
  }
}
