import { describe, expect, it } from 'vitest';
import { stepDistance, stepToward, tileToWorld } from './MovementMath';

describe('MovementMath', () => {
  it('converts tile coordinates to centered world coordinates', () => {
    expect(tileToWorld({ tileX: 0, tileY: 0 })).toEqual({ x: 8, y: 8 });
    expect(tileToWorld({ tileX: 5, tileY: 3 })).toEqual({ x: 88, y: 56 });
  });

  it('computes step distance from speed and delta time', () => {
    expect(stepDistance(32, 1000)).toBeCloseTo(32);
    expect(stepDistance(32, 250)).toBeCloseTo(8);
  });

  it('snaps to target when step exceeds remaining distance', () => {
    const result = stepToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 10);
    expect(result.arrived).toBe(true);
    expect(result.position).toEqual({ x: 3, y: 4 });
    expect(result.distanceRemaining).toBe(0);
  });

  it('moves proportionally toward target when step is smaller', () => {
    const result = stepToward({ x: 0, y: 0 }, { x: 3, y: 4 }, 2);
    expect(result.arrived).toBe(false);
    expect(result.position.x).toBeCloseTo(1.2);
    expect(result.position.y).toBeCloseTo(1.6);
    expect(result.distanceRemaining).toBeCloseTo(3);
  });

  it('returns arrived when current equals target', () => {
    const result = stepToward({ x: 7, y: 9 }, { x: 7, y: 9 }, 1);
    expect(result.arrived).toBe(true);
    expect(result.position).toEqual({ x: 7, y: 9 });
    expect(result.distanceRemaining).toBe(0);
  });
});
