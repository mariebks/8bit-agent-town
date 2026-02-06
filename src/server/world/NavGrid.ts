import { TilePosition } from '@shared/Types';

interface TiledLayer {
  id: number;
  name: string;
  type: string;
  data?: number[];
  width?: number;
  height?: number;
}

export interface TiledMapData {
  width: number;
  height: number;
  layers: TiledLayer[];
}

export class NavGrid {
  readonly width: number;
  readonly height: number;
  private readonly walkable: boolean[][];

  constructor(walkableGrid: boolean[][]) {
    this.walkable = walkableGrid;
    this.height = walkableGrid.length;
    this.width = walkableGrid[0]?.length ?? 0;
  }

  static fromTiledMap(map: TiledMapData, collisionLayerName = 'collision'): NavGrid {
    const layer = map.layers.find((candidate) => {
      return candidate.type === 'tilelayer' && candidate.name === collisionLayerName && Array.isArray(candidate.data);
    });

    const width = map.width;
    const height = map.height;
    const grid: boolean[][] = [];

    for (let y = 0; y < height; y += 1) {
      grid[y] = [];
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const tile = layer?.data?.[index] ?? 0;
        grid[y][x] = tile <= 0;
      }
    }

    return new NavGrid(grid);
  }

  isWalkable(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= this.width || tileY >= this.height) {
      return false;
    }

    return this.walkable[tileY][tileX];
  }

  getNeighbors(tileX: number, tileY: number): TilePosition[] {
    const neighbors: TilePosition[] = [];
    const candidates: TilePosition[] = [
      { tileX: tileX - 1, tileY },
      { tileX: tileX + 1, tileY },
      { tileX, tileY: tileY - 1 },
      { tileX, tileY: tileY + 1 },
    ];

    for (const candidate of candidates) {
      if (this.isWalkable(candidate.tileX, candidate.tileY)) {
        neighbors.push(candidate);
      }
    }

    return neighbors;
  }

  getRandomWalkableTiles(maxCount: number): TilePosition[] {
    const all: TilePosition[] = [];

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.walkable[y][x]) {
          all.push({ tileX: x, tileY: y });
        }
      }
    }

    if (all.length <= maxCount) {
      return all;
    }

    return all.slice(0, maxCount);
  }
}
