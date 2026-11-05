# Shiftland: release state

Results against the release checklist in `PLAN.md`. Evidence paths are under `D:\Work\_local\evidence\2026-11-04-shiftland\` unless a full path is given. Updated 2026-11-04.

**Nothing is public.** The repo stays private and the itch page is not created until Victor approves (G0, G4).

## Checklist

| # | Item | State | Evidence |
|---|---|---|---|
| R1 | Zip valid for itch HTML5 | see "Build" | `npm run pack:check` |
| R2 | Relative paths | pass locally; the itch draft half waits on G0 | `npm run pack:check` |
| R3 | Plays end to end | pass, real mouse input from a clean save to the ending, on a production build | `p12\a24.log` |
| R4 | Levels pass the bar | pass, 24 of 24; count matches `itch-page.md` | `npm run levels:audit` |
| R5 | Rules and tests | see "Build" | `npm test`, `npm run typecheck` |
| R6 | itch iframe | stand-in pass: Chromium, cross-origin iframe with itch's `allow` list at 1024x640 and 640x480: real drag solves island 1, audio context runs, progress saved, fullscreen works, no console errors. The real draft page **waits on G0** | `if\` |
| R7 | Touch | pass in emulation at 390x844 and 844x390; no real phone tried | `p12\a24p.log`, `p12\a24l.log` |
| R8 | Save and settings | pass in e2e | `npm run e2e` |
| R9 | Performance | pass on the dev PC, map included (re-measured Nov 5), see below; no mid laptop tried | `p12\perf.log`, `2026-11-05-shiftland\perf.log` |
| R10 | Audio | event log and metrics pass; a blind machine listen (Gemini, Nov 5) led to changes in `qa.md`; **no person has heard it** | `npm run e2e`, `D:\Work\_local\evidence\2026-11-04-shiftland-audio\report.md` |
| R11 | Look | critic rounds run; the open majors are answered in the session's `Taste:` line | `D:\Work\_local\taste-critic\` |
| R12 | No shipped AI media | pass: no image or audio file in `dist/` | `npm run pack:check` |
| R13 | Repo ready | README and LICENSE (all rights reserved) are in. Secret scan Nov 5: gitleaks over all 139 commits, 1 hit, a false positive (the `ENDING_KEY` localStorage name in `app.ts`). Going public also shows: the commit author email, the AI concept images in `concepts/` (never shipped), and internal `D:\Work\_local` evidence paths in `docs/`; Victor decides at G4 whether `docs/` and `concepts/` stay. Rerun the scan on the final commit | `gitleaks git .` |
| R14 | itch page | text in `itch-page.md`; press images in `press/`; the disclosure must be matched to the real form at G4 | `press/` |
| R15 | Victor's approvals | **waiting on Victor** | |
| R16 | Submitted and verified | **waits on R15** | |

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

- G0: approve the itch draft page and the public repo. Until then R6 can't be run, and the itch iframe (WebGL2, audio unlock, sizing) is untested.
- G2 and G3: play it. No person has played this game yet: every play so far is an agent driving real input and reading screenshots.
- Listen to the audio.
- G4: approve the page text, disclosure, repo going public and the submission.

## Known limits

- Repo and license, Victor on Nov 4: "no open source then if not needed ... you can make it public if needed next run." The jam needs a public repo but no open-source license, so going public is approved for the next run when it is needed. `LICENSE` is now all rights reserved (Nov 5), with the Fredoka OFL and three.js MIT notes kept. The itch page and submission are not covered by this approval.

- Testing is browser-only on this PC, by Victor's decision on Nov 4 ("focus on just testing here on the browser"): real phones, iOS and laptops are not a to-do for agents.

- Real Safari and iOS are untested. WebKit in Playwright solved the first island; WebKit on Windows stops showing the canvas when its buffer changes size: proven not ours by a bare WebGL page that does the same (`p12\wk\`, `qa.md`). On a real iPhone, check a rotation and a slow-device quality step first.
- "About an hour" on the itch page is an estimate from agent play: playtest 6 finished everything in 51 minutes, reading a text dump of the board, so a person is likely slower. Par is the solver's true minimum.
- The hard end isn't proven fair for a cold player. Playtest 7 got stuck on Two Waters without hints; playtest 8 solved it at par but needed hints after 7 minutes; playtest 9 failed Frost Line and The Summit in 13 minutes without hints, reaching 3 of 4 and 5 of 6 wants. The bite-and-carry trick is the wall. See `qa.md`.
