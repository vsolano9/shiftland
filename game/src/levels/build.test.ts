import { describe, expect, it } from 'vitest';
import { buildLevels } from './build';
import { parse, TUTORIAL } from './tutorial';
import spike from '../../../spikes/plates/levels.json';
import shipped from './levels.json';

describe('level build (ported from the spike exporter)', () => {
  const built = buildLevels();
  it('reproduces the spike export exactly (parity before the spike is retired)', () => {
    expect(built).toEqual(spike);
  });
  it('src/levels/levels.json is current (rerun `npm run levels:export` after changing levels)', () => {
    expect(shipped).toEqual(built);
  });
  it('rejects a map with an unknown object letter', () => {
    expect(() => parse({ ...TUTORIAL[0], map: '~ ~\n~ a0X' })).toThrow(/unknown object/);
  });
});
