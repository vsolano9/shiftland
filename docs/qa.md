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
| 24 islands | Real mouse | 1280x720 | All solved at par from a clean save, reached the ending | `p12\a24.log` |
| 24 islands | Real touch | 390x844 | Reached the ending | `p12\a24p.log` |
| 24 islands | Real touch | 844x390 | Reached the ending, 3 runs at once; earlier runs stopped on Good Neighbours (below) | `p12\a24l.log`, `p8\a24l-r1.log` to `r3` |
| Plate cells and buttons under the HUD | Probe, every island along its par line, frozen build | 844x390, 390x844, 360x640, 1280x720, 1024x768 | No plate cell or action button is covered by a chip, note or button. A phone with 4 chips used to push a third row over Hint: found by the critic, fixed with icon-only chips from 4 up | session scratch `overlay.mjs` (run it on a frozen build: a dev-server hot reload mid-scan reports false misses) |
| Rail handle on its plate | Probe, every plate of every island along its par line | 1280x720 | The handle projects onto its own plate, near its slider | session scratch `anchor.mjs` |
| 28 islands (older build), random walk | Controller | 1280x720 | 14 random moves on each island: 27 px past the screen edge on Still Water, none on the rest | `wander.mjs`, design row "Camera holds par moves' reach" |
| Scenario run | Real mouse | 1280x720 | Pinned, ice, penguins, undo, restart, cancel: 11 checks, 0 fails, 0 errors | `q7.log` |
| Random input | Real mouse | 1280x720 | 500 steps with reloads, then 200 on the last snapshot, 0 errors | `p11\mk.log`, `p12\mk.log` |
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

### Playtest 6 findings (24 islands, ending, map, phone; finished, 22 of 24 stars, 51 minutes)

Times from an agent reading a board dump: lower limits. Report: `playtest6\`. Verdict: would finish and recommend; the place it would quit was island 23.

| Id | Finding | Result |
|---|---|---|
| P6-1 | Give and Take is the wall, before an easier finale, and nothing says Restart is nearer | Note now states the trick ("Push in, then pull back: the bitten land comes with you"); both hint presses say "Restart is shorter" when the way from here is longer than par. Not swapped: The Summit is the climax |
| P6-2 | Thin Ice never says melted ice becomes open water | Note and penguin rule both say so |
| P6-3 | Two Waters spikes above the next three | Note fixed, not swapped: playtest 5 hit the same wall the other way round. It now says the thing the first move does ("A bitten palm stays put when its old plate slides away"); the corner rule is taught earlier, at The Cut |
| P6-4 | Water dots read as chimney puffs, start far from the creature | Tinted water cyan, with a pulsing beat at the source |
| P6-5 | Bubbles far from owners, over rails | Already weighs distance against covering (P5-6); with six creatures and four rails on a small board some trade stays. No change |
| P6-6 | Phone shows one reason at a time | The line turns through every unhappy creature, 2.6 s each |
| P6-7 | A drag at a floating rail handle missed once, through the tester's helper | Rail height came from the plate's highest cell, so beside a low cell the rail and the hint hand floated over water (seen again on Give and Take, `p9\sh\s2.png`). Rail, anchor and grab segments now ride the slider's own cell (`railY`, `p9\sh2\s2.png`). A thumb also reaches 14 px past a plate's edge |
| P6-8 | Hint panel didn't move up over a plate's edge | It moves for the rail and hand, by design; it covered 25 px of a plate's edge and no handle. No change |
| P6-9 | Tundra label missing | The tester's build predates labels stepping aside (`382ef3b`); present in `p8\_map.png` |
| P6-10 | "This plate has to be here" unclear | "Nothing shows yet: this slide sets up the next move" |
| P6-11 | Small things | Village Green's door now says a creature can be asked; the button sliver beside the phone's results card is gone. Accepted: chip rows change shape as reasons change length, a rail stays lit while its plate is selected, objects over a rail tip, Next goes on in order after a replay, phone map pins over small thumbnails |

### Playtest 7 findings (hard islands cold, stopped at its 25 minutes)

Verdict from the tester: not proven. Three real solves, Frost Line and The Summit not attempted, Give and Take only a wrong line. It never found bite-and-carry by thinking. Shots: `playtest7\`.

| Id | Finding | Result |
|---|---|---|
| P7-1 | Two Waters needs a rule whose note came one island later; stuck for 7 min with 6 hint presses | Fixed: the carry note moved to Two Waters, Twin Palms got its own. Playtest 8 (below): the note helped, the island is still hard |
| P7-2 | Give and Take can die at move 2 of 6 with a board that looks fine | Open as a design risk, kept: it is the second-to-last island, the warning and "Restart is shorter" both say so, and Undo gets out. The six-creature start is daunting |
| P7-3 | Thin Ice's melt rule seemed to sit behind a tap | Not reproduced: the note says it and shows for 11 s after the chapter card (`p7.mjs`). The tester's flow skipped past it; tapping the name card repeats it |
| P7-4 | Chip badges don't preview water | By design: from island 4 the player judges moves unless Settings brings the + and − back. Hatching reads alike over sea and land: accepted, the dots answer after the move |
| P7-5 | "No star this run: Restart to win it back" repeated at Moves 0, and the raised panel clipped Undo | Fixed: it now says "Restart with no hint"; a raised panel sits below the buttons too (`p7.mjs`: top 76, buttons end 68) |
| P7-6 | A rail drew on and the drag answered "No room that way" | Accepted: the far end's stop is the red one in `i13-s3.png`; a long drag counts one step by design |
| P7-7 | An oasis bubble slid under Undo on Two Waters after 5 moves | Accepted: off-par state only, tapping the chip or creature still answers |
| P7-8 | The phone reason line overlaps the note during its crossfade | Fixed: it leaves at once and comes back after the note has faded |

### Playtest 8 findings (Two Waters cold, an earlier wording of the note)

Solved at par in 3 moves after 9.5 minutes: 8 failed lines, the first hint at 7.4 minutes, 4 hint presses in all, star spent. The tester took the hint because of the clock, not because it was out of ideas. Twin Palms only probed. Shots: `playtest8\`.

| Id | Finding | Result |
|---|---|---|
| P8-1 | The note worked: bite then pull was tried within two minutes and freed the buoy | Kept. The wall moved one step on: a hole travels with its plate, and red can slide it next to the palm. This is the puzzle, not a fault |
| P8-2 | Oasis passes with sea beside it if a lake also touches it; only learned by inference, and "that water reaches the sea" misled | Fixed: the oasis explanation ends "Sea on another side does no harm." Fits on 390x844, 844x390, 360x640 (`p11\note\`) |
| P8-3 | Biting the buoy's cell with red is a tempting false lead | Kept: it answers "that water is a lake", which is true and teaches |
| P8-4 | The finished buoy stands half behind raised violet | Accepted: the level comment records the trade. Turning the island hides it more; the chip confirms it, and the buoy's top still shows (`playtest8\j-13.png`) |

### Playtest 9 findings (Frost Line and The Summit cold, 13 minutes, no hints)

Neither solved. Frost Line: about 8 minutes, best 6 moves with 3 of 4 wants. The Summit: about 5 minutes, 5 of 6 wants in 3 moves, only the oasis left. "Solvable by thinking" is not proven either way; 13 minutes is little for the two hardest islands. "No way back" helped, and was used as an oracle. Shots: `playtest9\`.

| Id | Finding | Result |
|---|---|---|
| P9-1 | Nothing said that a plate sliding over land takes that land: a village and penguins changed plate | Fixed in the village's explanation: "A plate that slides over land takes it, and what stands on it." Two Waters' note says it from the other side |
| P9-2 | "Rose too high" doesn't say what raised the village | Partly: the explanation names the rule; the chip doesn't name the cause. Open |
| P9-3 | The oasis chip doesn't point at the gap | Open, a tapped chip already marks the wrong water on the board (e2e "a chip about the wrong water") |
| P9-4 | The Summit's tip names no plate | Open: naming it spends the puzzle's last idea; left as a taste call |
| P9-5 | Lighthouse and palm overlap in one Summit state (`playtest9\sG-05`) | Open, off-par state |

### Phone board blurred for the whole session (Nov 4, critic T20)

The critic kept calling the phone board soft, and it was right. The first seconds of boot (shader compile, fonts) read as slow, so adaptive quality stepped down at once and only ever steps down: a phone that ran 60 fps from then on stayed at pixel ratio 1 of 2 (`q.mjs`: quality 1 at the title). Nothing failed, because no check looked at the ratio. Now the first 5 s don't count, a merely slow window has to repeat, a crawl under 18 fps still acts at once, and pixel ratio steps through 1.5 first. After: quality 0, ratio 2, 60 fps from title through Mirage, shot `p9\q.png`. Every phone shot before this was taken blurred.

### Landscape touch miss on Good Neighbours (Nov 4)

`allplay.mjs` at 844x390 stopped at Good Neighbours' second move in about 1 of 10 runs, never elsewhere. The touch landed at the very top edge of plate 0 (cell 9's centre at plate height projects onto the silhouette, see `p9` scratch `ll4.png`), and `pick` said null there on `pointerdown`, a tick after saying plate 0. The exact flip was not caught: a logged `pick` ran 40 clean runs. The player-facing fix is thumb reach: a touch within 14 px of a plate grabs it (`e2e/phone.spec.ts`). The hint text in that failure was the first move's, not the touch's. After the fix: 10 of 10 repeats of the flow passed (scratch `ll2after.log`), against about 1 miss per 10 before; 10 runs alone can't prove the rate is zero.

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
