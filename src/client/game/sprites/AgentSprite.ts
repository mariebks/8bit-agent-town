import Phaser from 'phaser';
import { DEFAULT_AGENT_SPEED, TILE_SIZE } from '@shared/Constants';
import { AgentData, TilePosition } from '@shared/Types';

export class AgentSprite extends Phaser.GameObjects.Rectangle {
  readonly agentId: string;
  readonly agentName: string;

  currentTile: TilePosition;
  private path: TilePosition[] = [];
  private pathIndex = 0;
  private readonly speedPxPerSecond: number;

  constructor(scene: Phaser.Scene, data: AgentData) {
    const start = AgentSprite.tileToWorld(data.tilePosition);

    super(scene, start.x, start.y, 12, 12, data.color);

    this.agentId = data.id;
    this.agentName = data.name;
    this.currentTile = { ...data.tilePosition };
    this.speedPxPerSecond = DEFAULT_AGENT_SPEED * TILE_SIZE;

    this.setDepth(10);
    scene.add.existing(this);
  }

  setPath(path: TilePosition[]): void {
    this.path = path;
    this.pathIndex = 0;
  }

  updateMovement(deltaMs: number): void {
    if (this.pathIndex >= this.path.length) {
      return;
    }

    const targetTile = this.path[this.pathIndex];
    const target = AgentSprite.tileToWorld(targetTile);

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    const step = this.speedPxPerSecond * (deltaMs / 1000);

    if (distance <= step) {
      this.setPosition(target.x, target.y);
      this.currentTile = { ...targetTile };
      this.pathIndex += 1;
      return;
    }

    this.setPosition(
      this.x + (dx / distance) * step,
      this.y + (dy / distance) * step,
    );
  }

  private static tileToWorld(tile: TilePosition): { x: number; y: number } {
    return {
      x: tile.tileX * TILE_SIZE + TILE_SIZE / 2,
      y: tile.tileY * TILE_SIZE + TILE_SIZE / 2,
    };
  }
}
