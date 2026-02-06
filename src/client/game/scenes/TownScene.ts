import Phaser from 'phaser';
import { TILE_SIZE } from '@shared/Constants';
import { AgentData, AgentState, GameTime } from '@shared/Types';
import { CameraController } from '../camera/CameraController';
import { AStar } from '../pathfinding/AStar';
import { AgentSprite } from '../sprites/AgentSprite';

export class TownScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap;
  private astar!: AStar;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private blockedMarker!: Phaser.GameObjects.Rectangle;
  private blockedMarkerTimerMs = 0;

  private readonly agents: AgentSprite[] = [];
  private readonly agentsById = new Map<string, AgentSprite>();
  private selectedAgent: AgentSprite | null = null;

  private cameraController!: CameraController;
  private spacePanKey!: Phaser.Input.Keyboard.Key;

  private fpsOverlay: HTMLElement | null = null;
  private fpsTimerMs = 0;

  private serverAuthoritative = false;
  private serverConnected = false;
  private serverGameTime: GameTime | null = null;

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
    this.createOverlays();

    this.selectAgent(this.agents[0] ?? null);

    this.cameraController = new CameraController(this, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.centerOn(this.map.widthInPixels / 2, this.map.heightInPixels / 2);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cameraController.destroy());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 || this.spacePanKey.isDown) {
        return;
      }

      const clickedAgent = this.findAgentAtWorld(pointer.worldX, pointer.worldY);
      if (clickedAgent) {
        this.selectAgent(clickedAgent);
        return;
      }

      if (!this.selectedAgent) {
        return;
      }

      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);

      if (this.serverAuthoritative) {
        this.showBlockedMarker(tileX, tileY);
        return;
      }

      const path = this.astar.findPath(this.selectedAgent.currentTile, { tileX, tileY });
      if (!path || path.length === 0) {
        this.showBlockedMarker(tileX, tileY);
        return;
      }

      this.selectedAgent.setPath(path);
    });
  }

  update(_time: number, delta: number): void {
    this.cameraController.update(delta);

    if (!this.serverAuthoritative) {
      for (const agent of this.agents) {
        agent.updateMovement(delta);
      }
    }

    this.renderSelectedPath();
    this.updateBlockedMarker(delta);

    this.fpsTimerMs += delta;
    if (this.fpsTimerMs >= 250) {
      this.fpsTimerMs = 0;
      if (this.fpsOverlay) {
        const fps = Math.round(this.game.loop.actualFps);
        this.fpsOverlay.textContent = `FPS: ${fps} | Frame: ${delta.toFixed(1)}ms`;
      }
    }
  }

  setServerConnectionState(connected: boolean): void {
    this.serverConnected = connected;
    this.updateInfoText();
  }

  applyServerSnapshot(agents: AgentData[], gameTime: GameTime): void {
    this.serverAuthoritative = true;
    this.serverGameTime = gameTime;
    this.syncServerAgents(agents);
    this.updateInfoText();
  }

  applyServerDelta(agents: AgentData[], gameTime: GameTime): void {
    this.serverAuthoritative = true;
    this.serverGameTime = gameTime;
    this.syncServerAgents(agents);
    this.updateInfoText();
  }

  getSelectedAgentId(): string | null {
    return this.selectedAgent?.agentId ?? null;
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
      this.addOrReplaceAgent(agentData);
    }
  }

  private createOverlays(): void {
    this.pathGraphics = this.add.graphics();
    this.pathGraphics.setDepth(90);

    this.blockedMarker = this.add.rectangle(0, 0, TILE_SIZE - 2, TILE_SIZE - 2);
    this.blockedMarker.setStrokeStyle(2, 0xff4444);
    this.blockedMarker.setFillStyle(0xff4444, 0.2);
    this.blockedMarker.setVisible(false);
    this.blockedMarker.setDepth(95);

    this.infoText = this.add.text(10, 36, '', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '12px',
      backgroundColor: 'rgba(0,0,0,0.55)',
      padding: { left: 6, right: 6, top: 4, bottom: 4 },
    });
    this.infoText.setScrollFactor(0);
    this.infoText.setDepth(1000);
    this.updateInfoText();
  }

  private selectAgent(agent: AgentSprite | null): void {
    this.selectedAgent?.setSelected(false);
    this.selectedAgent = agent;
    this.selectedAgent?.setSelected(true);
    this.updateInfoText();
  }

  private updateInfoText(): void {
    const selected = this.selectedAgent?.agentName ?? 'None';
    const mode = this.serverAuthoritative ? (this.serverConnected ? 'Server' : 'Server (offline)') : 'Local';
    const timeText = this.serverGameTime
      ? `Day ${this.serverGameTime.day} ${String(this.serverGameTime.hour).padStart(2, '0')}:${String(this.serverGameTime.minute).padStart(2, '0')}`
      : 'No sim time';

    this.infoText?.setText(
      `Mode: ${mode} | ${timeText} | Selected: ${selected} | Click agent to select | Hold Space + Drag to pan`,
    );
  }

  private findAgentAtWorld(worldX: number, worldY: number): AgentSprite | null {
    for (let i = this.agents.length - 1; i >= 0; i -= 1) {
      if (this.agents[i].containsWorldPoint(worldX, worldY)) {
        return this.agents[i];
      }
    }
    return null;
  }

  private renderSelectedPath(): void {
    this.pathGraphics.clear();
    if (!this.selectedAgent) {
      return;
    }

    const path = this.selectedAgent.getRemainingPath();
    if (path.length === 0) {
      return;
    }

    this.pathGraphics.lineStyle(2, 0x8ec9ff, 0.9);
    this.pathGraphics.beginPath();
    this.pathGraphics.moveTo(this.selectedAgent.x, this.selectedAgent.y);

    for (const tile of path) {
      const x = tile.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = tile.tileY * TILE_SIZE + TILE_SIZE / 2;
      this.pathGraphics.lineTo(x, y);
    }

    this.pathGraphics.strokePath();
  }

  private showBlockedMarker(tileX: number, tileY: number): void {
    this.blockedMarker.setPosition(tileX * TILE_SIZE + TILE_SIZE / 2, tileY * TILE_SIZE + TILE_SIZE / 2);
    this.blockedMarker.setVisible(true);
    this.blockedMarkerTimerMs = 350;
  }

  private updateBlockedMarker(deltaMs: number): void {
    if (!this.blockedMarker.visible) {
      return;
    }

    this.blockedMarkerTimerMs -= deltaMs;
    if (this.blockedMarkerTimerMs <= 0) {
      this.blockedMarker.setVisible(false);
    }
  }

  private syncServerAgents(agents: AgentData[]): void {
    const activeIds = new Set<string>();

    for (const data of agents) {
      activeIds.add(data.id);
      this.addOrReplaceAgent(data);
    }

    for (const [agentId, sprite] of this.agentsById.entries()) {
      if (activeIds.has(agentId)) {
        continue;
      }

      sprite.destroy();
      this.agentsById.delete(agentId);
      const index = this.agents.indexOf(sprite);
      if (index >= 0) {
        this.agents.splice(index, 1);
      }
    }

    if (this.selectedAgent && !this.agentsById.has(this.selectedAgent.agentId)) {
      this.selectedAgent = null;
    }

    if (!this.selectedAgent) {
      this.selectAgent(this.agents[0] ?? null);
    }
  }

  private addOrReplaceAgent(data: AgentData): void {
    const existing = this.agentsById.get(data.id);
    if (existing) {
      existing.applyServerState(data);
      return;
    }

    const sprite = new AgentSprite(this, data);
    this.agentsById.set(data.id, sprite);
    this.agents.push(sprite);
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
