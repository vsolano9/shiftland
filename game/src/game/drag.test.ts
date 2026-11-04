import { describe, expect, it } from 'vitest';
import { dragStops } from './drag';

describe('dragStops', () => {
  it('asks for a stop only strictly past the snap threshold (exactly on it is not a stop)', () => {
    expect(dragStops(1, 0.3, 0)).toBeNull();
    expect(dragStops(1, 0.35, 0)).toBeNull();
    expect(dragStops(1, -0.35, 0)).toBeNull();
    expect(dragStops(0, 0, 0.35)).toBeNull();
    expect(dragStops(0, 0, -0.35)).toBeNull();
    expect(dragStops(1, 0.6, 0)).toEqual({ dir: 1, n: 1 });
    expect(dragStops(1, -0.6, 0)).toEqual({ dir: 3, n: 1 });
    expect(dragStops(0, 0, 0.6)).toEqual({ dir: 2, n: 1 });
    expect(dragStops(0, 0, -0.6)).toEqual({ dir: 0, n: 1 });
  });
  it('a long drag still asks for one stop', () => {
    expect(dragStops(1, 1.36, 0)).toEqual({ dir: 1, n: 1 });
    expect(dragStops(1, -2.3, 0)).toEqual({ dir: 3, n: 1 });
  });
  it('ignores movement across the rail (a sloppy diagonal on touch still slides along it)', () => {
    expect(dragStops(1, 0.2, 3)).toBeNull();
    expect(dragStops(1, 0.7, -0.9)).toEqual({ dir: 1, n: 1 });
    expect(dragStops(0, 5, 0.1)).toBeNull();
  });
});
