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

interface CachedPath {
  path: TilePosition[];
  timestampMs: number;
  accessCount: number;
  lastAccessedMs: number;
}

interface PathfindingOptions {
  cacheSize?: number;
  now?: () => number;
}

export class PathfindingCache {
  private readonly maxSize: number;
  private readonly now: () => number;
  private readonly cache = new Map<string, CachedPath>();
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 500, now: () => number = () => Date.now()) {
    this.maxSize = Math.max(1, Math.floor(maxSize));
    this.now = now;
  }

  get(start: TilePosition, goal: TilePosition): TilePosition[] | null {
    const key = this.key(start, goal);
    const cached = this.cache.get(key);
    if (!cached) {
      this.misses += 1;
      return null;
    }

    this.hits += 1;
    cached.accessCount += 1;
    cached.lastAccessedMs = this.now();
    return cached.path.map((node) => ({ ...node }));
  }

  set(start: TilePosition, goal: TilePosition, path: TilePosition[]): void {
    const key = this.key(start, goal);
    const timestampMs = this.now();
    this.cache.set(key, {
      path: path.map((node) => ({ ...node })),
      timestampMs,
      accessCount: 0,
      lastAccessedMs: timestampMs,
    });
    this.evictIfNeeded();
  }

  invalidateNear(position: TilePosition, radius: number): void {
    const radiusValue = Math.max(0, radius);
    const keysToDelete: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if (this.pathNear(value.path, position, radiusValue)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; hitRate: number; hits: number; misses: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hitRate: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
    };
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.maxSize) {
      let oldestKey: string | null = null;
      let oldestAccess = Number.POSITIVE_INFINITY;
      let lowestAccessCount = Number.POSITIVE_INFINITY;

      for (const [key, value] of this.cache.entries()) {
        if (value.accessCount < lowestAccessCount) {
          lowestAccessCount = value.accessCount;
          oldestAccess = value.lastAccessedMs;
          oldestKey = key;
          continue;
        }

        if (value.accessCount === lowestAccessCount && value.lastAccessedMs < oldestAccess) {
          oldestAccess = value.lastAccessedMs;
          oldestKey = key;
        }
      }

      if (!oldestKey) {
        break;
      }
      this.cache.delete(oldestKey);
    }
  }

  private pathNear(path: TilePosition[], position: TilePosition, radius: number): boolean {
    for (const node of path) {
      const distance = Math.abs(node.tileX - position.tileX) + Math.abs(node.tileY - position.tileY);
      if (distance <= radius) {
        return true;
      }
    }
    return false;
  }

  private key(start: TilePosition, goal: TilePosition): string {
    return `${start.tileX},${start.tileY}->${goal.tileX},${goal.tileY}`;
  }
}

export class Pathfinding {
  private readonly cache: PathfindingCache;

  constructor(
    private readonly navGrid: NavGrid,
    options: PathfindingOptions = {},
  ) {
    this.cache = new PathfindingCache(options.cacheSize ?? 500, options.now ?? (() => Date.now()));
  }

  findPath(start: TilePosition, goal: TilePosition): TilePosition[] | null {
    if (!this.navGrid.isWalkable(start.tileX, start.tileY) || !this.navGrid.isWalkable(goal.tileX, goal.tileY)) {
      return null;
    }

    const cached = this.cache.get(start, goal);
    if (cached) {
      return cached;
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
          const resolved = path.slice(1);
          this.cache.set(start, goal, resolved);
          return resolved;
        }
        this.cache.set(start, goal, path);
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

  getCacheStats(): { size: number; hitRate: number; hits: number; misses: number } {
    return this.cache.getStats();
  }

  invalidateCacheNear(position: TilePosition, radius: number): void {
    this.cache.invalidateNear(position, radius);
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
