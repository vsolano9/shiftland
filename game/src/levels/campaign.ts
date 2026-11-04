// The shipped campaign in play order: Meadow (levels/tutorial.ts), Coast, Desert, Tundra, Finale. Every level is drawn by
// hand or hand-picked from a search, and states one idea, one trap and one aha that `npm run levels:audit` proves against
// the rules (solver/fixtures.ts). A biome's first levels are tutorials that teach its twist; the rest are puzzles.
// `levels.json` is built from this list by `npm run levels:export`; the table in docs/design-plates.md comes from `cli.ts table`.
import { TUTORIAL, type Spec } from './tutorial.ts';

const COAST: Spec[] = [
  {
    name: 'The Long Pier', biome: 'coast', teaches: 'a plate can slide out over open water: its front reclaims the sea and its back leaves water, in one move', axis: '---', expectPar: 1,
    blurb: 'Land can slide out to sea. Lighthouses want a coast.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 ~  ~  ~  ~
      ~  a0 a0 a0 b0* ~  ~  ~
      ~  a0 a0 b0L b0 b0 b0 ~
      ~  ~  c0 c0 c0 c0 ~  ~
      ~  ~  ~  c0 c0 ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E', trap: { move: 'P0W', finish: 2, why: 'a rift gives the lighthouse its coast, but the buoy is still on land' },
      aha: { move: 'P1E', says: 'the pier slides out to sea: the lamp leaves the land behind and the buoy floats where the pier stood', shows: ['reclaims', 'ticks2'] } },
  },
  {
    name: 'Dip and Return', biome: 'coast', role: 'puzzle', teaches: 'dip the shore, then send the other plate in and back: the high cell meets the lighthouse, not the village', axis: '|-', expectPar: 3,
    blurb: 'The island is never quite where it was.',
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
    name: 'Wind-Up', biome: 'coast', role: 'puzzle', teaches: 'swing back to hit harder: a plate that bites one neighbour carries that height into the other', axis: '|--', expectPar: 3,
    blurb: 'A plate carries what it took.',
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
    blurb: 'You cannot climb the sea.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 ~  b0 ~  ~
      ~  a0 a0 a1 b0 b0 b0 ~
      ~  ~  c0 a0L b0* b0 b0 ~
      ~  c0 c0 c1G c0 b0 ~  ~
      ~  ~  c0 c0 ~  ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0N P1W P2N P1E', trap: { move: 'P2S', finish: 6, why: 'pulling c away shows the lighthouse sea at once, and carries the goat away from every seam' },
      aha: { move: 'P1E', says: 'the tide goes out: b carries the lighthouse clear, sea for the lamp and sea under the buoy together', shows: ['returns', 'ticks2'] } },
  },
];

const DESERT: Spec[] = [
  {
    name: 'Still Water', biome: 'desert', teaches: 'water the sea cannot reach is a lake: an oasis wants a lake, not the ocean', axis: '|-', expectPar: 1,
    blurb: 'An oasis wants still water: a lake the sea cannot reach.',
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
    blurb: 'A rift is sea until a cap seals it. Corners never leak.',
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
    name: 'Two Waters', biome: 'desert', role: 'puzzle', teaches: 'lake or sea is decided by what walls it: make one hole of each, side by side', axis: '|--', expectPar: 3,
    blurb: 'One pond, one open sea. They may touch only at a corner.',
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
    blurb: 'A pond needs walls on all four sides. Count them.',
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
    blurb: 'The rock never moves. Bring the land to it.',
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
    name: 'Thin Ice', biome: 'tundra', teaches: 'ice lifted to a peak melts into water: a penguin wants a floe touching the sea', axis: '-|', expectPar: 1,
    blurb: 'Lifted ice melts. A penguin wants a floe by the sea.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 b1i b0 b0 ~
      ~  a0 a0 a0 b1i b0iP b0 ~
      ~  ~  a0 a0 b1i b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0E', trap: { move: 'P1S', finish: 3, why: 'sliding the floe only moves it inside its own plate: no water opens until the ice wall goes' },
      aha: { move: 'P0E', says: 'push the ice wall up: it melts along its whole length, and the penguin looks out on a channel open to the sea', shows: ['melts'] } },
  },
  {
    name: 'Step Aside', biome: 'tundra', role: 'puzzle', teaches: 'a move that would melt ice under a creature is refused: walk the refusals back, clear the floe a place to go, and it steps off the seam', axis: '-|-', expectPar: 3,
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
    name: 'Ice Dam', biome: 'tundra', role: 'puzzle', pinned: 'a', teaches: 'a pond is not the sea: crack the ice dam from outside, and first take the village aboard so the same push cannot break it', axis: '|-|', expectPar: 3,
    blurb: 'A penguin wants the sea. A pond will not do.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  ~  ~  c0 c0 ~  ~  ~
      ~  c0 c0 c0 c0 a0 ~  ~  ~
      ~  ~  b1 a0V a0 a0 a0 a0 ~
      ~  b0 b0 a0 a0 a0iP a0 a0 ~
      ~  ~  b0 a1i ~  ~  a0 a0 ~
      ~  b0 b0* ~  a0 a0 a0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2S P1E P1E', trap: { move: 'P1E', finish: 'dead', why: 'the dam cracks and the penguin sees the sea, but the same push slams the high ground into the village on the rock' },
      aha: { move: 'P2S', says: 'c comes down onto the rock and takes the village aboard: the push from the west now finds no one standing in its row', shows: ['quiet', 'hitsrock'] } },
  },
];

const FINALE: Spec[] = [
  {
    name: 'Give and Take', biome: 'finale', role: 'puzzle', pinned: 'd', teaches: 'open a pond, fill it, open it again: what one plate shuts, another can bite back out', axis: '--||', expectPar: 6,
    blurb: 'Every creature, one island. Nothing stays won.',
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
    blurb: 'Six wishes. Five is the easy part.',
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
