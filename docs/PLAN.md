# Game Off 2026 (SHIFT): plan

Status 2026-11-05: LICENSE is all rights reserved (Victor, Nov 4: no open source); a private play link for G2 is in `qa.md`; map perf, the quality-step freeze, a stuck-player Hint nudge, a cold playtest of islands 8-16 (Playtest 10: win silhouettes, a one-line second hint, hidden hint text dropped, a line when the hinted plate goes the other way, and Harbour Row back as island 8 against the Coast's difficulty cliff, 25 islands now) and an audio pass from a blind Gemini listen were done (`qa.md`, `release.md`). Still waiting on Victor: G0, G2, G3, G4.

Status 2026-11-04: the game ran far ahead of the schedule below in one long session: 24 islands, every biome, art, audio and ending are built and played end to end by real input; see `release.md` for what is checked and what still needs Victor (G0, G2, G3, G4, and his ears on the audio). The schedule stays as the record of the plan.

Status 2026-11-03: **G1 done: Victor picked Plates** ("I pick Plates. You handle the rest."). The game is **Shiftland** (name chosen by the agent under that mandate; no itch.io or store game of that name found; "Fault Lines" is taken). Changeover is archived as the kill-gate fallback only. Next: G0 approvals, then the grey-box build on Nov 4. Research: `research.md`. Concepts, review and spikes: `concepts.md`. Design: `design-plates.md`. Concept images: `../concepts/` (internal references only, never shipped).

## Task

Ship **Shiftland**, a browser tectonic-shift puzzle (`design-plates.md`), for GitHub Game Off 2026 (theme SHIFT) on itch.io before **Dec 1, 13:37 PST (22:37 CET)**, with the source in a public GitHub repo, aiming for a top-50 finish (top ~7%) out of an expected 600-900 entries. If the G2 kill gate fails, the fallback is **Changeover** (turn-based scene-shift puzzle), which reuses the grid, undo, solver and level pipeline below.

## Guardrails (must not change)

- Shipped art and audio are made in code (geometry, shaders, canvas, WebAudio). Codex image gen is for internal concepts only. Code is AI-written and disclosed as such on the submission form and the itch page. (Changing this needs Victor's decision; see `research.md`, "Generative AI".)
- Nothing from Grand Fantasia, Snowbound, or other projects' IP. No reuse of Skyway Rally's game code beyond small utilities rewritten in the repo (the rules want the work done in the jam window).
- Public repo, public itch page and any public post are public releases: each needs Victor's approval (gate G0).
- Browser-first: one HTML5 build that runs in the itch iframe on desktop Chrome, Firefox, Safari and Edge; touch works on phones and tablets (mobile is a bonus, not a gate).
- Victor's time: two short playtests a week, the kill-gate play, the pick, approvals, and rating other entries in December. Everything else runs without him.

## Gates (Victor)

| Gate | When | What Victor does |
|---|---|---|
| G1 pick | ~~Nov 4~~ done Nov 3 | Picked Plates; left the name and every other choice to the agent (name: Shiftland) |
| G0 approvals | Nov 4-5 | Approves the public GitHub repo (`vsolano9/shiftland`, created private on Nov 3, made public at or before submission) and an itch.io draft page for iframe testing (draft pages are not public) |
| G2 kill gate | Nov 7 | Plays 6 grey-box levels (10 min); "aha" yes/no. No → switch to fallback |
| G3 playtests | Nov 14, Nov 21, Nov 26 | 15-min play of the current build, notes in his words |
| G4 release | Nov 28 | Approves the itch page text, AI disclosure, repo going public, and submitting |

## Schedule

| Days | Phase | Work (owner: main agent unless noted) | Exit check |
|---|---|---|---|
| Nov 3 | Research and concepts | Done: research, 18 ideas scored, review, rules spikes (Plates, Changeover), playable Plates grey-box (10 levels at par), concept images v1-v3 with critic rounds, pitch page, G1 | `concepts.md`, spike output, grey-box headless run |
| Nov 4-5 | Concept sheets | For Shiftland, Codex image-gen sheets of every view and state the build needs (title, level select, in-level HUD, plate idle / selected / preview / moving, uplift and flood frames, each goal creature happy and unhappy, level complete, 4 biome palettes, cursor/touch affordances, cover 630×500), critiqued with `taste_critic.py --shot` and regenerated until nothing is missing; saved in `concepts/` | Sheets approved by critic; Victor sees them on the pitch page |
| Nov 4-7 | Grey-box | Vite + TS + three.js repo; rules module ported from the spike with vitest tests; solver + generator CLI (`npm run levels`); level JSON format; grid render (plain boxes), plate select + rail drag, flood/uplift preview, undo/restart, goal checks; 6 levels at the quality bar; itch draft upload to test the iframe (WebGL2, audio unlock, sizing, fullscreen) | vitest green; Playwright plays each level's solver solution to "complete"; draft page loads on itch; **G2** |
| Nov 8-14 | Look and sound | Diorama to the concept: column terrain, plate tints + edge patterns (colour-blind safe), animated uplift with dust, water shader and pour-in, ocean, sky; goal creatures with reactions; UI screens; WebAudio music per biome + SFX (rumble, crack, pour, bleats, chimes) | Screenshot set vs concept sheets, critic pass; **G3** |
| Nov 11-21 | Content | **Nov 4: done early with Tundra in: 20 named levels (Meadow 6, Coast 4, Desert 4, Tundra 4, Finale 2), `design-plates.md` "Level set"; the rest of this row is the original plan.** Generator + hand curation to the **12-level ship target** (Meadow 1-6, Coast 7-9, Desert 10-11 with the oasis/lake twist, one Finale), stretch 15 with Tundra (pinned plates, ice) only if G3 on Nov 21 is green (`design-plates.md`, "Scope decision"); difficulty curve; first levels teach without text walls. Supply check Nov 3 (game generator, seeds 1-600 with and without seam placement): 40 pass the bar, 14 with a lighthouse (6 at par ≥ 4), so Coast 7-9 has candidates; the Desert oasis (lake-wanting palm) is ported the same day (`Kind 'oasis'` in `game/src/rules`, generator option `oasis`, `npm run levels -- 1 300 --desert`: 18/300 seeds pass the bar), so Desert 10-11 has candidates too | Every level passes the quality bar via `npm run levels:audit`; **G3** |
| Nov 18-24 | Juice and onboarding | Camera moves, hover previews, satisfying move feedback, level-complete moment, settings (volume, reduced motion), save progress (localStorage, safe fallback; the store is done early, Nov 3: `game/src/game/progress.ts`, tutorials unlock in order then two unsolved levels stay open (design-plates.md "Unlocking"), best moves and star per level name, blocked or corrupt storage falls back to memory, unit-tested), touch controls; design audit by `reviewer` (skill `game-design-self-critique`), play-like-a-player pass (`game-qa-play-like-a-player`) | Findings fixed or answered by id; **feature freeze Nov 24** |
| Nov 25-28 | Release prep | Bug-fix and performance (60 fps on a mid laptop, < 15 MB zip, < 5 s load); itch page (cover, 4 screenshots, GIF, controls, short pitch, AI disclosure); repo README + LICENSE; **G4** | Release checklist below all green |
| Nov 29 | Submit | Push repo public, upload zip, submit to the jam, verify the entry page live (before/after checks) | Entry visible on the jam's entries page; hash of uploaded zip = built zip |
| Nov 30-Dec 1 | Buffer | Hotfixes only (itch allows updating the build until the deadline) | |
| Dec 1-Jan 1 | Rating | Victor plays and rates 20+ entries, comments, answers comments on ours; agents fix only critical bugs after the deadline if the jam allows | Our rating count ≥ the jam median |

## Week 1 in detail (Nov 4-7, grey-box to kill gate)

| Day | Work | Check before the day ends |
|---|---|---|
| Nov 4 | Scaffold `Games/GameOff2026/game/` (Vite + TS + three.js, vitest, Playwright, `base: './'`); port `plates.ts` rules into `src/rules/` (grid, shift, seaMask, goals, rails, plate cap) with unit tests for every rule in the spike's `selfCheck` plus the Codex fixtures (edge lighthouse, seed 25 goal-swap trap, crushed-not-drowned village, no stacking, no melting creatures, no goal that starts met); level JSON schema; ask Victor for G0 (repo + itch draft). **Started early on Nov 3:** `game/` scaffold (Vite 8, TS 7, vitest 5, three 0.186), `game/src/rules/rules.ts` ported with the S4 rule, 25 vitest tests (shift, uplift cap, rifts, rails, riding creatures, no stacking, crushed-not-drowned, sea vs lake, edge lighthouse, goals, and every `levels.json` level solving at its exported par); `npm run build` passes and the build loads in `vite preview` with no console errors. The audit is ported too (`game/src/solver/audit.ts`, 13 more tests: all 8 exported puzzles pass the bar at their par, the tutorial traps are pinned). The generator is ported too (`game/src/solver/generate.ts`: deterministic, regenerates Dip and Return (seed 56) and all 8 exported puzzle seeds, seed 25 P1N fixture), and the level CLI exists: `npm run levels:audit [file]` audits every level against the ship bar (`shipCheck`: full bar for puzzles, par-is-minimum for all; 14/14 pass, a wrong par exits 1) and `npm run levels -- <seed> <count>` lists passing seeds (14 of seeds 1-300). Level JSON now carries `role` (`tutorial` / `puzzle`, written by the exporter; `shipCheck` reads it, a level without one gets the full puzzle bar). `game/src/rules/diff.ts` `previewDiff` (what a move changes) is in and drives the grey-box preview. 51 tests. Playwright is set up (`@playwright/test` 1.63.0; `npm run e2e` builds, serves `dist` with `vite preview` and runs `e2e/smoke.spec.ts`: loads over HTTP, all 14 levels, no console errors; vitest is scoped to `src/`). The game owns its levels too: `game/src/levels/tutorial.ts` (map parser + the 6 tutorial specs), `build.ts` and `npm run levels:export` write `game/src/levels/levels.json`, byte-equal to the spike export; a test fails if the file is stale. 59 unit tests. Nov 4 scaffold work is done; the spike folder is now reference only | `npm test` green; `npm run build` dist loads over HTTP (`npm run preview`; ES-module builds do not run from `file://`, itch serves over HTTP) |
| Nov 4-5 | Concept sheets for the build (see Schedule), started in parallel in the background while the code is written | sheets critiqued, in `concepts/` |
| Nov 5 | Exporter in the game repo (the CLI already audits and lists seeds; it still has to write the curated set); `tutorial.ts` levels 1-6 (L4 and L5 rebuilt after design audit S2) and 3 curated generated levels exported as JSON; plain-box three.js render of the grid (plates as tinted columns, water plane, sea vs lake colour), orbit-limited camera | audit passes on all 8 levels; screenshot of level 3 inspected |
| Nov 6 | (Core done early on Nov 3: `game/src/game/session.ts` `Session`: history, undo, restart, moves vs par, star, solved lock, preview + diff, stuck-checker hookup; every shipped level's solver solution played through it to par. Also done early: `game/drag.ts` (cumulative rail drag → stops asked for, strictly past half a cell; cross-rail motion ignored for touch) and `game/keys.ts` (Tab/1-9/arrows/Z/R/Enter/Esc → actions, wrong-axis nudge, Ctrl shortcuts left to the browser) and `game/controller.ts` (level list + progress + session + selection; actions → events for render/audio: level, selected, preview, moved, blocked, wrong-axis, undone, stuck, solved, finished; a drag only previews, release commits, Esc cancels; Enter goes to the next unsolved level and the ending fires once; a test plays all 14 levels in order through it at par); 115 unit tests in total. What remains for Nov 6 is the DOM/three.js wiring of these.) Input: hover/select a plate, rail drawn with stops, drag one stop (mouse + touch), keyboard; diff-only preview (rising columns, new water, goal ticks/crosses) per the grey-box lesson; undo/restart; move counter vs par; level complete → next; a basic crush reaction (houses tilt) and the "no way back" stuck warning (design audit S3, S12; `canFinish` is breadth-first since Codex chain 4, worst exported first move ~0.5 s, so it runs in a worker and a newer move cancels it, as the grey-box already does with a deferred, cancellable check; done early on Nov 3: `game/src/solver/stuck.worker.ts` + `StuckChecker` in `stuck.ts`, stale answers dropped and a superseded running search killed by terminating and respawning the worker (unit-tested with a fake worker; the real worker proven in the built bundle by `npm run e2e`: five superseded slow searches, then the latest answer in under 1 s); drag along a rail maps to one stop per move in `game/drag.ts`) so G2 judges the idea, not the boxes | Playwright plays every level's solver solution through pointer events to "complete"; console clean |
| Nov 7 | itch draft upload (if G0 approved) and iframe test (WebGL2, audio unlock, sizing); **G2 kill gate**: Victor plays 6 levels for 10 minutes; his notes answer open questions Q1, Q2 and Q6 (`design-plates.md`) | draft loads in Chrome and Firefox (screenshot); Victor's "aha" yes/no recorded here |

If G0 is not approved by Nov 7, the iframe test moves to the first day it is; nothing else waits on it.

## Done-criteria (each with its check)

1. Game is complete: title → 12 levels (15 with the stretch) → ending, no dead ends. Check: Playwright autoplay runs every level's solver solution end to end and reaches the ending.
2. Every level is solvable and meets the quality bar. Check: `npm run levels:audit` (solver) in CI and locally.
3. Rules are correct. Check: vitest unit tests for shift, uplift, rift, flood, goals, undo.
4. Runs in the itch iframe. Check: the uploaded draft loads and plays level 1 in Chrome and Firefox via browser_relay; screenshot inspected.
5. Looks like the concept. Check: screenshots of title, level, complete, each biome vs concept sheets with `taste_critic.py --ref`, findings answered; `Taste:` verdict.
6. Sounds finished: music + every action has a sound; mute works. Check: audio event log in a Playwright run shows each SFX fires; Victor's G3 notes.
7. Performance. Check: Playwright perf trace, 60 fps median on the dev PC with 4× CPU throttle ≥ 30 fps; zip size and load time measured.
8. Submitted on time with honest disclosure. Check: entry page screenshot, form answers recorded in `docs/release.md`.

## Release checklist (Nov 25-29; every line green before G4)

Each line has its check; results with evidence paths go in `docs/release.md`.

| # | Item | Check |
|---|---|---|
| R1 | Zip is valid for itch HTML5 | `index.html` at the zip root, < 1,000 files, every path < 240 chars, < 15 MB (`research.md`: limits 1,000 files, 500 MB, 200 MB per file); script lists count, size, longest path |
| R2 | Relative paths only | `vite.config.ts` `base: './'`; grep of `dist/` finds no `"/assets` absolute URL; the zip plays from the itch draft page |
| R3 | Plays end to end | Playwright autoplay of every level's solver solution from the title to the ending on the production build (`vite preview`), console clean |
| R4 | Levels pass the bar | `npm run levels:audit` green on the shipped level set; level count matches the itch page line |
| R5 | Rules and tests | `npm test` and `npm run typecheck` green on the release commit |
| R6 | itch iframe | draft page loads and plays level 1 in Chrome and Firefox via browser_relay; fullscreen, audio after first click, sizing at 1280×720 and in fullscreen; screenshots inspected |
| R7 | Touch | level 1 solved by touch drag in a Playwright mobile emulation (and on a real phone if Victor has one at hand) |
| R8 | Save and settings | progress survives a reload; with storage blocked (private window) the game still starts; volume and reduced-motion persist |
| R9 | Performance | done-criterion 7 numbers recorded (fps median, 4× throttle, load time, zip size) |
| R10 | Audio | done-criterion 6 event log: every SFX fires once in the autoplay run; mute silences all |
| R11 | Look | done-criterion 5: final screenshot set vs `concepts/shiftland-*.png`, critic findings answered, `Taste:` verdict |
| R12 | No shipped AI media | `dist/` contains no image or audio files except ones generated by code at build time (list of non-JS/CSS/HTML files is empty or explained) |
| R13 | Repo ready | README (what, how to play, how to build, AI disclosure), LICENSE (MIT for code), no secrets (`git log -p` grep for keys/tokens), no Grand Fantasia or other project IP |
| R14 | itch page | `docs/itch-page.md` final text with the shipped level count; cover 630×500 and 4 screenshots rendered from the game; disclosure matches the submission form's AI question (answers recorded) |
| R15 | Victor's approvals | G4 recorded in this file with his words: page text, disclosure, repo public, submit |
| R16 | Submitted and verified | after submit: entry visible on the jam's entries page (screenshot), downloaded zip hash = built zip hash, repo public and its link on the entry page opens |

## Tech

- Vite + TypeScript + three.js, vitest, Playwright (the stack proven on Skyway Rally and Aether Relay). `vite.config.ts` uses `base: './'` for itch's relative paths.
- Modules: `rules/` (pure, deterministic: grid, shift, flood, goals), `solver/` (BFS, audit, generator; Node CLI), `levels/*.json`, `render/` (terrain, water, creatures, fx), `ui/`, `audio/` (WebAudio synth), `input/` (mouse + touch, rail drag).
- Data shapes (from the spikes, kept): `Level { id, name, biome, w, h, plates, axis[], maxTravel, pinned[], start: { plate: Int8Array, elev: Int8Array, objs: {kind, cell}[], off? }, buoys[], par }`; level files are JSON with plain arrays; `State` is immutable per move (undo = a stack of States). `rules/` exports `shift`, `seaMask`, `goalsMet`, `solved` and is the single source for the game, the solver CLI and the tests (Codex chain 2: no duplicate flood fills).
- Render data flow: `State` → `previewDiff(lv, prev, next)` (`game/src/rules/diff.ts`, done and tested Nov 3: uplift on taken cells, carried terrain (a plate's own peak sliding along), flood, land arriving, creature moves, goal flips; the grey-box preview already draws from it) → animations (rising columns, flood front by BFS distance from the ocean, creature reactions); the preview uses the same diff on a hypothetical next State, drawn as ghosts.
- Reuse, not rebuild: three.js for rendering, ZzFX/ZzFXM or hand WebAudio for sound (licence checked before use), @fontsource for fonts; no physics engine needed (grid rules).

## Name

**Shiftland.** Picked 2026-11-03 from: Drift, Fault Line, Pangaea, Continental, Plate Shift, Tectonic, Faultline Farm, Shiftland. Web search found no game called Shiftland or Plate Shift (several games are called just "Shift"); "Fault Lines" exists on itch.io. Shiftland carries the theme word and the island. Re-check itch.io once more when the draft page is created (G0).

## Risks

| Risk | Mitigation |
|---|---|
| Puzzles feel dry | Creature reactions and land-moving feel come first in the look phase; G2 kill gate |
| Level design takes longer than planned | Generator + solver produce candidates; 12 good levels beat 25 average ones |
| Victor unavailable for gates | Each gate has a default (G2 default: continue if the solver bar is met and the critic is happy; G4 has no default: submission waits for his approval) |
| itch iframe surprises (WebGL, audio) | Draft upload in week 1 |
| Few ratings | Browser-playable, strong cover and GIF, Victor rates 20+ games in December |
| Builds and agent time compete with Horizon and Irismere | Jam game is small; one lead agent, helpers only for parallel art/audio work |
