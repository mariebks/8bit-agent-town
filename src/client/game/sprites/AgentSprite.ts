import Phaser from 'phaser';
import { DEFAULT_AGENT_SPEED, TILE_SIZE } from '@shared/Constants';
import { AgentData, AgentState, TilePosition } from '@shared/Types';
import { stepDistance, stepToward, tileToWorld } from './MovementMath';
import { deriveAgentPalette, FacingDirection, frameIndexFor, resolveFacingDirection, spriteTextureKeyForAgent } from './AgentVisuals';
import { ensureAgentSpriteSheet } from './AgentTextureFactory';

export class AgentSprite extends Phaser.GameObjects.Container {
  readonly agentId: string;
  readonly agentName: string;

  currentTile: TilePosition;
  private path: TilePosition[] = [];
  private pathIndex = 0;
  private readonly speedPxPerSecond: number;
  private selected = false;
  private readonly actorSprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly selectionRing: Phaser.GameObjects.Ellipse;
  private facing: FacingDirection = 'down';
  private walkPhase = false;
  private strideAccumulator = 0;
  private currentState: AgentState;

  constructor(scene: Phaser.Scene, data: AgentData) {
    super(scene, data.position.x, data.position.y);

    this.agentId = data.id;
    this.agentName = data.name;
    this.currentTile = { ...data.tilePosition };
    this.speedPxPerSecond = DEFAULT_AGENT_SPEED * TILE_SIZE;
    this.currentState = data.state;

    const textureKey = spriteTextureKeyForAgent(data.id, data.color, data.occupation);
    ensureAgentSpriteSheet(scene, textureKey, deriveAgentPalette(data.color, data.id, data.occupation));

    this.shadow = scene.add.ellipse(0, 5, 10, 4, 0x09111a, 0.28);
    this.selectionRing = scene.add.ellipse(0, 5, 15, 7, 0xb8f77b, 0.14);
    this.selectionRing.setStrokeStyle(1, 0xeafed2, 0.9);
    this.selectionRing.setVisible(false);

    this.actorSprite = scene.add.sprite(0, -2, textureKey, String(frameIndexFor('down', false)));
    this.actorSprite.setScale(1);
    this.actorSprite.setOrigin(0.5);

    this.add([this.shadow, this.selectionRing, this.actorSprite]);

    this.setSize(12, 12);
    this.setDepth(10);
    scene.add.existing(this);
    this.setDepth(10);
    this.applySelectionStyle();
  }

  setPath(path: TilePosition[]): void {
    this.path = path;
    this.pathIndex = 0;
    this.currentState = path.length > 0 ? AgentState.Walking : AgentState.Idle;
    if (path.length === 0) {
      this.walkPhase = false;
      this.strideAccumulator = 0;
    }
  }

  applyServerState(data: AgentData): void {
    const dx = data.position.x - this.x;
    const dy = data.position.y - this.y;

    this.setPosition(data.position.x, data.position.y);
    this.currentTile = { ...data.tilePosition };
    this.path = data.path ? [...data.path] : [];
    this.pathIndex = 0;
    this.currentState = data.state;
    const moving = data.state === AgentState.Walking || Math.hypot(dx, dy) > 0.01 || this.path.length > 0;
    this.updatePose(dx, dy, moving);
  }

  getRemainingPath(): TilePosition[] {
    return this.path.slice(this.pathIndex);
  }

  setSelected(isSelected: boolean): void {
    this.selected = isSelected;
    this.applySelectionStyle();
  }

  containsWorldPoint(worldX: number, worldY: number, radius = 9): boolean {
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
    const beforeX = this.x;
    const beforeY = this.y;
    const result = stepToward({ x: beforeX, y: beforeY }, target, step);

    this.setPosition(result.position.x, result.position.y);
    this.updatePose(this.x - beforeX, this.y - beforeY, true);

    if (result.arrived) {
      this.currentTile = { ...targetTile };
      this.pathIndex += 1;
    }

    if (this.pathIndex >= this.path.length) {
      this.currentState = AgentState.Idle;
      this.updatePose(0, 0, false);
    }
  }

  private applySelectionStyle(): void {
    this.selectionRing.setVisible(this.selected);
    if (this.selected) {
      this.selectionRing.setFillStyle(0xc8f89f, 0.18);
      this.selectionRing.setStrokeStyle(1, 0xffffff, 0.95);
      return;
    }

    this.selectionRing.setFillStyle(0xb8f77b, 0.14);
    this.selectionRing.setStrokeStyle(1, 0xeafed2, 0.9);
  }

  private updatePose(dx: number, dy: number, moving: boolean): void {
    this.facing = resolveFacingDirection(dx, dy, this.facing);

    if (moving) {
      this.strideAccumulator += Math.hypot(dx, dy);
      if (this.strideAccumulator >= 3.2) {
        this.strideAccumulator = 0;
        this.walkPhase = !this.walkPhase;
      }
    } else {
      this.strideAccumulator = 0;
      this.walkPhase = false;
    }

    this.actorSprite.setFrame(String(frameIndexFor(this.facing, moving && this.walkPhase)));
    this.actorSprite.y = moving ? (this.walkPhase ? -2.2 : -1.8) : this.currentState === AgentState.Conversing ? -2.4 : -2;
    this.shadow.setScale(moving ? 0.95 : 1, 1);

    if (this.currentState === AgentState.Sleeping) {
      this.actorSprite.setTint(0x8ea3b7);
    } else {
      this.actorSprite.clearTint();
    }
  }
}
