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
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a1G b0 ~  b0 ~
      ~  a0 a0 a0L b0 b0 b0 ~
      ~  a0 a0 a0V b1 b0 ~  ~
      ~  ~  a0 a0 b0 b0 b0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0S P1W P1E', trap: { move: 'P1W', finish: 'dead', why: "b's high cell runs straight into the village row and breaks it" },
      aha: { move: 'P0S', says: 'slide the shore down first: the high cell then meets the lighthouse, and the village slips past on flat ground', shows: ['quiet'] } },
  },
  {
    name: 'Salt Point', biome: 'coast', role: 'puzzle', teaches: 'swing back to hit harder: a plate that bites one neighbour carries that height into the other', axis: '|--', expectPar: 3,
    blurb: 'A raised edge stays raised, even out over the water.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 ~  c0 ~  b0 ~
      ~  a0 a0L a0 c0 b0G b0 ~
      ~  a0 a0 a0 c0 b0 b0 ~
      ~  ~  a0 ~  c0* b0 b0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2W P2E P2E', trap: { move: 'P2E', finish: 5, why: 'the straight push only raises the goat one step: the front of c is still flat' },
      aha: { move: 'P2E', says: 'go the wrong way first: biting a raises the whole front of c, and swinging back carries that height across the water and into the goat', shows: ['returns'] } },
  },
  {
    name: 'Low Tide', biome: 'coast', role: 'puzzle', teaches: 'water has nothing to climb: b comes in so the goat can rise, then goes back out with the lighthouse aboard', axis: '|-|', expectPar: 4,
    blurb: 'Land crossing water does not rise.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 ~  b0 ~  ~
      ~  a0 a0 a1 ~  b0 b0 ~
      ~  ~  a0 a0L b0* b0 b0 ~
      ~  c0 c0 c1G c0 b0 ~  ~
      ~  ~  c0 c0 ~  ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0N P1W P2N P1E', trap: { move: 'P1E', finish: 6, why: 'two goals tick at once, but the goat still has nothing to climb: b has to come back past where it started, and then go out again' },
      aha: { move: 'P1E', says: 'the tide goes out: b carries the lighthouse clear, sea for the lamp and sea under the buoy together', shows: ['returns', 'ticks2'] } },
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
    name: 'Breakwater', biome: 'desert', teaches: 'open a rift, then cap its end: a channel to the sea becomes a lake; water joins edge to edge, so a corner does not leak', axis: '|--', expectPar: 2,
    blurb: "Close a rift's open end and its sea becomes a lake.",
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  c0 c0 ~  ~  ~  ~
      ~  a0 a0 a0O b0 b0 b0 ~
      ~  a0 a0 a1V b0 ~  ~  ~
      ~  ~  a0 a0 a0 a0 a0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E P2E', trap: { move: 'P1W', finish: 'dead', why: 'pushing b in instead of pulling it away leaves no water at all and lifts the village onto a peak' },
      aha: { move: 'P2E', says: 'the little breakwater slides over the end of the rift and the sea is shut out', shows: ['seals'] } },
  },
  {
    name: 'Oxbow', biome: 'desert', role: 'puzzle', teaches: 'the first level to ask for both waters: one rift, cut in two by a stub of land, is sea at one end and a lake at the other', axis: '--|', expectPar: 3,
    blurb: 'A strip of land can keep a lake and the sea apart.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  ~  b0 b0 ~  ~  ~
      ~  ~  b0 b0 c0 a0 a0 ~
      ~  c0 c0 c0* c0 a0O a0 ~
      ~  c0 c0 a0 a0 a0 a0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0E P2S P1E', trap: { move: 'P2S', finish: 4, why: "the buoy floats at once, but c has bitten a's south shore too soon: a now needs a detour before it can open water beside the oasis" },
      aha: { move: 'P1E', says: 'b slides over the open end: the east half of the rift is shut in as a lake, and the stub of c keeps the west half open to the sea', shows: ['seals'] } },
  },
  {
    name: 'Two Waters', biome: 'desert', role: 'puzzle', teaches: 'lake or sea is decided by what walls it: make one hole of each, side by side', axis: '|--', expectPar: 3,
    blurb: 'Water joins edge to edge, so corners stay apart.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  b0 ~  c0 ~  ~  ~
      ~  ~  b0 ~  c0 a0 ~  ~
      ~  b0 b0 c0 c0* a0 a0 ~
      ~  b0 b0 b0 a0O a0 a0 ~
      ~  ~  b0 b0 ~  a0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E P2E P0S', trap: { move: 'P0S', finish: 4, why: "the pond comes at once, right next to the buoy: open the buoy's water now and the two holes share an edge and join into sea" },
      aha: { move: 'P0S', says: 'last of all, a backs off and leaves a pocket walled on all four sides beside the oasis, its corner touching the open sea', shows: ['lake'] } },
  },
  {
    name: 'Mirage', biome: 'desert', role: 'puzzle', teaches: 'a lake needs a lid: land slid over the end of a rift seals it, and if that land covers the buoy, a bite carries it off', axis: '---', expectPar: 4,
    blurb: 'A lake needs land on all four sides; count them.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 a1V b0 b0 ~  ~
      ~  a0 a0 c0 c0 b0 b0 b0 ~
      ~  a0 a0 c1 c0 c0O b0L b0 ~
      ~  ~  a0 c0* c0 c0 b0 ~  ~
      ~  a0 a0 ~  c0 ~  b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E P0E P2W P2E', trap: { move: 'P2W', finish: 'dead', why: 'two goals tick at once, but c bit too soon: the land over the buoy is still its own, and no way on clears that spot and keeps the rest' },
      aha: { move: 'P2E', says: 'the bite comes home: the land over the buoy rides off with it, and the oasis slides back beside the sealed pond', shows: ['returns', 'ticks2', 'seals'] } },
  },
];

const TUNDRA: Spec[] = [
  {
    name: 'Anchor Rock', biome: 'tundra', pinned: 'b', teaches: 'a pinned plate never moves: the slide that saved this village in the meadow is gone, so bring land to the rock from the other side', axis: '-||', expectPar: 2,
    blurb: 'The rock never moves, but other plates can bite into it.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 c0 c0 ~  ~
      ~  a0 a0 ~  ~  ~  ~
      ~  ~  a0 b1G b0 b0 ~
      ~  a0 a0 b1V b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2S P2S', trap: { move: 'P0E', finish: 'dead', why: 'the rock cannot step aside as a meadow plate could: the push breaks the village' },
      aha: { move: 'P2S', says: 'bring the land to the rock: c crosses the bay and comes down on the goat, and the village never feels it', shows: ['reclaims'] } },
  },
  {
    name: 'Thin Ice', biome: 'tundra', teaches: 'ice melts at height 2, not before: the first push only lifts the wall, the second carries it on and it melts one cell short of the penguin', axis: '-|', expectPar: 2,
    blurb: 'Ice raised to height 2 melts; penguins want ice by the sea.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 b0i b0 b0 b0 ~
      ~  a0 a0 a0 b0i b0 b0iP b0 ~
      ~  a0 a0 a0 b0i b0 b0 b0 ~
      ~  ~  a0 ~  ~  b0 b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0E P0E', trap: { move: 'P0W', finish: 4, why: 'a backs away from the wall: the water opens on the wrong side of it, nowhere near the penguin' },
      aha: { move: 'P0E', says: 'the first push lifts the wall to height 1 and it holds; the second carries it on, it melts, and the penguin looks out on a channel open to the sea', shows: ['melts'] } },
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
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  b0 b0 b0G a0 a0 ~  ~
      ~  b0 b0 b0 b0 c0 a0 a0 ~
      ~  b0 b0 b0 b0* c0iP a0i ~  ~
      ~  ~  b0 b0 c0V c0 a0 a0 ~
      ~  a0 a0 a1 a0 a0 a0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2S P1E P1E P1W P1W', trap: { move: 'P1W', finish: 7, why: 'two goals tick at once, but b has walked away from the rock: the goat needs it to go the other way, twice' },
      aha: { move: 'P2S', says: 'c comes down and takes the village out of the row: only now can b swing all the way across the rock without breaking it', shows: ['quiet'] } },
  },
];

const FINALE: Spec[] = [
  {
    name: 'High Water', biome: 'finale', role: 'puzzle', pinned: 'b', teaches: 'the coast and desert come back after the tundra: d must go north, south and north again, and a has to bite it in between so the third trip leaves the buoy clear', axis: '---|', expectPar: 5,
    blurb: 'Bitten land leaves with the plate that bit it.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  b0 b0 c0 c0V c0 c0 ~
      ~  b0 b0 b0* d0L d0 ~  ~
      ~  ~  a0 d0 d0O d0 ~  ~
      ~  a0 a0 a1G d0 d0 d0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2E P3N P3S P0E P3N', trap: { move: 'P3S', finish: 7, why: 'the goat and the lighthouse tick at once, but the goat now stands on d, and d is the plate that has to go north past the buoy' },
      aha: { move: 'P0E', says: 'a bites the cell of d that would cover the buoy on the way north again: bitten land stays with a, so the next trip leaves the buoy afloat and walls in the pond', shows: ['lifts'] } },
  },
  {
    name: 'Give and Take', biome: 'finale', role: 'puzzle', pinned: 'd', teaches: 'open a pond, fill it, open it again: what one plate shuts, another can bite back out', axis: '--||', expectPar: 6,
    blurb: 'A plate can bite back land it lost.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 a0O b0 b0 ~
      ~  a0 a0 a0 b0 b0 ~  ~
      ~  a1V a0 a0 b0 b0 b0* ~
      ~  c1G c1 a0 d0iP d0 b1i ~
      ~  c0 c0 c0 d0L d0 d0 ~
      ~  ~  c0 c0 d0 d0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0W P1W P0E P0W P2N P2N', trap: { move: 'P1W', finish: 7, why: 'two goals tick at once, but b swallows the oasis along with the edge of a: let a back off first and b slides in over open water' },
      aha: { move: 'P0E', says: 'b has filled the pond, so a bites the land that filled it: when a pulls back the pond is open again, and b never moves', shows: ['quiet'] } },
  },
  {
    name: 'The Summit', biome: 'finale', role: 'puzzle', pinned: 'd', teaches: 'five of six come in two moves: the sixth means giving two back, and then one slide ticks the last pair at once', axis: '||--', expectPar: 6,
    blurb: 'All six must hold at the same moment.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  c0 c0 c1 b0G ~  ~
      ~  c0 c0 c0 c0V b0 b0 ~
      ~  a0 c0L c0 b0O b0 ~  ~
      ~  a0 a0 a1i d0 b1iP b0 ~
      ~  ~  a0 a0 d0 d0 ~  ~
      ~  a0 a0* ~  d0 ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0N P2E P0N P2W P2W P1N', trap: { move: 'P2W', finish: 7, why: 'two goals tick at once, but the goat is left behind on b: c has to come all the way back for it' },
      aha: { move: 'P2W', says: 'five of six are met and the slide for the last would break the village: give them up, and c carries the goat and the village home out of its path', shows: ['unticks', 'returns'] } },
  },
];

export const CAMPAIGN: Spec[] = [...TUTORIAL, ...COAST, ...DESERT, ...TUNDRA, ...FINALE];
