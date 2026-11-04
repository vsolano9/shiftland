// The shipped campaign in play order: Meadow (levels/tutorial.ts), Coast, Desert, Tundra, Finale. Every level is drawn by
// hand or hand-picked from a search, and states one idea, one trap and one aha that `npm run levels:audit` proves against
// the rules (solver/fixtures.ts). A biome's first levels are tutorials that teach its twist; the rest are puzzles.
// `levels.json` is built from this list by `npm run levels:export`; the table in docs/design-plates.md comes from `cli.ts table`.
import { TUTORIAL, type Spec } from './tutorial.ts';

const COAST: Spec[] = [
  {
    name: 'The Long Pier', biome: 'coast', teaches: 'a plate can slide out over open water: land reclaims the sea and leaves room behind it', axis: '--|', expectPar: 1,
    blurb: 'Land can slide out to sea. Lighthouses want a coast.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  ~  c0 ~  ~  ~
      ~  a0 a0 c0L b0 b0 ~
      ~  a0 a0 c0 b0 b0 ~
      ~  ~  a0 c0* b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2N', trap: { move: 'P0W', finish: 2, why: 'a rift gives the lighthouse its coast, but the buoy is still on land' },
      aha: { move: 'P2N', says: 'the pier slides out to sea: the lamp gets its coast and the buoy floats behind it', shows: ['reclaims', 'ticks2'] } },
  },
  {
    name: 'Wind-Up', biome: 'coast', role: 'puzzle', teaches: 'swing back to hit harder: a plate that bites one neighbour carries that height into the other', axis: '|--', expectPar: 3,
    blurb: 'A plate carries what it took. Swing back and hit.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 c0 ~  ~  ~
      ~  a0 a0L a0 c0 b0G b0 ~
      ~  a0 a0 a0 c0 b0 b0 ~
      ~  ~  a0 a0 c0* b0 b0 ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2W P2E P2E', trap: { move: 'P2E', finish: 5, why: 'the straight push only raises the goat one step: the front of c is still flat' },
      aha: { move: 'P2E', says: 'go the wrong way first: biting a raises the whole front of c, and swinging back carries that height across the water and into the goat', shows: ['returns'] } },
  },
  {
    name: 'Dip and Return', biome: 'coast', role: 'puzzle', teaches: 'away and back is not nothing: dip a plate so the high cell meets the lighthouse, not the village', axis: '|-', expectPar: 3,
    blurb: 'Dip, push, pull back. The island is not where it was.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a1G b0 b0 b0 ~
      ~  a0 a0 a0L b0 b0 b0 ~
      ~  a0 a0 a0V b1 b0 ~  ~
      ~  ~  a0 a0 b0 b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0S P1W P1E', trap: { move: 'P1W', finish: 'dead', why: "b's high cell runs straight into the village row and breaks it" },
      aha: { move: 'P0S', says: 'slide the shore down first: the high cell then meets the lighthouse, and the village slips past on flat ground', shows: ['quiet'] } },
  },
  {
    name: 'Low Tide', biome: 'coast', role: 'puzzle', teaches: 'a plate carries what it takes: b comes in, takes the village aboard out of harm, and goes back out with it', axis: '|-|', expectPar: 4,
    blurb: 'What comes in goes out again, carrying what it took.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 a0 b0 ~  ~
      ~  a0 a0 a1 b0 b0 b0 ~
      ~  c0 c0 a0L b0* b0 b0 ~
      ~  c0 c0 c1G c0V b0 ~  ~
      ~  ~  c0 c0 ~  ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0N P1W P2N P1E', trap: { move: 'P2S', finish: 6, why: 'pulling c away shows the lighthouse sea at once, and carries the goat and the village away from every seam' },
      aha: { move: 'P1E', says: 'the tide goes out: b carries the lighthouse and the village clear, sea for the lamp and sea under the buoy together', shows: ['returns', 'ticks2'] } },
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
      ~  a0 a0O b0 b0 ~  ~
      ~  ~  a0 a0 a0 ~  ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E', trap: { move: 'P0S', finish: 3, why: 'pulling the desert apart spills open sea beside the oasis: it wants a closed pond' },
      aha: { move: 'P1E', says: 'the plug sails out and the hole it leaves is walled in: a lake', shows: ['lake'] } },
  },
  {
    name: 'The Door', biome: 'desert', teaches: 'close a bay and it becomes a lake: one slide shuts the sea out on one side and lets it in on the other', axis: '-|', expectPar: 1,
    blurb: 'Close a bay and it turns into a lake.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 a0 a0 ~  ~
      ~  a0 a0O ~  ~  ~  ~  ~
      ~  a0 a0 a0 a0 b0 ~  ~
      ~  ~  a0 a0 a0 b0* ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1N', trap: { move: 'P0E', finish: 'dead', why: 'pushing the land east swallows the door and the bay stays open to the sea for good' },
      aha: { move: 'P1N', says: 'the door slides shut across the bay, and sea opens under the buoy behind it', shows: ['seals', 'ticks2'] } },
  },
  {
    name: 'Breakwater', biome: 'desert', teaches: 'open a rift, then cap its end: a channel to the sea becomes a lake', axis: '|--', expectPar: 2,
    blurb: 'A rift is sea until something caps its end.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  c0 c0 ~  ~  ~  ~
      ~  a0 a0 a0O b0 b0 b0 ~
      ~  a0 a0 a1V b0 b0 ~  ~
      ~  ~  a0 a0 a0 a0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1E P2E', trap: { move: 'P1W', finish: 'dead', why: 'pushing b in instead of pulling it away leaves no water at all and lifts the village onto a peak' },
      aha: { move: 'P2E', says: 'the little breakwater slides over the end of the rift and the sea is shut out', shows: ['seals'] } },
  },
  {
    name: 'Two Waters', biome: 'desert', role: 'puzzle', teaches: 'lake or sea is decided by what walls it: make one hole of each', axis: '|--', expectPar: 3,
    blurb: 'One pond, one open sea. Do not let them meet.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 b0 b0 ~  ~
      ~  a0 a0 a0O b0 b0 b0 ~
      ~  a0 a0 c0* c0 b0 b0 ~
      ~  ~  a0 c0 c0 b0 ~  ~
      ~  ~  ~  c0 ~  ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P1W P2W P0N', trap: { move: 'P0N', finish: 4, why: "the pond comes at once, right above the buoy: open the buoy's water now and the two holes join into sea" },
      aha: { move: 'P0N', says: 'last of all, a backs off and leaves a pocket walled on all four sides beside the oasis', shows: ['lake'] } },
  },
];

const TUNDRA: Spec[] = [
  {
    name: 'Anchor Rock', biome: 'tundra', pinned: 'b', teaches: 'a pinned plate never moves: bring the land to it and choose the side that misses the village', axis: '--|', expectPar: 1,
    blurb: 'The rock never moves. Bring the land to it.',
    map: `
      ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 c0 c0 ~  ~
      ~  a0 a0 b1G b0 b0 ~
      ~  a0 a0 b1V b0 ~  ~
      ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2S', trap: { move: 'P0E', finish: 'dead', why: 'the rock cannot step aside as a meadow plate could: the push breaks the village' },
      aha: { move: 'P2S', says: 'come at the rock from above: the goat rises and the village never feels it', shows: ['hitsrock', 'lifts'] } },
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
    fixture: { intended: 'P0E', trap: { move: 'P1S', finish: 3, why: 'sliding the floe around finds no water: the sea is behind the ice wall' },
      aha: { move: 'P0E', says: 'push the ice wall up: it melts and the penguin is looking at the sea', shows: ['melts'] } },
  },
  {
    name: 'Step Aside', biome: 'tundra', role: 'puzzle', teaches: 'a move that would melt ice under a creature is refused: slide the ice out of the way, then the floe can cross', axis: '|--', expectPar: 3,
    blurb: 'A push that melts the floe under a penguin will not go.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 b0 b0 ~  ~
      ~  a0 a0 a1i b0 b0 b0 ~
      ~  a0 a0 a1i b1iP b0 b0 ~
      ~  ~  a0 c0 c0 b0G ~  ~
      ~  ~  ~  c0 c0 ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P0N P1W P2E', trap: { move: 'P1E', finish: 4, why: 'b backs off and the penguin sees the sea at once, but the goat sails away from the seam that would lift it' },
      aha: { move: 'P0N', says: "b's push is refused while high ice stands in the floe's path: slide a north and the path is open water", shows: ['quiet'] } },
  },
  {
    name: 'Bite the Rock', biome: 'tundra', role: 'puzzle', pinned: 'b', teaches: 'the rock will not move, but a plate can bite it and pull back: the bite is new sea', axis: '-|-', expectPar: 4,
    blurb: 'The rock will not move. You can still take a bite.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 b1i b0 ~  ~
      ~  a0 a0 a0 b0i b0iP b0 ~
      ~  a0 a0 a0 b0 b0 b0 ~
      ~  ~  a0* c1V c1i b0 ~  ~
      ~  ~  ~  c0 c0 ~  ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2E P0E P0W P0W', trap: { move: 'P0E', finish: 'dead', why: 'the bite is right, but the village still stands in the way and a lifts it past bearing' },
      aha: { move: 'P0E', says: 'bite the rock: the ice wall melts at the seam and a takes the rock cells with it when it pulls back', shows: ['hitsrock', 'melts'] } },
  },
];

const FINALE: Spec[] = [
  {
    name: 'Give and Take', biome: 'finale', role: 'puzzle', pinned: 'd', teaches: 'two bites: each plate pushes in and pulls back, and what it stole is what the next plate hits', axis: '|---', expectPar: 5,
    blurb: 'Every creature, one island. Take a little, give it back.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 a0 b0G b0 ~
      ~  a0 a0 a0O b0 b0 b0 ~
      ~  a0 a0 a0 b0iP b0 b0 ~
      ~  c0 c1i a0 d0 d0 b0 ~
      ~  c0 c0 c0 d0L d0 d0 ~
      ~  ~  c0 c0* d0V d0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2W P0S P0N P1W P1E', trap: { move: 'P1E', finish: 7, why: 'the goal it ticks is free, but b backs away from the height it will need' },
      aha: { move: 'P0N', says: "a dips into b and comes back with a raised cell: that stolen height is what b's goat climbs next", shows: ['returns'] } },
  },
  {
    name: 'The Summit', biome: 'finale', role: 'puzzle', pinned: 'd', teaches: 'build the tower first: b drives over a dipped shore twice, then a rides its goat up the tower it left', axis: '|--|', expectPar: 6,
    blurb: 'Six wishes. Build the mountain before you need it.',
    map: `
      ~  ~  ~  ~  ~  ~  ~  ~
      ~  ~  a0 a0 a0 b1 b0 ~
      ~  a0O a0 a0 b0 b0 b0 ~
      ~  a0 a0 a0G b0i b0 b0V ~
      ~  c0 c0L a0* d0 d0 b0 ~
      ~  c0 c0 c1iP d0 d1 d0 ~
      ~  ~  c0 c0 d0 d0 ~  ~
      ~  ~  ~  ~  ~  ~  ~  ~`,
    fixture: { intended: 'P2W P0S P1W P1W P0N P0N', trap: { move: 'P0N', finish: 8, why: 'the goat heads north at once, but the tower it needs does not exist yet' },
      aha: { move: 'P0S', says: 'give up what you just won: the dip takes the goat down beside the rock and clears the way for b to pile up its tower', shows: ['unticks'] } },
  },
];

export const CAMPAIGN: Spec[] = [...TUTORIAL, ...COAST, ...DESERT, ...TUNDRA, ...FINALE];
