# Game Off 2026 entry (theme: SHIFT)

Our entry for [GitHub Game Off 2026](https://itch.io/jam/game-off-2026). Submissions close **2026-12-01 13:37 PST (22:37 CET)**; ratings run until 2027-01-01.

Status (2026-11-04): **Shiftland**, a tectonic-shift puzzle, is playable from title to ending in `game/` (`npm run dev`): 24 curated islands across five biomes, six creatures, code-made art and sound, the last-shift ending. Not public: the repo and itch page wait for Victor's approval (G0/G4, `docs/PLAN.md`). Nobody has listened to the audio yet; it has only been measured.

| Doc | What |
| --- | --- |
| `docs/research.md` | Jam rules, past winners, itch.io HTML5 facts, AI position, theme map, reusable tech |
| `docs/concepts.md` | 18 ideas scored, shortlist, fresh-eyes review findings, Plates rules spike results, recommendation |
| `docs/PLAN.md` | Gates, schedule to Dec 1, week-1 day plan, done-criteria with checks, tech, risks |
| `docs/itch-page.md` | Draft itch.io page text and metadata (for G4 approval; not published) |
| `concepts/` | Codex image-gen mockups (internal references only, never shipped) |
| `docs/design-plates.md` | Shiftland game design: rules, creatures, biomes, level progression, controls, feel |
| `spikes/plates/plates.ts` | Throwaway rules + BFS solver spike: `node spikes/plates/plates.ts 300` (`AXIS=2` rails, `AUDIT=1` quality bar, `PLACE=1` seam placement) |
| `spikes/plates/play.html` | Playable top-down grey-box (open from disk); levels from `export-levels.ts` |
| `game/` | The real game (Vite + TS + three.js). Code: `src/rules` (rules, move diff), `src/solver` (solver, audit, generator, CLI, stuck worker), `src/levels` (tutorial specs, level JSON), `src/game` (pure play layer: `Session`, `Controller`, `Progress`, key and drag input; no DOM). In `game/`: `npm test` (all of the above), `npm run typecheck`, `npm run build`, `npm run preview` (port 4327), `npm run e2e` (build + Playwright against the served build), `npm run levels:export` (write `src/levels/levels.json` from the campaign in `src/levels/campaign.ts`), `npm run levels:audit [file]` (ship bar and per-level fixture on every level, exit 1 on a failure), `npm run levels -- <seed> <count> [--desert]` (generated seeds that pass), `node src/solver/cli.ts random` (random-play solve rate per level), `inspect <name|number>` (map, shortest solutions, what each first move costs), `table` (the level table in `docs/design-plates.md`) |
| `spikes/changeover/changeover.ts` | Changeover rules spike (fallback only) |

Repo: private `vsolano9/shiftland` (created 2026-11-03). The jam needs it public by submission; making it public is a public release and waits for Victor's approval (G0/G4).
