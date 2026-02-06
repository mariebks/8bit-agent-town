import type Phaser from 'phaser';
import { TilePosition } from '@shared/Types';

interface AStarNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

export class AStar {
  private readonly grid: boolean[][];
  private readonly width: number;
  private readonly height: number;

  constructor(walkableGrid: boolean[][]) {
    this.grid = walkableGrid;
    this.height = walkableGrid.length;
    this.width = walkableGrid[0]?.length ?? 0;
  }

  static fromTilemapLayer(layer: Phaser.Tilemaps.LayerData): AStar {
    const grid: boolean[][] = [];

    for (let y = 0; y < layer.height; y += 1) {
      grid[y] = [];
      for (let x = 0; x < layer.width; x += 1) {
        const tile = layer.data[y][x];
        grid[y][x] = !tile || tile.index < 0;
      }
    }

    return new AStar(grid);
  }

  findPath(start: TilePosition, end: TilePosition): TilePosition[] | null {
    if (!this.isWalkable(start.tileX, start.tileY) || !this.isWalkable(end.tileX, end.tileY)) {
      return null;
    }

    const openList: AStarNode[] = [];
    const closed = new Set<string>();

    const startNode: AStarNode = {
      x: start.tileX,
      y: start.tileY,
      g: 0,
      h: this.heuristic(start.tileX, start.tileY, end.tileX, end.tileY),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;
    openList.push(startNode);

    while (openList.length > 0) {
      openList.sort((a, b) => {
        if (a.f !== b.f) {
          return a.f - b.f;
        }
        return a.h - b.h;
      });

      const current = openList.shift();
      if (!current) {
        break;
      }

      if (current.x === end.tileX && current.y === end.tileY) {
        const path = this.reconstructPath(current);
        // Return path excluding start tile.
        if (path.length > 0 && path[0].tileX === start.tileX && path[0].tileY === start.tileY) {
          return path.slice(1);
        }
        return path;
      }

      closed.add(this.key(current.x, current.y));

      const neighbors = [
        { x: current.x - 1, y: current.y },
        { x: current.x + 1, y: current.y },
        { x: current.x, y: current.y - 1 },
        { x: current.x, y: current.y + 1 },
      ];

      for (const neighbor of neighbors) {
        if (!this.isWalkable(neighbor.x, neighbor.y)) {
          continue;
        }

        const neighborKey = this.key(neighbor.x, neighbor.y);
        if (closed.has(neighborKey)) {
          continue;
        }

        const tentativeG = current.g + 1;
        const existing = openList.find((node) => node.x === neighbor.x && node.y === neighbor.y);

        if (!existing) {
          const h = this.heuristic(neighbor.x, neighbor.y, end.tileX, end.tileY);
          openList.push({
            x: neighbor.x,
            y: neighbor.y,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current,
          });
        } else if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = tentativeG + existing.h;
          existing.parent = current;
        }
      }
    }

    return null;
  }

  private reconstructPath(node: AStarNode): TilePosition[] {
    const path: TilePosition[] = [];
    let cursor: AStarNode | null = node;

    while (cursor) {
      path.unshift({ tileX: cursor.x, tileY: cursor.y });
      cursor = cursor.parent;
    }

    return path;
  }

  private heuristic(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  private isWalkable(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return false;
    }

    return this.grid[y][x];
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }
}
