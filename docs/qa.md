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
| 26 islands (Nov 6) | Real input, `scripts/fullplay.mjs` | Mouse 1280x720, touch 390x844 and 844x390 | All three: 26 of 26 at par, 26 stars, each card's button pressed, the ending reached, 0 errors (168, 196, 195 s). The first mouse run stopped on Two Waters because the script pressed the rail's raised anchor with another plate's rail on show; a player presses the knob. Not a game fault, and e2e now also checks that where the hint's hand starts grabs the hinted plate on every board of every solution | `2026-11-06-shiftland-polish\full26\` |
| 26 islands (Nov 6) | Same script, other ways in | Firefox mouse 1280x720 (159 s), Chromium mouse 960x540, the itch frame's size (167 s), keyboard 1280x720 by digit and the second-nearest arrow, Enter on each card (143 s) | Each: 26 of 26 at par, 26 stars, the ending, 0 errors | `full26\firefox.log`, `mouse540.log`, `keys.log` |
| 25 islands (Nov 5) | Real mouse drags on the sliders | 1280x720 | All 25 solved at par from a clean save through each card's Next, 296 s, 0 errors (the first run stopped on Two Waters: P10-9, fixed); the last card's Finish shows the ending, 0 errors | `_local\evidence\2026-11-05-shiftland\`: `full25b.log`, `end25-card.png`, `ending25.png` |
| 25 islands (Nov 5) | Real touch swipes from each knob | 390x844 | All 25 solved at par from a clean save, each card's Next tapped, reached the ending, 245 s, 0 errors; again on the final Nov 5 build (return hint, buoy chip): 25 of 25, 246 s, 0 errors | `_local\evidence\2026-11-05-shiftland\`: `touch25.log`, `touch25-end.png`, `touchfinal.log` |
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

### Nov 5 pass (lead agent, real mouse, islands 1 to 7; evidence `D:\Work\_local\evidence\2026-11-05-shiftland\`)

Title, then islands 1 to 6 played in order from a clean save, each trap tried first, then the solution; island 7 opened at 390x640 (the claude.ai phone viewer's height). Every trap answers in words ("the land rose too high", then "No way back from here. Undo?" about 3 s later on Village Green); every solve shows its panel; 0 console errors. Nothing new to fix in the first five minutes. Small things seen and kept: on Open Water the tutorial hand sits beside the buoy's bubble (it leaves on the first move); a rail drawn under a creature runs between its legs (accepted in P8 above). A harness note, not a game bug: Playwright's click waits for a still element, and a glowing Undo never is, so scripts press Z instead.

Private playable link for Victor's G2 (Nov 5): https://claude.ai/artifact/QkJ37hAcgi58X55TDdQRnu, the production build with its CSS and font inlined (the artifact frame allows scripts and workers from its own files only). The same files, served under a strict CSP, solved island 1 by a real drag with the font loaded and 0 errors (`artifact-csp-solved.png`); opening the hosted link itself was not possible from this PC's browser, which is signed into another account.

Stuck-player nudge (Nov 5): after max(14, 4×par) fruitless moves on a puzzle island, Hint glows and a line says Hint names a plate, or which other open island to play. Checked at 1280x720 (`nudge2.png`; the taste critic's weak-glow major T1 is fixed with a halo at rest, round 2 found 0 majors) and 390x844 (`phone-nudge.png`: two lines, nothing covered). A Codex review found that a Hint press during the nudge's 1.2 s delay was overwritten by it; a hint request now ends the nudge for the visit (e2e "a hint asked for before the nudge, or while it waits"). The shadow e2e now counts real shadow passes at quality 0 and 3.

Machine listen (Nov 5, Gemini via the browser, blind; a partial read of what sounds read as, not a person and not timing): `gemini-listen.json`. It heard select as a long sonar ping, slide as an impact, stop and blocked as near twins, crack as a woodblock, pour as a thruster, splash as a snare, the goat and penguin as a kazoo, a metronome click in Meadow and a loud, harsh Desert lead; ice melt, star and the island fanfare passed. Changed: select lost the pure sine two octaves up that rang on in the reverb; stop is a softer low thud; blocked is a soft falling two-tone "uh-uh" (a wood double knock lost a blind A/B to the old thud, and both read too close to stop); the creature voices are breathier and darker (a blind A/B split: penguin new, goat old); Desert's lead is −6 dB; Meadow lost its wood knock, and its shaker moved off the steady offbeat. A second listen could not run (Gemini's upload menu stopped opening), so the stop and blocked contrast was measured instead: stop is one noisy onset peaking at 168 Hz, blocked two tonal onsets peaking at 287 Hz (`audio2\sfx-stop.wav`, `sfx-blocked.wav`). Slide's onset now swells over 70 ms instead of 30 ms, so it reads less like an impact, and pour has more splash band and a higher lowpass, against its thruster read, and the lighthouse horn moved up an octave out of foghorn range. Only the stop, blocked, goat and penguin changes were heard (the A/B); the rest are measured (the audio e2e: levels, tails, loop loudness) but not heard. Still open from the listen, all lower confidence: crush being quiet, kept, since its render measures among the louder SFX (peak -11.7, rms -36.2 dBFS against -40 to -44 for slide, stop and blocked). Splash reading as a snare got a softer onset (35 ms, was 12 ms) and a brown-noise body under the wash: the first 60 ms centre on 1574 Hz, was 2493 (`audio3\sfx-splash.wav` against `audio2\`); measured, not heard. Gemini also suggested recorded Foley, which would break the code-made-audio rule (R12); that is Victor's call.

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

### Playtest 10 findings (islands 8 to 16 cold in the 24-island numbering, now 9 to 17; a Sonnet verifier through real mouse drags, 60 minutes, on a build without the stuck-player nudge)

All nine solved, 0 page errors. Unaided: 11, 12, 13 (stars). With Hint: 8, 9, 10, 14, 15, 16, after about 15 to 35 tries each. Would have quit at 14 (Two Waters), then 8. Its verdict: the middle is fair but too hard, with 11 to 13 the best paced. Shots: `scratchpad\pt10\`, win shots after the fix in `scratchpad\winshots\` (session scratch, Nov 5).

| Id | Finding | Result |
|---|---|---|
| P10-1 | The buoy is half hidden behind raised land on the win (9, 10, 14); the lake behind a palm on 16 | Fixed for creatures: on the win the silhouette shows for any creature at least 10% hidden (30% in play, P5-5). The silhouette is now a soft cream body under its rim (a faint navy fill left only the rim, and the buoy's chain drew tangled loops: taste critic T1, fixed; round 2 found 0 majors). Evidence: `win14-xray2.png` (the buoy's hidden half), `win10-xray2.png` (the lighthouse). Lakes are land-shaped water and get no silhouette: kept |
| P10-2 | Difficulty cliff from 8; 8 to 10 and 14 felt unsolvable without Hint | **Open, and real.** The audit agrees there is a cliff: 7 The Long Pier is effort 4 (par 1), then 8 The Cut is effort 97 with the lowest random-solve rate before the finale (2.6%), and 9 and 10 stay at 116 and 137. A swap inside the coast does not fix it (all three needed Hint), and that the earlier islands teach push-and-retreat does not prove the lesson carries over. Done in part: Harbour Row (effort 32, par 3, shelved on Nov 4) is back as island 8, so the Coast reads 4, 32, 97, 116, 137 and the game has 25 islands (`map25.png`: 25 pins, nothing clipped; progress is keyed by level name, so saves keep). Playtest 11 (below) played 7 to 10 cold on that build: **the cliff moved, it did not go.** Harbour Row took 12 minutes and all three hints, and The Cut went unsolved after 15 minutes and all three hints. Still open: The Cut (effort 97) and Salt Point need an easier entry, either a new teaching island between Harbour Row and The Cut or a smaller Cut. 14 (now 15) is unchanged. Meanwhile the nudge (added after this playtest) points at Hint after max(14, 4×par) fruitless moves |
| P10-7 | Following the second hint, the tester moved the hinted plate the wrong way six times: each plate slides two ways, and nothing said the move was not the hinted one | Fixed: moving the hinted plate the other way from the board the hint was for says "That went the other way from the hint. Undo takes it back" and lights Undo; the hinted way says nothing. e2e `the hinted plate moved the other way…`; one line at 1280x720 (`harbour-wrongway.png`) |
| P10-3 | The second hint's line ran to two lines over the board's top edge and a creature's bubble (`i9_hint.png`) | Fixed: "N moves to go, no star this time" (the first hint already says it costs the star): one line at 1280x720 and 390x844 (`hint9-oneline.png`, `hint9-phone.png`) |
| P10-4 | With the hint ghost showing, the other plates answered "no slider for that plate" | Not a game fault: the pilot finds plates by their shown sliders, and the hint shows only its own. Real drags on other plates are not blocked (the hint sets no input lock) |
| P10-5 | Stale lines ("1 move to go", "Back to the start") in the UI text after a win or restart | Fixed: a faded hint line is now `visibility: hidden` too, so screen readers and text dumps drop it |
| P10-e2e | A full e2e run beside the taste critic and three capture browsers failed two tests: the quality-0 shadow test (the ladder had already stepped to 3 at startup) and the dead-end hint (the worker still "Thinking it over…" after 15 s) | Load, not game code. The quality-0 shadow test also failed in a later full run (its own parallel workers are enough load), so the test now holds the ladder from the first frame through an init script instead of after start; 4 of 4 repeated runs passed. The dead-end hint passed rerun alone and in the next full runs |
| P10-9 | Found by the 25-island mouse play, not the tester: on Two Waters after its first move, pressing the purple plate's knob dragged the gold plate. The moved plate's rail stays on show, and its end dot (26 px reach) lay on the neighbour's knob (16 px) | Fixed: every knob centre is its own 30 px target, so a knob always grabs its plate. The knob e2e now also walks every island's solution with the moved plate's rail on show; it failed on the old build (`P1E: knob 2 picks 1`, island 15) and passes on the new one. Likely part of P10-7 too: the tester's six wasted moves were on this island right after the hinted first move, the exact board where this press went to the wrong plate |
| P10-8 | The hint hand passes over a creature's wish bubble (the lighthouse's on The Cut, `i8_hint4.png`) | Kept: the hand moves along the rail and leaves the bubble a moment later, and the same wish is in its chip at the bottom the whole time |
| P10-6 | Win card over the island's right side; island near the left edge on 13 and 16; a cactus on a lake edge on 15 | Kept: the card sits beside the island at 1280x720 on the shots, and the framing is the shared one tuned in P6-8 |

### Victor's first play (2026-11-06, build `17da6d9`, the first person to play)

"good game, i completed all levels". The map showed 25 / 25 stars (`D:\Work\_local\evidence\2026-11-06-shiftland-victor-play\map-25-of-25.jpg`), and a star means solved within par without showing the move, so every island including the Coast was solved at par at most, with no second hint on the solving run. At most about 36 minutes passed between the shot of his first move and that map, by the two screenshots' timestamps. His words afterwards: "it was fun, so aha it is. i solved some in first try and some with hints, some were hard but it can all be solved", and "the sound is good".

This changes P10-2 and P11-2b: the cliff is not a blocker. They stay open as polish (solver effort still jumps 4, 32, 97; agent testers still struggled), to recheck with someone other than Victor, who is one strong player and knows the project. Nov 6: with Ferry Lane and the new second hint a cold agent solved all of 7 to 11 (playtest 13 below), so the agent evidence no longer shows a wall there. A person's cold play comes when the jam opens for ratings.

### After Victor's play (2026-11-06, for P10-2 and P11-2b)

- **Ferry Lane**, island 8 between The Long Pier and Harbour Row (par 2, effort 10): one plate bites straight in and goes home, which is the move The Cut asks for. The Coast now reads effort 4, 10, 32, 97, 116, 137 and the game has 26 islands. Saves are keyed by name, so a solved island that now sits after an unsolved Ferry Lane stays open (`progress.ts`, unit test).
- **The second hint shows the whole move**: a big arrow along the rail, the hand sliding it, the plate leaning that way, and a preview of what changes on the whole plate. Undo, Restart or the move itself take the show away (e2e `the second hint shows the move…`). Concept: `concepts/hint-move-v1.png`.

### Design audit (fresh-eyes reviewer, Nov 6, live in Chromium)

| Id | Finding | Result |
|---|---|---|
| A1 | Hover moved the hint's big arrow to the wrong plate, on island 1 too | Fixed: `IslandView.pointRail` ties the arrow to its plate; hover can't take the rail; selecting another plate shows that plate's plain rail, and letting go brings the hint back. e2e `a hint keeps its rail…` |
| A2 | The arrow survived leaving the island, with no hand | Fixed: `setActive` and `enterLevel` clear it. Same e2e |
| A3 | Undo left "2 moves to go" on a board 3 moves away | Fixed: Undo hides the line and drops a running hint search. Same e2e |
| A4 | Ferry Lane has the same solution shape as Stolen Peak, and might strengthen The Cut's trap | Kept, on evidence: the cold player below carried its lesson into Harbour Row, The Cut and Salt Point. One agent's play, so it's support, not proof |
| A5, A6 | A fast first drag lost its preview; a tap during the show brought bubbles back | Fixed (Codex review found the first). e2e `the second hint shows the move…` drags with one whole-cell mouse move |
| A7 | Esc hid the rail while hand and lean carried on | Fixed by A1: letting go of a selection shows the hinted rail again |
| A8, A9 | Reduced motion: the plate froze a tenth of a cell out when switched on mid-show; arrow and plate kept pulsing | Fixed: the lean lets go; `IslandView.calm` holds them still |
| A10 | The tutorial line sat on the goat's thought | Fixed at the cause: a hint's raised place carried over from another island, and `enterLevel` now resets it. e2e checks the class |
| A11 | White fleck at the arrow tip | Fixed: it was the track's end poking out (`B0-tip.png` in session scratch). The track and far stops hide while the big arrow lies on them; e2e checks the track, and `thecut-h2-desk.png` shows no fleck |
| A12 | On a phone the hand covered the arrow | Fixed: the hand scales with the cell, down to .65, around its fingertip (`thecut-h2-phone.png`) |
| A13 | `design-plates.md` still said 25 islands | Fixed |

### Playtest 13 (islands 7 to 11 cold, 26-island build; a Sonnet verifier, real mouse and keys, no solutions)

All five solved, no errors, verdict PASS: "mostly fair". 7, 8 and 9 earned stars; 9 took hint 1; 10 and 11 took both hints. Compare playtest 11, where 9 and 10 (now 10 and 11) went unsolved. It came closest to quitting on Salt Point, at 3 of 3 moves with 2 of 3 wants, when the first hint said "From here it takes 6: Restart is shorter", which it called honest and useful. It solved these far faster than playtest 11, about 2 minutes each, so it is one fast reader of screenshots: The Coast's ramp is better but still not proven for a person. Victor's own play, before Ferry Lane existed, solved everything ("some were hard but it can all be solved"). Shots: `2026-11-06-shiftland-polish\pt13\shots\`.

| Id | Finding | Result |
|---|---|---|
| P13-1 | The chapter card and the island's note overlapped for half a second (`i7_a.png`) | Fixed: the note comes 2.2 s after landing, once the card has faded |
| P13-2 | The rail shows arrows both ways while a plate is selected | Kept: both ways are legal, and a drag shows the way it goes (`i11_p1.png`) |
| P13-3 | The goat looks off its tower in the win shot (`i11_done.png`) | Measured, not a fault: root at the cell's centre, legs centred on it; marked on screen in `goatmark-10-3.png`. The offset is the win's hop (`creatures.ts`) |
| P13-4 | The second hint's text gone by a later shot (`i11_h3b.png`) | Kept: it stays at least 6 s. The hand and arrow stay until the move |
| P13-5 | Orange chevrons lie on the plate that doesn't move, with the moving plate elsewhere (`i11_h2a.png`) | Kept: chevrons mark where land will rise, as in every drag preview; the tester could still tell plate and way from the shots alone |
| P13-6 | Tall strata on Ferry Lane and Harbour Row look confusing | Kept: that is how a raised stack reads throughout; nothing else reported it |

### Playtest 11 findings (islands 7 to 10 cold, 25-island build with Harbour Row, before the knob fix; a Sonnet verifier through the pilot, 36 minutes)

Solved: 7 The Long Pier (4 minutes, no hint) and 8 Harbour Row (12 minutes, about 50 moves, 3 hints). Unsolved: 9 The Cut (15 minutes, 3 hints, then a move sweep) and 10 Salt Point (6 minutes, no hint). Would have quit on 8 after about 8 minutes. Verdict FAIL: the Coast's start is still a cliff, one island later. Shots: `pt11\` in the evidence folder (`i8c.png` dead end, `i9hint3.png`, `i9c.png`, `i10a.png`).

| Id | Finding | Result |
|---|---|---|
| P11-1 | The cliff moved to 9: The Cut unsolved with every hint | Open: see P10-2 |
| P11-2 | On The Cut the third hint pointed the yellow plate back where it had just come from and "read as undo, not next step" | Fixed: when the hinted move sends a plate straight back after it bit a neighbour, the second hint says "Slide it back: the land it bit comes with it." in place of the goal it meets. Two lines at 390x844 (`undo-phone.png`), one at 1280x720 (`undo-desk.png`). e2e `a hint to slide a plate back after its bite…`, which also checks a plain step back does not say it. Along their solutions, 12 of the 25 islands reach a board where the second hint gives this line: 4, 5, 8, 9, 10, 16, 19 and 21 to 25 (session scratch `back.mts`). The first wording, "Not an undo: …", was called hard to read beside the Undo button by the taste critic (T5) and changed. Whether a cold player now finishes The Cut is not shown: no player has tried it with this line |
| P11-taste | The taste critic on the phone shot (run `20261105-130720-427417`) also raised the board being small in portrait (T1), plates told apart mostly by outline (T2), the hint hand and rail marks crowding the plate (T3), a buoy shown on land with "buried under land" (T4), and too many banners and buttons around the board (T6) | T4 fixed after round 2 kept it: the buoy is drawn standing on the land, so its chip now says "stuck on land" (`goalReason`, unit test). T5's second half, "no star this time" at Moves 2 / Par 3, is kept: the first hint already says the second costs the star. Round 3 (`20261105-132101-609d3a`, against round 2 `20261105-131105-c5fdc6`) still finds T5's first half unclear. "The land it bit" leans on the hint just before it on that board ("It bites its neighbour: that land is this plate's now"), which the critic does not see. Whether it reads for a player is the open question in P10-2. T1, T2, T3 and T6 are about the shipped phone layout, plate palette and hint hand, which this change did not touch and the phone and colour-blind passes accepted. They are kept as open taste notes for a layout pass, not fixed on Nov 5 |
| P11-2b | A second cold check of The Cut alone, on the final build (12 minutes, `pt12`, session scratch): solved in 5 moves against par 3, with 8 hints, verdict "not fair coming from island 8". Its path never reached the board where "Slide it back" shows, so the line is still untried by a player. It also found the diagonal hint arrows hard to map to a plate and direction, and that the first slide shows nothing | Open, part of P10-2: The Cut needs an easier entry, and the hint arrows' reading on the diagonal board needs a look |
| P11-3 | Moving the hinted plate the legal opposite way along its rail said nothing | Already covered for the second hint (P10-7, in this build). The tester's case followed the first hint, which names the plate only, so there is no "way" to have gone against: kept |
| P11-4 | Par 1 on The Long Pier, but the tester only found 2 moves | Not a fault: the solver and the e2e full plays solve it in 1 (`full25b.log`, `touch25.log`) |
| P11-5 | A stale "This plate slides the other way" line and a rail with arrows on opening island 10 at 0 moves | Not a fault: that line answers a drag across the rail, which spends no move, and the arrows are the selected plate's rail (`i10a.png`) |
| P11-6 | The camera turned between the start and the win (`i8solved2.png`) | By design: the win frames the island beside the card (P6-8) |

### Playtest 9 findings (Frost Line and The Summit cold, 13 minutes, no hints)

Neither solved. Frost Line: about 8 minutes, best 6 moves with 3 of 4 wants. The Summit: about 5 minutes, 5 of 6 wants in 3 moves, only the oasis left. "Solvable by thinking" is not proven either way; 13 minutes is little for the two hardest islands. "No way back" helped, and was used as an oracle. Shots: `playtest9\`.

| Id | Finding | Result |
|---|---|---|
| P9-1 | Nothing said that a plate sliding over land takes that land: a village and penguins changed plate | Fixed in the village's explanation: "A plate that slides over land takes it, and what stands on it." Two Waters' note says it from the other side |
| P9-2 | "Rose too high" doesn't say what raised the village | Kept: tapping names the rule, and the land just moved on the player's own last slide. Worth rechecking with a person |
| P9-3 | The oasis chip doesn't point at the gap | Kept: a tapped chip marks the wrong water on the board (e2e "a chip about the wrong water"); this tester judged from the text and shots |
| P9-4 | The Summit's tip names no plate | Kept: naming it spends the last island's last idea; hints exist for that |
| P9-5 | Lighthouse and palm overlap in one Summit state (`playtest9\sG-05-0E.png`) | Kept: an off-par state after 5 moves. Both still read by their bubbles and chips, and tapping answers |

### Device stand-ins, final build (`p12\proxy.log`, `p12\proxy\`)

Not the real devices: this PC has none, and the itch page waits on G0. WebKit with iPhone emulation: loads, opens island 1, 0 errors, 14 fps without GPU (Windows WebKit, not a phone's number); the low fps stepped quality down and the island vanished from the screen. Traced (`p12\wk\`): the GL buffer still holds the island's colours after the step, and six lines of raw WebGL with none of the game's code do the same on Playwright's Windows WebKit when the canvas buffer shrinks (`r-webkit-after.png` blue, Chromium stays red). So it is that browser build's compositing, not the game. With quality held at 0 the island draws there at phone and desktop sizes. Real Safari is still untested, and a pixel ratio step or a phone rotation there is the first thing to look at. Chromium with Pixel emulation at 6x CPU throttle: 60 fps on island 1. 1366x768 at 4x: 60 fps. Firefox: 0 errors. Cross-origin iframe with itch's allow list at 1024x640: reaches a level, 0 errors.

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
