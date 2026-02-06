import Phaser from 'phaser';
import { DEFAULT_AGENT_SPEED, TILE_SIZE } from '@shared/Constants';
import { AgentData, TilePosition } from '@shared/Types';
import { stepDistance, stepToward, tileToWorld } from './MovementMath';

export class AgentSprite extends Phaser.GameObjects.Rectangle {
  readonly agentId: string;
  readonly agentName: string;

  currentTile: TilePosition;
  private path: TilePosition[] = [];
  private pathIndex = 0;
  private readonly speedPxPerSecond: number;
  private selected = false;

  constructor(scene: Phaser.Scene, data: AgentData) {
    super(scene, data.position.x, data.position.y, 12, 12, data.color);

    this.agentId = data.id;
    this.agentName = data.name;
    this.currentTile = { ...data.tilePosition };
    this.speedPxPerSecond = DEFAULT_AGENT_SPEED * TILE_SIZE;

    this.setDepth(10);
    this.applySelectionStyle();
    scene.add.existing(this);
  }

  setPath(path: TilePosition[]): void {
    this.path = path;
    this.pathIndex = 0;
  }

  applyServerState(data: AgentData): void {
    this.setPosition(data.position.x, data.position.y);
    this.currentTile = { ...data.tilePosition };
    this.path = data.path ? [...data.path] : [];
    this.pathIndex = 0;
  }

  getRemainingPath(): TilePosition[] {
    return this.path.slice(this.pathIndex);
  }

  setSelected(isSelected: boolean): void {
    this.selected = isSelected;
    this.applySelectionStyle();
  }

  containsWorldPoint(worldX: number, worldY: number, radius = 10): boolean {
    const dx = worldX - this.x;
    const dy = worldY - this.y;
    return Math.hypot(dx, dy) <= radius;
  }

  updateMovement(deltaMs: number): void {
    if (this.pathIndex >= this.path.length) {
      return;
    }

    const targetTile = this.path[this.pathIndex];
    const target = tileToWorld(targetTile);
    const step = stepDistance(this.speedPxPerSecond, deltaMs);
    const result = stepToward({ x: this.x, y: this.y }, target, step);

    this.setPosition(result.position.x, result.position.y);
    if (result.arrived) {
      this.currentTile = { ...targetTile };
      this.pathIndex += 1;
    }
  }

  private applySelectionStyle(): void {
    if (this.selected) {
      this.setStrokeStyle(2, 0xffffff);
    } else {
      this.setStrokeStyle();
    }
  }
}
