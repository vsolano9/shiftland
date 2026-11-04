// Shiftland's whole soundscape, synthesized (no audio files; docs/design-plates.md "Sound recipes"). GameAudio owns the
// graph, the lookahead sequencer and the ocean; the score is songs.ts, the bar generator compose.ts, the note maths
// synth.ts, the recipes sfx.ts. Nothing here can throw at the game: without WebAudio every call just logs and returns.
import { Composer, platesOf, type Bar } from './compose.ts';
import { gullCry, playSfx, pourSound, type SfxHost, type SfxOpts } from './sfx.ts';
import { SONGS, type Inst, type Song } from './songs.ts';
import { impulse, noise, padWaveCoefficients, renderNote } from './synth.ts';
import { freq, rng } from './theory.ts';

export type Biome = 'title' | 'meadow' | 'coast' | 'desert' | 'tundra' | 'finale' | 'ending';
export type Sfx = 'hover' | 'select' | 'slide' | 'stop' | 'uplift' | 'crack' | 'blocked' | 'undo' | 'restart' | 'tick' | 'untick' | 'bleat' | 'crush' | 'lighthouse' | 'splash' | 'fish' | 'penguin' | 'oasis' | 'complete' | 'star' | 'ui' | 'stuck' | 'whoosh' | 'meltice' | 'chord';

const LOOKAHEAD = 0.4, TICK_MS = 100, FADE = 0.65; // FADE: time constant, so a crossfade is ~95% done at 2 s
const MAX_NOTES = 48, MAX_SFX = 14, OCEAN_GAIN = 0.34, LOG_CAP = 500;
const PANS = [-0.6, -0.25, 0, 0.25, 0.6];

/** One biome's music while it sounds: its own fader, buses, delay and pad filter. Old ones fade, then disconnect. */
interface Session {
  song: Song;
  comp: Composer;
  next: number;
  queue: { t: number; inst: Inst; midi: number; vel: number; pan: number }[];
  fade: GainNode; fadeWet: GainNode; plucks: AudioNode[]; bass: GainNode; perc: GainNode; padL: AudioNode; padR: AudioNode;
  padFilter: BiquadFilterNode; lfo: OscillatorNode; nodes: AudioNode[]; mid: number; lastCycle: number;
}

export class GameAudio {
  readonly log: { name: string; t: number }[] = [];
  /** live counters, read by the e2e leak check */
  readonly stats = { notes: 0, sfx: 0, peakNotes: 0, peakSfx: 0, droppedNotes: 0, droppedSfx: 0, pads: 0, sessions: 0 };

  private ctx: BaseAudioContext | null;
  private readonly offline: boolean;
  private clock = 0;
  private readonly rand: () => number;
  private seedCounter: number;
  private musicVol = 0.8;
  private sfxVol = 0.9;
  private isMuted = false;
  private want: Biome | null = null;
  private oceanLevel = 0;
  private scaleSong: Song = SONGS.title;
  private chordNow: number[] = [];
  private session: Session | null = null;
  private cycles = new Map<Biome, number>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private listening = false;
  private g: {
    master: GainNode; music: GainNode; musicWet: GainNode; duck: GainNode; duckWet: GainNode; sfx: GainNode; reverb: AudioNode; ocean: GainNode;
  } | null = null;
  private buffers = new Map<string, { buffer: AudioBuffer; rate: number; gain: number }>();
  private noises = new Map<string, AudioBuffer>();
  private noteEnds: number[] = [];
  private sfxEnds: number[] = [];
  private wave: PeriodicWave | null = null;
  private oceanStop: (() => void) | null = null;
  private oceanTimer: ReturnType<typeof setTimeout> | null = null;
  private nextGull = 0;
  private host: SfxHost | null = null;

  /** Tests pass an OfflineAudioContext and a seed; the game passes nothing and gets a context on the first gesture. */
  constructor(opts: { ctx?: BaseAudioContext; seed?: number } = {}) {
    this.ctx = opts.ctx ?? null;
    this.offline = !!opts.ctx && typeof OfflineAudioContext !== 'undefined' && opts.ctx instanceof OfflineAudioContext;
    const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    this.seedCounter = seed;
    this.rand = rng(seed ^ 0x5eed);
  }

  private guard(fn: () => void): void {
    try { fn(); } catch (e) { if (this.offline) throw e; console.warn('audio:', e); }
  }

  private now(): number { return this.ctx ? Math.max(this.ctx.currentTime, this.clock) : 0; }

  unlock(): void {
    this.guard(() => {
      if (!this.ctx) {
        const w = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const C = w.AudioContext ?? w.webkitAudioContext;
        if (!C) return;
        this.ctx = new C({ latencyHint: 'interactive' });
      }
      if (!this.g) this.build();
      if (!this.offline) {
        const c = this.ctx as AudioContext;
        if (c.state !== 'running' && c.resume && !this.hidden()) void c.resume().catch(() => undefined);
        this.listen();
        this.startTimer();
      }
      this.pump();
    });
  }

  private hidden(): boolean { return !this.offline && typeof document !== 'undefined' && document.visibilityState === 'hidden'; }

  private listen(): void {
    if (this.listening || typeof document === 'undefined') return;
    this.listening = true;
    document.addEventListener('visibilitychange', () => {
      this.guard(() => {
        const c = this.ctx as AudioContext | null;
        if (!c || this.offline) return;
        if (this.hidden()) {
          // suspending freezes context time, so nothing bursts or drifts while away
          this.stopTimer();
          void c.suspend?.().catch(() => undefined);
        } else {
          void c.resume?.().catch(() => undefined);
          this.startTimer();
        }
      });
    });
  }

  private startTimer(): void {
    if (this.timer === null && !this.hidden()) this.timer = setInterval(() => this.guard(() => this.pump()), TICK_MS);
  }
  private stopTimer(): void { if (this.timer !== null) { clearInterval(this.timer); this.timer = null; } }

  private build(): void {
    const c = this.ctx!;
    const master = c.createGain(); master.gain.value = this.isMuted ? 0 : 1;
    // gentle glue, then a trim (browsers add make-up gain inside the compressor), then the safety limiter
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28; hp.Q.value = 0.6;
    const shelf = c.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 6500; shelf.gain.value = -3;
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -16; glue.knee.value = 14; glue.ratio.value = 2.5; glue.attack.value = 0.012; glue.release.value = 0.28;
    const trim = c.createGain(); trim.gain.value = 0.62;
    const limit = c.createDynamicsCompressor();
    limit.threshold.value = -5; limit.knee.value = 3; limit.ratio.value = 16; limit.attack.value = 0.002; limit.release.value = 0.12;
    const out = c.createGain(); out.gain.value = 0.8;
    // drive sets where the mix sits against the limiter: it should touch it on pile-ups, not ride it all the time
    const drive = c.createGain(); drive.gain.value = 0.46;
    master.connect(drive); drive.connect(hp); hp.connect(shelf); shelf.connect(glue); glue.connect(trim); trim.connect(limit); limit.connect(out); out.connect(c.destination);

    const conv = c.createConvolver();
    const sr = c.sampleRate, ir = c.createBuffer(2, Math.floor(2.4 * sr), sr);
    ir.getChannelData(0).set(impulse(2.4, sr, 21));
    ir.getChannelData(1).set(impulse(2.4, sr, 22));
    conv.normalize = false;
    conv.buffer = ir;
    const rev = c.createGain(); rev.gain.value = 1;
    const ret = c.createGain(); ret.gain.value = 1.1;
    rev.connect(conv); conv.connect(ret); ret.connect(master);

    const music = c.createGain(), duck = c.createGain(), musicWet = c.createGain(), duckWet = c.createGain();
    music.gain.value = musicWet.gain.value = this.musicVol;
    music.connect(duck); duck.connect(master); musicWet.connect(duckWet); duckWet.connect(rev);
    const sfx = c.createGain(); sfx.gain.value = this.sfxVol;
    const sfxLift = c.createGain(); sfxLift.gain.value = 2.4; sfx.connect(sfxLift); sfxLift.connect(master); // recipes are written quiet
    const sfxWet = c.createGain(); sfxWet.gain.value = 0.3; sfx.connect(sfxWet); sfxWet.connect(rev);
    const ocean = c.createGain(); ocean.gain.value = 0; ocean.connect(master);
    this.g = { master, music, musicWet, duck, duckWet, sfx, reverb: rev, ocean };

    const coef = padWaveCoefficients();
    this.wave = c.createPeriodicWave(coef.real, coef.imag);
    const scale = (): number[] => this.scale, chord = (): number[] => (this.chordNow.length ? this.chordNow : this.scale.slice(0, 4));
    this.host = {
      ctx: c, sfxOut: sfx,
      get scale() { return scale(); },
      get chord() { return chord(); },
      rand: this.rand,
      noiseBuffer: k => this.noiseBuffer(k),
      note: (i, m, t, v, d, cut, done) => this.note(i, m, t, v, d, cut, done),
      padWave: () => this.wave!,
      duck: s => this.duck(s),
      voiceStarted: () => { this.stats.sfx++; this.stats.peakSfx = Math.max(this.stats.peakSfx, this.stats.sfx); },
      voiceEnded: () => { this.stats.sfx--; },
    };
    if (this.want) this.startSession(this.want);
    if (this.oceanLevel > 0) this.setOcean(this.oceanLevel);
  }

  private noiseBuffer(kind: 'white' | 'brown'): AudioBuffer {
    let b = this.noises.get(kind);
    if (!b) {
      const c = this.ctx!, d = noise(kind, 4, c.sampleRate, kind === 'white' ? 3 : 4);
      b = c.createBuffer(1, d.length, c.sampleRate);
      b.getChannelData(0).set(d);
      this.noises.set(kind, b);
    }
    return b;
  }

  /** One cached instrument note: a buffer source and a gain, gone when it ends. `cut` shortens it with an envelope. */
  private note(inst: Inst, m: number, t: number, vel: number, dest: AudioNode, cut?: number, done?: () => void): void {
    // polyphony counts by end time, which works the same whether the clock is real or an offline render's
    this.noteEnds = this.noteEnds.filter(e => e > t);
    if (this.noteEnds.length >= MAX_NOTES) { this.stats.droppedNotes++; done?.(); return; }
    const c = this.ctx!, key = `${inst}${m}`;
    let e = this.buffers.get(key);
    if (!e) {
      const r = renderNote(inst, m, c.sampleRate);
      const buffer = c.createBuffer(1, r.data.length, c.sampleRate);
      buffer.getChannelData(0).set(r.data);
      e = { buffer, rate: r.rate, gain: r.gain };
      this.buffers.set(key, e);
    }
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = e.buffer;
    s.playbackRate.value = e.rate * (1 + (this.rand() - 0.5) * 0.0012); // a breath of tuning drift between hits
    const level = Math.max(0.0002, vel * e.gain);
    g.gain.value = level;
    if (cut) {
      g.gain.setValueAtTime(level, t);
      g.gain.exponentialRampToValueAtTime(0.0002, t + cut);
    }
    s.connect(g); g.connect(dest);
    this.stats.notes++;
    this.noteEnds.push(t + (cut ?? e.buffer.duration / e.rate));
    this.stats.peakNotes = Math.max(this.stats.peakNotes, this.noteEnds.length);
    s.onended = () => { s.disconnect(); g.disconnect(); this.stats.notes--; done?.(); };
    s.start(t);
    if (cut) s.stop(t + cut + 0.01);
  }

  private startSession(b: Biome): void {
    const c = this.ctx!, g = this.g!, song = SONGS[b], t = this.now() + 0.08;
    const fade = c.createGain(), fadeWet = c.createGain();
    fade.gain.value = 0.0001; fadeWet.gain.value = 0.0001;
    fade.gain.setTargetAtTime(1, t, FADE); fadeWet.gain.setTargetAtTime(1, t, FADE);
    fade.connect(g.music); fadeWet.connect(g.musicWet);
    const nodes: AudioNode[] = [fade, fadeWet];
    const mk = <T extends AudioNode>(n: T): T => { nodes.push(n); return n; };
    const gain = (v: number, ...dests: AudioNode[]): GainNode => {
      const n = mk(c.createGain()); n.gain.value = v;
      for (const d of dests) n.connect(d);
      return n;
    };
    const wet = (v: number): GainNode => gain(v, fadeWet);

    // Delay: dotted time from the song's tempo, its feedback darkening, into the same fader as the dry signal.
    const beat = 60 / song.bpm, delay = mk(c.createDelay(2));
    delay.delayTime.value = Math.min(1.9, beat * song.send.delayBeats);
    const dark = mk(c.createBiquadFilter()); dark.type = 'lowpass'; dark.frequency.value = 2100;
    const feedback = gain(0.34, delay);
    delay.connect(dark); dark.connect(feedback); dark.connect(fade);
    const pluckIn = gain(1, fade, gain(song.send.delay, delay), wet(song.send.reverb));
    const plucks = PANS.map(p => {
      if (!c.createStereoPanner) return pluckIn;
      const n = mk(c.createStereoPanner()); n.pan.value = p; n.connect(pluckIn);
      return n;
    });
    const bass = gain(1, fade, wet(0.03));
    const perc = gain(1, fade, wet(song.send.reverb * 0.5));

    // Pad: one low-pass with a very slow drift in cutoff, a voice panned to each side for width.
    const mid = (song.pad.cutoff[0] + song.pad.cutoff[1]) / 2, depth = (song.pad.cutoff[1] - song.pad.cutoff[0]) / 2;
    const padFilter = mk(c.createBiquadFilter());
    padFilter.type = 'lowpass'; padFilter.frequency.value = mid; padFilter.Q.value = 0.4;
    const padOut = gain(song.pad.gain * 0.78, fade, wet(song.send.reverb * 0.7));
    padFilter.connect(padOut);
    const padL = c.createStereoPanner ? mk(c.createStereoPanner()) : padFilter, padR = c.createStereoPanner ? mk(c.createStereoPanner()) : padFilter;
    if (padL !== padFilter) { (padL as StereoPannerNode).pan.value = -0.55; (padR as StereoPannerNode).pan.value = 0.55; padL.connect(padFilter); padR.connect(padFilter); }
    const lfo = c.createOscillator(); lfo.frequency.value = 0.047;
    const lfoDepth = gain(depth); lfoDepth.connect(padFilter.frequency); lfo.connect(lfoDepth);
    lfo.start(t);

    const comp = new Composer(song, (this.seedCounter += 7919));
    comp.cycle = this.cycles.get(b) ?? 0;
    this.session = { song, comp, next: t, queue: [], fade, fadeWet, plucks, bass, perc, padL, padR, padFilter, lfo, nodes, mid, lastCycle: comp.cycle };
    this.stats.sessions++;
    this.scaleSong = song;
    this.chordNow = [];
  }

  private endSession(s: Session): void {
    const t = this.now();
    this.cycles.set(s.song.id, s.comp.cycle);
    s.fade.gain.cancelScheduledValues(t); s.fadeWet.gain.cancelScheduledValues(t);
    s.fade.gain.setTargetAtTime(0.0001, t, FADE); s.fadeWet.gain.setTargetAtTime(0.0001, t, FADE);
    s.lfo.stop(t + 8);
    if (!this.offline) setTimeout(() => {
      for (const n of s.nodes) n.disconnect();
      s.lfo.disconnect();
      this.stats.sessions--;
    }, 8000);
  }

  /** The sequencer: compose bars as their start comes within the lookahead, then create only the notes that are due. */
  private pump(): void {
    if (!this.g) return;
    const now = this.now(), until = now + LOOKAHEAD, s = this.session;
    if (s) {
      if (s.next < now) { // the clock jumped (a stall, a resume): rejoin at the next moment, don't play the backlog
        s.next = now + 0.05;
        s.queue.length = 0;
      }
      while (s.next <= until) {
        const bar = s.comp.next();
        this.takeBar(s, bar);
        s.next += bar.dur;
      }
      while (s.queue.length && s.queue[0].t <= until) {
        const n = s.queue.shift()!;
        const i = Math.max(0, Math.min(PANS.length - 1, Math.round((n.pan + 0.6) / 0.3)));
        const dest = n.inst === 'bass' ? s.bass : n.inst === 'shaker' || n.inst === 'wood' || n.inst === 'drum' ? s.perc : s.plucks[i];
        this.note(n.inst, n.midi, Math.max(n.t, this.ctx!.currentTime), n.vel, dest);
      }
    }
    if (this.oceanStop && this.oceanLevel > 0.15 && !this.isMuted) {
      if (this.nextGull === 0) this.nextGull = now + 25 + this.rand() * 40;
      if (now >= this.nextGull) {
        this.nextGull = now + 45 + this.rand() * 110;
        gullCry(this.host!, this.g.ocean, (this.rand() - 0.5) * 1.4, now + 0.1);
      }
    }
  }

  private takeBar(s: Session, bar: Bar): void {
    const t = s.next;
    if (bar.pad) { this.padChord(s, bar.pad.midi, t, bar.pad.dur); this.chordNow = bar.pad.midi; }
    for (const n of bar.notes) s.queue.push({ t: t + n.at, inst: n.inst, midi: n.midi, vel: n.vel, pan: n.pan });
    s.queue.sort((a, b) => a.t - b.t);
    if (s.song.loopFrom > 0 && s.comp.cycle !== s.lastCycle) { // the finale opens up as it builds
      s.lastCycle = s.comp.cycle;
      s.padFilter.frequency.setTargetAtTime(s.mid + Math.min(4, s.comp.cycle) * 120, t, 4);
    }
  }

  private padChord(s: Session, notes: number[], t: number, dur: number): void {
    const c = this.ctx!, attack = Math.min(0.9, dur * 0.35), release = 1.3, end = t + dur + release;
    const nodes: AudioNode[] = [];
    const sides = [s.padL, s.padR].map(side => {
      const e = c.createGain();
      e.gain.setValueAtTime(0.0001, t);
      e.gain.linearRampToValueAtTime(0.2, t + attack);
      e.gain.setValueAtTime(0.2, t + dur);
      e.gain.exponentialRampToValueAtTime(0.0001, end);
      e.connect(side);
      nodes.push(e);
      return e;
    });
    let live = 0;
    notes.forEach((m, idx) => sides.forEach((side, sideIdx) => {
      const o = c.createOscillator();
      o.setPeriodicWave(this.wave!);
      o.frequency.value = freq(m);
      o.detune.value = (sideIdx ? 1 : -1) * (3 + idx);
      const v = c.createGain(); v.gain.value = idx === notes.length - 1 ? 0.75 : 1; // the top voice stays out of the lead's way
      o.connect(v); v.connect(side);
      nodes.push(o, v);
      live++;
      o.onended = () => { if (--live === 0) { for (const n of nodes) n.disconnect(); this.stats.pads--; } };
      o.start(t);
      o.stop(end + 0.02);
    }));
    this.stats.pads++;
  }

  play(s: Sfx, o: SfxOpts = {}): void {
    this.logEvent(s);
    if (!this.host || this.isMuted || this.hidden()) return;
    const t = this.now() + 0.002;
    this.sfxEnds = this.sfxEnds.filter(e => e > t);
    if (this.sfxEnds.length >= MAX_SFX) { this.stats.droppedSfx++; return; }
    this.sfxEnds.push(t + 1.2);
    this.guard(() => playSfx(this.host!, s, o, t));
  }

  pour(durationSec: number, pan = 0): void {
    this.logEvent('pour');
    if (!this.host || this.isMuted || this.hidden()) return;
    this.guard(() => pourSound(this.host!, durationSec, pan, this.now() + 0.002));
  }

  private logEvent(name: string): void {
    this.log.push({ name, t: this.ctx ? this.now() : 0 });
    if (this.log.length > LOG_CAP) this.log.splice(0, this.log.length - LOG_CAP);
  }

  setMusic(b: Biome | null): void {
    if (b === this.want) return;
    this.want = b;
    if (b) this.scaleSong = SONGS[b];
    if (!this.g) return;
    this.guard(() => {
      if (this.session) this.endSession(this.session);
      this.session = null;
      if (b) this.startSession(b);
      this.pump();
    });
  }

  private param(p: AudioParam | undefined, v: number, tc = 0.05): void {
    if (p && this.ctx) this.guard(() => { p.cancelScheduledValues(this.now()); p.setTargetAtTime(v, this.now(), tc); });
  }

  setMusicVolume(v: number): void {
    this.musicVol = Math.max(0, Math.min(1, v));
    this.param(this.g?.music.gain, this.musicVol); this.param(this.g?.musicWet.gain, this.musicVol);
  }
  setSfxVolume(v: number): void { this.sfxVol = Math.max(0, Math.min(1, v)); this.param(this.g?.sfx.gain, this.sfxVol); }
  setMuted(m: boolean): void {
    this.isMuted = m;
    const p = this.g?.master.gain;
    this.param(p, m ? 0 : 1, 0.02);
    if (p && m) this.guard(() => p.setValueAtTime(0, this.now() + 0.2)); // an exponential approach never lands on zero
  }
  get muted(): boolean { return this.isMuted; }

  /** The biome's five notes, as midi numbers: what plates, ticks and fanfares play. */
  get scale(): number[] { return platesOf(this.scaleSong); }

  duck(seconds: number): void {
    const g = this.g;
    if (!g) return;
    this.guard(() => {
      const t = this.now();
      for (const p of [g.duck.gain, g.duckWet.gain]) {
        p.cancelScheduledValues(t);
        p.setTargetAtTime(0.32, t, 0.07);
        p.setTargetAtTime(1, t + Math.max(0.1, seconds), 0.45);
      }
    });
  }

  setOcean(level: number): void {
    this.oceanLevel = Math.max(0, Math.min(1, level));
    const g = this.g;
    if (!g) return;
    this.guard(() => {
      if (this.oceanTimer !== null) { clearTimeout(this.oceanTimer); this.oceanTimer = null; }
      if (this.oceanLevel > 0 && !this.oceanStop) this.buildOcean();
      this.param(g.ocean.gain, this.oceanLevel * OCEAN_GAIN, 0.7);
      if (this.oceanLevel === 0 && this.oceanStop && !this.offline) {
        this.oceanTimer = setTimeout(() => { this.oceanStop?.(); this.oceanStop = null; }, 5000);
      }
    });
  }

  /** Surf: looped brown and white noise, two sides on different slow swells so it never pulses in step. */
  private buildOcean(): void {
    const c = this.ctx!, g = this.g!, t = this.now(), nodes: AudioNode[] = [], sources: AudioScheduledSourceNode[] = [];
    const side = (pan: number, seed: number, rateA: number, rateB: number): void => {
      const body = c.createBufferSource(), foam = c.createBufferSource();
      const data = noise('brown', 9, c.sampleRate, seed), buf = c.createBuffer(1, data.length, c.sampleRate);
      buf.getChannelData(0).set(data);
      body.buffer = buf; body.loop = true;
      foam.buffer = this.noiseBuffer('white'); foam.loop = true;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.4;
      const foamG = c.createGain(); foamG.gain.value = 0.09;
      const swell = c.createGain(); swell.gain.value = 0.62;
      const panner = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
      if ('pan' in panner) panner.pan.value = pan;
      body.connect(lp); lp.connect(swell);
      foam.connect(bp); bp.connect(foamG); foamG.connect(swell);
      swell.connect(panner); panner.connect(g.ocean);
      const lfoA = c.createOscillator(), lfoB = c.createOscillator(), aG = c.createGain(), bG = c.createGain(), fG = c.createGain();
      lfoA.frequency.value = rateA; lfoB.frequency.value = rateB;
      aG.gain.value = 0.26; bG.gain.value = 0.12; fG.gain.value = 240;
      lfoA.connect(aG); aG.connect(swell.gain); lfoB.connect(bG); bG.connect(swell.gain); lfoA.connect(fG); fG.connect(lp.frequency);
      for (const n of [body, foam, lfoA, lfoB]) { n.start(t); sources.push(n); }
      nodes.push(body, foam, lp, bp, foamG, swell, panner, lfoA, lfoB, aG, bG, fG);
    };
    side(-0.5, 31, 0.113, 0.041);
    side(0.5, 32, 0.087, 0.053);
    this.oceanStop = () => {
      for (const s of sources) s.stop();
      for (const n of nodes) n.disconnect();
    };
  }

  /** Offline renders only: move the virtual clock and schedule everything due up to `t`. */
  advanceTo(t: number): void {
    if (!this.offline) return;
    const step = 0.1;
    for (let x = this.clock + step; x < t; x += step) { this.clock = x; this.pump(); }
    this.clock = t;
    this.pump();
  }
}
