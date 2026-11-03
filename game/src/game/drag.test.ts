import { describe, expect, it } from 'vitest';
import { consumeStep, dragStep } from './drag';

describe('dragStep', () => {
  it('waits for the snap threshold along the rail', () => {
    expect(dragStep(1, 0.3, 0)).toBeNull();
    expect(dragStep(1, 0.6, 0)).toBe(1);   // E
    expect(dragStep(1, -0.6, 0)).toBe(3);  // W
    expect(dragStep(0, 0, 0.6)).toBe(2);   // S
    expect(dragStep(0, 0, -0.6)).toBe(0);  // N
  });
  it('ignores movement across the rail (a sloppy diagonal on touch still slides along it)', () => {
    expect(dragStep(1, 0.2, 3)).toBeNull();
    expect(dragStep(1, 0.7, -0.9)).toBe(1);
    expect(dragStep(0, 5, 0.1)).toBeNull();
  });
  it('a long drag commits one stop at a time', () => {
    let [dx, dy] = [2.2, 0]; const steps: number[] = [];
    for (let d = dragStep(1, dx, dy); d !== null; d = dragStep(1, dx, dy)) { steps.push(d); [dx, dy] = consumeStep(d, dx, dy); }
    expect(steps).toEqual([1, 1]);
    expect(dx).toBeCloseTo(0.2);
  });
});
