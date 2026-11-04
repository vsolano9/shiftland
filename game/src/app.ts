// The game: wires Controller (rules and progress) to World (three.js), the DOM UI, audio and input.
import '@fontsource/fredoka/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import './ui/style.css';
import { Vector3 } from 'three';
import { GameAudio, type Biome } from './audio/audio.ts';
import { Controller, type GameEvent } from './game/controller.ts';
import { keyAction } from './game/keys.ts';
import { browserStorage, Progress, tutorialCount } from './game/progress.ts';
import raw from './levels/levels.json';
import type { CreatureKind } from './render/creatures.ts';
import { MOVE_TIME, type IslandView } from './render/island.ts';
import { BIOMES, type BiomeName } from './render/palette.ts';
import { World } from './render/world.ts';
import { previewDiff } from './rules/diff.ts';
import { DIR_NAME, fromJson, shift, solve, type Dir, type Level, type LevelJson, type State } from './rules/rules.ts';
import { createStuckWorker, StuckChecker } from './solver/stuck.ts';
import { drawLogo } from './ui/logo.ts';

type Screen = 'title' | 'map' | 'level' | 'ending';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const icon = {
  undo: '<svg viewBox="0 0 24 24"><path d="M8 5 3.5 9.5 8 14"/><path d="M4 9.5h10a6 6 0 0 1 0 12H9"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20.5 2.5v5h-5"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h4l5 4v-13l-5 4z"/><path d="m17 9.5 5 5M22 9.5l-5 5"/></svg>',
  bulb: '<svg viewBox="0 0 24 24"><path d="M9 17.5h6M10 21h4"/><path d="M12 2.8a6.7 6.7 0 0 0-4 12.1c.7.6 1 1.2 1 2.1h6c0-.9.3-1.5 1-2.1a6.7 6.7 0 0 0-4-12.1z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M10 5 3.5 12l6.5 7"/><path d="M4 12h17"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M6 3.5v17l15-8.5z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 13 4.5 4.5L19 7"/></svg>',
  cross: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  star: '<svg viewBox="0 0 48 48"><path fill="#ffc531" stroke="#d98e12" stroke-width="3" stroke-linejoin="round" d="m24 4 6 13 14 1.7-10.3 9.6L36.4 42 24 35l-12.4 7 2.7-13.7L4 18.7 18 17z"/><path fill="#ffe487" d="m24 8.5 4.6 10 10.8 1.3-3.6 3.3C29 23.5 21 21 15 17.5l4.6-.6z"/></svg>',
  starEmpty: '<svg viewBox="0 0 48 48"><path fill="#e8dcc4" stroke="#c4b292" stroke-width="3" stroke-linejoin="round" d="m24 4 6 13 14 1.7-10.3 9.6L36.4 42 24 35l-12.4 7 2.7-13.7L4 18.7 18 17z"/></svg>',
  lock: '<svg class="lock" viewBox="0 0 24 24"><path d="M7 10V7.5a5 5 0 0 1 10 0V10h1.5v11h-13V10zm2.2 0h5.6V7.5a2.8 2.8 0 0 0-5.6 0z"/></svg>',
  flag: '<svg class="flag" viewBox="0 0 20 22"><path d="M3.5 1v20" stroke="#6b4a32" stroke-width="2.4" stroke-linecap="round"/><path d="M4.5 2 18 6.5 4.5 11z" fill="#e04238"/></svg>',
  hand: '<svg viewBox="0 0 64 64"><path fill="#fff" stroke="#3b3226" stroke-width="3" stroke-linejoin="round" d="M26 6c3 0 5 2 5 5v17c1-2 7-3 8 0 2-2 7-2 8 1 3-2 7 0 7 4v12c0 9-6 14-15 14H34c-6 0-9-3-13-8L9 35c-2-3 3-7 7-4l5 5V11c0-3 2-5 5-5z"/></svg>',
};

const GOAL_TEXT: Record<CreatureKind, [string, string]> = {
  goat: ['Goat', 'height 2 or more'], village: ['Village', 'height 1 or less'], light: ['Lighthouse', 'beside the sea'], buoy: ['Buoy', 'open sea'], oasis: ['Oasis', 'beside a lake'], penguin: ['Penguins', 'ice by the sea'],
};
/** The full rule, shown when a goal chip is tapped. */
const GOAL_RULE: Record<CreatureKind, string> = {
  goat: 'The goat wants a peak: height 2 or more. Count the dots. Pushing two plates together lifts the seam one higher than either side.',
  village: 'The village wants low ground: height 1 or less. If the land rises under it, it is unhappy.',
  light: 'The lighthouse wants open sea on a side next to it. Pull plates apart, or sail its plate to the shore.',
  buoy: 'The buoy never moves. Land can slide under it and beach it. It wants open sea around it.',
  oasis: 'The oasis wants a lake on a side next to it. A lake is water the sea cannot reach: close the gap around it.',
  penguin: 'Penguins want their ice touching the sea. Lifting ice melts it, and a plate carries what stands on it.',
};
/** The ending's tour: what each biome's creatures got. */
const TOUR: [BiomeName, string][] = [
  ['meadow', 'The goats have their peaks'], ['coast', 'The lights reach the sea'], ['desert', 'The oases have their water'], ['tundra', 'The penguins kept their ice'], ['finale', 'And the land is at rest'],
];
const ENDING_KEY = 'shiftland.ending.v1';

const parseMove = (m: string) => ({ plate: Number(m[1]), dir: DIR_NAME.indexOf(m[2] as 'N') as Dir });

const SETTINGS_KEY = 'shiftland.settings.v1';
interface Settings { music: number; sfx: number; muted: boolean; reduced: boolean }
function loadSettings(): Settings {
  const d: Settings = { music: .7, sfx: .85, muted: false, reduced: matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false };
  try { const s = JSON.parse(browserStorage()?.getItem(SETTINGS_KEY) ?? 'null'); if (s) { for (const k of ['music', 'sfx'] as const) if (typeof s[k] === 'number' && s[k] >= 0 && s[k] <= 1) d[k] = s[k]; for (const k of ['muted', 'reduced'] as const) if (typeof s[k] === 'boolean') d[k] = s[k]; } } catch { /* defaults */ }
  return d;
}

/** Islands along a serpentine path across the screen-aligned ocean. */
function archipelago(levels: Level[], aspect: number): [number, number][] {
  const AZ = .72, right = [Math.cos(AZ), -Math.sin(AZ)], fwd = [-Math.sin(AZ), -Math.cos(AZ)];
  const out: [number, number][] = [];
  // rows that suit the screen's shape, so the whole sea fills it and each island stays big enough to read and tap
  const perRow = aspect < .9 ? 3 : aspect > 1.95 ? 7 : 5;
  const rows = Math.ceil(levels.length / perRow), du = perRow === 3 ? 13 : 13.5, dv = perRow === 3 ? 13.5 : 14.5;
  levels.forEach((_, i) => {
    const r = Math.floor(i / perRow), k = i - r * perRow;
    const u = (r % 2 ? perRow - 1 - k : k) * du - (perRow - 1) * du / 2 + Math.sin(i * 1.7) * 1.4;
    const v = (rows - 1) * dv / 2 - r * dv + Math.sin(i * 2.3 + 1) * 1.6 + (k % 2 ? 1.6 : -1.6);
    // first row at the bottom of the map, so the player climbs the screen
    const V = -v;
    out.push([right[0] * u + fwd[0] * V, right[1] * u + fwd[1] * V]);
  });
  return out;
}

class App {
  levels: Level[]; progress: Progress; controller!: Controller; world: World; audio = new GameAudio(); stuck: StuckChecker;
  screen: Screen = 'title';
  settings = loadSettings();
  private view!: IslandView;
  private busyUntil = 0;
  private drag: { plate: number; start: Vector3; y: number; pointer: number; moved: boolean; across: number } | null = null;
  private dragging = false;
  private pinEls: HTMLElement[] = [];
  private thumbs!: ReturnType<World['thumbs']>;
  private chips = new Map<CreatureKind, { el: HTMLElement; goals: number[]; delta: HTMLElement | null }>();
  private hintTimer = 0;
  private firstMoveMade = false;
  private completeTimer = false;
  private handStart = 0;
  private handMove: { plate: number; dir: Dir } | null = null;
  private solvedStates = new Map<number, State>();
  private ready = false;

  constructor(canvas: HTMLCanvasElement) {
    this.levels = (raw as unknown as LevelJson[]).map(fromJson);
    const names = this.levels.map(l => l.name!);
    this.progress = new Progress(names, browserStorage(), tutorialCount(this.levels), this.levels.flatMap((l, i) => (l.role === 'tutorial' ? [i] : [])));
    this.world = new World(canvas, this.levels, (s, o) => this.audio.play(s, o), archipelago(this.levels, innerWidth / innerHeight));
    this.world.reducedMotion = this.settings.reduced;
    this.world.fx.reduced = this.settings.reduced;
    this.stuck = new StuckChecker(createStuckWorker, s => this.controller?.stuckAnswer(s));
    this.applyAudioSettings();
    this.audio.setOcean(.7);
    this.buildUi();
    this.thumbs = this.world.thumbs();
    this.controller = new Controller(this.levels, this.progress, this.stuck, e => this.onEvent(e));
    this.refreshIslands();
    this.world.focusTitle();
    this.view = this.world.views[this.controller.index];
    this.view.reconcile(this.view.lv.start, false);
    this.bindInput(canvas);
    this.world.onFrame((dt, t) => this.frame(dt, t));
    this.ready = true;
    this.show('title');
  }

  // ---- UI construction
  private buildUi() {
    const ui = $('ui');
    ui.innerHTML = `
      <div id="s-title" class="screen">
        <canvas id="logo" width="1560" height="520"></canvas>
        <div id="tagline">Move the earth. Make everyone happy.</div>
        <div id="play"><button id="btn-play" aria-label="Play">${icon.play}<span>Play</span></button></div>
        <div id="title-tr"><button class="round snd" id="t-mute" aria-label="Sound">${icon.sound}</button><button class="round" id="t-set" aria-label="Settings">${icon.gear}</button></div>
      </div>
      <div id="s-map" class="screen hidden">
        <div id="map-tl"><button class="round" id="m-back" aria-label="Back">${icon.back}</button></div>
        <div id="map-title" class="card">Choose an island</div>
        <div id="map-stars" class="card">${icon.star}<span id="stars-n">0</span></div>
      </div>
      <div id="s-level" class="screen hidden">
        <div id="hud-tl" class="card"><div id="hud-name"></div><div id="hud-moves"></div></div>
        <div id="hud-tr">
          <button class="round" id="b-undo" aria-label="Undo (Z)" title="Undo (Z)">${icon.undo}</button>
          <button class="round" id="b-restart" aria-label="Restart (R)" title="Restart (R)">${icon.restart}</button>
          <button class="round" id="b-hint" aria-label="Hint (H)" title="Hint (H)">${icon.bulb}</button>
          <button class="round" id="b-map" aria-label="Map (M)" title="Map (M)">${icon.map}</button>
          <button class="round" id="b-set" aria-label="Settings">${icon.gear}</button>
        </div>
        <div id="stuck" class="hidden-el">No way back from here. Undo?</div>
        <div id="hint" class="card off"></div>
        <div id="blurb" class="card off"></div>
        <div id="goals"></div>
        <div id="hand" class="hidden-el">${icon.hand}</div>
        <div id="card"><div class="big"></div><div class="small"></div></div>
      </div>
      <div id="done" class="screen hidden"><div class="panel"><h2 id="d-title"></h2><div id="d-star"></div><div class="score" id="d-score"></div><div class="sub" id="d-sub"></div>
        <div class="row"><button class="btn" id="d-replay">Replay</button><button class="btn" id="d-map">Map</button><button class="btn primary" id="d-next">Next</button></div></div></div>
      <div id="ending" class="screen hidden"><div class="panel"><h2 id="e-title">Every creature is happy.</h2><p id="e-sub"></p><div class="row" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn" id="e-map">Back to the islands</button><button class="btn primary" id="e-shift">One last shift</button></div><div id="e-thanks">Thanks for playing Shiftland. Made for GitHub Game Off 2026, theme: Shift.</div></div></div>
      <div id="settings" class="screen hidden"><div class="panel"><h2>Settings</h2>
        <div class="set-row"><label for="s-music">Music</label><input type="range" id="s-music" min="0" max="1" step=".01"></div>
        <div class="set-row"><label for="s-sfx">Sounds</label><input type="range" id="s-sfx" min="0" max="1" step=".01"></div>
        <div class="set-row"><label for="s-muted">Mute everything</label><input type="checkbox" id="s-muted"></div>
        <div class="set-row"><label for="s-reduced">Reduced motion</label><input type="checkbox" id="s-reduced"></div>
        <div class="set-foot"><button class="btn" id="s-reset">Reset progress</button><button class="btn" id="s-full">Fullscreen</button><button class="btn primary" id="s-close">Close</button></div>
        <div id="credits">Keys: Tab or 1-9 pick a plate, arrows slide it, Z undo, R restart, H hint, M map, Enter next.<br>Shiftland, for GitHub Game Off 2026 (theme: SHIFT). All art and sound are made in code. Code written with AI (Claude). Font: Fredoka (OFL).</div>
      </div></div>`;
    const click = (id: string, fn: () => void) => $(id).addEventListener('click', () => { this.audio.unlock(); this.audio.play('ui'); fn(); });
    click('btn-play', () => this.toMap(true));
    click('t-set', () => this.openSettings()); click('b-set', () => this.openSettings());
    click('t-mute', () => this.toggleMute());
    click('m-back', () => this.toTitle());
    click('b-undo', () => this.controller.act({ kind: 'undo' }));
    click('b-restart', () => this.controller.act({ kind: 'restart' }));
    click('b-map', () => this.toMap());
    click('b-hint', () => this.showHint());
    $('hud-tl').addEventListener('click', () => this.showBlurb(4));
    click('d-replay', () => this.controller.act({ kind: 'restart' }));
    click('d-map', () => this.toMap());
    click('d-next', () => this.next());
    click('e-map', () => this.leaveEnding());
    click('e-shift', () => this.lastShift());
    click('s-close', () => $('settings').classList.add('hidden'));
    click('s-full', () => { const d = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void }; const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void }; if (document.fullscreenElement || d.webkitFullscreenElement) (document.exitFullscreen ?? d.webkitExitFullscreen)?.call(document); else (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el); });
    let confirmReset = false;
    click('s-reset', () => {
      if (!confirmReset) { confirmReset = true; $('s-reset').textContent = 'Really? Press again'; return; }
      confirmReset = false; $('s-reset').textContent = 'Reset progress';
      this.progress.reset(); $('settings').classList.add('hidden'); this.refreshIslands(); this.controller.open(0); this.toTitle();
    });
    const music = $<HTMLInputElement>('s-music'), sfx = $<HTMLInputElement>('s-sfx'), muted = $<HTMLInputElement>('s-muted'), reduced = $<HTMLInputElement>('s-reduced');
    music.oninput = () => { this.settings.music = +music.value; this.saveSettings(); };
    sfx.oninput = () => { this.settings.sfx = +sfx.value; this.saveSettings(); this.audio.play('select', { plate: 1 }); };
    muted.onchange = () => { this.settings.muted = muted.checked; this.saveSettings(); };
    reduced.onchange = () => { this.settings.reduced = reduced.checked; this.world.reducedMotion = reduced.checked; this.world.fx.reduced = reduced.checked; this.saveSettings(); };
    this.pinEls = this.levels.map((_, i) => {
      const el = document.createElement('div'); el.className = 'pin'; el.dataset.level = String(i);
      el.addEventListener('click', () => { this.audio.unlock(); this.pickLevel(i); });
      $('s-map').appendChild(el);
      this.world.pins.push({ el, pos: this.world.mapAnchors(this.world.views[i]).pin, hide: () => this.screen !== 'map' });
      return el;
    });
    // one label per biome, beside its first island
    let last = '';
    this.levels.forEach((lv, i) => {
      const b = (lv.biome ?? 'meadow') as BiomeName;
      if (b === last) return; last = b;
      const el = document.createElement('div'); el.className = 'biome-label'; el.textContent = BIOMES[b].label;
      $('s-map').appendChild(el);
      this.world.pins.push({ el, pos: this.world.mapAnchors(this.world.views[i]).label, hide: () => this.screen !== 'map' });
    });
    this.syncMuteIcon();
    // logo: the two halves slide along their faults, then settle
    const logo = $<HTMLCanvasElement>('logo');
    drawLogo(logo, 0);
    document.fonts?.ready.then(() => {
      const t0 = performance.now();
      const anim = () => { const u = Math.min(1, (performance.now() - t0 - 500) / 700); drawLogo(logo, u <= 0 ? 0 : 1 - Math.pow(1 - u, 3)); if (u < 1) requestAnimationFrame(anim); };
      anim();
    });
  }

  private applyAudioSettings() {
    const s = this.settings;
    this.audio.setMusicVolume(s.music); this.audio.setSfxVolume(s.sfx); this.audio.setMuted(s.muted);
  }
  private saveSettings() {
    this.applyAudioSettings(); this.syncMuteIcon();
    try { browserStorage()?.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* memory only */ }
  }
  private syncMuteIcon() { for (const b of document.querySelectorAll('.snd')) b.innerHTML = this.settings.muted ? icon.mute : icon.sound; }
  private toggleMute() { this.settings.muted = !this.settings.muted; this.saveSettings(); }
  private openSettings() {
    $<HTMLInputElement>('s-music').value = String(this.settings.music); $<HTMLInputElement>('s-sfx').value = String(this.settings.sfx);
    $<HTMLInputElement>('s-muted').checked = this.settings.muted; $<HTMLInputElement>('s-reduced').checked = this.settings.reduced;
    $('settings').classList.remove('hidden');
  }

  private show(s: Screen) {
    if (s !== this.screen) this.solveGen++;
    this.screen = s;
    for (const [id, name] of [['s-title', 'title'], ['s-map', 'map'], ['s-level', 'level'], ['ending', 'ending']] as const) $(id).classList.toggle('hidden', s !== name);
    if (s !== 'level') $('done').classList.add('hidden');
  }

  // ---- navigation
  private toTitle() {
    this.show('title');
    this.audio.setMusic('title'); this.audio.setOcean(.7);
    this.world.focusTitle(1);
  }
  private toMap(fromTitle = false) {
    if (fromTitle && !this.progress.solved(0)) { this.openLevel(0); return; } // first play: straight into the first island
    this.show('map');
    this.world.setActive(null);
    this.refreshIslands();
    this.world.writeStatic();
    this.audio.setMusic('title'); this.audio.setOcean(.6);
    this.audio.play('whoosh');
    this.world.showMap(1.1);
  }
  private refreshIslands() {
    let stars = 0;
    const next = this.progress.next();
    this.world.views.forEach((v, i) => {
      const unlocked = this.progress.unlocked(i), solved = this.progress.solved(i), rec = this.progress.record(this.levels[i].name!);
      if (rec?.stars) stars += rec.stars;
      const el = this.pinEls[i];
      if (el) {
        el.className = `pin${unlocked ? '' : ' locked'}${unlocked && !solved && i === next ? ' next' : ''}`;
        el.innerHTML = unlocked ? `${i + 1}${solved ? icon.flag : ''}${rec?.stars ? icon.star.replace('<svg', '<svg class="st"') : ''}` : icon.lock;
        el.setAttribute('aria-label', `Island ${i + 1}, ${this.levels[i].name}${unlocked ? '' : ', locked'}`);
        el.title = unlocked ? this.levels[i].name! : 'Locked';
      }
      v.setDim(unlocked ? 0 : 1);
      if (v !== this.world.active) {
        v.setBloom(solved);
        // the island left unfinished stays as the player left it; solved ones as their creatures left them
        const cur = this.controller.session, left = i === this.controller.index && cur.moves > 0 && !cur.solved;
        const s = left ? cur.state : solved ? this.solvedState(i) : v.lv.start;
        v.reconcile(s, false); v.applyGoals(v.goalsFn(v.lv, s), false); v.update(0, this.world.time.value);
      }
    });
    $('stars-n').textContent = `${stars} / ${this.levels.length}`;
  }
  /** The island as its creatures left it: the shipped solution applied. */
  private solvedState(i: number): State {
    const c = this.solvedStates.get(i); if (c) return c;
    const lv = this.levels[i]; let s = lv.start;
    for (const m of lv.sol ?? []) { const t = shift(lv, s, Number(m[1]), DIR_NAME.indexOf(m[2] as 'N') as Dir); if (t) s = t; }
    this.solvedStates.set(i, s);
    return s;
  }
  private pickLevel(i: number) {
    if (!this.progress.unlocked(i)) { this.audio.play('blocked'); return; }
    this.audio.play('ui');
    const cur = this.controller.session;
    if (i === this.controller.index && cur.moves > 0 && !cur.solved) { this.enterLevel(i, true); return; } // back to the unfinished island, moves and all
    this.openLevel(i);
  }
  private openLevel(i: number) {
    if (!this.controller.open(i)) return;
  }
  private next() {
    $('done').classList.add('hidden');
    this.controller.act({ kind: 'next' });
  }

  private enterLevel(i: number, fly: boolean) {
    this.view = this.world.views[i];
    const v = this.view, lv = v.lv;
    this.show('level');
    $('done').classList.add('hidden');
    this.firstMoveMade = false; this.completeTimer = false;
    const s = this.controller.session; // a fresh session is the level's start; one left for the map comes back as it was
    v.setDim(0);
    v.celebrate(false); v.setBloom(false);
    v.reconcile(s.state, true, { fromRestart: true });
    $('stuck').classList.add('hidden-el'); $('b-undo').classList.remove('glow');
    this.hintLevel = 0;
    this.firstMoveMade = s.moves > 0;
    this.setFlying(true); // before the flight: with reduced motion it lands, and unlocks, inside this call
    this.setActiveLevel(v, fly);
    v.showMarks = true;
    v.applyGoals(s.goals, this.world.active === v && !fly);
    v.setSelected(null);
    this.buildChips();
    this.refreshHud();
    this.audio.setMusic(((lv.biome ?? 'meadow') as Biome));
    this.audio.setOcean(.35);
    const tut = i < 2 && s.moves === 0;
    const h = $('hint');
    h.textContent = i === 0 && tut ? 'Drag a plate along its rail' : '';
    h.classList.add('off');
    if (i === 0 && tut) this.world.after(fly ? 1.3 : .1, () => { if (this.view === v && !this.firstMoveMade && this.screen === 'level') h.classList.remove('off'); });
    this.handStart = tut ? this.world.time.value : 0;
    this.handMove = tut && lv.sol?.[0] ? parseMove(lv.sol[0]) : null;
    if (tut) this.world.after(fly ? 1.4 : .2, () => { if (this.view === v && !this.firstMoveMade && this.handMove) { v.railHint = 1; v.showRail(this.handMove.plate); } });
  }
  private setActiveLevel(v: IslandView, fly: boolean) {
    this.world.setActive(v);
    this.world.focusIsland(v.index, fly ? 1.35 : .01, () => { this.setFlying(false); if (this.view === v) this.showBlurb(3.4); });
    if (fly) this.audio.play('whoosh');
  }
  /** The level's name and line; shown on landing and whenever the name card is tapped. */
  private showBlurb(sec = 3.4) {
    const lv = this.view.lv, c = $('blurb');
    c.textContent = lv.blurb ?? BIOMES[(lv.biome ?? 'meadow') as BiomeName].label;
    c.classList.remove('off');
    clearTimeout(this.blurbTimer);
    this.blurbTimer = window.setTimeout(() => c.classList.add('off'), sec * 1000);
  }
  private blurbTimer = 0;
  private setFlying(on: boolean) { this.busyUntil = on ? Infinity : 0; }
  private showCard(big: string, small: string, sec = 3.4) {
    const c = $('card'); (c.children[0] as HTMLElement).textContent = big; (c.children[1] as HTMLElement).textContent = small;
    c.classList.add('show');
    clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => c.classList.remove('show'), sec * 1000);
  }

  /**
   * Works out the next move from wherever the player is. The first press only points at a plate and keeps the star;
   * the second shows the whole move with the hand and gives up the star for this run (restart wins it back).
   */
  private showHint() {
    if (!this.canPlay) return;
    const s = this.controller.session, v = this.view, sol = solve(s.lv, 16, s.state);
    if (!sol) { this.flashHint('No way forward from here. Try Undo'); $('b-undo').classList.add('glow'); return; }
    const m = parseMove(sol.firstSolution[0]);
    v.setSelected(null); v.railHint = 1; v.showRail(m.plate);
    const late = s.par !== undefined && s.moves + sol.min > s.par;
    if (this.hintLevel === 0) {
      this.hintLevel = 1;
      this.flashHint(late ? 'Try this plate. Restart if you want the star' : 'Try this plate. Press Hint again to see the move', 4);
      return;
    }
    s.hinted = true;
    this.handMove = m; this.handStart = this.world.time.value;
    this.flashHint(`${sol.min} move${sol.min === 1 ? '' : 's'} to go. No star this run: Restart to win it back`, 4);
  }
  private hintLevel = 0;

  // ---- HUD
  private buildChips() {
    const v = this.view, box = $('goals'); box.innerHTML = ''; this.chips.clear();
    for (const c of v.creatures) {
      const e = this.chips.get(c.kind);
      if (e) { e.goals.push(c.goalIndex); continue; }
      const el = document.createElement('div'); el.className = 'chip';
      const [a, b] = GOAL_TEXT[c.kind];
      el.innerHTML = `<img alt="" src="${this.thumbs[c.kind].sad}"><div class="tx"><b>${a}</b><span>${b}</span></div><div class="badge">${icon.cross}</div>`;
      el.title = GOAL_RULE[c.kind];
      el.addEventListener('click', () => { this.audio.play('ui'); this.flashHint(GOAL_RULE[c.kind], 6); });
      box.appendChild(el);
      this.chips.set(c.kind, { el, goals: [c.goalIndex], delta: null });
    }
    for (const [, e] of this.chips) if (e.goals.length > 1) { const n = document.createElement('div'); n.className = 'count'; e.el.appendChild(n); }
    $('s-level').style.setProperty('--goals-h', `${box.offsetHeight}px`); // the hint sits above however many rows the chips take
  }
  private refreshChips() {
    const g = this.controller.session.goals;
    for (const [kind, e] of this.chips) {
      const n = e.goals.filter(k => g[k]).length, all = n === e.goals.length;
      const wasMet = e.el.classList.contains('met');
      e.el.classList.toggle('met', all);
      if (all !== wasMet) { e.el.classList.add('bump'); setTimeout(() => e.el.classList.remove('bump'), 260); }
      e.el.querySelector('.badge')!.innerHTML = all ? icon.check : icon.cross;
      (e.el.querySelector('img') as HTMLImageElement).src = this.thumbs[kind][all ? 'ok' : 'sad'];
      const cnt = e.el.querySelector('.count'); if (cnt) cnt.textContent = `${n}/${e.goals.length}`;
    }
  }
  private refreshHud() {
    const s = this.controller.session, par = s.par ?? 0;
    $('hud-name').textContent = `${this.controller.index + 1}. ${s.lv.name}`;
    $('hud-moves').innerHTML = `Moves <b>${s.moves}</b> <span class="par">/ Par ${par}</span>`;
    $('hud-moves').classList.toggle('over', s.moves > par);
    $<HTMLButtonElement>('b-undo').disabled = s.moves === 0;
    this.refreshChips();
  }
  private previewChips(flips: [number, boolean][] | null) {
    for (const [, e] of this.chips) { e.delta?.remove(); e.delta = null; }
    if (!flips) return;
    for (const [g, met] of flips) for (const [, e] of this.chips) if (e.goals.includes(g) && !e.delta) {
      const d = document.createElement('div'); d.className = `delta ${met ? 'plus' : 'minus'}`; d.textContent = met ? '+' : '−';
      e.el.appendChild(d); e.delta = d;
    }
  }

  // ---- controller events
  private onEvent(e: GameEvent) {
    if (!this.ready) return; // the controller opens the saved level while being constructed; the title comes first
    switch (e.kind) {
      case 'level': {
        const same = this.view === this.world.views[e.index] && this.screen === 'level';
        if (same) { this.restartView(); break; }
        this.enterLevel(e.index, this.screen !== 'title' || this.progress.solved(0) || true);
        break;
      }
      case 'selected': {
        this.view.setSelected(e.plate);
        if (e.plate !== null) this.audio.play('select', { plate: e.plate });
        break;
      }
      case 'moved': this.afterMove(e.plate); break;
      case 'blocked': {
        this.view.setDrag(this.drag?.plate ?? null, 0, 0); this.audio.play('blocked'); this.world.shakeCam(.18);
        const say = { rail: 'End of the rail', stack: "Two creatures can't share a cell", melt: 'That would melt the ice under them', pinned: 'Anchored by the rock. This plate stays put', other: 'No room that way' } as const;
        if (e.why) this.flashHint(say[e.why]);
        break;
      }
      case 'wrong-axis': this.audio.play('blocked'); this.flashHint('This plate slides the other way'); break;
      case 'preview': {
        this.view.showPreview(e.diff);
        this.previewChips(e.diff ? e.diff.flips : null);
        if (e.steps > 0) this.audio.play('stop', { plate: e.plate });
        break;
      }
      case 'undone': this.afterUndo(); break;
      case 'solved': this.afterSolved(e.moves, e.par, e.stars); break;
      case 'stuck': $('stuck').classList.toggle('hidden-el', !e.stuck); $('b-undo').classList.toggle('glow', e.stuck); if (e.stuck) this.audio.play('stuck'); break;
      case 'finished': this.toEnding(); break;
    }
  }
  private flashHint(t: string, sec = 1.5) {
    const h = $('hint'); h.textContent = t; h.classList.remove('off');
    clearTimeout(this.flashT);
    this.flashT = window.setTimeout(() => {
      if (this.firstMoveMade || this.controller.index !== 0) h.classList.add('off');
      else h.textContent = 'Drag a plate along its rail';
    }, sec * 1000);
  }
  private flashT = 0;
  private panOf(cell: number) { const v = this.view, [x] = v.xz(cell); return Math.max(-1, Math.min(1, x / v.lv.w * 1.4)); }

  private restartView() {
    const v = this.view, s = this.controller.session;
    $('done').classList.add('hidden'); v.celebrate(false); v.setBloom(false); this.completeTimer = false;
    this.hintLevel = 0; v.showMarks = true; this.solveGen++;
    this.world.frameActive('level', .5);
    $('stuck').classList.add('hidden-el'); $('b-undo').classList.remove('glow');
    v.clearPreview(); v.setSelected(null);
    const prev = v.state;
    if (prev !== s.lv.start) { v.reconcile(s.lv.start, true, { fromRestart: true }); this.audio.play('restart'); this.world.after(.42, () => { v.applyGoals(this.controller.session.goals, true); this.refreshHud(); }); }
    this.refreshHud();
  }

  private afterMove(plate: number) {
    const v = this.view, s = this.controller.session, lv = s.lv;
    this.firstMoveMade = true;
    this.handStart = 0; this.handMove = null; v.railHint = 0;
    $('hint').classList.add('off'); $('b-undo').classList.remove('glow'); $('stuck').classList.add('hidden-el');
    this.hintLevel = 0;
    v.absorbDrag(plate);
    const before = v.creatures.map(c => c.met);
    const melted = previewDiff(lv, v.state, s.state).melt;
    const r = v.reconcile(s.state, true);
    if (melted.length) this.world.after(MOVE_TIME * .6, () => {
      this.audio.play('meltice', { pan: this.panOf(melted[0]) });
      for (const cell of melted) { const p = v.worldPos(cell, .1); this.world.fx.splash(p.x, p.z, 10); this.world.fx.rubble(p.x, .4, p.z, 4, '#d6f3ff'); }
    });
    this.audio.play('slide', { plate });
    const t0 = MOVE_TIME * .45;
    if (r.rose.length) {
      this.world.after(t0, () => {
        this.world.shakeCam(.55 + r.rose.length * .08);
        this.audio.play('uplift', { intensity: Math.min(1, .35 + r.rose.length * .14), pan: this.panOf(r.rose[0]) });
        for (const cell of r.rose) { const p = v.worldPos(cell); this.world.fx.dust(p.x, p.y - .1, p.z, 7); this.world.fx.rubble(p.x, p.y, p.z, 2); }
      });
    }
    if (r.flooded.length) {
      this.audio.play('crack', { pan: this.panOf(r.flooded[0]) });
      this.world.after(MOVE_TIME * .9, () => {
        this.audio.pour(.3 + r.flooded.length * .09, this.panOf(r.flooded[0]));
        for (const cell of r.flooded) { const p = v.worldPos(cell, 0); this.world.after(Math.random() * .3, () => this.world.fx.splash(p.x, p.z, 7)); }
      });
    }
    if (r.arrived.length) this.world.after(MOVE_TIME * .7, () => { for (const cell of r.arrived) { const p = v.worldPos(cell, 0); this.world.fx.splash(p.x, p.z, 4); } });
    this.refreshHud();
    this.world.after(MOVE_TIME + .05, () => {
      if (this.view !== v || this.controller.session.lv !== lv) return;
      const g = this.controller.session.goals;
      v.applyGoals(g, true);
      let delay = 0;
      v.creatures.forEach((c, i) => {
        if (before[i] === g[c.goalIndex]) return;
        const pan = this.panOf(0);
        this.world.after(delay, () => {
          if (g[c.goalIndex]) {
            this.audio.play('tick', { pan });
            if (c.kind === 'goat') this.audio.play('bleat', { variant: i });
            if (c.kind === 'light') this.audio.play('lighthouse');
            if (c.kind === 'oasis') this.audio.play('oasis');
            if (c.kind === 'penguin') this.audio.play('penguin');
            if (c.kind === 'buoy') this.audio.play('fish');
          } else {
            this.audio.play('untick', { pan });
            if (c.kind === 'village') this.audio.play('crush');
          }
        });
        delay += .12;
      });
    });
  }
  private afterUndo() {
    const v = this.view, s = this.controller.session;
    v.clearPreview();
    const r = v.reconcile(s.state, true); void r;
    this.audio.play('undo');
    $('stuck').classList.add('hidden-el'); $('b-undo').classList.remove('glow');
    this.world.after(MOVE_TIME * .8, () => { if (this.controller.session === s) v.applyGoals(s.goals, true); });
    this.refreshHud();
    if (this.completeTimer) { $('done').classList.add('hidden'); this.completeTimer = false; this.solveGen++; v.showMarks = true; v.celebrate(false); v.setBloom(false); this.world.frameActive('level', .5); }
  }
  private afterSolved(moves: number, par: number | undefined, stars: number) {
    const v = this.view, lv = v.lv, s = this.controller.session, gen = ++this.solveGen;
    const stale = () => gen !== this.solveGen || this.screen !== 'level' || this.controller.session !== s || !s.solved;
    this.completeTimer = true;
    v.railHint = 0; v.setHover(null); v.setSelected(null); v.showMarks = false;
    $('stuck').classList.add('hidden-el'); $('b-undo').classList.remove('glow');
    this.world.after(MOVE_TIME + .45, () => {
      if (stale()) return;
      v.celebrate(true); v.setBloom(true);
      this.world.frameActive('solved', .7);
      this.world.fx.confetti(v.ox, 0, v.oz, 110, Math.max(lv.w, lv.h) * .45);
      this.audio.duck(3);
      this.audio.play('complete');
      if (stars) this.world.after(.5, () => this.audio.play('star'));
      this.world.after(.95, () => {
        if (stale()) return;
        const titles = ['Island settled!', 'All happy!', 'Lovely shift!', 'Land ho!', 'Well moved!'];
        $('d-title').textContent = titles[this.controller.index % titles.length];
        $('d-star').innerHTML = (stars ? icon.star : icon.starEmpty).replace('<svg', `<svg class="star${stars ? '' : ' empty'}"`);
        $('d-score').textContent = par !== undefined ? `Moves ${moves} / Par ${par}` : `Moves ${moves}`;
        const kept = !stars && !!this.progress.record(lv.name!)?.stars;
        $('d-star').innerHTML = (stars || kept ? icon.star : icon.starEmpty).replace('<svg', `<svg class="star${stars || kept ? '' : ' empty'}"`);
        $('d-sub').textContent = stars ? '' : kept ? 'Star kept from your best run' : s.hinted && moves <= (par ?? 0) ? 'Solve it without seeing a move for the star' : `Finish in ${par} for the star`;
        const allDone = this.levels.every((_, i) => this.progress.solved(i));
        $('d-next').textContent = allDone && this.controller.index === this.levels.length - 1 ? (this.endingDue() ? 'Finish' : 'Map') : 'Next';
        $('done').classList.remove('hidden');
      });
    });
    this.refreshHud();
  }
  /** Bumped by every solve and every leaving of the level: a celebration still scheduled from before gives up. */
  private solveGen = 0;
  /** The ending plays when the game is first finished, and again only when a replay has won more stars. */
  private endingDue() {
    let seen = -1;
    try { const v = browserStorage()?.getItem(ENDING_KEY); if (v !== null && v !== undefined && /^\d+$/.test(v)) seen = Number(v); } catch { /* memory only */ }
    return this.progress.totalStars() > seen;
  }
  private toEnding() {
    if (!this.endingDue()) { this.toMap(); return; }
    const stars = this.progress.totalStars(), total = this.levels.length;
    try { browserStorage()?.setItem(ENDING_KEY, String(stars)); } catch { /* memory only */ }
    this.show('ending');
    $('ending').classList.add('touring');
    $('e-title').textContent = 'Every creature is happy.';
    $('e-shift').classList.add('hidden-el');
    this.world.setActive(null);
    this.refreshIslands();
    this.world.writeStatic();
    this.world.views.forEach(v => v.celebrate(true));
    this.audio.setMusic('ending'); this.audio.setOcean(.5); this.audio.play('complete');
    const moves = this.levels.reduce((n, l) => n + (this.progress.record(l.name!)?.best ?? 0), 0);
    $('e-sub').textContent = stars === total ? `All ${stars} stars in ${moves} moves. You move mountains, literally.` : `${stars} of ${total} stars. The goats would like a word about the others.`;
    this.endingFire = 0;
    // a short tour of the creatures the player made happy, one stop per biome; any tap skips it
    const stops = TOUR.flatMap(([b, line]) => { let at = -1; this.levels.forEach((l, i) => { if (l.biome === b) at = i; }); return at >= 0 ? [{ at, line }] : []; });
    const tour = ++this.tourGen;
    const step = (k: number) => {
      if (tour !== this.tourGen) return;
      if (k >= stops.length || this.settings.reduced) { this.endTour(); return; }
      this.world.peek(stops[k].at, k ? 1.15 : 1.6, () => {
        if (tour !== this.tourGen) return;
        const v = this.world.views[stops[k].at];
        this.showCard(stops[k].line, '', 1.5);
        this.world.fx.confetti(v.ox, 0, v.oz, 50, 4);
        this.audio.play('star');
        this.world.after(1.45, () => step(k + 1));
      });
    };
    step(0);
  }
  private tourGen = 0;
  private touring() { return this.screen === 'ending' && $('ending').classList.contains('touring'); }
  private endTour() {
    this.tourGen++;
    $('ending').classList.remove('touring');
    $('card').classList.remove('show');
    this.world.showMap(1.8, .3);
    $('e-shift').classList.remove('hidden-el');
    $('e-map').classList.remove('primary');
  }
  /** One last shift, and it is the player's: every island slides in and locks into one continent. */
  private lastShift() {
    if (this.world.merged) return;
    $('ending').classList.add('shifting');
    this.audio.play('uplift'); this.audio.play('whoosh');
    let landed = 0;
    this.world.lastShift(i => {
      const v = this.world.views[i];
      this.world.fx.dust(v.ox, .2, v.oz, 3);
      this.world.shakeCam(.5);
      // every island's arrival is a soft thud; a whole continent of cracks would be noise
      if (landed++ % 3 === 0) this.audio.play('crack');
    }, () => {
      this.world.shakeCam(1.2);
      this.audio.play('complete');
      this.world.views.forEach(v => this.world.fx.confetti(v.ox, 0, v.oz, 16, 4));
      $('e-title').textContent = 'One land.';
      $('e-sub').textContent = 'No more shifting. Everyone is home.';
      $('e-shift').classList.add('hidden-el');
      $('e-map').classList.add('primary');
      $('ending').classList.remove('shifting');
    });
  }
  /** Leaving the ending: a continent breaks up again, because the map and its levels live on the archipelago. */
  private leaveEnding() {
    if (this.world.shifting) return;
    if (!this.world.merged) { this.toMap(); return; }
    $('ending').classList.add('shifting');
    this.audio.play('whoosh');
    this.world.undoLastShift(() => { $('ending').classList.remove('shifting'); this.toMap(); });
  }
  private endingFire = 0;

  // ---- per frame
  private frame(dt: number, t: number) {
    if (this.screen === 'ending') {
      this.endingFire -= dt;
      if (this.endingFire <= 0) {
        this.endingFire = .45 + Math.random() * .6;
        const v = this.world.views[Math.floor(Math.random() * this.world.views.length)];
        const cols = ['#ffd23f', '#ff6b6b', '#6be3a0', '#6bb8ff', '#d48bff', '#ff9f43'];
        this.world.fx.firework(v.ox + (Math.random() - .5) * 4, 5 + Math.random() * 3, v.oz + (Math.random() - .5) * 4, cols[Math.floor(Math.random() * cols.length)], 40);
      }
    }
    // tutorial hand: shows the drag on the first two levels until the player has moved
    const hand = $('hand');
    const m = this.handMove;
    const showHand = this.screen === 'level' && this.handStart > 0 && !this.world.flying && !this.dragging && m;
    hand.classList.toggle('hidden-el', !showHand);
    if (showHand && m) {
      const d = m.dir;
      const a = this.view.railAnchor(m.plate), b = a.clone().add(new Vector3(d === 1 ? 1 : d === 3 ? -1 : 0, 0, d === 2 ? 1 : d === 0 ? -1 : 0));
      const u = ((t - this.handStart) % 2.2) / 2.2, e = u < .2 ? 0 : u > .75 ? 1 : (u - .2) / .55, k = e * e * (3 - 2 * e);
      const [ax, ay] = this.world.project(a), [bx, by] = this.world.project(b);
      hand.style.opacity = u > .9 ? '0' : '1';
      hand.style.transform = `translate(${(ax + (bx - ax) * k - 19).toFixed(1)}px, ${(ay + (by - ay) * k - 4).toFixed(1)}px) scale(${u < .2 ? 1.05 : .95})`;
    }
  }

  // ---- input
  private bindInput(cv: HTMLCanvasElement) {
    cv.addEventListener('pointerdown', e => this.pointerDown(e));
    cv.addEventListener('pointermove', e => this.pointerMove(e));
    const up = (e: PointerEvent) => this.pointerUp(e);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => this.pointerCancel());
    addEventListener('blur', () => this.pointerCancel());
    addEventListener('keydown', e => this.keyDown(e));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pointerCancel(); });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => e.preventDefault(), { passive: false });
    window.addEventListener('pointerdown', () => this.audio.unlock(), { capture: true });
    window.addEventListener('keydown', () => this.audio.unlock(), { capture: true });
  }
  private get canPlay() { return this.screen === 'level' && this.busyUntil === 0 && !this.controller.session.solved && $('settings').classList.contains('hidden'); }

  private pointerDown(e: PointerEvent) {
    if (this.screen === 'map') { const i = this.world.pickIsland(e.clientX, e.clientY); if (i !== null) this.pickLevel(i); return; }
    if (this.screen === 'title') { this.toMap(true); return; }
    if (this.touring()) { this.endTour(); return; }
    if (this.screen === 'level' && this.world.flying && this.busyUntil !== 0) this.world.finishFly(); // a touch during the fly-in lands at once and starts the drag
    if (!this.canPlay) return;
    let plate = this.world.pick(e.clientX, e.clientY);
    // a touch on the water or another spot keeps working on the selected plate (tap, then swipe anywhere)
    if (plate === null) plate = this.controller.selected;
    if (plate === null) return;
    const v = this.view, y = v.plateTop(plate);
    if (v.lv.pinned?.includes(plate)) { this.audio.play('blocked'); this.flashHint('Anchored by the rock. This plate stays put'); return; }
    const start = this.world.groundPoint(e.clientX, e.clientY, y);
    if (!start) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    this.drag = { plate, start, y, pointer: e.pointerId, moved: false, across: 0 };
    this.dragging = true;
    v.setQuiet(true);
    this.controller.act({ kind: 'select', plate });
  }
  private pointerMove(e: PointerEvent) {
    if (this.screen === 'level' && !this.drag && e.pointerType === 'mouse' && this.canPlay) {
      const p = this.world.pick(e.clientX, e.clientY);
      this.view.setHover(p);
      (e.target as HTMLElement).style.cursor = p !== null ? 'grab' : 'default';
      return;
    }
    if (this.screen === 'map' && e.pointerType === 'mouse') { const i = this.world.pickIsland(e.clientX, e.clientY); (e.target as HTMLElement).style.cursor = i !== null && this.progress.unlocked(i) ? 'pointer' : 'default'; return; }
    if (!this.drag || e.pointerId !== this.drag.pointer) return;
    const { plate, start, y } = this.drag, v = this.view;
    const pt = this.world.groundPoint(e.clientX, e.clientY, y); if (!pt) return;
    const dx = pt.x - start.x, dz = pt.z - start.z;
    (e.target as HTMLElement).style.cursor = 'grabbing';
    const ax = v.lv.axis[plate], along = ax === 1 ? dx : dz;
    if (Math.abs(along) > .06) this.drag.moved = true;
    this.drag.across = Math.max(this.drag.across, Math.abs(ax === 1 ? dz : dx) - Math.abs(along));
    const r = v.legalRange(plate);
    let o = along;
    const rub = (over: number) => Math.tanh(over * 2) * .16;
    if (o > r.pos) o = r.pos + rub(o - r.pos); else if (o < -r.neg) o = -r.neg - rub(-r.neg - o);
    v.setDrag(plate, ax === 1 ? o : 0, ax === 1 ? 0 : o);
    this.controller.drag(plate, dx, dz);
    this.handStart = 0;
  }
  private pointerUp(e: PointerEvent) {
    if (!this.drag || e.pointerId !== this.drag.pointer) return;
    const p = this.drag.plate, across = this.drag.across;
    this.drag = null; this.dragging = false;
    this.view.setQuiet(false);
    this.view.noteDragEnd(p);
    this.view.setDrag(null);
    const before = this.controller.session.moves;
    this.controller.release();
    // dragged clean across the rail: say so, or the plate just looks broken
    if (across > .5 && this.controller.session.moves === before) { this.audio.play('blocked'); this.flashHint('This plate slides the other way'); }
    (e.target as HTMLElement).style.cursor = 'default';
  }
  private pointerCancel() {
    if (!this.drag) return;
    const p = this.drag.plate;
    this.drag = null; this.dragging = false;
    this.view.setQuiet(false);
    this.view.noteDragEnd(p); this.view.setDrag(null);
    this.controller.cancelDrag();
    this.controller.release();
  }
  private keyDown(e: KeyboardEvent) {
    if (e.repeat && !e.key.startsWith('Arrow')) return;
    if (!$('settings').classList.contains('hidden')) { if (e.key === 'Escape') $('settings').classList.add('hidden'); return; }
    if (this.screen === 'title' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.toMap(true); return; }
    if (this.screen === 'map') {
      if (e.key === 'Escape') this.toTitle();
      if (e.key === 'Enter') this.pickLevel(this.progress.next());
      return;
    }
    if (this.touring() && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) { this.endTour(); return; }
    if (this.screen === 'ending' && e.key === 'Enter') { if (this.world.merged) this.leaveEnding(); else this.lastShift(); return; }
    if (this.screen !== 'level' || this.busyUntil !== 0) return;
    if (e.key === 'm' || e.key === 'M') { this.toMap(); return; }
    if (e.key === 'h' || e.key === 'H') { this.showHint(); return; }
    const ctl = this.controller, s = ctl.session;
    if (s.solved && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (!$('done').classList.contains('hidden')) this.next(); return; }
    const a = keyAction({ key: e.key, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }, { plates: s.lv.plates, axis: s.lv.axis, selected: ctl.selected, solved: s.solved });
    if (!a) return;
    e.preventDefault();
    if (a.kind === 'next') return;
    ctl.act(a);
  }
}

export function boot() {
  const canvas = $<HTMLCanvasElement>('c');
  try {
    const app = new App(canvas);
    (window as unknown as { __shiftland: App }).__shiftland = app;
    $('loading').classList.add('gone');
  } catch (err) {
    console.error(err);
    const f = document.createElement('div'); f.id = 'fatal';
    f.textContent = 'Shiftland needs WebGL. Please enable hardware acceleration or try another browser.';
    document.body.appendChild(f);
  }
}
