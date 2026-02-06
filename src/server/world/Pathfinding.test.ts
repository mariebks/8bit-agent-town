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
});
