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

## Fresh-eyes playtests

Agents told to play as a new player, each on a newer build.

| Round | Report | Main result |
|---|---|---|
| 1 | `playtest\` | Free +/- preview solved islands by scanning: turned off after island 3 (setting brings it back) |
| 2 | `playtest2\` | Lake against sea and corners stumped a player for 12 minutes: live reasons on chips |
| 3 | `playtest3\` | "Clearly above a typical jam entry, not yet a great puzzle game". Bite-and-retreat untaught, warning used as an oracle, notes vanish, bubbles float: all addressed |
| 4 | `playtest4\` | See the section below |

## Colour-blind check

Deuteranopia and greyscale simulation of Give and Take (`p3\cvd23.jpg`): red and yellow plate edges merge under deuteranopia, and plates stay apart through their patterns (stripes, zigzag, dots, checks) and dark seams. The check and cross badges differ by glyph. The page's "colour-blind safe plate patterns" holds for that board.
