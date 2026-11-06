# Shiftland: release state

Results against the release checklist in `PLAN.md`. Evidence paths are under `D:\Work\_local\evidence\2026-11-04-shiftland\` unless a full path is given. Updated 2026-11-06.

Victor approved the repo going public, the itch page and the submission on Nov 6 (G0, G4).

## Checklist

| # | Item | State | Evidence |
|---|---|---|---|
| R1 | Zip valid for itch HTML5 | see "Build" | `npm run pack:check` |
| R2 | Relative paths | pass locally and on itch's server: the game loads on the real page, no console errors (Nov 6) | `npm run pack:check`, `D:\Work\_local\evidence\2026-11-06-shiftland-victor-play\itch-iframe-title.png` |
| R3 | Plays end to end | pass, real mouse input from a clean save to the ending, on a production build; redone on 25 islands Nov 5 | `full25b.log` (Nov 5), `p12\a24.log` |
| R4 | Levels pass the bar | pass, 25 of 25 (Harbour Row back as island 8, Nov 5); count matches `itch-page.md` | `npm run levels:audit` |
| R5 | Rules and tests | see "Build" | `npm test`, `npm run typecheck` |
| R6 | itch iframe | stand-in pass: Chromium, cross-origin iframe with itch's `allow` list at 1024x640 and 640x480: real drag solves island 1, audio context runs, progress saved, fullscreen works, no console errors. The real page: see "itch iframe test" below | `if\` |
| R7 | Touch | pass in emulation: the 25-island build played through by one-finger swipes at 390x844 on Nov 5 (25 of 25 at par, ending reached, 245 s, 0 errors); 844x390 last played on 24 islands; no real phone tried | `_local\evidence\2026-11-05-shiftland\touch25.log`, `p12\a24p.log`, `p12\a24l.log` |
| R8 | Save and settings | pass in e2e | `npm run e2e` |
| R9 | Performance | pass on the dev PC, map included (re-measured Nov 5), see below; no mid laptop tried | `p12\perf.log`, `2026-11-05-shiftland\perf.log` |
| R10 | Audio | event log and metrics pass; a blind machine listen (Gemini, Nov 5) led to changes in `qa.md`; Victor on Nov 6: "the sound is good" | `npm run e2e`, `D:\Work\_local\evidence\2026-11-04-shiftland-audio\report.md` |
| R11 | Look | critic rounds run; the open majors are answered in the session's `Taste:` line | `D:\Work\_local\taste-critic\` |
| R12 | No shipped AI media | pass: no image or audio file in `dist/` | `npm run pack:check` |
| R13 | Repo ready | README and LICENSE (all rights reserved) are in. README rewritten Nov 6. Secret scan Nov 6: gitleaks over all 152 commits, 1 hit, the same false positive as Nov 5 (the `ENDING_KEY` localStorage name in `app.ts`). Going public shows the commit author email, the AI concept images in `concepts/` (never shipped, disclosed in the README) and internal `D:\Work\_local` evidence paths in `docs/`; R13 listed these for G4 and Victor approved everything, so they stay | `gitleaks git .` |
| R14 | itch page | live page and `itch-page.md` agree; itch's AI form answers recorded there; shots 2-4 re-rendered Nov 6 with `npm run press` (the old ones said 24 islands) | `press/` |
| R15 | Victor's approvals | pass: approved Nov 6 ("i approve everything"), see below | |
| R16 | Submitted and verified | submitted Nov 6, 10:46 CET; entry `https://itch.io/jam/game-off-2026/rate/5309017` shows every answer as drafted (`itch-page.md`); see "Jam entry" below | `D:\Work\_local\evidence\2026-11-06-shiftland-itch\jam-entry-after.png` |

## itch iframe test (real page, logged out, Nov 6)

Playwright, no account, on `https://thechosenvictor.itch.io/shiftland`: Chromium with hardware GPU at 1718x1214 and 1024x640, Firefox at 1440x900. Each run clicked Run game, then Play, and solved First Peak with a real drag at par. All three: WebGL2 on, star saved, save survives a reload, audio context running, fullscreen works. Evidence: `D:\Work\_local\evidence\2026-11-06-shiftland-itch\` (`chromium-*`, `chromium-small-*`, `firefox-*`).

- The first run at a 1280x720 frame found itch's Follow, Add To Collection and Related games buttons over the game's top-right buttons, and the frame overflowing a 1024-wide window. Fixed on the page, not in the game: frame 960x540 and a 100 px banner above it (`itch-page.md`). Rerun: `box.y` 120, below the buttons, at all three sizes; the frame fits the 1024 window.
- All 25 islands at 960x540 on the production build: no HUD or goal list over the board, 0 errors (`sweep540\sheet1.png`, `sheet2.png`).
- Firefox logs `NotSupportedError: Operation is not supported` when itch's fullscreen button is clicked (3 of 3 runs with the click, 0 of 4 without). It is an unhandled rejection on itch's top page, not in the game's frame, and fullscreen still works. Not ours to fix.
- Served files: 12 of the zip's 13 files are byte-identical on itch's server; `index.html` differs only by the one `htmlgame.js` tag itch appends.

## Jam entry

Logged-out read, Nov 6 (Playwright, no account): the entry page answers 200 and shows the title, the repo link and the answers, with no edit link (`jam-entry-loggedout.png`). The jam's Submissions tab says "Submissions will be available after the jam has ended" for every entry, so the list can't show Shiftland until Dec 1 (`jam-entries-loggedout.png`).

Answers as submitted are in `itch-page.md`. All commits are from Nov 3 on, inside the jam (opened Nov 1, closes Dec 1 at 22:37 CET). The entry stays open to edits until then; a code change only needs a new zip on the itch page.

## Performance (production build, dev PC)

Chromium with hardware GPU at 1280x720. Target from `PLAN.md`: 60 fps median, at least 30 under 4x CPU throttle.

| Scene | No throttle | 4x CPU throttle |
|---|---|---|
| Title | 58.8 fps | 59.2 fps |
| The Summit, idle | 59.9 fps | 61.3 fps |
| The Summit, moves | 60.2 fps | 42 fps |
| Map | 60.2 fps | 59.3 fps, quality 0, worst frame 33 ms (Nov 5, idle PC); 6x throttle: 35.7 fps, quality 0 |

Nov 4 numbers were measured with a playtest running on the same PC (`p12\perf.log`); the map then read 25.3 fps at 4x and stepped quality down to 3 (worst frame 1.6 s, the shader rebuild when shadows go off). Re-measured on Nov 5 with no playtest running (`D:\Work\_local\evidence\2026-11-05-shiftland\perf.log`): the map passes. The Nov 4 load is a likely cause of the gap, not a proven one; the Nov 5 harness is a new script, not the Nov 4 one. The 1.6 s freeze at the quality step is fixed (Nov 5): step 3 no longer switches shadows off, which rebuilt every shader at once; it keeps them, at 1024 px, redrawn every other frame while anything moves. The Summit under 10x throttle, stepping to quality 3: worst frame near the step 1,467 ms before, 217 ms after, shadows still drawn (`2026-11-05-shiftland\step.log`). A CPU profile of the map at 4x shows no hot spot in the game's code (largest: the frame loop 5.5%, three.js culling 3.9%, the rest under 3%). Load about 3 s from a local server. A mid laptop and a real phone have not been tried.

## What only Victor can do

All answered by Victor on 2026-11-06: "it was fun, so aha it is. i solved some in first try and some with hints, some were hard but it can all be solved. good work ... And yeah i approve everything and the sound is good as well."

- G0 approved: itch draft page and public repo.
- G2 passed: "it was fun, so aha it is"; 25 / 25 stars (`qa.md`, Victor's first play).
- Audio: "the sound is good".
- G4 approved: page text, disclosure, repo going public and the submission ("i approve everything").

## Known limits

- Repo and license, Victor on Nov 4: "no open source then if not needed ... you can make it public if needed next run." The jam needs a public repo but no open-source license, so going public is approved for the next run when it is needed. `LICENSE` is now all rights reserved (Nov 5), with the Fredoka OFL and three.js MIT notes kept. Victor approved the itch page, the public repo and the submission on Nov 6 ("i approve everything"). Posting about it on X or elsewhere isn't included.

- Testing is browser-only on this PC, by Victor's decision on Nov 4 ("focus on just testing here on the browser"): real phones, iOS and laptops are not a to-do for agents.

- Real Safari and iOS are untested. WebKit in Playwright solved the first island; WebKit on Windows stops showing the canvas when its buffer changes size: proven not ours by a bare WebGL page that does the same (`p12\wk\`, `qa.md`). On a real iPhone, check a rotation and a slow-device quality step first.
- "About an hour" on the itch page is an estimate from agent play: playtest 6 finished everything in 51 minutes, reading a text dump of the board, so a person is likely slower. Par is the solver's true minimum.
- The hard end isn't proven fair for a cold player. Playtest 7 got stuck on Two Waters without hints; playtest 8 solved it at par but needed hints after 7 minutes; playtest 9 failed Frost Line and The Summit in 13 minutes without hints, reaching 3 of 4 and 5 of 6 wants. The bite-and-carry trick is the wall. See `qa.md`.
