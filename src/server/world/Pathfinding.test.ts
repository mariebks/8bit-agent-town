import { describe, expect, test } from 'vitest';
import { NavGrid } from './NavGrid';
import { Pathfinding } from './Pathfinding';

describe('Pathfinding', () => {
  test('finds valid route on open grid', () => {
    const pathfinder = new Pathfinding(
      new NavGrid([
        [true, true, true],
        [true, true, true],
        [true, true, true],
      ]),
    );

    const path = pathfinder.findPath({ tileX: 0, tileY: 0 }, { tileX: 2, tileY: 1 });
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual({ tileX: 2, tileY: 1 });
  });

  test('returns null for unreachable targets', () => {
    const pathfinder = new Pathfinding(
      new NavGrid([
        [true, false, true],
        [false, false, false],
        [true, false, true],
      ]),
    );

    const path = pathfinder.findPath({ tileX: 0, tileY: 0 }, { tileX: 2, tileY: 2 });
    expect(path).toBeNull();
  });

  test('uses cache on repeated route requests', () => {
    const pathfinder = new Pathfinding(
      new NavGrid([
        [true, true, true, true],
        [true, true, true, true],
        [true, true, true, true],
      ]),
    );

    const start = { tileX: 0, tileY: 0 };
    const goal = { tileX: 3, tileY: 2 };

    const first = pathfinder.findPath(start, goal);
    expect(first).not.toBeNull();

    const second = pathfinder.findPath(start, goal);
    expect(second).not.toBeNull();
    expect(second).toEqual(first);

    const stats = pathfinder.getCacheStats();
    expect(stats.hits).toBeGreaterThanOrEqual(1);
    expect(stats.hitRate).toBeGreaterThan(0);
  });

  test('invalidates cached routes near updated tiles', () => {
    const pathfinder = new Pathfinding(
      new NavGrid([
        [true, true, true, true],
        [true, true, true, true],
        [true, true, true, true],
      ]),
    );

    const start = { tileX: 0, tileY: 0 };
    const goal = { tileX: 3, tileY: 0 };
    const path = pathfinder.findPath(start, goal);
    expect(path).not.toBeNull();

    pathfinder.invalidateCacheNear({ tileX: 1, tileY: 0 }, 1);
    const statsAfterInvalidation = pathfinder.getCacheStats();
    expect(statsAfterInvalidation.size).toBe(0);
  });
});
