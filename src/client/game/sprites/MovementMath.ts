import { TILE_SIZE } from '@shared/Constants';
import { TilePosition } from '@shared/Types';

export interface Point {
  x: number;
  y: number;
}

export interface StepResult {
  position: Point;
  arrived: boolean;
  distanceRemaining: number;
}

export function tileToWorld(tile: TilePosition): Point {
  return {
    x: tile.tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tile.tileY * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function stepDistance(speedPxPerSecond: number, deltaMs: number): number {
  return speedPxPerSecond * (deltaMs / 1000);
}

export function stepToward(current: Point, target: Point, step: number): StepResult {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return {
      position: { x: current.x, y: current.y },
      arrived: true,
      distanceRemaining: 0,
    };
  }

  if (distance <= step) {
    return {
      position: { x: target.x, y: target.y },
      arrived: true,
      distanceRemaining: 0,
    };
  }

  return {
    position: {
      x: current.x + (dx / distance) * step,
      y: current.y + (dy / distance) * step,
    },
    arrived: false,
    distanceRemaining: distance - step,
  };
}
