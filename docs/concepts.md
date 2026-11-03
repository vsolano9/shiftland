# SHIFT: concepts

Goal: one browser game, 10-20 minutes of content, where SHIFT is the verb the player performs (the pattern every 2025 top-5 game followed), with art and audio made in code (see `research.md`, AI position).

## Scoring

Each raw idea scored 1-5 on: **Theme** (shift is the mechanic, ideally with a second meaning), **Hook** (fun understood in 10 s), **Depth** (15 min without repeating), **Build** (fits ~3 weeks of agent work with code-made art and audio; 5 = easiest), **Fresh** (away from the cliché list), **Look** (can look striking with procedural art).

| # | Idea | Shift as | Theme | Hook | Depth | Build | Fresh | Look | Sum |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Stagehand**: shift scenery live during a play, on cue, while it goes wrong | scene shift (theatre) | 5 | 5 | 3 | 2 | 5 | 4 | **24** |
| 2 | **Plates**: drag tectonic plates; collisions raise mountains, rifts flood with sea; satisfy goals | tectonic shift | 5 | 4 | 4 | 4 | 4 | 5 | **26** |
| 3 | **Handover**: run a 24 h diner in three shifts; earlier shifts replay as ghosts you must cooperate with | shift work, shift change | 5 | 3 | 5 | 2 | 3 | 3 | **21** |
| 4 | **Redshift**: your speed shifts every colour; only gates matching your shifted colour are open | Doppler shift | 4 | 4 | 2 | 4 | 2 | 5 | **21** |
| 17 | **Changeover** (review N1): turn-based Stagehand; slide flats in grooves during a blackout, then watch the scene | scene shift | 5 | 4 | 4 | 3 | 5 | 4 | **25** |
| 18 | **Dayshift** (review N2): drag the sun; shadows sweep a toy town | shifting the hour | 4 | 4 | 4 | 3 | 3 | 5 | **23** |

Scores for 1, 3, 4 were corrected after the review (D4). Hook and the first five minutes matter most, since raters play ~5 minutes (D3).
| 5 | You Are the Wind: push dunes to guide a caravan; sand shifts and buries or uncovers | shifting sands | 4 | 3 | 3 | 2 | 4 | 4 | 20 |
| 6 | Cargo Shift: lash cargo on a deck in a storm; waves shift the load | load shift | 3 | 4 | 3 | 3 | 3 | 3 | 19 |
| 7 | Shifting Goalposts: minigolf where the hole moves by rules you learn | idiom + literal | 4 | 4 | 3 | 4 | 3 | 3 | 21 |
| 8 | Graveyard Shift: night-shift anomaly spotting ("did something shift?") | night shift + things shifted | 4 | 4 | 3 | 3 | 1 | 2 | 17 |
| 9 | Downshift: one-button gear shifting downhill racer | gear shift | 3 | 4 | 2 | 4 | 2 | 3 | 18 |
| 10 | Turncoat: tactics where flanked enemies shift allegiance | allegiance shift | 3 | 3 | 4 | 2 | 3 | 2 | 17 |
| 11 | Register: data puzzles on shift registers / bit shifts | bit shift | 3 | 2 | 4 | 4 | 4 | 2 | 19 |
| 12 | Conveyor tactics: the arena's rows shift each turn; push enemies into hazards | board shift | 4 | 3 | 5 | 2 | 3 | 3 | 20 |
| 13 | Tilt-shift: move the focus band to reveal what's real in a miniature town | tilt-shift | 3 | 2 | 2 | 3 | 5 | 4 | 19 |
| 14 | Light/dark world swap platformer | dimension shift | 2 | 4 | 3 | 4 | 1 | 3 | 17 |
| 15 | Gravity-flip platformer | gravity shift | 2 | 4 | 3 | 4 | 1 | 3 | 17 |
| 16 | Shapeshifter with animal forms | shapeshift | 2 | 3 | 3 | 2 | 1 | 2 | 13 |

Cut: 8, 14, 15, 16 are the clichés most entrants will pick. 9, 13 are too thin for 15 minutes. 5 (sand sim) and 12 (tactics) are good but over budget for one month with polish. 6 and 7 are fine, but weaker on theme than the top four.

## Shortlist

### 1. Stagehand (scene shift)

**Pitch.** A toy-theatre play is running live. You are the only stagehand. Cues fire ("CUE 14: SHIFT TO CASTLE"); you drag flats into grooves, fly trees up on ropes, swap props, aim the spotlight and drop the curtain before the actors walk into the wrong scene. Miss a cue and the play goes wrong in front of the audience: the knight duels a palm tree, the princess delivers her balcony speech from a beach. The applause meter is your health.

**Core loop.** Read the cue card → find the pieces in the wings → place them before the timer runs out → actors play the scene → next cue. Acts get busier: overlapping cues, a director who rewrites the script mid-act ("the play is now a western!"), a sabotaging understudy, an actor who improvises off-script.

**Content.** Three short plays × 3 acts (a fairy tale, a space opera, a western), ~2-3 min per act, plus a "closing night" final with all three mixed. 10 acts ≈ 25 min.

**Look and sound.** Paper/cardboard toy theatre: flat painted cutouts on sticks, felt curtains, footlights. All made in code: extruded flat shapes with canvas-drawn faces and painted patterns, a spotlight cone. Audio: a synthesised pit-orchestra theme that shifts genre with the play, wood clunks, rope creaks, crowd claps (filtered noise bursts), boos.

**Why it can win.** Funny, readable, fresh (no clichés), the theme is literally the job, and comedy gets comments. Innovation and Theme are its strong categories.

**Risks.** Real-time drag-and-drop must feel great with a mouse and on touch; difficulty tuning (too easy is boring, too hard feels unfair); characters and gags need real writing; procedurally-made crowd laughter is hard (we use claps, cheers, boos instead of laughter).

| Question | Answer |
|---|---|
| Makes sense | Every cue names pieces that are visible in the wings, each with its label. A placed flat clicks into its groove and the actors react to it. |
| Fun | Choices: which cue first when two overlap, where to park pieces in the wings for later. The timer exists because the play doesn't stop; it is shown. |
| Correct | The applause meter only drops when the audience can see the mistake (curtain open). Pieces not on stage can't be "wrong". |
| Reach | All pieces needed for an act are in the wings from the act's start (no hidden pieces). |
| Side effects | A rewrite cue invalidates pending cues; they visibly tear off the cue board so the player knows they're void. |

### 2. Plates (tectonic shift)

**Pitch.** A small floating island is cut into tectonic plates. Drag a plate one step: where it pushes into a neighbour, the ground rises into mountains; where it pulls away, a rift opens and the sea floods in; where it slides past, a fault line cracks the land. Little goal flags want things: goats want peaks, fish want sea, villages want to stay dry and connected, a lighthouse wants coast. Satisfy them all in a limited number of shifts.

**Core loop.** Read the goals → plan → shift a plate → watch the land change (the satisfying part: columns rising, water pouring in) → undo freely → solve. 24-30 levels across 4 biomes (meadow, desert, tundra, volcanic), each adding one rule: a plate pinned by a volcano, ice that melts into sea, plates that are stuck together, a village that moves with its plate.

**Look and sound.** Isometric diorama of chunky columns, plate tints, animated uplift with dust, water shader, clouds below the island. Calm synthesised ambient music per biome, deep rumbles on shifts, water pouring, goat bleats from simple synthesis.

**Why it can win.** It is the closest match to what places (2025 #2 "Where the Water Flows": sea level as level design). A puzzle is the easiest kind of game to make solid: a **solver** (BFS over shift sequences) proves every level solvable, finds the minimum move count, and flags levels with trivial or accidental solutions. Graphics can look excellent procedurally.

**Risks.** Rules must be readable without text (convergent = up, divergent = water); puzzles can feel dry without personality (the goal creatures carry it); level design taste: 25 good levels is real work, mitigated by the solver.

| Question | Answer |
|---|---|
| Makes sense | Each plate has a visible handle and tint; preview arrows show what a shift will raise or flood before you commit. Goal flags show their want as an icon and turn gold when met. |
| Fun | Each move is a real choice because mountains are permanent until another collision moves them; order matters. Move limit = solver minimum + slack, shown, and undo is free. |
| Correct | Water fills only from the sea edge (flood fill); a rift landlocked by mountains stays a dry canyon. Rules hold in every level, verified by the solver's unit tests. |
| Reach | Every level's goals are reachable; the solver proves it. |
| Side effects | Villages ride their plate; if a village is split by a rift it fails loudly (sad animation), not silently. |

### 3. Handover (shift change)

**Pitch.** Run a roadside diner for 24 hours as three workers on three 8-hour shifts. You play shift 1. Then you play shift 2 while shift 1's worker replays exactly what you did, as a ghost in the same diner. Then shift 3 with both ghosts. Your past selves are your coworkers: plan shift 1 knowing you'll need its help later.

**Core loop.** Take orders, cook, serve; the next shift inherits your mess and your ghost.

**Risks.** Hard to read in 10 seconds; the cooperate-with-your-recording idea is known (The Last Clockwinder, Cursor*10). Ghost replay plus customer sim is a big determinism and design effort. Characters are needed throughout.

### 4. Redshift (Doppler shift)

**Pitch.** Fly fast; your speed shifts every colour. Gates are solid unless their shifted colour matches the band you're seeing, so you throttle up to see blue and brake to see red. A one-more-run arcade score chaser.

**Risks.** Shallow after 5 minutes; reads as "colour-match runner" (a crowded genre); very close to Skyway Rally, so less learning and less novelty for us.

### 5. Changeover (scene shift, turn-based) — added after review

**Pitch.** Stagehand as a puzzle. Each level is one set change during a blackout of N moves. Painted flats ride front-to-back grooves and block each other (sliding-block logic), two fly lines can lift one flat each into the loft, wing space is limited, and anything inside the follow-spot circle is "seen". When the lights come up the actors play the scene you built: a correct set gets the scene and applause, a wrong one gets a short gag (the knight proposes to a cottage), so even failure is fun to watch.

**Why.** Keeps Stagehand's freshness, comedy and theme, drops real-time unfairness, and the same BFS solver tooling as Plates proves every level. Sliding-block puzzles are well understood (Rush Hour), so depth is low-risk; the theatre fiction and the curtain-up payoff are the new part.

**Risks.** Gags need writing and Victor's approval; cutout actors with canvas-drawn faces must look good in code (the mockup's illustrated faces are the hard part).

### 6. Dayshift (shift the hour) — added after review

**Pitch.** Drag the sun across a toy town's sky; grid-exact shadows sweep the streets. A sleepy vampire courier must walk home in shade while sunflowers want light. Strongest code-only look (real-time shadows), solver-checkable. Risk: shadow puzzles exist (with other verbs), and goals can conflict in confusing ways.

## Fresh-eyes review (Opus reviewer, 2026-11-03) and what changed

| Id | Finding | Response |
|---|---|---|
| D1 | Plates' grid rules were undefined (overlap, vacated cells, faults) | Fixed: rules defined and implemented in `spikes/plates/plates.ts` (below). Slide-past faults have no effect and are cut. Setting moves from a floating island to an island in the ocean, so flooding from the sea edge makes sense. |
| D2 | Real-time Stagehand is "obey the text fast"; unfair under time pressure | Accepted. Real-time Stagehand dropped; its idea lives on as Changeover (turn-based). |
| D3 | Scoring overweights depth; raters play ~5 min | Accepted. Content cut to 12-15 levels with 2-3 rule twists; the first 5 levels get the most polish. |
| D4 | Table scores too generous for Stagehand, Redshift, Handover | Accepted: Stagehand 24 (Depth 3, Build 2), Redshift 22 (Fresh 2, Hook 4; colour-blind hostile), Handover 21 (Build 2, Fresh 3). |
| D5 | BFS proves solvable, not interesting | Accepted. Level quality bar below; flood preview shows the actual water, not just arrows. |
| D6 | Public repo + itch page are public releases needing Victor's approval | Accepted. Approval asked in week 1 (PLAN.md, gate G0). |
| D7 | Doubtful facts in research.md | Fixed in research.md (UTC/CET label, submit-rate claim removed, 2023 winner flagged, "every top 5" softened, AI "code" tag flagged unverified). |

## Plates rules spike (evidence)

`node spikes/plates/plates.ts 300` (Node 24, ~30 s): rules self-check passes, then 300 random 7×7 levels (3 Voronoi plates, ocean ring, 1-2 goats, 0-2 villages, 0-1 lighthouse, 0-1 buoy) solved by BFS to depth 6.

Rules: a move shifts a whole plate one step; where it lands on another plate it keeps the cell and height becomes max+1 (cap 3), lifting whatever stands there; cells it leaves become open water; water connected to the edge is sea. Goals: goat on height ≥ 2, village on dry land height ≤ 1, lighthouse next to sea, buoy cell must be sea.

| Variant | Unsolvable ≤ 6 | Trivial (≤ 1 move) | Min 4-6 moves | Puzzle-grade (min ≥ 4, ≤ 4 shortest solutions) |
|---|---|---|---|---|
| Free movement (any direction) | 3 | 12 | 78 | 26 (9%) |
| One axis per plate, max 2 steps (rails) | 102 | 9 | 70 | **58 (19%)** |

Readings:
- **The rules have depth**: random layouts already give 4-6 move puzzles with a single shortest solution, e.g. seed 34 (min 4, unique: `P1E P1E P0W P0S`) and seed 13 (min 6, unique).
- **Rails are better**: one axis per plate, ±2 travel doubles the puzzle-grade share, cuts branching (more readable: each plate shows its rail), and stops plates wandering across the map. Unsolvable layouts are simply discarded by the generator.
- **Land loss**: a solution keeps a median 68% of the starting land (worst 20%). Fine for the fiction (the sea takes the rifts), but levels that drown most of the island read as destruction, not building; the level filter should prefer ≥ 60% kept.
- Generating, solving and filtering 300 levels takes ~30 s, so a curated generator + hand edits is a viable level pipeline.

### Level quality bar (from D5)

A level ships only if: min solution ≥ 3 moves (≥ 2 for the first 3 tutorial levels); at least one tempting wrong first move (a first move that makes a goal true but is off every shortest solution, so finishing after it costs more than par, or is impossible); order matters (the shortest solutions are not all permutations of one move set); ≥ 60% land kept; Victor finds an "aha" in playtest.

The bar is now implemented in the spike (`AUDIT=1 node spikes/plates/plates.ts 300`, add `AXIS=2` for rails). The automatic parts on 300 random levels:

| Variant | Solvable ≤ 6 | Pass the bar | By min moves | Main failure reasons |
|---|---|---|---|---|
| Rails (one axis, ±2) | 198 | **25 (8%)** | 3: 12, 4: 8, 5: 4, 6: 1 | no tempting wrong move 149, too short 73, order doesn't matter 55, land < 60% 35 |
| Free movement | 297 | **40 (13%)** | | no tempting wrong move 189, too short 129, order doesn't matter 108 |

So ~1 in 10 random layouts already passes every automatic check, before any hand design: 3,000 seeds give ~250 candidates to curate 12-15 levels from. The generator needs placement rules (goals near plate edges, a buoy where a rift can reach) to raise the pass rate, and the hardest levels (5-6 moves) will need hand design.

## Prior-art check (web search, 2026-11-03)

- **Plates:** no plate-shifting puzzle game found on itch.io. Nearest: [GeoJigsaw](https://frosty36.itch.io/geojigsaw) (educational drag-and-rotate plates), [Seismic Activity](https://halvardo13.itch.io/seismic-activity), [Tectonic Plates Game](https://raptorhra.itch.io/tectonic-game) (Unity HTML5, no description), and Terra Forma (GMTK 2024, raise mountains and dig canyons, no plates). xkcd made a joke "tectonics game" comic (2018-10-19). The verb is fresh.
- **Changeover / Stagehand:** several games use the "Stagehand" name ([afells](https://afells.itch.io/stagehand), [glhfgreg](https://glhfgreg.itch.io/stagehand), [ansa](https://ansa.itch.io/stage-hand)), so that name is out. [Coulisses](https://tlouel.itch.io/coulisses) is a stage-manager puzzle about reaching ropes; "Final Cue: Stage Puzzle" (STOVE, Dec 2025) is a stage-themed escape-room game, not a set-change puzzle. The sliding-flats-in-a-blackout verb was not found.

## Recommendation

**Plates, with a kill gate; Changeover as the fallback that shares its tooling.**

- **Plates** is the most likely to place well: the theme is the verb, the spike shows the rules make real puzzles, the solver gives provable level quality (which suits how we work), and the mockup shows a diorama that can be built entirely in code. Its weakness is personality; goal creatures (goats that cheer on peaks, a lighthouse that switches on at the coast) and the sound of land moving must carry it.
- **Kill gate (day 3 of the build):** a grey-box grid with the solver has 6 levels that meet the quality bar, and Victor finds at least one "aha" playing them. If not, switch to **Changeover**, which reuses the grid, undo, solver and level pipeline.
- **Not recommended:** real-time Stagehand (tuning risk with one playtester), Handover (fails the 5-minute test, over budget), Redshift (shallow, close to Skyway Rally, colour-blind hostile).
