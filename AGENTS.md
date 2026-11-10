# Shiftland / Game Off 2026

Updated: 2026-11-10

## Purpose and status

Browser tectonic-plate puzzle for GitHub Game Off 2026 (SHIFT): move an island's plates to satisfy its inhabitants in the fewest shifts. `D:\Work\PROJECTS.md` records 95%, competition closeout only: the 26-island entry is submitted, public source approved, newcomer-fairness checks and rating obligations retained. The November 8 decision queues no new islands or modes; it does not establish that the difficult end is fair to newcomers.

## Where things are

- `game/src/rules/`, `game/src/solver/`: shared rules, solver, hints and audits.
- `game/src/levels/campaign.ts`: authored islands; `game/src/levels/levels.json`: generated export.
- `game/src/game/`: session, progress and input; `render/`, `audio/`, `ui/` beneath `game/src/`: presentation.
- `game/scripts/`, `game/e2e/`: packaging, press, full-play and browser checks. `game/dist/`: generated playable build.
- `press/`: game-rendered public media; `concepts/`: internal references; `docs/`: plans/playtests/release. `spikes/` is historical exploration.
- Evidence: `D:\Work\_local\evidence\2026-11-04-shiftland`, `2026-11-06-shiftland-polish` and `2026-11-06-shiftland-itch` under the same parent.
- Public repo `vsolano9/shiftland`; live game `https://thechosenvictor.itch.io/shiftland`.

## Commands

From `game/`, Node 22.18+ or 24:

```powershell
npm install
npm run dev
npm test
npm run typecheck
npm run levels:audit
npm run levels:export
heavy run -- npm run build
npm run preview
```

`npm run e2e`, `npm run pack:check` and `npm run press` each build before their browser/package/media step; coordinate those build-bearing commands through `heavy run --`. After a build, `node scripts/fullplay.mjs mouse 960x540` plays all islands at par from a clean save; use `touch 390x844`, `touch 844x390` or `keys` for other paths. `node scripts/monkey.mjs` exercises random input. Preview uses port 4327 with strict binding. `levels:export` regenerates JSON; audit the authored campaign rather than hand-editing only its export.

## Guardrails

- Preserve the submitted game, progress/save behavior and free undo/hints. Protect any live checkout owner's work.
- Public source is all rights reserved, not an open-source licence; retain three.js/Fredoka notices. No private account/session material belongs in this tree.
- Shipped art/audio currently use runtime geometry/shaders and WebAudio. Generated concept images are disclosed but excluded from the build. Changing that production method requires rechecking jam disclosures and page claims.
- Keep island count, page media, `docs/itch-page.md` and submitted description aligned. New social posts/public rating text require Victor's explicit approval; submission approval does not authorize later posts.
- Solver/fullplay success is not a cold-player fairness pass. Space live itch checks to avoid rate limiting; itch's own fullscreen rejection is not a game exception.

## Current state

As of 2026-11-10, release records show submission November 6 at 10:46 CET, entry `/jam/game-off-2026/rate/5309017`. The 26-island build passed mouse/touch full plays at par with zero errors and logged-out Chromium/Firefox iframe checks. Audio received Victor's approval. Physical phones, real Safari and a midrange laptop remain coverage limits.

Playtest 13 cold-tested islands 7–11 with Ferry Lane included: one agent solved all five and called them mostly fair. That improved teaching remains unproven for a cold human; Victor's play predates Ferry Lane. Middle/end plays required substantial hints, and later water/preview wording has no fresh cold-player pass. Read QA before selecting the next fairness check. Browser-only testing was Victor's recorded November 4 choice; missing physical-device coverage is a limit, not an assigned hardware task. December rating obligations remain; preserve failed plays rather than erasing them with submission status.

## Docs

- `README.md`: controls, media disclosure, licence and layout.
- `docs/PLAN.md`, `docs/design-plates.md`: scope, rules and release gates.
- `docs/qa.md`: cold-play findings and performance/device limits.
- `docs/release.md`: submitted build/page proof, approvals and fairness gaps.
- `docs/itch-page.md`, `docs/research.md`: entry copy and dated jam research.
- `D:\Work\_ops\docs\portfolio-decisions-20261108.md`: competition-closeout decision.
