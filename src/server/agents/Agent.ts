import { DEFAULT_AGENT_SPEED, TILE_SIZE } from '@shared/Constants';
import { AgentData, AgentState, Position, TilePosition } from '@shared/Types';
import { AgentFullState, AgentProfile, AgentStatusMeters } from './AgentState';

function tileToWorld(tile: TilePosition): Position {
  return {
    x: tile.tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tile.tileY * TILE_SIZE + TILE_SIZE / 2,
  };
}

function stepToward(current: Position, target: Position, stepDistancePx: number): Position {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);

  if (distance === 0 || distance <= stepDistancePx) {
    return { ...target };
  }

  return {
    x: current.x + (dx / distance) * stepDistancePx,
    y: current.y + (dy / distance) * stepDistancePx,
  };
}

export class Agent {
  readonly profile: AgentProfile;
  private position: Position;
  private tilePosition: TilePosition;
  private state: AgentState;
  private path: TilePosition[];
  private pathIndex: number;
  private currentAction: string;
  private nextDecisionTick: number;
  private readonly status: AgentStatusMeters;

  private readonly speedPxPerSecond: number;

  constructor(profile: AgentProfile, startTile: TilePosition) {
    this.profile = profile;
    this.tilePosition = { ...startTile };
    this.position = tileToWorld(startTile);
    this.state = AgentState.Idle;
    this.path = [];
    this.pathIndex = 0;
    this.currentAction = 'idle';
    this.nextDecisionTick = 0;
    this.speedPxPerSecond = DEFAULT_AGENT_SPEED * TILE_SIZE;

    this.status = {
      energy: 100,
      hunger: 0,
      mood: 65,
      social: 50,
    };
  }

  get id(): string {
    return this.profile.id;
  }

  get name(): string {
    return this.profile.name;
  }

  get color(): number {
    return this.profile.color;
  }

  getTilePosition(): TilePosition {
    return { ...this.tilePosition };
  }

  hasActivePath(): boolean {
    return this.pathIndex < this.path.length;
  }

  getState(): AgentState {
    return this.state;
  }

  getCurrentAction(): string {
    return this.currentAction;
  }

  setCurrentAction(action: string): void {
    this.currentAction = action;
  }

  setNextDecisionTick(tick: number): void {
    this.nextDecisionTick = tick;
  }

  getNextDecisionTick(): number {
    return this.nextDecisionTick;
  }

  setPath(path: TilePosition[]): void {
    this.path = path;
    this.pathIndex = 0;

    if (path.length > 0) {
      this.state = AgentState.Walking;
      this.currentAction = 'walking';
    }
  }

  clearPath(): void {
    this.path = [];
    this.pathIndex = 0;

    if (this.state === AgentState.Walking) {
      this.state = AgentState.Idle;
      this.currentAction = 'idle';
    }
  }

  setConversing(isConversing: boolean): void {
    if (isConversing) {
      this.state = AgentState.Conversing;
      this.currentAction = 'conversing';
      return;
    }

    if (this.state === AgentState.Conversing) {
      this.state = this.pathIndex < this.path.length ? AgentState.Walking : AgentState.Idle;
      this.currentAction = this.state === AgentState.Walking ? 'walking' : 'idle';
    }
  }

  update(deltaMs: number): void {
    this.updateMeters();

    if (this.state === AgentState.Conversing) {
      return;
    }

    if (this.pathIndex >= this.path.length) {
      if (this.state === AgentState.Walking) {
        this.state = AgentState.Idle;
        this.currentAction = 'idle';
      }
      return;
    }

    const targetTile = this.path[this.pathIndex];
    const targetPosition = tileToWorld(targetTile);
    const stepDistancePx = this.speedPxPerSecond * (deltaMs / 1000);

    this.position = stepToward(this.position, targetPosition, stepDistancePx);

    if (this.position.x === targetPosition.x && this.position.y === targetPosition.y) {
      this.tilePosition = { ...targetTile };
      this.pathIndex += 1;
    }

    if (this.pathIndex >= this.path.length) {
      this.state = AgentState.Idle;
      this.currentAction = 'idle';
    }
  }

  toAgentData(): AgentData {
    return {
      id: this.profile.id,
      name: this.profile.name,
      color: this.profile.color,
      state: this.state,
      position: { ...this.position },
      tilePosition: { ...this.tilePosition },
      path: this.path.slice(this.pathIndex),
      currentAction: this.currentAction,
      mood: this.status.mood,
      energy: this.status.energy,
      hunger: this.status.hunger,
    };
  }

  toFullState(): AgentFullState {
    return {
      ...this.profile,
      state: this.state,
      position: { ...this.position },
      tilePosition: { ...this.tilePosition },
      path: this.path.slice(this.pathIndex),
      currentAction: this.currentAction,
      nextDecisionTick: this.nextDecisionTick,
      status: { ...this.status },
    };
  }

  private updateMeters(): void {
    this.status.hunger = Math.min(100, this.status.hunger + 0.05);
    this.status.energy = Math.max(0, this.status.energy - 0.03);

    const moodDelta = this.state === AgentState.Conversing ? 0.04 : -0.01;
    this.status.mood = Math.min(100, Math.max(0, this.status.mood + moodDelta));
  }
}
