# Plates: game design (draft for G1)

Working title **Plates** (name decided at G1). Draft written before Victor's pick so the build can start the day he picks it. If he picks Changeover, this file is archived and `design-changeover.md` is written from `concepts.md` §5.

## One line

A small island in the ocean is cut into tectonic plates. Slide a plate along its rail: where it pushes into a neighbour the land rises into mountains, where it pulls away a rift opens and the sea pours in. Make every creature on the island happy in as few shifts as you can.

## The first five minutes (what a rater sees)

1. Title: the island bobbing in the ocean, plates gently breathing; "Play" is the only button that matters.
2. Level 1 (one plate, one goat, one move): the goat looks at the neighbouring plate; the plate's rail arrow pulses. One drag: columns rise with a rumble, the goat hops onto the peak and bleats. Done in 10 seconds; the verb is learned without text.
3. Level 2: pulling a plate away opens a rift; the sea pours in and a buoy's fish jump. Water is learned.
4. Level 3: a village next to the rift: the obvious move drowns it (sad villagers, undo glows). The first "think first" moment.
5. Levels 4-5: two plates, goals that need an order. The first real "aha".

By minute 5 the rater has used every core rule, had one failure that was funny rather than punishing, and solved one real puzzle.

## Rules (as in `spikes/plates/plates.ts`)

- Square grid, an island inside an ocean ring. Every cell is either plate land (plate id, height 0-3) or water.
- A move slides one whole plate one cell along its rail (each plate has one axis, shown as a rail; travel limited to ±2 from its start, shown as rail end-stops).
- Convergent: where the moving plate lands on another plate's cell, it takes the cell and the height becomes max(both) + 1, capped at 3. Whatever stands there is lifted with it.
- Divergent: cells the plate leaves become water.
- Water joined to the ocean is **sea**; water enclosed by land is a **lake** (different colour; matters from the desert biome on).
- A plate may move into ocean-ring cells (reclaiming sea); it may not leave the map.
- Undo and restart are free and unlimited. Move count is shown against **par** (the solver's minimum); finishing at par earns a star. Stars are optional mastery, never a gate.

## Goal creatures

| Creature | Wants | Happy | Unhappy |
|---|---|---|---|
| Goat | stand on height ≥ 2 | hops to the peak, bleats | looks up at the hills, sighs |
| Village (3 houses) | dry land, height ≤ 1 | chimney smoke, warm windows | water next door: villagers on rooftops; crushed (height ≥ 2): houses tilt and crack (fail state, undo glows) |
| Lighthouse | land next to sea | beam switches on and sweeps | dark, keeper waves a lantern |
| Buoy (fixed in the world) | its cell is sea | fish jump around it | sits on dry land, flopping fish icon |
| Palm oasis (desert) | next to a lake (not sea) | palms sway, a camel drinks | wilts |
| Penguins (tundra) | on ice next to sea | slide into the water | huddle |

A level's goals list shows each creature's icon and a tick. All goals true at once = level complete.

## Biomes and twists (12-15 levels)

| Biome | Levels | New idea | Why it adds depth |
|---|---|---|---|
| Meadow | 1-4 | plates, uplift, rifts, goats, villages, buoys | the base verb |
| Coast | 5-7 | lighthouses (need coast) and ocean-ring reclaiming | moving land into the sea, not just splitting it |
| Desert | 8-10 | lakes vs sea (oasis wants a lake, buoys want sea) | the same rift must be closed off or opened to the ocean |
| Tundra | 11-13 | pinned plates (an anchor rock: cannot move, only be pushed into) and ice cells (melt to water when lifted to height ≥ 2) | reverses expectations of uplift |
| Finale | 14-15 | all of the above on a larger island | the payoff |

Each twist ships only if the solver and audit support it before levels are made with it.

## Controls

- Mouse: hover a plate to highlight it and show its rail; drag along the rail; while dragging, a **preview** shows the exact result (ghost columns rising, blue water fill including far-off flooding) before release. Release commits, Esc cancels.
- Keyboard: Tab / 1-9 cycles plates, arrow keys move along the rail, Z undo, R restart, Enter next level.
- Touch: tap a plate, then swipe along the rail; same preview while the finger is down.

## Feedback and feel

- Uplift: columns ease up over ~350 ms with a low rumble, small camera shake, dust puffs at the seam.
- Rift: a crack sound, the seam splits, the water front pours in from the nearest sea edge over ~500 ms (flood fill animated by distance).
- Goal ticks with a rising chime; the creature reacts; the last goal triggers the level-complete sequence (camera pull-back, all creatures celebrate, par star).
- Fail states are funny and soft: a drowned village floats its roofs; undo is one key.

## Look and sound

- Look: the `concepts/plates-mock.png` direction, but the island sits in an animated ocean (not over clouds), plate tints plus edge patterns (colour-blind safe), soft shadows, four biome palettes. All geometry and textures made in code.
- Sound: WebAudio synth only. A gentle marimba/pad loop per biome (pentatonic, so moves can add notes in key), SFX: rumble, crack, water pour, goat bleat (formant synth), chimes, UI clicks. Mute and volume in settings.

## Screens

Title → level select (the 15 islands as an archipelago map) → level (HUD: level name, moves / par, goals, undo, restart, menu) → level complete → … → ending (the whole archipelago, all creatures happy). Settings: volume, reduced motion, colour-blind patterns on/off.

## Design questions (game-design-self-critique)

| Mechanic | Makes sense | Fun | Correct | Reach | Side effects |
|---|---|---|---|---|---|
| Plate slide on rails | Rails and end-stops are drawn; a plate that cannot move shakes and shows the blocked stop | Rails cut branching so the player can reason; the choice is which plate and in which order | Same rules in game and solver (one shared module, unit-tested) | Every plate's full travel is reachable within its stops | Moving carries every creature on the plate; previews show that |
| Uplift | Collision is visible at the seam; height grows with each push | Mountains are permanent until moved again, so order matters | Cap 3 shown by a snowcap; extra pushes still take the cell | | Lifts villages too (crush = fail); preview warns in red |
| Rift and flooding | Water always enters from the visible ocean; lakes look different | Opening water can help one goal and hurt another: the core tension | Flood fill shared with the solver | Far-off flooding is shown in the preview | Lighthouses and buoys re-check after every move |
| Par and stars | Par is shown from the start | Optional mastery for players who want it | Par = solver minimum; tested per level | | Never blocks progress |
| Undo / restart | Buttons always visible | Removes fear of experimenting | Undo restores the exact state, including creatures | | Move counter goes back too |

## Grey-box (2026-11-03)

`spikes/plates/play.html` (open from disk; rebuild with the command at the top of `play.ts`) is a top-down playable test of the rules with 10 generated levels (2 warm-ups, 8 audited puzzles at par 3-4). Click or Tab to select a plate, arrows to slide, Shift + arrow to preview, Z undo, R restart, H solver hint.

Checked headless (Playwright): every level solved at par through the real key handling, no console errors. Screens: `D:\Work\_local\evidence\2026-11-03-gameoff-plates\` (warm-up 1, puzzle 5 with preview, puzzle 5 solved).

What it taught:
- A full ghost overlay of the next state is hard to read (creatures appear twice, everything tints). The real preview should draw only the **difference**: rising columns, new water, creatures whose goal flips (with a tick or cross).
- Generated solutions often let one plate eat most of another (puzzle 5: the orange plate shrinks to a third). It reads as conquest, not shaping; the level filter should also cap how much of any one plate is consumed, or hand-made levels should avoid it.
- Rails that run off the island into the ocean read well: the plate visibly has room to move.
- Plate ids in hints ("P1E") are meaningless to players; the real hint highlights the plate and arrow.

## Content budget

15 levels × ~1-2 min = 20-30 min for a full play; the first 5 levels (~5 min) get the most polish because that is what most raters see.
