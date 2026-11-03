# Game Off 2026 entry (theme: SHIFT)

Our entry for [GitHub Game Off 2026](https://itch.io/jam/game-off-2026). Submissions close **2026-12-01 13:37 PST (22:37 CET)**; ratings run until 2027-01-01.

Status (2026-11-03): Victor picked **Plates**; the game is **Shiftland**, a tectonic-shift puzzle. Research, design, rules spike and a playable grey-box are done; the real build starts Nov 4 (`docs/PLAN.md`). Changeover is the kill-gate fallback only.

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
| `spikes/changeover/changeover.ts` | Changeover rules spike (fallback only) |

Repo: private `vsolano9/shiftland` (created 2026-11-03). The jam needs it public by submission; making it public is a public release and waits for Victor's approval (G0/G4).
