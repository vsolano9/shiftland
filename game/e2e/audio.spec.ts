// Audio checks on real WebAudio in Chromium: renders every SFX and every biome through OfflineAudioContext and measures
// the samples (peak, DC, loudness window, silent gaps, decay), then exercises the live AudioContext paths (unlock, mute,
// hidden tab, no WebAudio at all, node clean-up). With AUDIO_EVIDENCE=<dir> it also writes WAVs there, for
// src/audio/tools/analyze_audio.py (spectrograms, bar-by-bar variation, in-key energy).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';
import type { Biome, GameAudio as GameAudioT, Sfx } from '../src/audio/audio.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EVIDENCE = process.env.AUDIO_EVIDENCE ?? '';
const BIOMES: Biome[] = ['title', 'meadow', 'coast', 'desert', 'tundra', 'finale', 'ending'];
const SFX: Sfx[] = ['hover', 'select', 'slide', 'stop', 'uplift', 'crack', 'blocked', 'undo', 'restart', 'tick', 'untick', 'bleat', 'crush', 'lighthouse', 'splash', 'fish', 'penguin', 'oasis', 'complete', 'star', 'ui', 'stuck', 'whoosh', 'meltice', 'chord'];
const SR = 44100;

type Cue = { t: number; do: 'play' | 'pour' | 'music' | 'ocean' | 'duck' | 'mute' | 'musicVol' | 'mood'; name?: string; o?: object; v?: unknown };
interface Scene { seconds: number; seed?: number; cues: Cue[]; musicVol?: number }
interface Pcm { l: Float32Array; r: Float32Array; ms: number }

declare global { interface Window { ShiftlandAudio: { GameAudio: typeof GameAudioT }; render(s: Scene): Promise<{ b64: string; ms: number; log: number; stats: object }> } }

let bundle = '';
test.beforeAll(async () => {
  // the audio module on its own, so these checks don't depend on whatever the game's main.ts is doing
  const out = await build({
    configFile: false, logLevel: 'silent', root: ROOT,
    build: { write: false, minify: false, lib: { entry: join(ROOT, 'src/audio/audio.ts'), formats: ['iife'], name: 'ShiftlandAudio', fileName: () => 'audio.js' } },
  });
  const outputs = (Array.isArray(out) ? out : [out]) as { output: { code?: string }[] }[];
  bundle = outputs[0].output[0].code ?? '';
  expect(bundle.length).toBeGreaterThan(1000);
  if (EVIDENCE) mkdirSync(EVIDENCE, { recursive: true });
});

async function open(page: Page): Promise<void> {
  await page.route('**/audio-harness', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>audio</title><body style="height:100vh"></body>' }));
  await page.goto('./audio-harness');
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    window.render = async ({ seconds, seed, cues, musicVol }) => {
      const sr = 44100, ctx = new OfflineAudioContext(2, Math.floor(seconds * sr), sr);
      const a = new window.ShiftlandAudio.GameAudio({ ctx, seed: seed ?? 1 });
      if (musicVol !== undefined) a.setMusicVolume(musicVol);
      a.unlock();
      for (const c of [...cues].sort((x, y) => x.t - y.t)) {
        a.advanceTo(c.t);
        if (c.do === 'play') a.play(c.name as Sfx, c.o);
        else if (c.do === 'pour') a.pour(c.v as number, 0.4);
        else if (c.do === 'music') a.setMusic(c.v as Biome | null);
        else if (c.do === 'ocean') a.setOcean(c.v as number);
        else if (c.do === 'duck') a.duck(c.v as number);
        else if (c.do === 'mute') a.setMuted(c.v as boolean);
        else if (c.do === 'musicVol') a.setMusicVolume(c.v as number);
        else if (c.do === 'mood') a.setMood(c.v as number);
      }
      a.advanceTo(seconds);
      const t0 = performance.now(), buf = await ctx.startRendering(), ms = performance.now() - t0;
      const l = buf.getChannelData(0), r = buf.getChannelData(1), both = new Float32Array(l.length * 2);
      for (let i = 0; i < l.length; i++) { both[2 * i] = l[i]; both[2 * i + 1] = r[i]; }
      const bytes = new Uint8Array(both.buffer);
      let b64 = '';
      for (let i = 0; i < bytes.length; i += 30000) b64 += btoa(String.fromCharCode(...bytes.subarray(i, i + 30000)));
      return { b64, ms, log: a.log.length, stats: a.stats };
    };
  });
}

function decode(b64chunks: string): Float32Array {
  // btoa chunks are padded only at the very end because 30000 is a multiple of 3
  const raw = Buffer.from(b64chunks, 'base64');
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

async function render(page: Page, name: string, scene: Scene): Promise<Pcm> {
  const res = await page.evaluate(s => window.render(s), scene);
  const both = decode(res.b64), n = both.length / 2, l = new Float32Array(n), r = new Float32Array(n);
  for (let i = 0; i < n; i++) { l[i] = both[2 * i]; r[i] = both[2 * i + 1]; }
  if (EVIDENCE) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0); header.writeUInt32LE(36 + both.byteLength, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
    header.writeUInt16LE(3, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 8, 28);
    header.writeUInt16LE(8, 32); header.writeUInt16LE(32, 34); header.write('data', 36); header.writeUInt32LE(both.byteLength, 40);
    writeFileSync(join(EVIDENCE, `${name}.wav`), Buffer.concat([header, Buffer.from(both.buffer, both.byteOffset, both.byteLength)]));
  }
  return { l, r, ms: res.ms };
}

const db = (x: number): number => 20 * Math.log10(Math.max(x, 1e-9));

function measure(p: Pcm): { peak: number; dc: number; rms: number; gap: number; tail: number } {
  const n = p.l.length, win = Math.floor(0.1 * SR);
  let peak = 0, sum = 0, e = 0;
  for (let i = 0; i < n; i++) { const m = (p.l[i] + p.r[i]) / 2; peak = Math.max(peak, Math.abs(p.l[i]), Math.abs(p.r[i])); sum += m; e += m * m; }
  let gap = 0, run = 0, last = 0;
  for (let i = 0; i + win <= n; i += win) {
    let w = 0;
    for (let j = i; j < i + win; j++) w += p.l[j] * p.l[j] + p.r[j] * p.r[j];
    last = db(Math.sqrt(w / (2 * win)));
    run = last < -60 ? run + 0.1 : 0;
    gap = Math.max(gap, run);
  }
  return { peak: db(peak), dc: Math.abs(sum / n), rms: db(Math.sqrt(e / n)), gap, tail: last };
}

test.describe('offline renders', () => {
  test.setTimeout(600_000);

  test('every SFX is bounded, centred and decays to silence', async ({ page }) => {
    await open(page);
    const scenes: [string, Sfx, object][] = SFX.map(s => [`sfx-${s}`, s, {}]);
    for (const v of [0, 1, 2]) scenes.push([`sfx-bleat-v${v}`, 'bleat', { variant: v }]);
    for (const i of [0, 1]) scenes.push([`sfx-uplift-i${i}`, 'uplift', { intensity: i, plate: 1 }], [`sfx-slide-i${i}`, 'slide', { intensity: i, pan: i * 2 - 1 }]);
    for (const v of [1, 3]) scenes.push([`sfx-tick-v${v}`, 'tick', { variant: v }]);
    for (const [name, s, o] of scenes) {
      const quietMusic: Cue = { t: 0, do: 'music', v: 'meadow' };
      const m = measure(await render(page, name, { seconds: s === 'complete' ? 7 : 3.5, musicVol: 0, cues: [quietMusic, { t: 0.05, do: 'play', name: s, o }] }));
      console.log(`${name.padEnd(18)} peak ${m.peak.toFixed(1)} rms ${m.rms.toFixed(1)} tail ${m.tail.toFixed(1)}`);
      expect.soft(m.peak, `${name} peak`).toBeLessThanOrEqual(-1);
      expect.soft(m.peak, `${name} must carry over the music`).toBeGreaterThan(s === 'hover' ? -36 : -26);
      expect.soft(m.dc, `${name} dc`).toBeLessThan(0.002);
      expect.soft(m.tail, `${name} decays`).toBeLessThan(-52);
    }
  });

  test('the mood filter darkens the song without losing its loudness', async ({ page }) => {
    await open(page);
    const scene = (v: number): Scene => ({ seconds: 20, seed: 5, cues: [{ t: 0, do: 'music', v: 'meadow' }, { t: 0, do: 'mood', v }] });
    const low = await render(page, 'mood-0', scene(0)), high = await render(page, 'mood-1', scene(1));
    // a second difference weighs the top end enough to see past the song's strong low notes
    const bright = (p: Pcm) => { let e = 0; for (let i = 2; i < p.l.length; i++) e += (p.l[i] - 2 * p.l[i - 1] + p.l[i - 2]) ** 2; return db(Math.sqrt(e / p.l.length)); };
    const dark = bright(high) - bright(low), lost = measure(high).rms - measure(low).rms;
    console.log(`mood: top end ${dark.toFixed(1)} dB darker, ${lost.toFixed(1)} dB quieter`);
    expect(dark).toBeGreaterThan(4);
    expect(lost).toBeLessThan(5);
  });

  test('every biome loops inside a loudness window, with no gap and no clip', async ({ page }) => {
    await open(page);
    const seconds = EVIDENCE ? 150 : 60, rows: number[] = [];
    for (const b of BIOMES) {
      const m = measure(await render(page, `music-${b}`, { seconds, seed: 42, cues: [{ t: 0, do: 'music', v: b }] }));
      console.log(`${b.padEnd(8)} peak ${m.peak.toFixed(1)} rms ${m.rms.toFixed(1)} gap ${m.gap.toFixed(1)}s dc ${m.dc.toExponential(1)}`);
      rows.push(m.rms);
      expect(m.peak, `${b} peak`).toBeLessThanOrEqual(-1);
      expect(m.dc, `${b} dc`).toBeLessThan(0.001);
      expect(m.gap, `${b} silent gap`).toBeLessThan(4);
      expect(m.rms, `${b} loudness`).toBeGreaterThan(-32);
      expect(m.rms, `${b} loudness`).toBeLessThan(-16);
    }
    expect(Math.max(...rows) - Math.min(...rows), 'biome to biome loudness spread').toBeLessThan(6);
  });

  test('music, surf, pour and a pile-up of SFX together stay under the ceiling', async ({ page }) => {
    await open(page);
    const cues: Cue[] = [{ t: 0, do: 'music', v: 'finale' }, { t: 0, do: 'ocean', v: 1 }, { t: 4, do: 'pour', v: 2 }];
    for (let i = 0; i < 6; i++) cues.push({ t: 4 + i * 0.14, do: 'play', name: 'uplift', o: { intensity: 1, plate: i } }, { t: 4.05 + i * 0.14, do: 'play', name: 'crack' });
    cues.push({ t: 6, do: 'play', name: 'complete' }, { t: 6.1, do: 'play', name: 'crush' }, { t: 7.5, do: 'play', name: 'star' }, { t: 7.6, do: 'play', name: 'star', o: { variant: 2 } });
    const m = measure(await render(page, 'mix-pileup', { seconds: 14, cues }));
    console.log(`pile-up peak ${m.peak.toFixed(1)} rms ${m.rms.toFixed(1)}`);
    expect(m.peak).toBeLessThanOrEqual(-1);
  });

  test('crossfade, duck, same-biome no-op, and surf alone', async ({ page }) => {
    await open(page);
    const scene = await render(page, 'scene-crossfade', {
      seconds: 26,
      cues: [{ t: 0, do: 'music', v: 'meadow' }, { t: 5, do: 'music', v: 'meadow' }, { t: 9, do: 'music', v: 'coast' }, { t: 14, do: 'duck', v: 3 }, { t: 20, do: 'music', v: null }],
    });
    const fade = measure(scene);
    expect(fade.peak).toBeLessThanOrEqual(-1);
    const span = (a: number, b: number): number => measure({ ...scene, l: scene.l.subarray(a * SR, b * SR), r: scene.r.subarray(a * SR, b * SR) }).rms;
    const dip = span(11.5, 13.5) - span(15, 16.8);
    console.log(`duck dip ${dip.toFixed(1)} dB`);
    expect(dip, 'duck dips the music').toBeGreaterThan(5);
    expect(fade.tail, 'music stops after setMusic(null)').toBeLessThan(-52);
    const surf = measure(await render(page, 'scene-ocean', { seconds: 90, seed: 3, cues: [{ t: 0, do: 'ocean', v: 1 }] }));
    console.log(`ocean peak ${surf.peak.toFixed(1)} rms ${surf.rms.toFixed(1)}`);
    expect(surf.rms, 'surf is an ambience, under the music').toBeLessThan(-26);
    expect(surf.rms).toBeGreaterThan(-48);
    expect(surf.gap).toBeLessThan(1);
    const pour = measure(await render(page, 'sfx-pour', { seconds: 3.5, cues: [{ t: 0.05, do: 'pour', v: 1.2 }] }));
    expect(pour.peak).toBeLessThanOrEqual(-1);
    expect(pour.tail).toBeLessThan(-52);
  });

  test('mute and zero volume are silent', async ({ page }) => {
    await open(page);
    const m = measure(await render(page, 'scene-muted', {
      seconds: 8,
      cues: [{ t: 0, do: 'music', v: 'ending' }, { t: 0, do: 'ocean', v: 1 }, { t: 0, do: 'mute', v: true }, { t: 2, do: 'play', name: 'complete' }],
    }));
    expect(m.peak, 'muted peak').toBeLessThan(-70);
  });
});

test.describe('live AudioContext', () => {
  test('without WebAudio nothing throws and the log still fills', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      delete w.AudioContext; delete w.webkitAudioContext;
    });
    await open(page);
    const out = await page.evaluate(() => {
      const a = new window.ShiftlandAudio.GameAudio();
      a.unlock(); a.setMusic('meadow'); a.setOcean(1); a.duck(1); a.setMusicVolume(0.5); a.setSfxVolume(0.5); a.setMuted(true);
      a.play('select', { plate: 1 }); a.pour(1); a.unlock();
      return { log: a.log.map(e => e.name), muted: a.muted, scale: a.scale };
    });
    expect(out.log).toEqual(['select', 'pour']);
    expect(out.muted).toBe(true);
    expect(out.scale).toHaveLength(5);
  });

  test('a blocked context never throws; the first gesture starts it; hidden pauses; nodes are cleaned up', async ({ page }) => {
    await open(page);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.evaluate(() => {
      const w = window as unknown as { a: GameAudioT };
      w.a = new window.ShiftlandAudio.GameAudio();
      w.a.setMusic('meadow'); // before any gesture: remembered, not started
      w.a.setOcean(0.5);
      w.a.play('ui');
      document.addEventListener('pointerdown', () => { w.a.unlock(); w.a.unlock(); });
    });
    await page.mouse.click(200, 200);
    const read = (): Promise<{ state: string; t: number; stats: GameAudioT['stats']; n: number }> => page.evaluate(() => {
      const a = (window as unknown as { a: { ctx?: AudioContext; stats: GameAudioT['stats']; log: unknown[] } }).a;
      return { state: a.ctx?.state ?? 'none', t: a.ctx?.currentTime ?? -1, stats: { ...a.stats }, n: a.log.length };
    });
    await expect.poll(async () => (await read()).state).toBe('running');
    await expect.poll(async () => (await read()).t).toBeGreaterThan(1.5);
    const running = await read();
    expect(running.stats.sessions).toBe(1);
    expect(running.stats.notes + running.stats.pads).toBeGreaterThan(0);

    // same biome: no restart. Then SFX of all kinds on top.
    await page.evaluate(sfx => {
      const a = (window as unknown as { a: GameAudioT }).a;
      a.setMusic('meadow');
      for (const s of sfx) a.play(s as Sfx, { plate: 1, intensity: 0.5, pan: 0.2 });
      a.pour(0.5, -0.3);
    }, SFX);
    expect((await read()).stats.sessions).toBe(1);
    expect((await read()).n).toBe(1 + SFX.length + 1);

    // hidden tab: the clock freezes and no notes are added
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => (await read()).state).toBe('suspended');
    const h0 = await read();
    await page.waitForTimeout(1200);
    const h1 = await read();
    expect(h1.t).toBe(h0.t);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => (await read()).state).toBe('running');
    await expect.poll(async () => (await read()).t).toBeGreaterThan(h1.t + 0.5);

    // crossfade away and stop: every note, pad, SFX voice and old session must clean itself up
    await page.evaluate(() => { const a = (window as unknown as { a: GameAudioT }).a; a.setMusic('tundra'); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const a = (window as unknown as { a: GameAudioT }).a; a.setMusic(null); a.setOcean(0); });
    await expect.poll(async () => { const s = (await read()).stats; return s.notes + s.pads + s.sfx + s.sessions; }, { timeout: 15_000, intervals: [500] }).toBe(0);

    // the log is capped
    const capped = await page.evaluate(() => { const a = (window as unknown as { a: GameAudioT }).a; for (let i = 0; i < 700; i++) a.play('hover'); return a.log.length; });
    expect(capped).toBe(500);
    expect(errors).toEqual([]);
  });
});
