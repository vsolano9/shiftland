import { describe, expect, it } from 'vitest';
import { dragStops } from './drag';

describe('dragStops', () => {
  it('asks for a stop only strictly past the snap threshold (exact half cells are not a stop)', () => {
    expect(dragStops(1, 0.3, 0)).toBeNull();
    expect(dragStops(1, 0.5, 0)).toBeNull();
    expect(dragStops(1, -0.5, 0)).toBeNull();
    expect(dragStops(0, 0, 0.5)).toBeNull();
    expect(dragStops(0, 0, -0.5)).toBeNull();
    expect(dragStops(1, 0.6, 0)).toEqual({ dir: 1, n: 1 });
    expect(dragStops(1, -0.6, 0)).toEqual({ dir: 3, n: 1 });
    expect(dragStops(0, 0, 0.6)).toEqual({ dir: 2, n: 1 });
    expect(dragStops(0, 0, -0.6)).toEqual({ dir: 0, n: 1 });
  });
  it('counts stops along a long drag', () => {
    expect(dragStops(1, 1.5, 0)).toEqual({ dir: 1, n: 1 });
    expect(dragStops(1, 1.51, 0)).toEqual({ dir: 1, n: 2 });
    expect(dragStops(1, -2.4, 0)).toEqual({ dir: 3, n: 2 });
  });
  it('ignores movement across the rail (a sloppy diagonal on touch still slides along it)', () => {
    expect(dragStops(1, 0.2, 3)).toBeNull();
    expect(dragStops(1, 0.7, -0.9)).toEqual({ dir: 1, n: 1 });
    expect(dragStops(0, 5, 0.1)).toBeNull();
  });
});
