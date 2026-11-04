# Shiftland: play record

Exploratory play of the production build through real input (skill `game-qa-play-like-a-player`). Evidence paths are under `D:\Work\_local\evidence\2026-11-04-shiftland\`. Plays by agents reading screenshots: **no person has played this yet, and nobody has heard the audio.**

Controller-driven captures (`few.mjs`, `gallery.mjs`) are for looking at boards and are not counted as input checks here.

## The seven passes

| # | Pass | What was done | Result | Evidence |
|---|---|---|---|---|
| 1 | Do nothing | Sat on the title, a level, the solved panel and the map with no input; compared state before and after | Nothing moves the player: same moves, same board. The title loop keeps pushing its own demo island, by design | `q7.log` "idle: state unchanged" |
| 2 | Go the wrong way | Dragged across rails, past rail ends and into pinned plates; moved away from the goal and undid; left mid-level through the map and came back | Each refused move names its reason; progress on the unfinished island is kept | `q7.log`, `mk3.log` (400 random real inputs, 0 errors) |
| 3 | Look near the start | Zoomed every island's first view and solved view | Found and fixed: floating hint rail, bubbles far from owners, buoy caption read as an instruction. Accepted: creatures can stand in front of each other on the densest solved boards (fixed camera; every creature stays visible at a chip) | `p3\g2\_s.jpg`, `p3\g\_e.jpg`, `playtest3\` |
| 4 | Judge the scene | Island boards, title, map, ending at six window shapes | Ending fill read as unfinished squares: rebuilt. Next island under phone chips read as part of the board: faded out. Map labels clipped at 1280x720: margins raised | `p3\en\land.png`, `p3\ph3\s22.png`, `p3\m2\` |
| 5 | Real key at every prompt | Solved an island by digit and arrow keys; Tab, Z, R, H, M, Escape | All pass | `npm run e2e` (`e2e/player.spec.ts`), `p3\qa2-*` |
| 6 | Close while standing | Settings opened and closed five times without moving the pointer away, then a fresh drag | No move spent, panel stays shut, drag works | `e2e/player.spec.ts` |
| 7 | Dismiss messages | Chip message, then hint, then name-card note, then restart | A newer message isn't cut by an older timer; the note returns on tap and on Restart | `e2e/player.spec.ts` |

## Full plays

| Build | Input | Shape | Result | Evidence |
|---|---|---|---|---|
| 25 islands | Real mouse | 1280x720 | All solved at par from a clean save, reached the ending | `a28.log` |
| 25 islands | Real touch | 390x844 | Reached the ending | `a28p.log` |
| 25 islands | Real touch | 844x390 | Reached the ending | `a28l.log` |
| Scenario run | Real mouse | 1280x720 | Pinned, ice, penguins, undo, restart, cancel: 11 checks, 0 fails, 0 errors | `q7.log` |
| Random input | Real mouse | 1280x720 | 400 steps, 0 errors | `mk3.log` |
| Long session | Controller | 1280x720 | 27 islands opened, solved and restarted: geometries steady at 243, heap 47 to 55 MB, 0 errors | session scratch `mem.mjs` |
| Cross-origin iframe | Real mouse | 1024x640, 640x480 | Solved island 1, audio runs, save works, fullscreen works, 0 errors | `if\` |
| Firefox, WebKit | Real mouse | 1280x720 | First island solved, 0 errors | `br3\` |
| Software GL (SwiftShader, no GPU) | Real mouse | 1280x720 | About 14 fps; islands 1 to 3 solved by real drags, each script drag registered in about 2.5 s, 0 errors. Slow but it works | session scratch `nogl.mjs`, `softplay.mjs` |
| No WebGL at all | None | 1280x720 | Plain message asking to enable hardware acceleration or try another browser, no crash | `p3\nogl\none.png` |
| Slow connection (1.6 Mbit/s, 150 ms) | None | 1280x720 | Blue screen with name and breathing dots from the start, title at about 6 s, playable at about 10 s | `p3\slow\2\` |
| Narrow phone 360x640 | Controller | 360x640 | Name card clear of Undo, moves on one line, the note follows the card's height | `p3\n360\_z.png` |

## Fresh-eyes playtests

Agents told to play as a new player, each on a newer build.

| Round | Report | Main result |
|---|---|---|
| 1 | `playtest\` | Free +/- preview solved islands by scanning: turned off after island 3 (setting brings it back) |
| 2 | `playtest2\` | Lake against sea and corners stumped a player for 12 minutes: live reasons on chips |
| 3 | `playtest3\` | "Clearly above a typical jam entry, not yet a great puzzle game". Bite-and-retreat untaught, warning used as an oracle, notes vanish, bubbles float: all addressed |
| 4 | `playtest4\` | "A good puzzle game is hiding inside a pleasant one, but its middle sags." Findings below |

### Playtest 4 findings (islands 6 to 17)

| Id | Finding | Result |
|---|---|---|
| Curve | 8 to 14 easy and repetitive, 14 a recap, 6 harder than 7 to 13, spike at 17; occlusion on 6, 11, 17, 22 | Middle reworked by the level expert (see design-plates.md) |
| P1 | Sliders stack and a drag grabs the wrong plate (Mirage) | A slider moves to another cell of its plate when one sits beside it; the plate whose rail shows wins close calls; its end dots grab it. `p41\`: every knob picks its plate, far dot picks the shown plate |
| P2 | Camera seems to move during play | Rejected: `frameActive` runs only on restart and solve, and `_cam.jpg` shows the plate in the same screen place across moves |
| P3 | A short drag does nothing and says nothing; messages gone in 1.5 s | Snap at .35 of a cell, "Drag further" message, messages stay 3 s. `p41\`: .2 cell says so, .45 cell moves |
| P4 | Hint names no plate; hint outlives Restart | "Try the gold plate with the dots", the plate breathes, Restart clears it. `p41\` |
| P5 | Creatures hidden behind land | X-ray only when mostly hidden, land itself moved in the level rework |
| P6 | "Melt the ice under them" names nobody | Names the creature (`meltReason`, unit test) |
| P7 | Rail one step off after Undo | Rail counts from the destination; `e2e/player.spec.ts` checks it after a move and after Undo |
| P8 | Bubbles over objects, rails across houses | Accepted: the rail shows one stop each way and a thought belongs above its owner |

## Colour-blind check

Deuteranopia and greyscale simulation of Give and Take (`p3\cvd23.jpg`): red and yellow plate edges merge under deuteranopia, and plates stay apart through their patterns (stripes, zigzag, dots, checks) and dark seams. The check and cross badges differ by glyph. The page's "colour-blind safe plate patterns" holds for that board.
