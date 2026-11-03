# Game Off 2026 (SHIFT): plan

Status 2026-11-03: research and concept phase done; waiting on Victor's concept pick (gate G1). Research: `research.md`. Concepts, review and spike: `concepts.md`. Mockups: `../concepts/*-mock.png` (internal references only, never shipped).

## Task

Ship one browser game for GitHub Game Off 2026 (theme SHIFT) on itch.io before **Dec 1, 13:37 PST (22:37 CET)**, with the source in a public GitHub repo, aiming for a top-50 finish (top ~7%) out of an expected 600-900 entries. Default pick: **Plates** (tectonic-shift puzzle); fallback **Changeover** (turn-based scene-shift puzzle). Both share the grid, undo, solver and level pipeline below.

## Guardrails (must not change)

- Shipped art and audio are made in code (geometry, shaders, canvas, WebAudio). Codex image gen is for internal concepts only. Code is AI-written and disclosed as such on the submission form and the itch page. (Changing this needs Victor's decision; see `research.md`, "Generative AI".)
- Nothing from Grand Fantasia, Snowbound, or other projects' IP. No reuse of Skyway Rally's game code beyond small utilities rewritten in the repo (the rules want the work done in the jam window).
- Public repo, public itch page and any public post are public releases: each needs Victor's approval (gate G0).
- Browser-first: one HTML5 build that runs in the itch iframe on desktop Chrome, Firefox, Safari and Edge; touch works on phones and tablets (mobile is a bonus, not a gate).
- Victor's time: two short playtests a week, the kill-gate play, the pick, approvals, and rating other entries in December. Everything else runs without him.

## Gates (Victor)

| Gate | When | What Victor does |
|---|---|---|
| G1 pick | Nov 4 | Picks Plates / Changeover / other from the pitch page; picks a name |
| G0 approvals | Nov 4-5 | Approves the public GitHub repo (`vsolano9/<name>`, created private now, made public at or before submission) and an itch.io draft page for iframe testing (draft pages are not public) |
| G2 kill gate | Nov 7 | Plays 6 grey-box levels (10 min); "aha" yes/no. No → switch to fallback |
| G3 playtests | Nov 14, Nov 21, Nov 26 | 15-min play of the current build, notes in his words |
| G4 release | Nov 28 | Approves the itch page text, AI disclosure, repo going public, and submitting |

## Schedule

| Days | Phase | Work (owner: main agent unless noted) | Exit check |
|---|---|---|---|
| Nov 3 | Research and concepts | Done: research, 18 ideas scored, review, rules spike, 6 mockups | `concepts.md`, spike output |
| Nov 4-5 | Concept sheets | For the picked game, Codex image-gen sheets of every view and state the build needs (title, level select, in-level HUD, plate idle / selected / preview / moving, uplift and flood frames, each goal creature happy and unhappy, level complete, 4 biome palettes, cursor/touch affordances, cover 630×500), critiqued with `taste_critic.py --shot` and regenerated until nothing is missing; saved in `concepts/` | Sheets approved by critic; Victor sees them on the pitch page |
| Nov 4-7 | Grey-box | Vite + TS + three.js repo; rules module ported from the spike with vitest tests; solver + generator CLI (`npm run levels`); level JSON format; grid render (plain boxes), plate select + rail drag, flood/uplift preview, undo/restart, goal checks; 6 levels at the quality bar; itch draft upload to test the iframe (WebGL2, audio unlock, sizing, fullscreen) | vitest green; Playwright plays each level's solver solution to "complete"; draft page loads on itch; **G2** |
| Nov 8-14 | Look and sound | Diorama to the concept: column terrain, plate tints + edge patterns (colour-blind safe), animated uplift with dust, water shader and pour-in, ocean, sky; goal creatures with reactions; UI screens; WebAudio music per biome + SFX (rumble, crack, pour, bleats, chimes) | Screenshot set vs concept sheets, critic pass; **G3** |
| Nov 11-21 | Content | Generator + hand curation to **12-15 levels** in 3-4 biomes, each biome adding one twist (e.g. pinned plates, ice that melts to sea, a village that must stay connected); difficulty curve; first 3 levels teach without text walls | Every level passes the quality bar via `npm run levels:audit`; **G3** |
| Nov 18-24 | Juice and onboarding | Camera moves, hover previews, satisfying move feedback, level-complete moment, settings (volume, reduced motion), save progress (localStorage, safe fallback), touch controls; design audit by `reviewer` (skill `game-design-self-critique`), play-like-a-player pass (`game-qa-play-like-a-player`) | Findings fixed or answered by id; **feature freeze Nov 24** |
| Nov 25-28 | Release prep | Bug-fix and performance (60 fps on a mid laptop, < 15 MB zip, < 5 s load); itch page (cover, 4 screenshots, GIF, controls, short pitch, AI disclosure); repo README + LICENSE; **G4** | Release checklist below all green |
| Nov 29 | Submit | Push repo public, upload zip, submit to the jam, verify the entry page live (before/after checks) | Entry visible on the jam's entries page; hash of uploaded zip = built zip |
| Nov 30-Dec 1 | Buffer | Hotfixes only (itch allows updating the build until the deadline) | |
| Dec 1-Jan 1 | Rating | Victor plays and rates 20+ entries, comments, answers comments on ours; agents fix only critical bugs after the deadline if the jam allows | Our rating count ≥ the jam median |

## Done-criteria (each with its check)

1. Game is complete: title → 12-15 levels → ending, no dead ends. Check: Playwright autoplay runs every level's solver solution end to end and reaches the ending.
2. Every level is solvable and meets the quality bar. Check: `npm run levels:audit` (solver) in CI and locally.
3. Rules are correct. Check: vitest unit tests for shift, uplift, rift, flood, goals, undo.
4. Runs in the itch iframe. Check: the uploaded draft loads and plays level 1 in Chrome and Firefox via browser_relay; screenshot inspected.
5. Looks like the concept. Check: screenshots of title, level, complete, each biome vs concept sheets with `taste_critic.py --ref`, findings answered; `Taste:` verdict.
6. Sounds finished: music + every action has a sound; mute works. Check: audio event log in a Playwright run shows each SFX fires; Victor's G3 notes.
7. Performance. Check: Playwright perf trace, 60 fps median on the dev PC with 4× CPU throttle ≥ 30 fps; zip size and load time measured.
8. Submitted on time with honest disclosure. Check: entry page screenshot, form answers recorded in `docs/release.md`.

## Tech

- Vite + TypeScript + three.js, vitest, Playwright (the stack proven on Skyway Rally and Aether Relay). `vite.config.ts` uses `base: './'` for itch's relative paths.
- Modules: `rules/` (pure, deterministic: grid, shift, flood, goals), `solver/` (BFS, audit, generator; Node CLI), `levels/*.json`, `render/` (terrain, water, creatures, fx), `ui/`, `audio/` (WebAudio synth), `input/` (mouse + touch, rail drag).
- Reuse, not rebuild: three.js for rendering, ZzFX/ZzFXM or hand WebAudio for sound (licence checked before use), @fontsource for fonts; no physics engine needed (grid rules).

## Name candidates (Plates)

Drift, Fault Line, Pangaea, Continental, Plate Shift, Tectonic, Faultline Farm, Shiftland. Check itch.io and Steam for clashes before G1.

## Risks

| Risk | Mitigation |
|---|---|
| Puzzles feel dry | Creature reactions and land-moving feel come first in the look phase; G2 kill gate |
| Level design takes longer than planned | Generator + solver produce candidates; 12 good levels beat 25 average ones |
| Victor unavailable for gates | Each gate has a default (G2 default: continue if the solver bar is met and the critic is happy; G4 has no default: submission waits for his approval) |
| itch iframe surprises (WebGL, audio) | Draft upload in week 1 |
| Few ratings | Browser-playable, strong cover and GIF, Victor rates 20+ games in December |
| Builds and agent time compete with Horizon and Irismere | Jam game is small; one lead agent, helpers only for parallel art/audio work |
