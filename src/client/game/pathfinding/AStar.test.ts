import { describe, expect, it } from 'vitest';
import { AStar } from './AStar';

describe('AStar', () => {
  it('finds a straight horizontal path on an empty grid', () => {
    const astar = new AStar([
      [true, true, true],
      [true, true, true],
      [true, true, true],
    ]);

    const path = astar.findPath({ tileX: 0, tileY: 0 }, { tileX: 2, tileY: 0 });

    expect(path).toEqual([
      { tileX: 1, tileY: 0 },
      { tileX: 2, tileY: 0 },
    ]);
  });

  it('returns an empty path when start and end tiles are the same', () => {
    const astar = new AStar([
      [true, true],
      [true, true],
    ]);

    const path = astar.findPath({ tileX: 1, tileY: 1 }, { tileX: 1, tileY: 1 });

    expect(path).toEqual([]);
  });

  it('returns null when destination tile is blocked', () => {
    const astar = new AStar([
      [true, true, true],
      [true, false, true],
      [true, true, true],
    ]);

    const path = astar.findPath({ tileX: 0, tileY: 0 }, { tileX: 1, tileY: 1 });

    expect(path).toBeNull();
  });

  it('routes around blocked tiles using 4-directional movement only', () => {
    const astar = new AStar([
      [true, true, true, true],
      [true, false, false, true],
      [true, true, true, true],
    ]);

    const path = astar.findPath({ tileX: 0, tileY: 1 }, { tileX: 3, tileY: 1 });

    expect(path).toEqual([
      { tileX: 0, tileY: 0 },
      { tileX: 1, tileY: 0 },
      { tileX: 2, tileY: 0 },
      { tileX: 3, tileY: 0 },
      { tileX: 3, tileY: 1 },
    ]);

    if (!path) {
      throw new Error('Path should not be null in this test');
    }

    for (let i = 1; i < path.length; i += 1) {
      const dx = Math.abs(path[i].tileX - path[i - 1].tileX);
      const dy = Math.abs(path[i].tileY - path[i - 1].tileY);
      expect(dx + dy).toBe(1);
    }
  });

  it('returns null when no route exists', () => {
    const astar = new AStar([
      [true, false, true],
      [false, false, false],
      [true, false, true],
    ]);

    const path = astar.findPath({ tileX: 0, tileY: 0 }, { tileX: 2, tileY: 2 });

    expect(path).toBeNull();
  });

  it('builds walkability correctly from tilemap layer data', () => {
    const fakeLayer = {
      width: 2,
      height: 2,
      data: [
        [null, { index: -1 }],
        [{ index: 2 }, null],
      ],
    } as unknown as Parameters<typeof AStar.fromTilemapLayer>[0];

    const astar = AStar.fromTilemapLayer(fakeLayer);

    expect(astar.findPath({ tileX: 0, tileY: 0 }, { tileX: 1, tileY: 0 })).toEqual([
      { tileX: 1, tileY: 0 },
    ]);
    expect(astar.findPath({ tileX: 0, tileY: 0 }, { tileX: 0, tileY: 1 })).toBeNull();
  });
});
