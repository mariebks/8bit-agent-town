import Phaser from 'phaser';
import { TILE_SIZE } from '@shared/Constants';
import { AgentData, AgentState } from '@shared/Types';
import { CameraController } from '../camera/CameraController';
import { AStar } from '../pathfinding/AStar';
import { AgentSprite } from '../sprites/AgentSprite';

export class TownScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap;
  private astar!: AStar;

  private readonly agents: AgentSprite[] = [];
  private selectedAgent: AgentSprite | null = null;

  private cameraController!: CameraController;
  private spacePanKey!: Phaser.Input.Keyboard.Key;

  private fpsOverlay: HTMLElement | null = null;
  private fpsTimerMs = 0;

  constructor() {
    super('TownScene');
  }

  create(): void {
    if (!this.input.keyboard) {
      throw new Error('Keyboard input is unavailable');
    }

    this.spacePanKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.fpsOverlay = document.getElementById('fps-overlay');

    this.createMap();
    this.spawnDebugAgents();

    this.selectedAgent = this.agents[0] ?? null;

    this.cameraController = new CameraController(this, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.centerOn(this.map.widthInPixels / 2, this.map.heightInPixels / 2);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cameraController.destroy());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 || this.spacePanKey.isDown || !this.selectedAgent) {
        return;
      }

      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);
      const path = this.astar.findPath(this.selectedAgent.currentTile, { tileX, tileY });

      if (!path || path.length === 0) {
        return;
      }

      this.selectedAgent.setPath(path);
    });
  }

  update(_time: number, delta: number): void {
    this.cameraController.update(delta);

    for (const agent of this.agents) {
      agent.updateMovement(delta);
    }

    this.fpsTimerMs += delta;
    if (this.fpsTimerMs >= 250) {
      this.fpsTimerMs = 0;
      if (this.fpsOverlay) {
        const fps = Math.round(this.game.loop.actualFps);
        this.fpsOverlay.textContent = `FPS: ${fps} | Frame: ${delta.toFixed(1)}ms`;
      }
    }
  }

  private createMap(): void {
    this.map = this.make.tilemap({ key: 'townmap' });

    const tileset = this.map.addTilesetImage('town_tiles', 'tileset');
    if (!tileset) {
      throw new Error('Failed to create tileset from map data');
    }

    const groundLayer = this.map.createLayer('ground', tileset, 0, 0);
    const objectsLayer = this.map.createLayer('objects', tileset, 0, 0);
    const aboveLayer = this.map.createLayer('above', tileset, 0, 0);
    const collisionLayer = this.map.createLayer('collision', tileset, 0, 0);

    groundLayer?.setDepth(0);
    objectsLayer?.setDepth(5);
    aboveLayer?.setDepth(100);
    collisionLayer?.setVisible(false);

    if (!collisionLayer) {
      throw new Error('Map is missing required collision layer');
    }

    this.astar = AStar.fromTilemapLayer(collisionLayer.layer);
  }

  private spawnDebugAgents(): void {
    const data: AgentData[] = [
      this.createAgentData('agent-1', 'Red', 0xff4444, 4, 4),
      this.createAgentData('agent-2', 'Green', 0x44ff44, 8, 18),
      this.createAgentData('agent-3', 'Blue', 0x4444ff, 19, 10),
      this.createAgentData('agent-4', 'Yellow', 0xffff44, 30, 7),
      this.createAgentData('agent-5', 'Pink', 0xff44ff, 35, 24),
    ];

    for (const agentData of data) {
      this.agents.push(new AgentSprite(this, agentData));
    }
  }

  private createAgentData(
    id: string,
    name: string,
    color: number,
    tileX: number,
    tileY: number,
  ): AgentData {
    const x = tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = tileY * TILE_SIZE + TILE_SIZE / 2;

    return {
      id,
      name,
      color,
      state: AgentState.Idle,
      tilePosition: { tileX, tileY },
      position: { x, y },
    };
  }
}
