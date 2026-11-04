// The shipped campaign in play order: Meadow (levels/tutorial.ts), Coast, Desert, Tundra, Finale. Every level is drawn by
// hand or hand-picked from a search, and states one idea, one trap and one aha that `npm run levels:audit` proves against
// the rules (solver/fixtures.ts). A biome's first levels are tutorials that teach its twist; the rest are puzzles.
// `levels.json` is built from this list by `npm run levels:export`; the table in docs/design-plates.md comes from `cli.ts table`.
import { TUTORIAL, type Spec } from './tutorial.ts';

const COAST: Spec[] = [
  {
    name: 'The Long Pier', biome: 'coast', teaches: 'a plate can slide out over open water: its front reclaims the sea and its back leaves water, in one move', axis: '---', expectPar: 1,
    blurb: 'Land can slide out over the sea; lighthouses want a coast.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 ~  ~  ~  ~
      ~  a0 a0 a0 b0* ~  ~  ~
      ~  ~  b0 b0L b0 b0 b0 ~
      ~  ~  c0 c0 c0 c0 ~  ~
      ~  ~  ~  c0 c0 ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E', trap: { move: 'P0W', finish: 2, why: 'a rift gives the lighthouse its coast, but the buoy is still on land' },
      aha: { move: 'P1E', says: 'the pier slides out to sea: the lamp leaves the land behind and the buoy floats where the pier stood', shows: ['reclaims', 'ticks2'] } },
  },
  {
    name: 'Harbour Row', biome: 'coast', role: 'puzzle', teaches: 'dip the shore, then send the other plate in and back: the high cell meets the lighthouse, not the village', axis: '|-', expectPar: 3,
    blurb: 'A lighthouse stands at any height if it touches the sea.',
    // Mirrored east to west (phone playtest): raised land hid something on 6 of the 26 boards within three moves; now on 1.
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  b0 ~  b0 a1G a0 ~  ~
      ~  b0 b0 b0 a0L a0 a0 ~
      ~  ~  b0 b1 a0V a0 a0 ~
      ~  b0 b0 b0 a0 a0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0S P1E P1W', trap: { move: 'P1E', finish: 'dead', why: "b's high cell runs straight into the village row and breaks it" },
      aha: { move: 'P0S', says: 'slide the shore down first: the high cell then meets the lighthouse, and the village slips past on flat ground', shows: ['quiet'] } },
  },
  {
    name: 'The Cut', biome: 'coast', role: 'puzzle', teaches: 'a bite can be a whole channel, and the wake of another plate opens its door: a has to leave before c can bite a straight line out of b, or the same push breaks the village on a', axis: '---', expectPar: 3,
    blurb: 'Water touching only a corner does not count.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  c0 b0 b1 b0 b0 ~
      ~  ~  c0 b0* b0 b1 b0 ~
      ~  c0 c0 b0 b0 b0 b0 ~
      ~  c0 c0 b1 b0L b0 b1 ~
      ~  ~  c1V a1 a0 a0 a0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0E P2E P2W', trap: { move: 'P2E', finish: 'dead', why: 'the bite and retreat everyone knows by now, straight away: but a is still standing at the end of the row, and the same push lifts the village onto its high cell' },
      aha: { move: 'P2W', says: 'c comes home with a whole column of b, and the channel it leaves runs from the north shore to the gap a left: buoy and lighthouse see the sea at once', shows: ['returns', 'carries', 'ticks2'] } },
  },
  {
    name: 'Salt Point', biome: 'coast', role: 'puzzle', teaches: 'swing back to hit harder: a plate that bites one neighbour carries that height into the other', axis: '|--', expectPar: 3,
    blurb: 'A raised edge stays raised, even out over the water.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 a0 ~  b0 ~
      ~  a0 a0L a0 c0 b0G b0 ~
      ~  a0 a0 ~  c0* b0 b0 ~
      ~  ~  ~  ~  c0 ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    // The gap beside the buoy is there for the finished picture: with land in it the first bite raised c's whole front, and the
    // wall it left stood between the camera and the buoy. Now only the goat's row climbs, and the buoy floats in plain sight.
    fixture: { intended: 'P2W P2E P2E', trap: { move: 'P2E', finish: 4, why: 'the straight push only raises the goat one step: the front of c is still flat' },
      aha: { move: 'P2E', says: 'go the wrong way first: biting a raises the cell of c that faces the goat, and swinging back carries that height across the water and into the goat', shows: ['returns'] } },
  },
  {
    name: 'Low Tide', biome: 'coast', role: 'puzzle', teaches: 'water has nothing to climb: a makes way, b comes in flat so the goat has land to hit, and when b goes back out the lamp and the buoy see the sea together', axis: '|-|', expectPar: 4,
    blurb: 'Land crossing water does not rise.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  a0 a0 ~  ~  b0 b0 ~
      ~  a0 a0 a0 ~  b0 ~  ~
      ~  a0 a0 a0L b0* b0 b0 ~
      ~  c0 c0 c1G c0 b0 b0 ~
      ~  ~  c0 c0 ~  ~  b0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0N P1W P2N P1E', trap: { move: 'P1E', finish: 6, why: 'two goals tick at once, but the goat still has nothing to climb: b has to come back past where it started, and then go out again' },
      aha: { move: 'P1E', says: 'the tide goes out: b slides away from the lamp, sea beside it and sea under the buoy together', shows: ['returns', 'ticks2'] } },
  },
];

const DESERT: Spec[] = [
  {
    name: 'Still Water', biome: 'desert', teaches: 'water the sea cannot reach is a lake: an oasis wants a lake, not the ocean', axis: '|-', expectPar: 1,
    blurb: 'An oasis wants a lake: water the sea cannot reach.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 a0 ~  ~
      ~  a0 a0 b0 b0 b0 ~
      ~  a0 a0O b0 ~  ~  ~
      ~  ~  a0 a0 a0 a0 ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E', trap: { move: 'P0S', finish: 3, why: 'pulling the desert apart spills open sea beside the oasis: it wants a closed pond' },
      aha: { move: 'P1E', says: 'the plug sails out and the hole it leaves is walled in: a lake', shows: ['lake'] } },
  },
  {
    name: 'Breakwater', biome: 'desert', teaches: 'open a rift, then cap its end: a channel to the sea becomes a lake, and the cap is the plate that carries the oasis to it', axis: '|--', expectPar: 2,
    blurb: "Close a rift's open end and its sea becomes a lake.",
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  c0 c0 c0O c1V b0 ~  ~
      ~  a0 a0 a0 ~  b0 ~  ~
      ~  ~  a0 a0 ~  a0 a0 ~
      ~  ~  a0 a0 a0 a0 a0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E P2E', trap: { move: 'P1W', finish: 'dead', why: 'pushing b in instead of pulling it away leaves no water at all and lifts the village onto a peak' },
      aha: { move: 'P2E', says: 'c slides east with the oasis aboard and its end stops the mouth of the rift: the sea is shut out, and the pond lies right under the palms', shows: ['seals'] } },
  },
  {
    name: 'Oxbow', biome: 'desert', role: 'puzzle', teaches: 'the first level to ask for both waters: one rift, cut in two by a stub of land, is sea at one end and a lake at the other', axis: '--|', expectPar: 3,
    blurb: 'A strip of land can keep a lake and the sea apart.',
    // Turned half way round (phone playtest): raised land hid something on 34 of the 152 boards within three moves; now on 3.
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  a0 a0 a0 c0 c0 c0 ~
      ~  a0 a0O c0 c0* c0 c0 ~
      ~  a0 a0 c0 b0 b0 ~  ~
      ~  ~  a0 b0 b0 ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0W P2N P1W', trap: { move: 'P2N', finish: 4, why: "the buoy floats at once, but c has bitten a's north shore too soon: a's slide would now open the rift at both ends, and one cap cannot close both" },
      aha: { move: 'P1W', says: 'b slides over the open end: the west half of the rift is shut in as a lake, and the stub of c keeps the east half open to the sea', shows: ['seals'] } },
  },
  {
    name: 'Twin Palms', biome: 'desert', role: 'puzzle', teaches: 'give up a tick to get two: the plate that spoils the first pond also carries both oases off, and each leaves a pond of its own in the wake', axis: '|-|', expectPar: 3,
    blurb: 'What a plate bites, it can carry off.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  a0 a0 a0 a0 a0 a0 ~
      ~  a0 c0 c0 a0 b0O b0 ~
      ~  c0O c0 c0 c0 b0L b0 ~
      ~  c0 c0 c0 c0 c0 b0 ~
      ~  ~  ~  c0 c0 c0 b0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E P0S P0N', trap: { move: 'P0N', finish: 5, why: 'a backs off and the first oasis has a pond at once, but it took nothing with it: the second oasis is still on the shore, and the lamp still has no sea' },
      aha: { move: 'P0N', says: 'a comes down and spoils the good pond, then goes home with both oases aboard, and the cells it bit leave water behind: a pond beside each palm', shows: ['returns', 'carries', 'ticks2'] } },
  },
  {
    name: 'Two Waters', biome: 'desert', role: 'puzzle', teaches: 'lake or sea is decided by what walls it: make one hole of each, side by side', axis: '|--', expectPar: 3,
    blurb: 'Water joins edge to edge, so corners stay apart.',
    // Mirrored north to south (phone playtest): the finished buoy stood half behind the ridge. Pond and buoy now sit side by side
    // on the screen. The corner they share lies behind the tip of c, a trade: the two waters still read apart by colour, and the
    // way round that shows the corner leaves the buoy nearly half hidden.
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  b0 b0 ~  a0 ~  ~
      ~  b0 b0 b0 a0O a0 a0 ~
      ~  b0 b0 c0 c0* a0 a0 ~
      ~  ~  b0 ~  c0 a0 ~  ~
      ~  ~  b0 ~  c0 ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E P2E P0N', trap: { move: 'P0N', finish: 4, why: "the pond comes at once, right next to the buoy: open the buoy's water now and the two holes share an edge and join into sea" },
      aha: { move: 'P0N', says: 'last of all, a backs off and leaves a pocket walled on all four sides beside the oasis, its corner touching the open sea', shows: ['lake'] } },
  },
  {
    name: 'Backwater', biome: 'desert', role: 'puzzle', teaches: 'the bite and retreat works, and the chip says "that water reaches the sea": every hole it leaves is joined in a row, so c first feeds b a cell whose only job is to leave a hole of its own, one corner away from the sea', axis: '||-', expectPar: 3,
    blurb: 'A hole that touches the sea by an edge is the sea.',
    // The strip that reaches the sea lies east of the pond and one row nearer the camera, so the corner they share faces the player.
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  c0 c0 ~  b0 b0 ~  ~
      ~  c0 c0 b0 b0 b0 ~  ~
      ~  c0 c0 c0 b0 b0 b0 ~
      ~  ~  ~  a0 a0 a0O a0* ~
      ~  ~  ~  a0 a0 a0 a0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2E P1S P1N', trap: { move: 'P1S', finish: 6, why: 'the obvious bite: b comes home with the oasis and the buoy floats, but all three holes are one strip open to the east, and the chip says so; putting that right takes six moves in all' },
      aha: { move: 'P1N', says: 'the same retreat as ever, but a cell of it came from c: that cell leaves its own hole beside the oasis, walled on all four sides, and only its corner touches the strip that reaches the sea', shows: ['returns', 'carries', 'ticks2', 'lake'] } },
  },
  {
    name: 'Wishing Well', biome: 'desert', role: 'puzzle', teaches: 'one slide makes the oasis happy and the lamp sulk, the next flips them: the same water cannot be both, so the two need separate holes, and every tick has to be given back on the way there', axis: '-|', expectPar: 5,
    blurb: 'The same water cannot be both a lake and the sea.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  b0 b0 b0 b0 b0 ~  ~
      ~  b0 b0 b0 b0L b0 ~  ~
      ~  b0 b0 b0 a0O ~  ~  ~
      ~  b0 b0 a0* a0 ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0E P0E P1S P0W P1N', trap: { move: 'P1N', finish: 7, why: 'b backs off and oasis and lamp tick at once, but the buoy is still under a, and when a leaves the two goals share the water it opens' },
      aha: { move: 'P0W', says: 'a comes back onto the land b has just brought south: that cell is a\'s now, so when b goes home it cannot fill the water east of the lamp', shows: ['returns', 'lifts', 'unticks'] } },
  },
];

const TUNDRA: Spec[] = [
  {
    name: 'Thin Ice', biome: 'tundra', teaches: 'ice melts at height 2, not before: the first push only lifts the wall, the second carries it on and it melts right in front of the penguin riding behind it', axis: '-|', expectPar: 2,
    blurb: 'Ice raised to height 2 melts; penguins want ice by the sea.',
    // Playtest 4 half solved the old map by accident: b's slides cost nothing there, so random play fell into the answer 26% of
    // the time. Here they cost two moves each and it is 11%. The wall only lines up after the first push, which is the moment to see.
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~  ~
      ~  a0 a0 a0 b0i b0 b0 b0 ~
      ~  a0 a0 a0i b0 b0 b0 b0 ~
      ~  a0 a0iP a0 b0 b0i b0 b0 ~
      ~  a0 a0 a0 a0 b0 ~  b0 ~
      ~  ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0E P0E', trap: { move: 'P0W', finish: 4, why: 'a backs away from the wall: the water opens on the wrong side of it, nowhere near the penguin' },
      aha: { move: 'P0E', says: 'the first push lifts the wall to height 1 and it holds; the second carries it on, it melts, and the penguin looks out on a channel open to the sea', shows: ['melts'] } },
  },
  {
    name: 'Anchor Rock', biome: 'tundra', pinned: 'b', teaches: "a pinned plate cannot step aside: a's bite would carry its village into the rock's high cell, and the rock will not move, so c first takes the village off a and out of the row", axis: '-||', expectPar: 3,
    blurb: 'The rock never moves, but other plates can bite into it.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  c0 c0 c0 ~  b0 b0 ~
      ~  c0 ~  a0V b1 b0 ~  ~
      ~  c0 a0 a0 a0 b0 b0 ~
      ~  ~  a0 a0 b0* b0 b0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2S P0E P0W', trap: { move: 'P0E', finish: 'dead', why: 'the bite and retreat that has worked all game, and the rock cannot step aside as a meadow plate could: the village rides straight into its high cell and breaks' },
      aha: { move: 'P2S', says: 'c comes down and takes the village off a: now a has nothing in that row to hit the rock with, and its next bite takes the land over the buoy and breaks nothing', shows: ['quiet'] } },
  },
  {
    name: 'Cold Feet', biome: 'tundra', role: 'puzzle', teaches: 'a move that would melt ice under a creature is refused: walk the refusals back, clear the floe a place to go, and it steps off the seam', axis: '-|-', expectPar: 3,
    blurb: 'A push that would melt ice under a penguin will not go.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 ~  b0 ~  ~
      ~  a0 a0 a0 b1G b0 b0 ~
      ~  a0 a0 a0 b1iP b0 b0 ~
      ~  ~  a0 c0 c0 b0 ~  ~
      ~  ~  ~  c0 c0 ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2W P1S P0E', trap: { move: 'P0W', finish: 5, why: 'a backs off and the penguin sees the sea at once, but the goat still needs that push and the floe still stands in its way' },
      aha: { move: 'P1S', says: 'with c out of the way the floe steps south, off the seam: the push that was refused now finds only the goat', shows: ['quiet'] } },
  },
  {
    name: 'Thaw', biome: 'tundra', role: 'puzzle', teaches: 'land crossing water does not rise, so ice crossing water does not melt: back the shore off so the floe crosses cold while the cell beside it climbs, melts and opens the sea', axis: '--|', expectPar: 3,
    blurb: 'Ice melts only when it climbs, never when it crosses water.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 b0 b0 ~  ~  ~
      ~  ~  a1 a0 b0 b1 b0 ~
      ~  a0 a0 a0i a0i b0G b0 ~
      ~  ~  c0 c0iP c0 c0 ~  ~
      ~  ~  c0 c0 c0 ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0W P2N P2N', trap: { move: 'P2S', finish: 5, why: 'c backs away and the penguin sees the sea at once, but the goat needs c pushing north, twice' },
      aha: { move: 'P0W', says: "a backs off first and leaves open water in the floe's path: the second push carries the penguin across cold, while the ice beside it hits land and melts", shows: ['quiet'] } },
  },
  {
    name: 'Frost Line', biome: 'tundra', role: 'puzzle', pinned: 'a', teaches: 'every creature on one rock: the easy retreat ticks two and strands the rest; take the village out of the row, swing b all the way across, then bring it home', axis: '|-|', expectPar: 5,
    blurb: 'A penguin wants the sea; a pond will not do.',
    // Mirrored north to south (playtest 4): the village stood right over the buoy.
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~  ~
      ~  a0 a0 a1 a0 a0 a0 ~  ~
      ~  ~  b0 b0 c0V c0 a0 a0 ~
      ~  b0 b0 b0 b0* c0iP a0i ~  ~
      ~  b0 b0 b0 b0 c0 a0 a0 ~
      ~  ~  b0 b0 b0G a0 a0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2N P1E P1E P1W P1W', trap: { move: 'P1W', finish: 7, why: 'two goals tick at once, but b has walked away from the rock: the goat needs it to go the other way, twice' },
      aha: { move: 'P2N', says: 'c comes up and takes the village out of the row: only now can b swing all the way across the rock without breaking it', shows: ['quiet'] } },
  },
];

const FINALE: Spec[] = [
  {
    name: 'Mirage', biome: 'finale', role: 'puzzle', teaches: 'a lake needs a lid: land slid over the end of a rift seals it, and if that land covers the buoy, a bite carries it off', axis: '---', expectPar: 4,
    blurb: 'A lake needs land on all four sides; count them.',
    // Turned half way round (playtest 4 and the phone playtest): the solved buoy sat behind the cliff, then the oasis, so the cliff
    // came down a step as well. It moved here from the Desert, where it was a spike the next three islands fell away from: it is
    // harder than anything before the Finale, and it opens the Finale well.
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  b0 ~  a0 ~  c0 c0 ~
      ~  ~  b0 a0 a0 a0* c0 ~  ~
      ~  b0 b0L a0O a0 a0 c0 c0 ~
      ~  b0 b0 b0 a0 a0 c0 c0 ~
      ~  ~  b0 b0 c1V c0 c0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1W P2W P0E P0W', trap: { move: 'P0E', finish: 'dead', why: 'two goals tick at once, but a bit too soon: the land over the buoy is still its own, and no way on clears that spot and keeps the rest' },
      aha: { move: 'P0W', says: 'the bite comes home: the land over the buoy rides off with it, and the oasis slides back beside the sealed pond', shows: ['returns', 'carries', 'ticks2', 'seals'] } },
  },
  {
    name: 'High Water', biome: 'finale', role: 'puzzle', pinned: 'b', teaches: 'the coast and desert come back after the tundra: d must go south, north and south again, and a has to bite it in between so the third trip leaves the buoy clear', axis: '---|', expectPar: 5,
    blurb: 'Bitten land leaves with the plate that bit it.',
    // Turned half way round (playtest 4): the solved buoy sat behind land.
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  d0 d0 d0 a1G a0 a0 ~
      ~  ~  d0 d0O d0 a0 ~  ~
      ~  ~  d0 d0L b0* b0 b0 ~
      ~  c0 c0 c0V c0 b0 b0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2W P3S P3N P0W P3S', trap: { move: 'P3N', finish: 7, why: 'the goat and the lighthouse tick at once, but the goat now stands on d, and d is the plate that has to go south past the buoy' },
      aha: { move: 'P0W', says: 'a bites the cell of d that would cover the buoy on the way south again: bitten land stays with a, so the next trip leaves the buoy afloat and walls in the pond', shows: ['lifts'] } },
  },
  {
    name: 'Give and Take', biome: 'finale', role: 'puzzle', pinned: 'd', teaches: 'open a pond, fill it, open it again: what one plate shuts, another can bite back out', axis: '--||', expectPar: 6,
    blurb: 'A plate can bite back land it lost.',
    // Mirrored north to south (phone playtest): plate a stood behind the raised land on the solved board.
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  c0 c0 d0 d0 ~  ~
      ~  c0 c0 c0 d0L d0 d0 ~
      ~  c1G c1 a0 d0iP d0 b1i ~
      ~  a1V a0 a0 b0 b0 b0* ~
      ~  a0 a0 a0 b0 b0 ~  ~
      ~  ~  a0 a0 a0O b0 b0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0W P1W P0E P0W P2S P2S', trap: { move: 'P1W', finish: 7, why: 'two goals tick at once, but b swallows the oasis along with the edge of a: let a back off first and b slides in over open water' },
      aha: { move: 'P0E', says: 'b has filled the pond, so a bites the land that filled it: when a pulls back the pond is open again, and b never moves', shows: ['quiet'] } },
  },
  {
    name: 'The Summit', biome: 'finale', role: 'puzzle', pinned: 'd', teaches: 'the easy slide ticks four and strands the goat: a has to go out to the rock for it, lose its tail to b, and come all the way home, giving goals back, so the same slide ticks the last three at once', axis: '-||-', expectPar: 7,
    blurb: 'The easy slide is right; it just has to come last.',
    // Mirrored north to south (phone playtest): on the way home the rock and its goat stood behind a's raised land, on 11 of the
    // 53 boards within three moves. This way round the rock is at the front, and none of them hides anything.
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  ~  c0 c0 c0 ~  ~
      ~  ~  c0 c1L ~  c0 c0 ~
      ~  ~  ~  a0O a0 ~  ~  ~
      ~  d0 d0G a0 a0V a0 a0* ~
      ~  d0 d0 b0iP b0 b0 ~  ~
      ~  ~  d0 b0 b0 b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0W P0W P1N P1S P0E P0E P0E', trap: { move: 'P0E', finish: 9, why: "four goals tick at once, and this is the level's last move: but a has backed away from the only land that can lift the goat, and its tail still sits on the buoy" },
      aha: { move: 'P1N', says: 'while a is out at the rock, b comes up on its tail and carries it off: now a comes home short, the buoy stays afloat, and the easy slide is right at last', shows: ['lifts'] } },
  },
];

export const CAMPAIGN: Spec[] = [...TUTORIAL, ...COAST, ...DESERT, ...TUNDRA, ...FINALE];
