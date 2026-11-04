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
| 24 islands | Real mouse | 1280x720 | All solved at par from a clean save, reached the ending | `p8\a24.log` |
| 24 islands | Real touch | 390x844 | Reached the ending | `p8\a24p.log` |
| 24 islands | Real touch | 844x390 | Reached the ending in 3 of 3 runs at once; earlier runs stopped on Good Neighbours (below) | `p8\a24l-r1.log` to `r3` |
| Plate cells under the HUD | Probe, every island along its par line | 844x390, 390x844, 360x640, 1280x720 | No plate cell is covered by a chip, note or button | session scratch `overlay.mjs` |
| 28 islands (older build), random walk | Controller | 1280x720 | 14 random moves on each island: 27 px past the screen edge on Still Water, none on the rest | `wander.mjs`, design row "Camera holds par moves' reach" |
| Scenario run | Real mouse | 1280x720 | Pinned, ice, penguins, undo, restart, cancel: 11 checks, 0 fails, 0 errors | `q7.log` |
| Random input | Real mouse | 1280x720 | 500 steps with reloads on the 24-island build, 0 errors | `p8\mk.log` |
| Long session | Controller | 1280x720 | 27 islands opened, solved and restarted: geometries steady at 243, heap 47 to 55 MB, 0 errors | session scratch `mem.mjs` |
| Cross-origin iframe | Real mouse | 1024x640, 640x480 | Solved island 1, audio runs, save works, fullscreen works, 0 errors | `p6\if` |
| Firefox, WebKit | Real mouse | 1280x720 | First island solved, 0 errors | `p6\br` |
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
| 5 | `playtest5\` | Saw-tooth curve and a quit point at the Tundra's start: campaign cut to 24, water dots added. Findings below |

### Playtest 5 findings (whole game, 28 islands, reached 25)

| Id | Finding | Result |
|---|---|---|
| P5-1 | Hint arrow reads backwards | It pointed out already, but beside the ring it read as a funnel. Moved further along the rail and larger. `p8\_ar.png` |
| P5-2 | "That water reaches the sea" says neither which water nor where; the Tundra's start was the quit point | White dots run along the way out to sea, or pulse on the lake: chip hover and tap, creature tap, a move that newly causes it (`leakOf`). `p8\_leak.jpg`, e2e |
| P5-3 | One trick (bite and retreat) solves too much | Partly answered by the cuts. It is still the game's main trick |
| P5-4 | Saw-tooth curve | Cut to 24, Twin Palms moved. Low Tide stays a wall at the Coast's end |
| P5-5 | Creatures hidden behind land | X-ray from 30% hidden, was 50%. `p8\_c2.jpg` |
| P5-6 | Bubbles far from their owners | Distance costs in the placement, larger dots. `p8\_c2.jpg` |
| P5-7 | Hint panel covers the hand and plate | It moves up when the rail runs under it; e2e |
| P5-8 | Hint text promised the wrong moment | Reworded, `reasons.test.ts` |
| P5-9 | One reason spoke for several creatures | A chip lists each different reason. `p8\_c2.jpg` island 6 |
| P5-10 | Blurbs | 14 and 20 rewritten; 3 keeps "corner dots", held by a test |
| P5-11 | A long drag moved two stops | One drag, one stop; unit tests. The handle moving after a move stays: it follows its plate |
| P5-12 | Label wording, Play didn't resume, labels on island art, two open islands | Label renamed, Play resumes (e2e), labels moved back and step aside rather than vanish (`p8\_map.png`). Two open islands is the unlock rule, by design |
| P5-13 | Grey rock by a buoy; Hint needs another press after Restart | The rock is the buoy's jumping fish (`p8\_rock.png`). Restart wins the star back, so the warning press comes first again |

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

### Phone playtest (Chromium touch emulation, `phone1\`; not a real phone)

Rechecked by real touch in `phone1\fix\` and `e2e/phone.spec.ts`.

| Id | Finding | Result |
|---|---|---|
| PH1 | Map blank after a turn of the phone (camera started among the islands) or a tiny cluster | Map relayouts on rotation; pins and labels follow; both ways, and turning on an island |
| PH2 | A pinch spent a move | A second finger cancels the drag; e2e |
| PH3 | Upright board looks small | Answered with numbers: boards are 66-87% wide, and always limited by what their plates can reach (97%). A bigger board would crop moves. `fill.mjs` |
| PH4 | Restart unconfirmed, beside Undo | Restart can be undone; upright, it stands a hand's width from Undo in a row under the thumb; e2e |
| PH5, PH6 | Occlusion on 5, 6; dot code taught late | With the level rework |
| PH7 | A swipe on the water after a move spent another | Only a tap on a plate arms the water swipe; e2e |
| PH8 | Camera seems to reframe | Measured, rejected: focus and distance identical across two touch moves on island 24 |
| PH9, PH16 | HUD pills overlap at 360-390 | Map and Settings have the top row, the name card the rest; map title left at 400 and under |
| PH10 | Next island behind the HUD | Top gradient upright |
| PH11 | "Goat in the way of the goat" | "One goat is in the way of the other"; the chip line shows the first unhappy creature, a tap asks any other |
| PH12 | Double tap on Hint skips to the full answer | 1 s guard |
| PH13 | Blurb cut off after rotating | Hidden on any resize; in landscape it fades after 3.4 s |
| PH14 | Landscape win buttons 36 px | 44 px |
| PH15 | Hover stuck after a touch | Hover styles only on `(hover: hover)` |
| PH17 | Settings: keys listed on a phone, no outside tap | Keys hidden on coarse pointers; a tap outside closes |
| PH18 | The hand covers the goat on island 1 | Accepted: it moves, and is gone on the first move |

Biome labels that land on a pin on a small phone hide themselves (`world.ts`): a pin matters more than its region's name.

## Colour-blind check

Deuteranopia and greyscale simulation of Give and Take (`p3\cvd23.jpg`): red and yellow plate edges merge under deuteranopia, and plates stay apart through their patterns (stripes, zigzag, dots, checks) and dark seams. The check and cross badges differ by glyph. The page's "colour-blind safe plate patterns" holds for that board.
