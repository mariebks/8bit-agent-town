import { TilePosition } from '@shared/Types';
import { NavGrid } from './NavGrid';

interface AStarNode {
  tileX: number;
  tileY: number;
  g: number;
  h: number;
  f: number;
  parent: AStarNode | null;
}

export class Pathfinding {
  constructor(private readonly navGrid: NavGrid) {}

  findPath(start: TilePosition, goal: TilePosition): TilePosition[] | null {
    if (!this.navGrid.isWalkable(start.tileX, start.tileY) || !this.navGrid.isWalkable(goal.tileX, goal.tileY)) {
      return null;
    }

    const open: AStarNode[] = [
      {
        tileX: start.tileX,
        tileY: start.tileY,
        g: 0,
        h: this.heuristic(start, goal),
        f: this.heuristic(start, goal),
        parent: null,
      },
    ];
    const closed = new Set<string>();

    while (open.length > 0) {
      open.sort((a, b) => {
        if (a.f !== b.f) {
          return a.f - b.f;
        }
        return a.h - b.h;
      });

      const current = open.shift();
      if (!current) {
        break;
      }

      if (current.tileX === goal.tileX && current.tileY === goal.tileY) {
        const path = this.reconstruct(current);
        if (path.length > 0 && path[0].tileX === start.tileX && path[0].tileY === start.tileY) {
          return path.slice(1);
        }
        return path;
      }

      closed.add(this.key(current.tileX, current.tileY));

      for (const neighbor of this.navGrid.getNeighbors(current.tileX, current.tileY)) {
        const key = this.key(neighbor.tileX, neighbor.tileY);
        if (closed.has(key)) {
          continue;
        }

        const tentativeG = current.g + 1;
        const existing = open.find((candidate) => {
          return candidate.tileX === neighbor.tileX && candidate.tileY === neighbor.tileY;
        });

        if (!existing) {
          const h = this.heuristic(neighbor, goal);
          open.push({
            tileX: neighbor.tileX,
            tileY: neighbor.tileY,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current,
          });
          continue;
        }

        if (tentativeG < existing.g) {
          existing.g = tentativeG;
          existing.f = tentativeG + existing.h;
          existing.parent = current;
        }
      }
    }

    return null;
  }

  private reconstruct(node: AStarNode): TilePosition[] {
    const output: TilePosition[] = [];
    let current: AStarNode | null = node;

    while (current) {
      output.unshift({ tileX: current.tileX, tileY: current.tileY });
      current = current.parent;
    }

    return output;
  }

  private heuristic(a: TilePosition, b: TilePosition): number {
    return Math.abs(a.tileX - b.tileX) + Math.abs(a.tileY - b.tileY);
  }

  private key(tileX: number, tileY: number): string {
    return `${tileX},${tileY}`;
  }
}
