# Shiftland: game design

**Shiftland** (concept name "Plates"), picked by Victor on 2026-11-03. This is the design the build follows; changes are recorded here.

## One line

A small island in the ocean is cut into tectonic plates. Slide a plate along its rail: where it pushes into a neighbour the land rises into mountains, where it pulls away a rift opens and the sea pours in. Make every creature on the island happy in as few shifts as you can.

## The first five minutes (what a rater sees)

1. Title: the island bobbing in the ocean, plates gently breathing; "Play" is the only button that matters.
2. Level 1 (one plate, one goat, one move): the goat looks at the neighbouring plate; the plate's rail arrow pulses. One drag: columns rise with a rumble, the goat hops onto the peak and bleats. Done in 10 seconds; the verb is learned without text.
3. Level 2: pulling a plate away opens a rift; the sea pours in and a buoy's fish jump. Water is learned.
4. Level 3: a goat wants a peak, and the obvious push raises it, but the same push lands on the neighbour's village and lifts it to height 2: houses tilt and crack, undo glows. The first "think first" moment. (Villages ride their plate, so the rules can crush a village but never drown one; Codex review, chain 2.)
5. Level 4: one plate's front lifts a goat while its back opens sea for a buoy, in one move. Level 5: two goats, two pushes, and the order decides. The first real "aha".

By minute 5 the rater has used every core rule, had one failure that was funny rather than punishing, and solved one real puzzle.

These are built and solver-checked in `spikes/plates/tutorial.ts` (`node spikes/plates/tutorial.ts`: 6/6 as designed; L4 and L5 rebuilt after design audit S2):

| # | Name | Teaches | Par | Shortest solutions | Trap (tempting first move) |
|---|---|---|---|---|---|
| 1 | First Peak | push → the seam rises; goat wants a peak | 1 | 2 (push either plate) | none |
| 2 | Open Water | pull away → the gap is sea; buoy wants sea | 1 | 1 | none |
| 3 | Mind the Village | the obvious push also crushes the village; slide the village's plate aside first | 2 | 1 | the obvious push: goat ticks, village crushed, no finish (undo) |
| 4 | Two Wishes | a plate's front lifts land and its back opens sea in the same move (P2N) | 1 | 1 | P0E lifts the goat only: finish in 2, no par star |
| 5 | Far One First | two goats, push the far plate first: a move leaves water behind, so the near-first order lands the second push in water | 2 | 1 | P1E: finish in 3 |
| 7 | Dip and Return | moving a plate away and back reshapes the seam; order decides | 3 | 1 | the obvious push: no finish (undo) |

Dip and Return sits sixth in the grey-box until L6 ("land remembers") is built. It is generated (seed 56, 6×5, 2 plates). My hand-made level 5 failed its check: the solver beat it in 4 moves by pushing a plate twice and pulling it back twice. That shows a rule worth teaching on purpose: **a plate carries its raised land and creatures with it** (a mountain made by a push stays a mountain when the plate slides back). A Coast or Desert level should be built around "carry the peak".

## Level progression (the plan; the shipped list is "Level set" below)

The original plan, kept for its reasoning: levels 1-11 plus level 14 as the one Finale level, with Tundra (12-13) and the second Finale level (15) as the stretch (see "Scope decision"). On Nov 4 the set grew to 20 levels with Tundra in: the numbers in this table are the plan's, not the shipped order.

Unlocking (decided Nov 3, `game/src/game/progress.ts`): the tutorials (`role: tutorial`, the leading run) open strictly in order, because each teaches what the next relies on. From the first puzzle on, two unsolved levels are always open, so a player stuck on one puzzle can play the next and come back (Play reopens the first unsolved one). Why: jam raters who hit a wall stop playing and never see the later biomes they would rate; a strict chain makes the hardest puzzle a quit point. Cost: a player can reach the Finale with one puzzle skipped, which is fine because no puzzle teaches a rule.

| # | Biome | Beat | Source |
|---|---|---|---|
| 1-3 | Meadow | First Peak, Open Water, Mind the Village | built (`tutorial.ts`) |
| 4 | Meadow | Two Wishes, rebuilt (S2): one move ticks both goals (front lifts, back opens sea); the obvious plate ticks only one | built (`tutorial.ts`), par 1, one solution |
| 5 | Meadow | Far One First: two goats on two plates, lifted in a set order (first real "order matters" with creatures in view) | built (`tutorial.ts`), par 2, one solution |
| 6 | Meadow | land remembers: a plate that moves away leaves water, and moving it back takes the cell again (raised, not restored); the goat ends on the new peak | hand-made, beat checked with the solver (S5) |
| 7 | Coast | Dip and Return (moved from L5, S2): away and back changes the seam; first lighthouse | built (`tutorial.ts`), lighthouse added |
| 8 | Coast | reclaim the sea: push a plate into the ocean ring to give a lighthouse a new coast while the buoy keeps open water (villages never drown, so the beat uses lighthouse and buoy, S5) | hand-made, solver-checked |
| 9 | Coast | first 3-plate puzzle, par 4 | generator + curation |
| 10 | Desert | lake vs sea: an oasis wants enclosed water, a buoy wants sea, same rift | lake goal ported Nov 3 (`game/src/rules` `oasis`, generator `oasis` option; 18/300 desert seeds pass the bar) |
| 11 | Desert | close a rift to turn sea into a lake | hand-made |
| 12 | Tundra | pinned plate (anchor rock): it can be pushed into, never moved | needs the pinned rule + solver first |
| 13 | Tundra | ice melts when lifted to height 2+ | needs the ice rule + solver first |
| 14-15 | Finale | larger island (8×8, 4 plates), everything above, par 5-6 | hand-made from generator candidates (S9: the generator found no par-6 level in 200 seeds at depth 6, so par 5-6 is hand-built and solver-checked at depth 8) |

Every beat in this table is written as a solver fixture before its level is built: the level's intended solution, the trap move and the "aha" move are asserted by `npm run levels:audit` (S5).

Rules for the list: every level from level 8 on passes the full quality bar (`audit`: par ≥ 3, order matters, a tempting wrong move, land and plates kept, no goal that starts met); tutorial levels 1-7 are exempt from "par ≥ 3" but each keeps the trap it was designed around (pinned in `game/src/solver/audit.test.ts`); a new biome's twist ships only once the rules module, solver and a unit test support it; if a twist misses its date, its levels fall back to Meadow/Coast rules and the twist is cut (12 good levels beat 15 average ones).

## Level set (shipped, Nov 4)

The 20 shipped levels, in play order, built from `game/src/levels/tutorial.ts` (Meadow) and `game/src/levels/campaign.ts` (the rest) by `npm run levels:export`. Move notation: `P1E` = plate index 1 (letter b on the map) moves east. Regenerate this table with `node src/solver/cli.ts table`.

| # | Name | Biome | Par | Idea | Trap | Random solve |
|---|---|---|---|---|---|---|
| 1 | First Peak | meadow | 1 | push a plate into another: the seam rises; a goat wants a peak | none | 68.8% |
| 2 | Open Water | meadow | 1 | pull a plate away: the gap becomes sea; a buoy wants open sea | P1E: the gap opens beside the buoy, not under it: the buoy rides the other plate | 49.0% |
| 3 | Mind the Village | meadow | 2 | the obvious push also lifts a village and crushes it: look first, undo | P0E: the goat rises, and so does the village beside it: a broken village never recovers | 16.4% |
| 4 | Two Wishes | meadow | 1 | a plate has a front and a back: its front lifts land, its back opens sea, in the same move | P0E: the plain push lifts the goat and leaves the buoy on land | 54.4% |
| 5 | Far One First | meadow | 2 | two goats, two pushes: the order decides, because a move leaves water behind | P1W: the near goat rises, but b has backed away from c: c now pushes into water and lifts nothing | 26.7% |
| 6 | Stolen Peak | meadow | 2 | land remembers: push in, pull back, and the plate keeps the peak and leaves a bay | P1N: sliding b looks like it clears the buoy, but b's next row slides in under it and the goat sails away from the seam | 34.0% |
| 7 | The Long Pier | coast | 1 | a plate can slide out over open water: land reclaims the sea and leaves room behind it | P0W: a rift gives the lighthouse its coast, but the buoy is still on land | 50.3% |
| 8 | Wind-Up | coast | 3 | swing back to hit harder: a plate that bites one neighbour carries that height into the other | P2E: the straight push only raises the goat one step: the front of c is still flat | 13.4% |
| 9 | Dip and Return | coast | 3 | away and back is not nothing: dip a plate so the high cell meets the lighthouse, not the village | P1W: b's high cell runs straight into the village row and breaks it | 5.8% |
| 10 | Low Tide | coast | 4 | a plate carries what it takes: b comes in, takes the village aboard out of harm, and goes back out with it | P2S: pulling c away shows the lighthouse sea at once, and carries the goat and the village away from every seam | 6.6% |
| 11 | Still Water | desert | 1 | water the sea cannot reach is a lake: an oasis wants a lake, not the ocean | P0S: pulling the desert apart spills open sea beside the oasis: it wants a closed pond | 40.1% |
| 12 | The Door | desert | 1 | close a bay and it becomes a lake: one slide shuts the sea out on one side and lets it in on the other | P0E: pushing the land east swallows the door and the bay stays open to the sea for good | 31.6% |
| 13 | Breakwater | desert | 2 | open a rift, then cap its end: a channel to the sea becomes a lake | P1W: pushing b in instead of pulling it away leaves no water at all and lifts the village onto a peak | 12.1% |
| 14 | Two Waters | desert | 3 | lake or sea is decided by what walls it: make one hole of each | P0N: the pond comes at once, right above the buoy: open the buoy's water now and the two holes join into sea | 5.3% |
| 15 | Anchor Rock | tundra | 1 | a pinned plate never moves: bring the land to it and choose the side that misses the village | P0E: the rock cannot step aside as a meadow plate could: the push breaks the village | 36.1% |
| 16 | Thin Ice | tundra | 1 | ice lifted to a peak melts into water: a penguin wants a floe touching the sea | P1S: sliding the floe around finds no water: the sea is behind the ice wall | 36.4% |
| 17 | Step Aside | tundra | 3 | a move that would melt ice under a creature is refused: slide the ice out of the way, then the floe can cross | P1E: b backs off and the penguin sees the sea at once, but the goat sails away from the seam that would lift it | 7.0% |
| 18 | Bite the Rock | tundra | 4 | the rock will not move, but a plate can bite it and pull back: the bite is new sea | P0E: the bite is right, but the village still stands in the way and a lifts it past bearing | 6.1% |
| 19 | Give and Take | finale | 5 | two bites: each plate pushes in and pulls back, and what it stole is what the next plate hits | P1E: the goal it ticks is free, but b backs away from the height it will need | 1.9% |
| 20 | The Summit | finale | 6 | build the tower first: b drives over a dipped shore twice, then a rides its goat up the tower it left | P0N: the goat heads north at once, but the tower it needs does not exist yet | 2.3% |

**How a level is proven.** Each spec carries a fixture, and `npm run levels:audit` (`game/src/solver/fixtures.ts`) checks it against the rules: the intended solution solves at par, is a shortest solution and equals the exported `sol`; the aha move is on every shortest path and does what the fixture claims (`lifts`, `melts`, `seals`, `returns`, ...); the trap is a legal first move off every shortest path that costs exactly what the fixture says, where "dead" must be proven, never "nothing within the search depth". Shape checks reject a level over 9x9, land on the ocean ring, a plain rectangle, a plate with no room, a goat on ice. Whether a trap looks like progress and whether a sentence reads true are judgement, not code: those go through the design audit.

**Random solve** (`node src/solver/cli.ts random`): the share of 2000 random walks of 3 x par moves that hit a solved state. It is the ramp's sanity check, not the ramp itself: teachers sit at 30-70% on purpose, puzzles stay under 15%, the Finale under 3%. Each biome restarts low because its first levels teach a new rule.

## Rules (as in `spikes/plates/plates.ts`)

- Square grid, an island inside an ocean ring. Every cell is either plate land (plate id, height 0-3) or water.
- A move slides one whole plate one cell along its rail (each plate has one axis, shown as a rail; travel limited to ±2 from its start, shown as rail end-stops).
- Convergent: where the moving plate lands on another plate's cell, it takes the cell and the height becomes max(both) + 1, capped at 3. Whatever stands there is lifted with it.
- Divergent: cells the plate leaves become water.
- Water joined to the ocean is **sea**; water enclosed by land is a **lake** (different colour; matters from the desert biome on).
- A plate may move into ocean-ring cells (reclaiming sea); it may not leave the map.
- No stacking (design audit S4): a push that would put two creatures on one cell is blocked; the plate shakes and the rail end flashes. Before this rule, 23 of 28 par solutions moved a creature across plates and 5 needed two creatures on one cell. Taking a cell with a creature on it is still allowed (the creature now rides the mover). Checked in `selfCheck()`.
- The game never removes a creature (S6): a move that would melt ice under a creature is blocked too, so every level's goal list is fixed from start to finish.
- Undo and restart are free and unlimited. Move count is shown against **par** (the solver's minimum); finishing at par earns a star. Stars are optional mastery, never a gate.

## Goal creatures

| Creature | Wants | Happy | Unhappy |
|---|---|---|---|
| Goat | stand on height ≥ 2 | hops to the peak, bleats | looks up at the hills, sighs |
| Village (3 houses), goal label "not crushed" (S5) | land, height ≤ 1 (not crushed) | chimney smoke, warm windows | crushed (height ≥ 2): houses tilt and crack (fail state, undo glows). A village always rides its plate, so it is never under water; a "flood" twist would need its own rule, solver support and a test first |
| Lighthouse | land next to sea | beam switches on and sweeps | dark, keeper waves a lantern |
| Buoy (fixed in the world) | its cell is sea | fish jump around it | sits on dry land, flopping fish icon |
| Palm oasis (desert) | next to a lake (not sea) | palms sway, a camel drinks | wilts |
| Penguins (tundra) | on ice next to sea | slide into the water | huddle |

A level's goals list shows each creature's icon and a tick. All goals true at once = level complete.

## Biomes and twists

| Biome | Levels | New idea | Why it adds depth |
|---|---|---|---|
| Meadow | 1-6 | plates, uplift, rifts, goats, villages, buoys, carrying a peak | the base verb |
| Coast | 7-10 | lighthouses (need coast) and ocean-ring reclaiming | moving land into the sea, not just splitting it |
| Desert | 11-14 | lakes vs sea (oasis wants a lake, buoys want sea) | the same rift must be closed off or opened to the ocean |
| Tundra | 15-18 | pinned plates (an anchor rock: cannot move, only be pushed into) and ice cells (melt to water when lifted to height ≥ 2) | reverses expectations of uplift |
| Finale | 19-20 | all of the above on a larger island | the payoff |

Each twist ships only if the solver and audit support it before levels are made with it.

Twist spike (`node spikes/plates/twists.ts 150`, 2026-11-03): each twist added to 150 rails levels with seam placement, solved to depth 6. "Tight" = par ≥ 3 with ≤ 4 shortest solutions (a quick depth proxy, weaker than the full audit).

| Variant | Solvable ≤ 6 | Par 4-6 | Tight |
|---|---|---|---|
| No twist | 98 | 32 | 43 |
| Pinned plate | 64 | 16 | 26 |
| Tundra (pinned plate + 3 ice cells + penguin) | 42 | 17 | 24 |
| Desert (oasis wants a lake) | 43 | 23 | 35 |

(Rerun after the S4 no-stacking and S6 no-melting-creatures rules, with ice counted as terrain so creatures may stand on it (Codex chain 3); the first run, before them, had 110/74/61/62 solvable and 46/32/35/50 tight. Desert stays the strongest twist; Tundra is the thinnest and is first in the cut order.)

All three twists make puzzles; none is dead weight. The oasis pushes levels deeper (the lake/sea tension is the strongest twist), so Desert is the biome to keep if one is cut. Pinned plates remove options, so they suit early Tundra levels; ice adds unsolvable layouts, so ice levels need curation rather than raw generation. Rules as spiked: a pinned plate never moves but can be pushed into; ice melts to water when its cell is lifted to height ≥ 2, and a move that would melt ice under a creature is blocked (S6: the first spike deleted the creature and its goal, so a level could be won by melting it); penguins want an ice cell that touches sea; an oasis wants an adjacent lake. `selfCheck()` covers melt, pinned, push-into-pinned and the blocked melt under a penguin; `goals()` throws if a goal ever disappears.

## Controls

- Mouse: hover a plate to highlight it and show its rail; drag along the rail; while dragging, a **preview** shows the exact result (ghost columns rising, blue water fill including far-off flooding) before release. Release commits, Esc cancels.
- Keyboard: Tab / 1-9 cycles plates, arrow keys move along the rail, Z undo, R restart, Enter next level.
- Touch: tap a plate, then swipe along the rail; same preview while the finger is down.
- The rail is a row of move steps, not a slider (S1): it looks reversible but is not, because moving back takes cells again and raises them. Each step shows the ghost of the land it will take, and level 6 teaches "land remembers" before any level relies on it.
- Stuck states are never silent (S3): after every move `canFinish` searches every reachable state (no depth limit, capped at 200k states) for a solved one; only a proven dead end shows "no way back from here" and makes undo glow, and hitting the cap shows nothing. A village on a peak counts as proven at once, because a cell's height only ever rises. (A depth-limited search called far-but-solvable states dead ends: Codex chain 3, regression test in `game/src/rules/rules.test.ts`.) The check runs in a worker so input never waits. Prototyped in the grey-box.

## Feedback and feel

- Uplift: columns ease up over ~350 ms with a low rumble, small camera shake, dust puffs at the seam.
- Rift: a crack sound, the seam splits, the water front pours in from the nearest sea edge over ~500 ms (flood fill animated by distance).
- Goal ticks with a rising chime; the creature reacts; the last goal triggers the level-complete sequence (camera pull-back, all creatures celebrate, par star).
- Fail states are funny and soft: a crushed village's houses tilt with a comic creak and the villagers hop onto the roofs; undo is one key.

## Look and sound

- Look: `concepts/plates-key-v3.png` and the `shiftland-*.png` sheets: the island sits in an animated ocean (not over clouds), plate tints plus edge patterns (colour-blind safe), soft shadows, four biome palettes. All geometry and textures made in code.
- Plate palette rule: plate tints never use blue, teal or cyan (hue ~170-250°): water owns those hues (sea turquoise, lake green-teal), so a plate must never read as water. (Found in the first biome sheet, where a pale-blue dotted plate read as water.)
- Plate identity (taste critic T1/T3, 2026-11-03): each plate is a bold perimeter band plus a large surface pattern, the same in gameplay, title art and cover, and legible in greyscale at play size: plate 1 coral band + diagonal stripes, plate 2 golden band + round dots, plate 3 violet band + zigzag chevrons (plate 4 in the finale: rust band + checks). The biome changes only the ground cover inside the band (grass, sand, snow), and that ground cover is tinted toward the plate's hue (coral-, golden-, lilac-tinted grass) so plates separate at a glance; the pattern is low-contrast relief that still reads in greyscale but never out-shouts the rail, the preview marks or the creatures (HUD sheet critic T6). Creature states each carry one status badge (green check / red cross) on top of a silhouette or pose change, so they read at 40 px (T4).
- Uplift art follows the rules (S10): the mover's cell rises to max + 1 as one column; there is no buckling ridge across both plates, and the concept sheets' wider ridges are artistic licence the build does not copy.
- Props follow the biome: no cacti in Meadow, no pines in Desert.
- Sound: WebAudio synth only. A gentle marimba/pad loop per biome (pentatonic, so moves can add notes in key), SFX: rumble, crack, water pour, goat bleat (formant synth), chimes, UI clicks. Mute and volume in settings.

### Sound recipes (WebAudio, all synthesized)

| Event | Recipe | Notes |
|---|---|---|
| Plate select | short marimba tick (sine + 2nd partial, 60 ms decay), pitch = plate's note in the biome scale | each plate "owns" a note, so moves become melody |
| Slide one stop | soft stone scrape: band-passed noise sweep 200→600 Hz, 180 ms | lower and longer for bigger plates |
| Uplift | low rumble (brown noise through 80 Hz low-pass, 350 ms swell) + a rising note per height step (pentatonic) | camera shake synced to the swell |
| Rift + flood | crack (white-noise click + 1.2 kHz ping, 40 ms) then a pour: filtered noise with LFO gurgle, length = flood-fill time | pour pans toward the ocean side |
| Goal ticks | rising two-note chime (triangle waves, a fifth apart) | each creature its own interval |
| Goal lost | falling minor third, softer than the tick | never harsh; failure stays light |
| Goat bleat | formant synth: sawtooth through two band-passes (700 Hz, 1.2 kHz) with fast vibrato, 300 ms | 3 random variants by pitch |
| Village crushed | wooden creak (resonant filter sweep on noise) + a small comic "boing" | the fail is a gag, not a punishment |
| Level complete | 4-bar pentatonic fanfare on marimba + pad swell; par star adds a sparkle arpeggio | |
| Music | per-biome loop, 70-90 bpm: marimba/kalimba pattern over a soft pad, pentatonic so move notes always fit | ZzFXM or hand-written sequencer; mute and volume in settings |

## Screens

Title → level select (the 20 islands as an archipelago map) → level (HUD: level name, moves / par, goal chips each with icon + short label + status badge ("Goat: on a peak", "Village: stays low", "Lighthouse: by the sea", "Buoy: open sea"; icons alone don't teach the rule, HUD critic T4), undo, restart, menu; until the first move the selected plate's rail and a "Drag a plate along its rail" hint show (T1); the phone layout keeps the counter and goal strip, clear of the drag (T5); concept `concepts/shiftland-level-hud.png`) → level complete → … → ending (the whole archipelago, all creatures happy). Settings: volume, reduced motion, colour-blind patterns on/off.

## Design questions (game-design-self-critique)

| Mechanic | Makes sense | Fun | Correct | Reach | Side effects |
|---|---|---|---|---|---|
| Plate slide on rails | Rails and end-stops are drawn; a plate that cannot move shakes and shows the blocked stop | Rails cut branching so the player can reason; the choice is which plate and in which order | Same rules in game and solver (one shared module, unit-tested) | Every plate's full travel is reachable within its stops | Moving carries every creature on the plate; previews show that |
| Uplift | Collision is visible at the seam; height grows with each push | Mountains are permanent until moved again, so order matters | Cap 3 shown by a snowcap; extra pushes still take the cell | | Lifts villages too (crush = fail); preview warns in red |
| Rift and flooding | Water always enters from the visible ocean; lakes look different | Opening water can help one goal and hurt another: the core tension | Flood fill shared with the solver | Far-off flooding is shown in the preview | Lighthouses and buoys re-check after every move |
| Par and stars | Par is shown from the start | Optional mastery for players who want it | Par = solver minimum; tested per level | | Never blocks progress |
| Undo / restart | Buttons always visible | Removes fear of experimenting | Undo restores the exact state, including creatures | | Move counter goes back too |
| Drag preview (Nov 3, `controller.ts`) | The drag shows the result of every stop it asks for; letting go commits, Esc drops it | Players can test a move with no cost, not even an undo | A cancelled drag stays dead until release; undo, restart and level change drop a pending preview; exact half cells ask for nothing | A drag past the last legal stop previews the legal stops and strains once per push | Each committed stop is one move against par, the same as an arrow key |
| Unlocking and Enter (Nov 3, `progress.ts`) | Tutorials open in order; then two unsolved levels are open, and Enter goes to the next unsolved one | One hard puzzle never ends a run | Saved per level name; malformed saves are dropped per record; blocked storage keeps progress for the session | Every level is reachable with at most one puzzle skipped at a time | The ending fires once, when the last level is solved (also after undo and re-solve); replays go on in order |
| Pinned plate, the anchor rock (Nov 4, `Level.pinned`) | It has no rail and refuses every drag; other plates visibly bite into it | It removes the easy answer: the rock cannot step aside, so the player chooses who comes to it and from where, and a bite taken from it is new water | `shift` refuses it in every direction, `railMoves` never offers it, other plates still take its cells at max + 1 | First met in Anchor Rock (par 1), where the old push is the dead end; a plate can only reach it within its own ±2 travel | Fewer moves to search; the audit's "plate kept" floor stops a rock being eaten to a sliver in any intended solution |
| Ice (Nov 4, `State.ice`, `MoveDiff.melt`) | A pale cell that rides its plate like terrain; lifted to height 2 it melts, and the preview lists it in `melt` and `flood` | It flips the verb: a push that would raise land here makes water, so a mountain-building move can open a channel | Melts in `shift` after the stack check, refused if a creature stands on it (S6), part of `stateKey`; goal order is unchanged. A goat on ice could never be happy (ice cannot reach its height), so `shapeProblems` rejects one | Thin Ice teaches it with par 1; only cells below height 2 may start as ice | Melted water joins the normal sea or lake fill, so one melt can change a lighthouse, a buoy or an oasis far away; the preview's `flood` covers that |
| Penguin (Nov 4, `Kind 'penguin'`) | Stands on a floe and wants the floe to touch the sea; a lake does not count, the edge of the grid does (the same as a lighthouse) | The opposite of a goat: lifting is the danger, and Step Aside turns the refused push into the puzzle | Goal = on an ice cell next to sea; the goal list keeps its order (objects in reading order, then buoys) | Thin Ice (par 1), then Step Aside and Bite the Rock | It locks the ice under it: pushes that would melt that cell are refused, so a player meets a blocked move here that the stuck check never calls a dead end |
| Lost-village shortcut (Nov 4, `rules.ts`) | "No way back" appears as soon as a village stands on a peak | The warning arrives right after the mistake instead of after a search | Heights only rise, so a village at height 2+ can never be happy again; `solve` and `canFinish` drop such states | Every level with a village | The search proves more dead ends inside its 200k cap (Breakwater's push hit the cap before) |

## Grey-box (2026-11-03)

`spikes/plates/play.html` (open from disk; rebuild with the command at the top of `play.ts`) is a top-down playable test of the rules with 14 levels (the 6 tutorial levels from `tutorial.ts`, then 8 audited generated puzzles at par 3-4, re-exported after the S2/S4/S8 changes). Click or Tab to select a plate, arrows to slide, Shift + arrow to preview, Z undo, R restart, H solver hint.

Checked headless (Playwright): every level solved at par through the real key handling, no console errors. Screens: `D:\Work\_local\evidence\2026-11-03-gameoff-plates\` (warm-up 1, puzzle 5 with preview, puzzle 5 solved).

What it taught:
- A full ghost overlay of the next state is hard to read (creatures appear twice, everything tints). The real preview should draw only the **difference**: rising columns, new water, creatures whose goal flips (with a tick or cross). (Done in the grey-box: Shift + arrow now marks rising cells with their new height, new water with a hatch, and goal flips with +/− badges; screens `greybox-diff-preview-l3.png` and `-l4.png` in the evidence folder.)
- Generated solutions often let one plate eat most of another (puzzle 5: the orange plate shrinks to a third). It reads as conquest, not shaping; the level filter should also cap how much of any one plate is consumed, or hand-made levels should avoid it. (Done: the audit requires every plate to keep ≥ 50% of its cells, `minPlateKept`.)
- Rails that run off the island into the ocean read well: the plate visibly has room to move.
- Plate ids in hints ("P1E") are meaningless to players; the real hint highlights the plate and arrow.

## Design audit 2026-11-03 (fresh-eyes reviewer, S1-S12)

| Id | Finding | Answer |
|---|---|---|
| S1 major | The rail looks reversible but is not (moving back takes cells again) | Fixed in design: rail of move steps with the ghost of the taken land; L6 teaches "land remembers" (Controls, Level progression) |
| S2 major | L4 is filler (no single move ticks both goals); L5 Dip and Return is the least readable "aha" | Fixed: new L4 Two Wishes (par 1, one solution) and L5 Far One First (par 2, one solution) built in `tutorial.ts` (6/6 as designed); Dip and Return moves to L7. Grey-box re-exported: 14/14 levels solved at par through the real keys, no console errors |
| S3 major | Stuck states are silent | Fixed: exhaustive `canFinish` check after every move, "no way back from here" + glowing undo only on a proven dead end (Controls); in the grey-box and in `game/src/rules`, with tests for a real dead end and a far-but-solvable state |
| S4 major | Creatures change plates and stack on one cell (23 of 28 par solutions moved a creature across plates, 5 stacked) | Fixed in the rules: stacking pushes are blocked (`plates.ts` `shift`, fixture in `selfCheck`); crossing plates by being taken stays, it is the "rides the mover" rule and is shown in the preview. Seed-191 regression replaced by seed 25 (191's trap was a stacking move). Level set re-exported: 13/13 solved at par in the grey-box |
| S5 major | L6-L8 beats contradicted the rules | Fixed: beats rewritten against the rules (L8 uses lighthouse + buoy, villages never drown), village goal labelled "not crushed", and every beat becomes a solver fixture before its level is built. The suggested "pasture wants land" goal is not added: one more goal type costs art, sound and a tutorial beat for little new tension |
| S6 major | Ice melting deleted creatures and their goals, so a level could be won by melting | Fixed in `twists.ts`: a melt under a creature is blocked, `goals()` throws if a goal disappears, `selfCheck` covers it; survey rerun |
| S7 major | Scope | Cut order recorded: Tundra first, then the archipelago map (falls back to a numbered grid), then the synthesized bleat (falls back to a chime), then swipe (tap-tap stays). Each cut is decided at the Nov 21 playtest |
| S8 minor | The lighthouse often starts already happy | Fixed: the audit rejects a level where a goat, lighthouse or buoy goal starts met (`plates.ts` `audit`, "a goal starts met"); villages start happy by design |
| S9 minor | The generator cannot reach par 6 | Answered: finale levels are hand-built from generator candidates and checked at depth 8 (Level progression) |
| S10 minor | Uplift art does not match the rules | Answered: the build draws one column per taken cell (Look and sound) |
| S11 minor | `render` hid heights under creatures | Fixed: every land cell prints plate + height, then the creature letter |
| S12 minor | The kill gate on plain boxes needs the preview and the crush reaction | Fixed in PLAN: Nov 6 includes the diff preview and a basic crush reaction (houses tilt) so G2 judges the "aha", not the boxes |

## Scope decision and open player questions (2026-11-03)

Scope, decided under Victor's "you handle the rest": **ship target 12 levels** (Meadow 1-6, Coast 7-9, Desert 10-11, one Finale level), **stretch 15** (Tundra 12-13 and a second Finale level, built only if the Nov 21 playtest is green and the content phase is on schedule). Reasons: Tundra is the weakest twist in the survey (42 of 150 solvable, 24 tight, vs Desert 43 and 35) and adds two rules (pinned, ice) plus two creatures' worth of art and sound; Desert's lake-vs-sea tension is the strongest twist and stays. The archipelago map is drawn for 15 islands either way; with 12, the Tundra islands are left out of the chain.

Questions the build cannot answer by itself, each with the check that answers it:

| # | Question | Why it matters | Answered by |
|---|---|---|---|
| Q1 | Does "the creature now rides the mover" read when a plate takes a creature's cell? | 23 of 28 par solutions use it; if players miss it, puzzles feel random | G2: Victor's notes on L3/L5; the preview outlines a creature that changes plate in the mover's band colour |
| Q2 | Is "land remembers" (moving back raises, never restores) interesting or frustrating? | The rail looks reversible (S1); undo is the escape | G2/G3: does Victor reach L7 Dip and Return without asking how it works; undo presses noted |
| Q3 | Does the "no way back" warning help or spoil? | It leaks information (a dead end) but stops silent frustration | G3: if it reads as a spoiler, it moves behind a setting ("tell me when I'm stuck", on by default) |
| Q4 | Do par stars pull players into retries? | Stars are the only replay reason in a 20-30 min game | G3: does Victor retry any level for its star unprompted |
| Q5 | Are heights readable in the 3D diorama at the default camera, on a laptop and a phone? | The grey-box is top-down with numbers; the real game is isometric | Nov 6 screenshot of L5 and L7 at 1280×720 and 390×844, critic pass; heights must read without hovering |
| Q6 | Is one move per drag the right grain, or should a drag carry a plate several steps? | Fewer inputs vs exact step-by-step reasoning and par counting | G2: Victor's notes; default is one step per rail stop, a long drag commits several steps that count as several moves |

## Content budget

20 levels × ~1-2 min = 25-40 min for a full play; the first 5 levels (~5 min) get the most polish because that is what most raters see.
