import { describe, expect, test } from 'vitest';
import { NavGrid } from './NavGrid';

describe('NavGrid', () => {
  test('builds walkability from collision layer', () => {
    const grid = NavGrid.fromTiledMap({
      width: 3,
      height: 2,
      layers: [
        {
          id: 1,
          name: 'collision',
          type: 'tilelayer',
          data: [0, 2, 0, 0, 0, 2],
        },
      ],
    });

    expect(grid.isWalkable(0, 0)).toBe(true);
    expect(grid.isWalkable(1, 0)).toBe(false);
    expect(grid.isWalkable(2, 1)).toBe(false);
  });

  test('returns four-directional neighbors only for walkable tiles', () => {
    const grid = new NavGrid([
      [true, true, false],
      [true, true, true],
    ]);

    const neighbors = grid.getNeighbors(1, 1);
    expect(neighbors).toEqual(
      expect.arrayContaining([
        { tileX: 0, tileY: 1 },
        { tileX: 1, tileY: 0 },
        { tileX: 2, tileY: 1 },
      ]),
    );

    expect(neighbors).not.toContainEqual({ tileX: 1, tileY: 2 });
  });
});
