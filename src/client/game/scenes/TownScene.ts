import Phaser from 'phaser';
import { TICK_INTERVAL_MS, TILE_SIZE } from '@shared/Constants';
import { DEFAULT_TOWN_LOCATIONS, HIGHLIGHTED_LANDMARK_IDS } from '@shared/TownLocations';
import { AgentData, AgentState, GameTime } from '@shared/Types';
import { CameraController } from '../camera/CameraController';
import { AStar } from '../pathfinding/AStar';
import { AgentSprite } from '../sprites/AgentSprite';
import { inferConversationTags } from './ConversationTags';
import { addDirectorBookmark, nextDirectorBookmark, pruneDirectorBookmarks } from './DirectorBookmarks';
import { loadDirectorBookmarkIds, storeDirectorBookmarkIds } from './DirectorBookmarkPersistence';
import { nextDirectorZoom } from './DirectorZoom';
import { dequeueDirectorCue, DirectorCue, enqueueDirectorCue as pushDirectorCue } from './DirectorQueue';
import { enqueueSpeech } from './SpeechQueue';
import { layoutSpeechBubbleOffsets } from './SpeechBubbleLayout';
import { formatSpeechBubbleText } from './SpeechBubbleText';
import {
  loadPreferredSelectedAgentId,
  resolveSelectedAgentId,
  storePreferredSelectedAgentId,
} from './SelectionPersistence';
import { loadSelectedOnlySpeechEnabled, storeSelectedOnlySpeechEnabled } from './SpeechPreferences';
import { resolveWeatherProfile, WeatherProfile } from './WeatherProfile';
import {
  classifyAgentLod,
  movementUpdateInterval,
  selectVisibleSpeechBubbleAgentIds,
  shouldRenderBubble,
  shouldShowSpeechBubble,
} from './CullingMath';
import { overlayQualityProfileForFps } from './OverlayQuality';

type SceneUiMode = 'spectator' | 'story' | 'debug';
type CameraPace = 'smooth' | 'snappy';

export interface DebugOverlayState {
  pathEnabled: boolean;
  perceptionEnabled: boolean;
  updateStride: number;
  pathSampleStep: number;
  perceptionSuppressed: boolean;
}

export interface ScenePerfSummary {
  totalAgents: number;
  visibleAgents: number;
  visibleSpeechBubbles: number;
  queuedSpeechMessages: number;
}

interface SpeechBubbleState {
  container: Phaser.GameObjects.Container;
  remainingMs: number;
  width: number;
  height: number;
  preferredOffsetY: number;
  message: string;
  expanded: boolean;
}

export class TownScene extends Phaser.Scene {
  private map!: Phaser.Tilemaps.Tilemap;
  private astar!: AStar;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private perceptionGraphics!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private blockedMarker!: Phaser.GameObjects.Rectangle;
  private blockedMarkerTimerMs = 0;
  private dayTintOverlay!: Phaser.GameObjects.Rectangle;
  private dayTintTimerMs = 0;
  private rainUpdateTimerMs = 0;
  private landmarkGuideTimerMs = 0;
  private landmarkAccentPulseMs = 0;
  private routeGraphics!: Phaser.GameObjects.Graphics;
  private terrainVarianceGraphics!: Phaser.GameObjects.Graphics;
  private rainGraphics!: Phaser.GameObjects.Graphics;

  private readonly agents: AgentSprite[] = [];
  private readonly agentsById = new Map<string, AgentSprite>();
  private selectedAgent: AgentSprite | null = null;

  private cameraController!: CameraController;
  private spacePanKey!: Phaser.Input.Keyboard.Key;

  private fpsOverlay: HTMLElement | null = null;
  private fpsTimerMs = 0;

  private serverAuthoritative = false;
  private serverConnected = false;
  private serverSelectionInitialized = false;
  private serverGameTime: GameTime | null = null;
  private serverAverageMood: number | null = null;
  private weatherProfile: WeatherProfile = resolveWeatherProfile(null, []);
  private readonly recentTopicTrail: string[] = [];
  private manualSelectionMade = false;
  private preferredSelectedAgentId: string | null = null;
  private readonly speechBubbles = new Map<string, SpeechBubbleState>();
  private readonly pendingSpeechByAgent = new Map<string, Array<{ message: string; durationMs: number }>>();
  private frameCounter = 0;
  private pathOverlayEnabled = true;
  private perceptionOverlayEnabled = true;
  private overlayUpdateStride = 1;
  private overlayPathSampleStep = 1;
  private overlayPerceptionSuppressed = false;
  private followSelectedAgent = false;
  private selectedOnlySpeech = false;
  private uiMode: SceneUiMode = 'spectator';
  private autoDirectorEnabled = true;
  private directorBookmarkAgentIds: string[] = [];
  private directorBookmarkIndex = 0;
  private directorCooldownMs = 0;
  private directorFocusMs = 0;
  private directorCurrentAgentId: string | null = null;
  private directorFocusQueue: DirectorCue[] = [];
  private modeBaseZoom = 1;
  private modeFocusZoom = 1.06;
  private cameraPace: CameraPace = 'smooth';
  private readonly ambientParticles: Array<{ dot: Phaser.GameObjects.Arc; vx: number; vy: number }> = [];
  private readonly landmarkGuides: Array<{
    locationId: string;
    marker: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    accent: Phaser.GameObjects.Arc;
    accentRadius: number;
    centerX: number;
    centerY: number;
  }> = [];

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
    this.createAmbientParticles();
    this.createLandmarkGuides();
    this.directorBookmarkAgentIds = loadDirectorBookmarkIds(typeof window !== 'undefined' ? window.localStorage : null);
    this.directorBookmarkIndex = 0;
    this.selectedOnlySpeech = loadSelectedOnlySpeechEnabled(typeof window !== 'undefined' ? window.localStorage : null);
    this.preferredSelectedAgentId = loadPreferredSelectedAgentId(
      typeof window !== 'undefined' ? window.localStorage : null,
    );

    this.selectAgent(this.agents[0] ?? null, false);

    this.cameraController = new CameraController(this, this.map.widthInPixels, this.map.heightInPixels);
    this.cameras.main.centerOn(this.map.widthInPixels / 2, this.map.heightInPixels / 2);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cameraController.destroy());
    this.scale.on('resize', this.syncScreenOverlayBounds, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', this.syncScreenOverlayBounds, this));
    this.syncScreenOverlayBounds();
    this.applyModePreset();
    this.applySceneUiMode();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 || this.spacePanKey.isDown) {
        return;
      }

      const clickedAgent = this.findAgentAtWorld(pointer.worldX, pointer.worldY);
      if (clickedAgent) {
        this.manualSelectionMade = true;
        this.selectAgent(clickedAgent);
        return;
      }

      if (this.serverAuthoritative) {
        this.manualSelectionMade = true;
        this.selectAgent(null);
        return;
      }

      if (!this.selectedAgent) {
        return;
      }

      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);

      const path = this.astar.findPath(this.selectedAgent.currentTile, { tileX, tileY });
      if (!path || path.length === 0) {
        this.showBlockedMarker(tileX, tileY);
        return;
      }

      this.selectedAgent.setPath(path);
    });
  }

  update(_time: number, delta: number): void {
    this.frameCounter += 1;
    this.cameraController.update(delta);
    this.updateFollowCamera();
    this.updateAgentCullingAndMovement(delta);
    this.updateAmbientParticles(delta);
    this.updateDayTint(delta);
    this.updateWeatherEffects(delta);
    this.updateLandmarkGuides(delta);
    this.updateDirectorCamera(delta);

    this.renderDebugOverlays();
    this.updateBlockedMarker(delta);
    this.updateSpeechBubbles(delta);

    this.fpsTimerMs += delta;
    if (this.fpsTimerMs >= 250) {
      this.fpsTimerMs = 0;
      const fps = Math.round(this.game.loop.actualFps);
      this.updateOverlayQuality(fps);
      if (this.fpsOverlay) {
        this.fpsOverlay.textContent = `FPS: ${fps} | Frame: ${delta.toFixed(1)}ms | Overlay x${this.overlayUpdateStride}`;
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
    this.serverAverageMood = computeAverageMood(agents);
    this.weatherProfile = resolveWeatherProfile(this.serverAverageMood, this.recentTopicTrail);
    this.syncServerAgents(agents);
    this.updateInfoText();
  }

  applyServerDelta(agents: AgentData[], gameTime: GameTime): void {
    this.serverAuthoritative = true;
    this.serverGameTime = gameTime;
    this.serverAverageMood = computeAverageMood(agents);
    this.weatherProfile = resolveWeatherProfile(this.serverAverageMood, this.recentTopicTrail);
    this.syncServerAgents(agents);
    this.updateInfoText();
  }

  getSelectedAgentId(): string | null {
    return this.selectedAgent?.agentId ?? null;
  }

  clearSelectedAgent(): boolean {
    const hadSelection = this.selectedAgent !== null;
    const hadFollowEnabled = this.followSelectedAgent;
    if (!hadSelection && !hadFollowEnabled) {
      return false;
    }

    this.manualSelectionMade = true;
    this.followSelectedAgent = false;
    this.selectAgent(null);
    return true;
  }

  setUiMode(mode: SceneUiMode): void {
    if (this.uiMode === mode) {
      return;
    }
    this.uiMode = mode;
    this.applyModePreset();
    this.applySceneUiMode();
  }

  focusAgentById(agentId: string): boolean {
    const sprite = this.agentsById.get(agentId);
    if (!sprite) {
      return false;
    }

    this.manualSelectionMade = true;
    this.selectAgent(sprite);
    this.centerCameraOn(sprite, 1);
    return true;
  }

  toggleFollowSelectedAgent(): boolean {
    this.followSelectedAgent = !this.followSelectedAgent;
    if (this.followSelectedAgent) {
      this.directorCurrentAgentId = null;
      this.directorFocusMs = 0;
    }
    if (this.followSelectedAgent && this.selectedAgent) {
      this.centerCameraOn(this.selectedAgent, 0.25);
    }
    this.updateInfoText();
    return this.followSelectedAgent;
  }

  toggleAutoDirector(): boolean {
    this.autoDirectorEnabled = !this.autoDirectorEnabled;
    if (!this.autoDirectorEnabled) {
      this.directorCurrentAgentId = null;
      this.directorFocusMs = 0;
    }
    this.updateInfoText();
    return this.autoDirectorEnabled;
  }

  toggleSelectedOnlySpeech(): boolean {
    this.selectedOnlySpeech = !this.selectedOnlySpeech;
    storeSelectedOnlySpeechEnabled(this.selectedOnlySpeech, typeof window !== 'undefined' ? window.localStorage : null);
    this.updateInfoText();
    return this.selectedOnlySpeech;
  }

  isFollowingSelectedAgent(): boolean {
    return this.followSelectedAgent;
  }

  isAutoDirectorEnabled(): boolean {
    return this.autoDirectorEnabled;
  }

  isSelectedOnlySpeech(): boolean {
    return this.selectedOnlySpeech;
  }

  toggleCameraPace(): CameraPace {
    this.cameraPace = this.cameraPace === 'smooth' ? 'snappy' : 'smooth';
    this.updateInfoText();
    return this.cameraPace;
  }

  getCameraPace(): CameraPace {
    return this.cameraPace;
  }

  addBookmarkForSelectedAgent(): string | null {
    const selectedAgentId = this.selectedAgent?.agentId ?? null;
    if (!selectedAgentId) {
      return null;
    }

    const next = addDirectorBookmark(
      {
        bookmarkAgentIds: this.directorBookmarkAgentIds,
        nextIndex: this.directorBookmarkIndex,
      },
      selectedAgentId,
      10,
    );
    this.directorBookmarkAgentIds = next.bookmarkAgentIds;
    this.directorBookmarkIndex = next.nextIndex;
    this.persistDirectorBookmarks();
    return selectedAgentId;
  }

  getDirectorBookmarkAgentIds(): string[] {
    return [...this.directorBookmarkAgentIds];
  }

  removeDirectorBookmark(agentId: string): boolean {
    const before = this.directorBookmarkAgentIds.length;
    this.directorBookmarkAgentIds = this.directorBookmarkAgentIds.filter((id) => id !== agentId);
    if (this.directorBookmarkAgentIds.length === before) {
      return false;
    }
    this.directorBookmarkIndex = 0;
    this.persistDirectorBookmarks();
    return true;
  }

  focusNextDirectorBookmark(): string | null {
    const next = nextDirectorBookmark({
      bookmarkAgentIds: this.directorBookmarkAgentIds,
      nextIndex: this.directorBookmarkIndex,
    });
    this.directorBookmarkIndex = next.state.nextIndex;
    if (!next.agentId) {
      return null;
    }

    if (!this.focusAgentById(next.agentId)) {
      this.directorBookmarkAgentIds = this.directorBookmarkAgentIds.filter((id) => id !== next.agentId);
      this.directorBookmarkIndex = 0;
      this.persistDirectorBookmarks();
      return null;
    }
    return next.agentId;
  }

  hasManualSelectionMade(): boolean {
    return this.manualSelectionMade;
  }

  togglePathOverlay(): boolean {
    this.pathOverlayEnabled = !this.pathOverlayEnabled;
    this.renderDebugOverlays(true);
    return this.pathOverlayEnabled;
  }

  togglePerceptionOverlay(): boolean {
    this.perceptionOverlayEnabled = !this.perceptionOverlayEnabled;
    this.renderDebugOverlays(true);
    return this.perceptionOverlayEnabled;
  }

  getDebugOverlayState(): DebugOverlayState {
    return {
      pathEnabled: this.pathOverlayEnabled,
      perceptionEnabled: this.perceptionOverlayEnabled,
      updateStride: this.overlayUpdateStride,
      pathSampleStep: this.overlayPathSampleStep,
      perceptionSuppressed: this.overlayPerceptionSuppressed,
    };
  }

  getPerfSummary(): ScenePerfSummary {
    let visibleSpeechBubbles = 0;
    for (const bubble of this.speechBubbles.values()) {
      if (bubble.container.visible) {
        visibleSpeechBubbles += 1;
      }
    }

    let queuedSpeechMessages = 0;
    for (const queue of this.pendingSpeechByAgent.values()) {
      queuedSpeechMessages += queue.length;
    }

    return {
      totalAgents: this.agents.length,
      visibleAgents: this.agents.filter((agent) => agent.visible).length,
      visibleSpeechBubbles,
      queuedSpeechMessages,
    };
  }

  applyServerEvents(events: unknown[]): void {
    for (const event of events) {
      if (!event || typeof event !== 'object') {
        continue;
      }

      const typed = event as Record<string, unknown>;
      if (typed.type === 'speechBubble') {
        if (typeof typed.agentId !== 'string' || typeof typed.message !== 'string') {
          continue;
        }

        const durationTicks = typeof typed.durationTicks === 'number' ? typed.durationTicks : 8;
        const durationMs = Math.max(400, Math.round(durationTicks * TICK_INTERVAL_MS));
        this.enqueueSpeechBubble(typed.agentId, typed.message, durationMs);
        continue;
      }

      if (typed.type === 'conversationStart') {
        const participants = Array.isArray(typed.participants) ? typed.participants : [];
        const primary = typeof participants[0] === 'string' ? participants[0] : null;
        if (primary) {
          this.enqueueDirectorCue(primary, 'conversation', 1);
        }
        continue;
      }

      if (typed.type === 'relationshipShift' && typeof typed.sourceId === 'string') {
        this.enqueueDirectorCue(typed.sourceId, 'relationship', 2);
        continue;
      }

      if (typed.type === 'topicSpread' && typeof typed.targetId === 'string') {
        if (typeof typed.topic === 'string') {
          this.recentTopicTrail.push(typed.topic);
          if (this.recentTopicTrail.length > 28) {
            this.recentTopicTrail.splice(0, this.recentTopicTrail.length - 28);
          }
          this.weatherProfile = resolveWeatherProfile(this.serverAverageMood, this.recentTopicTrail);
        }
        this.enqueueDirectorCue(typed.targetId, 'topic', 1);
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

    this.createTerrainVariance();

    if (!collisionLayer) {
      throw new Error('Map is missing required collision layer');
    }

    this.astar = AStar.fromTilemapLayer(collisionLayer.layer);
  }

  private createTerrainVariance(): void {
    this.terrainVarianceGraphics = this.add.graphics();
    this.terrainVarianceGraphics.setDepth(1);

    const palette = [0x4f7f4c, 0x5b8a52, 0x496f43];
    for (let tileY = 0; tileY < this.map.height; tileY += 1) {
      for (let tileX = 0; tileX < this.map.width; tileX += 1) {
        const seed = this.terrainSeed(tileX, tileY);
        if (seed % 11 !== 0) {
          continue;
        }
        const color = palette[seed % palette.length];
        const alpha = 0.024 + (seed % 5) * 0.006;
        this.terrainVarianceGraphics.fillStyle(color, alpha);
        this.terrainVarianceGraphics.fillRect(tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
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
    this.perceptionGraphics = this.add.graphics();
    this.perceptionGraphics.setDepth(89);

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

    this.dayTintOverlay = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x111827, 0);
    this.dayTintOverlay.setOrigin(0, 0);
    this.dayTintOverlay.setScrollFactor(0);
    this.dayTintOverlay.setDepth(980);

    this.rainGraphics = this.add.graphics();
    this.rainGraphics.setDepth(981);

    this.updateInfoText();
  }

  private createLandmarkGuides(): void {
    this.routeGraphics = this.add.graphics();
    this.routeGraphics.setDepth(4);
    this.routeGraphics.lineStyle(2, 0xb5de74, 0.28);

    const highlighted = DEFAULT_TOWN_LOCATIONS.filter((location) =>
      HIGHLIGHTED_LANDMARK_IDS.includes(location.id as (typeof HIGHLIGHTED_LANDMARK_IDS)[number]),
    );

    const routePoints = highlighted
      .map((location) => location.spawnPoint)
      .filter((point): point is { tileX: number; tileY: number } => Boolean(point))
      .map((point) => ({
        x: point.tileX * TILE_SIZE + TILE_SIZE / 2,
        y: point.tileY * TILE_SIZE + TILE_SIZE / 2,
      }));

    if (routePoints.length > 1) {
      this.routeGraphics.beginPath();
      this.routeGraphics.moveTo(routePoints[0].x, routePoints[0].y);
      for (let index = 1; index < routePoints.length; index += 1) {
        this.routeGraphics.lineTo(routePoints[index].x, routePoints[index].y);
      }
      this.routeGraphics.strokePath();
    }

    for (const location of highlighted) {
      const centerX = (location.bounds.x + location.bounds.width / 2) * TILE_SIZE;
      const centerY = (location.bounds.y + location.bounds.height / 2) * TILE_SIZE;
      const marker = this.add.rectangle(
        centerX,
        centerY,
        location.bounds.width * TILE_SIZE,
        location.bounds.height * TILE_SIZE,
        0x1f3b30,
        0.08,
      );
      marker.setStrokeStyle(1, 0xb9db90, 0.24);
      marker.setDepth(7);

      const accentRadius = Math.max(6, Math.min(location.bounds.width, location.bounds.height) * TILE_SIZE * 0.5);
      const accent = this.add.circle(centerX, centerY, accentRadius, 0xffe5a3, 0.03);
      accent.setDepth(6);

      const label = this.add.text(centerX, centerY - location.bounds.height * TILE_SIZE * 0.5 - 2, location.name, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#e8f6dc',
        backgroundColor: 'rgba(15, 29, 21, 0.38)',
      });
      label.setOrigin(0.5, 1);
      label.setDepth(8);

      this.landmarkGuides.push({
        locationId: location.id,
        marker,
        label,
        accent,
        accentRadius,
        centerX,
        centerY,
      });
    }
  }

  private createAmbientParticles(): void {
    for (let index = 0; index < 20; index += 1) {
      const dot = this.add.circle(
        this.rngFloat(0, this.map.widthInPixels),
        this.rngFloat(0, this.map.heightInPixels),
        this.rngFloat(0.6, 1.8),
        0xe6f7bc,
        this.rngFloat(0.05, 0.2),
      );
      dot.setDepth(6);
      this.ambientParticles.push({
        dot,
        vx: this.rngFloat(-4, 4),
        vy: this.rngFloat(-3, 3),
      });
    }
  }

  private updateAmbientParticles(deltaMs: number): void {
    const visible = this.uiMode === 'spectator';
    const dt = deltaMs / 1000;
    const weatherColor =
      this.weatherProfile.kind === 'storm'
        ? 0xa5c1de
        : this.weatherProfile.kind === 'drizzle'
          ? 0xb9d0e6
          : this.weatherProfile.kind === 'cloudy'
            ? 0xd5dfd2
            : 0xe6f7bc;

    for (const particle of this.ambientParticles) {
      particle.dot.setVisible(visible);
      if (!visible) {
        continue;
      }
      particle.dot.setFillStyle(weatherColor, this.weatherProfile.kind === 'clear' ? 0.12 : 0.08);

      particle.dot.x += particle.vx * dt;
      particle.dot.y += particle.vy * dt;

      if (particle.dot.x < 0) {
        particle.dot.x = this.map.widthInPixels;
      } else if (particle.dot.x > this.map.widthInPixels) {
        particle.dot.x = 0;
      }

      if (particle.dot.y < 0) {
        particle.dot.y = this.map.heightInPixels;
      } else if (particle.dot.y > this.map.heightInPixels) {
        particle.dot.y = 0;
      }
    }
  }

  private updateDayTint(deltaMs: number): void {
    this.dayTintTimerMs += deltaMs;
    if (this.dayTintTimerMs < 400) {
      return;
    }
    this.dayTintTimerMs = 0;

    const time = this.serverGameTime;
    if (!time) {
      this.dayTintOverlay.setFillStyle(0x1f2937, (this.uiMode === 'spectator' ? 0.03 : 0) + this.weatherProfile.tintAlphaBoost);
      return;
    }

    let tintColor = 0xffffff;
    let tintAlpha = 0;
    if (time.hour >= 6 && time.hour < 9) {
      tintColor = 0xf59e0b;
      tintAlpha = this.uiMode === 'spectator' ? 0.05 : 0.02;
    } else if (time.hour >= 9 && time.hour < 18) {
      tintColor = 0xffffff;
      tintAlpha = 0;
    } else if (time.hour >= 18 && time.hour < 21) {
      tintColor = 0xff8b3d;
      tintAlpha = this.uiMode === 'spectator' ? 0.08 : 0.04;
    } else {
      tintColor = 0x0f172a;
      tintAlpha = this.uiMode === 'spectator' ? 0.13 : 0.08;
    }

    if (this.weatherProfile.kind !== 'clear') {
      tintColor = this.weatherProfile.tintColor;
      tintAlpha += this.weatherProfile.tintAlphaBoost;
    }
    this.dayTintOverlay.setFillStyle(tintColor, Math.min(0.25, tintAlpha));
  }

  private updateWeatherEffects(deltaMs: number): void {
    this.rainUpdateTimerMs += deltaMs;
    if (this.rainUpdateTimerMs < 80) {
      return;
    }
    this.rainUpdateTimerMs = 0;

    this.rainGraphics.clear();
    if (this.weatherProfile.rainIntensity <= 0) {
      return;
    }

    const camera = this.cameras.main;
    const view = camera.worldView;
    const drops = Math.round(38 * this.weatherProfile.rainIntensity);
    const alpha = this.weatherProfile.kind === 'storm' ? 0.42 : 0.32;
    this.rainGraphics.lineStyle(1, 0xb9d8f2, alpha);
    for (let index = 0; index < drops; index += 1) {
      const x = view.x + Math.random() * view.width;
      const y = view.y + Math.random() * view.height;
      const length = this.weatherProfile.kind === 'storm' ? 11 : 8;
      this.rainGraphics.beginPath();
      this.rainGraphics.moveTo(x, y);
      this.rainGraphics.lineTo(x - 3, y + length);
      this.rainGraphics.strokePath();
    }
  }

  private updateLandmarkGuides(deltaMs: number): void {
    this.landmarkAccentPulseMs += deltaMs;
    this.landmarkGuideTimerMs += deltaMs;
    if (this.landmarkGuideTimerMs < 220) {
      return;
    }
    this.landmarkGuideTimerMs = 0;

    const showGuides = this.uiMode !== 'debug';
    this.routeGraphics?.setVisible(showGuides);
    if (!showGuides) {
      for (const guide of this.landmarkGuides) {
        guide.marker.setVisible(false);
        guide.label.setVisible(false);
        guide.accent.setVisible(false);
      }
      return;
    }

    const center = this.getCameraCenter();
    const maxDistance = this.uiMode === 'spectator' ? 220 : 320;
    const accentAlpha = resolveLandmarkAccentAlpha(this.serverGameTime);
    for (const guide of this.landmarkGuides) {
      const distance = Math.hypot(guide.centerX - center.x, guide.centerY - center.y);
      const visible = distance <= maxDistance;
      guide.marker.setVisible(visible);
      guide.label.setVisible(visible);
      guide.accent.setVisible(visible);
      if (visible) {
        const pulse = 0.78 + Math.sin(this.landmarkAccentPulseMs * 0.003 + guide.centerX * 0.01 + guide.centerY * 0.01) * 0.22;
        guide.accent.setFillStyle(0xffe5a3, accentAlpha * pulse);
        guide.accent.setRadius(guide.accentRadius * (0.88 + pulse * 0.16));
      }
    }
  }

  private syncScreenOverlayBounds(): void {
    if (!this.dayTintOverlay) {
      return;
    }

    this.dayTintOverlay.setPosition(0, 0);
    this.dayTintOverlay.setSize(this.scale.width, this.scale.height);
  }

  private selectAgent(agent: AgentSprite | null, persistPreference = true): void {
    this.selectedAgent?.setSelected(false);
    this.selectedAgent = agent;
    this.selectedAgent?.setSelected(true);
    if (persistPreference) {
      this.preferredSelectedAgentId = agent?.agentId ?? null;
      storePreferredSelectedAgentId(this.preferredSelectedAgentId, typeof window !== 'undefined' ? window.localStorage : null);
    }
    this.updateInfoText();
  }

  private updateInfoText(): void {
    const selected = this.selectedAgent?.agentName ?? 'None';
    const mode = this.serverAuthoritative ? (this.serverConnected ? 'Server' : 'Server (offline)') : 'Local';
    const timeText = this.serverGameTime
      ? `Day ${this.serverGameTime.day} ${String(this.serverGameTime.hour).padStart(2, '0')}:${String(this.serverGameTime.minute).padStart(2, '0')}`
      : 'No sim time';
    const followText = this.followSelectedAgent ? 'On' : 'Off';
    const directorText = this.autoDirectorEnabled ? 'On' : 'Off';

    this.infoText?.setText(
      `Mode: ${mode} | ${timeText} | Selected: ${selected} | Follow: ${followText} | Director: ${directorText} | Click agent to select | Hold Space + Drag to pan`,
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

  private renderDebugOverlays(force = false): void {
    if (!this.pathGraphics || !this.perceptionGraphics) {
      return;
    }

    if (this.uiMode !== 'debug') {
      this.pathGraphics.clear();
      this.perceptionGraphics.clear();
      return;
    }

    if (!force && this.frameCounter % this.overlayUpdateStride !== 0) {
      return;
    }

    this.pathGraphics.clear();
    this.perceptionGraphics.clear();
    if (!this.selectedAgent) {
      return;
    }

    if (this.pathOverlayEnabled) {
      const path = this.selectedAgent.getRemainingPath();
      if (path.length > 0) {
        this.pathGraphics.lineStyle(2, 0x8ec9ff, 0.9);
        this.pathGraphics.beginPath();
        this.pathGraphics.moveTo(this.selectedAgent.x, this.selectedAgent.y);

        for (let index = 0; index < path.length; index += this.overlayPathSampleStep) {
          const tile = path[index];
          const x = tile.tileX * TILE_SIZE + TILE_SIZE / 2;
          const y = tile.tileY * TILE_SIZE + TILE_SIZE / 2;
          this.pathGraphics.lineTo(x, y);
        }

        const last = path[path.length - 1];
        if ((path.length - 1) % this.overlayPathSampleStep !== 0) {
          this.pathGraphics.lineTo(last.tileX * TILE_SIZE + TILE_SIZE / 2, last.tileY * TILE_SIZE + TILE_SIZE / 2);
        }
        this.pathGraphics.strokePath();
      }
    }

    if (this.perceptionOverlayEnabled && !this.overlayPerceptionSuppressed) {
      this.perceptionGraphics.lineStyle(1, 0x67e8f9, 0.6);
      this.perceptionGraphics.fillStyle(0x67e8f9, 0.08);
      this.perceptionGraphics.fillCircle(this.selectedAgent.x, this.selectedAgent.y, TILE_SIZE * 4);
      this.perceptionGraphics.strokeCircle(this.selectedAgent.x, this.selectedAgent.y, TILE_SIZE * 4);
    }
  }

  private updateOverlayQuality(fps: number): void {
    const profile = overlayQualityProfileForFps(fps);
    if (this.uiMode === 'spectator') {
      this.overlayUpdateStride = Math.max(profile.updateStride, 2);
      this.overlayPathSampleStep = Math.max(profile.pathSampleStep, 2);
      this.overlayPerceptionSuppressed = true;
      return;
    }

    if (this.uiMode === 'story') {
      this.overlayUpdateStride = Math.max(profile.updateStride, 1);
      this.overlayPathSampleStep = Math.max(profile.pathSampleStep, 1);
      this.overlayPerceptionSuppressed = profile.suppressPerception;
      return;
    }

    this.overlayUpdateStride = profile.updateStride;
    this.overlayPathSampleStep = profile.pathSampleStep;
    this.overlayPerceptionSuppressed = profile.suppressPerception;
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

  private updateSpeechBubbles(deltaMs: number): void {
    const cameraCenter = this.getCameraCenter();
    const visibilityCandidates: Array<{
      agentId: string;
      selected: boolean;
      baseVisible: boolean;
      distanceToCamera: number;
    }> = [];
    const layoutEntries: Array<{
      agentId: string;
      x: number;
      y: number;
      container: Phaser.GameObjects.Container;
      width: number;
      height: number;
      preferredOffsetY: number;
      selected: boolean;
    }> = [];

    for (const [agentId, existingBubble] of this.speechBubbles.entries()) {
      let bubble = existingBubble;
      const sprite = this.agentsById.get(agentId);
      if (!sprite) {
        bubble.container.destroy();
        this.speechBubbles.delete(agentId);
        continue;
      }

      const selected = this.selectedAgent?.agentId === sprite.agentId;
      if (bubble.expanded !== selected) {
        this.showSpeechBubble(agentId, bubble.message, bubble.remainingMs, selected);
        const refreshed = this.speechBubbles.get(agentId);
        if (!refreshed) {
          continue;
        }
        bubble = refreshed;
      }

      const bubbleVisible = shouldShowSpeechBubble(
        selected,
        this.selectedOnlySpeech,
        sprite.visible,
        shouldRenderBubble(sprite.x, sprite.y, cameraCenter.x, cameraCenter.y),
      );
      visibilityCandidates.push({
        agentId,
        selected,
        baseVisible: bubbleVisible,
        distanceToCamera: Math.hypot(sprite.x - cameraCenter.x, sprite.y - cameraCenter.y),
      });
      if (bubbleVisible) {
        layoutEntries.push({
          agentId,
          x: sprite.x,
          y: sprite.y,
          container: bubble.container,
          width: bubble.width,
          height: bubble.height,
          preferredOffsetY: bubble.preferredOffsetY,
          selected,
        });
      }

      bubble.remainingMs -= deltaMs;
      if (bubble.remainingMs <= 0) {
        bubble.container.destroy();
        this.speechBubbles.delete(agentId);
      }
    }

    const maxBackgroundVisible =
      this.uiMode === 'spectator' ? 4 : this.uiMode === 'story' ? 7 : Number.POSITIVE_INFINITY;
    const visibleAgentIds = selectVisibleSpeechBubbleAgentIds(visibilityCandidates, maxBackgroundVisible);
    for (const candidate of visibilityCandidates) {
      const bubble = this.speechBubbles.get(candidate.agentId);
      bubble?.container.setVisible(visibleAgentIds.has(candidate.agentId));
    }
    for (const entry of layoutEntries) {
      if (!visibleAgentIds.has(entry.agentId)) {
        entry.container.setVisible(false);
      }
    }
    const visibleLayoutEntries = layoutEntries.filter((entry) => visibleAgentIds.has(entry.agentId));

    for (const [agentId, queue] of this.pendingSpeechByAgent.entries()) {
      if (queue.length === 0 || this.speechBubbles.has(agentId)) {
        continue;
      }

      const next = queue.shift();
      if (!next) {
        continue;
      }

      this.showSpeechBubble(agentId, next.message, next.durationMs);
      if (queue.length === 0) {
        this.pendingSpeechByAgent.delete(agentId);
      }
    }

    const offsets = layoutSpeechBubbleOffsets(visibleLayoutEntries, { minGapPx: 6, maxLiftPx: 52 });
    for (const entry of visibleLayoutEntries) {
      entry.container.setPosition(entry.x, entry.y + (offsets.get(entry.agentId) ?? entry.preferredOffsetY));
    }
  }

  private showSpeechBubble(agentId: string, message: string, durationMs: number, expandedOverride?: boolean): void {
    const sprite = this.agentsById.get(agentId);
    if (!sprite) {
      return;
    }

    const previous = this.speechBubbles.get(agentId);
    if (previous) {
      previous.container.destroy();
      this.speechBubbles.delete(agentId);
    }

    const wrapWidth = Math.max(120, Math.min(180, Math.round(this.scale.width * 0.24)));
    const maxTagCount = this.scale.width <= 900 ? 2 : 3;
    const tags = inferConversationTags(message)
      .slice(0, maxTagCount)
      .map((tag) => `#${tag}`)
      .join(' ');
    const selected = expandedOverride ?? this.selectedAgent?.agentId === agentId;
    const formatted = formatSpeechBubbleText(message, 120, selected, 220);
    const headerText = this.add.text(0, 0, `${sprite.agentName} ${tags}`.trim(), {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#12311d',
      align: 'center',
      wordWrap: { width: wrapWidth, useAdvancedWrap: false },
    });
    headerText.setOrigin(0.5);

    const text = this.add.text(0, 0, formatted.body, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#04121f',
      align: 'center',
      wordWrap: { width: wrapWidth, useAdvancedWrap: false },
    });
    text.setOrigin(0.5);

    const hintText = formatted.hint
      ? this.add.text(0, 0, formatted.hint, {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#345043',
          align: 'center',
          wordWrap: { width: wrapWidth, useAdvancedWrap: false },
        })
      : null;
    hintText?.setOrigin(0.5);

    const headerBounds = headerText.getBounds();
    const bounds = text.getBounds();
    const hintBounds = hintText?.getBounds() ?? null;
    const padding = 4;
    const width = Math.max(headerBounds.width, bounds.width, hintBounds?.width ?? 0) + padding * 2;
    const height = headerBounds.height + bounds.height + (hintBounds?.height ?? 0) + padding * (hintBounds ? 4 : 3);
    const bubble = this.add.rectangle(0, 0, width, height, 0xf8fafc, 0.92);
    bubble.setStrokeStyle(1, 0x0f172a, 0.55);
    bubble.setOrigin(0.5);
    headerText.setY(-height / 2 + headerBounds.height / 2 + padding);
    text.setY(headerText.y + headerBounds.height / 2 + bounds.height / 2 + padding + (hintBounds ? 1 : 0));
    if (hintText) {
      hintText.setY(text.y + bounds.height / 2 + hintBounds!.height / 2 + 2);
    }

    const children: Phaser.GameObjects.GameObject[] = hintText ? [bubble, headerText, text, hintText] : [bubble, headerText, text];
    const container = this.add.container(sprite.x, sprite.y - 16, children);
    container.setDepth(1100);

    this.speechBubbles.set(agentId, {
      container,
      remainingMs: durationMs,
      width,
      height,
      preferredOffsetY: -16,
      message,
      expanded: selected,
    });
  }

  private enqueueSpeechBubble(agentId: string, message: string, durationMs: number): void {
    const pending = this.pendingSpeechByAgent.get(agentId) ?? [];
    if (this.speechBubbles.has(agentId) || pending.length > 0) {
      this.pendingSpeechByAgent.set(agentId, enqueueSpeech(pending, { message, durationMs }, 2));
      return;
    }

    this.showSpeechBubble(agentId, message, durationMs);
  }

  private updateAgentCullingAndMovement(deltaMs: number): void {
    const cameraCenter = this.getCameraCenter();

    for (const agent of this.agents) {
      const lod = classifyAgentLod(agent.x, agent.y, cameraCenter.x, cameraCenter.y);
      const interval = movementUpdateInterval(lod);
      const selected = this.selectedAgent?.agentId === agent.agentId;

      if (!this.serverAuthoritative && this.frameCounter % interval === 0) {
        agent.updateMovement(deltaMs * interval);
      }

      agent.setVisible(selected || lod !== 'culled');
      agent.tickVisuals(deltaMs);
    }
  }

  private updateFollowCamera(): void {
    if (!this.followSelectedAgent || !this.selectedAgent) {
      return;
    }

    if (this.cameraController.isPanModifierPressed()) {
      return;
    }

    this.centerCameraOn(this.selectedAgent, 0.18);
  }

  private updateDirectorCamera(deltaMs: number): void {
    this.directorCooldownMs = Math.max(0, this.directorCooldownMs - deltaMs);
    this.directorFocusMs = Math.max(0, this.directorFocusMs - deltaMs);

    if (!this.autoDirectorEnabled) {
      this.directorCurrentAgentId = null;
      this.directorFocusMs = 0;
      return;
    }

    if (this.followSelectedAgent || this.cameraController.isPanModifierPressed()) {
      this.directorCurrentAgentId = null;
      this.directorFocusMs = 0;
      return;
    }

    if (!this.directorCurrentAgentId && this.directorCooldownMs <= 0 && this.directorFocusQueue.length > 0) {
      const { cue: next, nextQueue } = dequeueDirectorCue(this.directorFocusQueue);
      this.directorFocusQueue = nextQueue;
      if (next && this.agentsById.has(next.agentId)) {
        this.directorCurrentAgentId = next.agentId;
        this.directorFocusMs = this.uiMode === 'spectator' ? 1850 : 1250;
        this.directorCooldownMs = this.uiMode === 'spectator' ? 1900 : 1600;
      }
    }

    if (!this.directorCurrentAgentId) {
      this.cameras.main.setZoom(nextDirectorZoom(this.cameras.main.zoom, this.modeBaseZoom, 0.07));
      return;
    }

    const target = this.agentsById.get(this.directorCurrentAgentId);
    if (!target) {
      this.directorCurrentAgentId = null;
      return;
    }

    this.centerCameraOn(target, this.uiMode === 'spectator' ? 0.14 : 0.1);
    this.cameras.main.setZoom(nextDirectorZoom(this.cameras.main.zoom, this.modeFocusZoom, 0.08));
    if (this.directorFocusMs <= 0) {
      this.directorCurrentAgentId = null;
      this.cameras.main.setZoom(nextDirectorZoom(this.cameras.main.zoom, this.modeBaseZoom, 0.15));
    }
  }

  private centerCameraOn(agent: AgentSprite, lerpAmount: number): void {
    const camera = this.cameras.main;
    const paceBias = this.cameraPace === 'snappy' ? 0.18 : 0;
    const clampedLerp = Math.max(0, Math.min(1, lerpAmount + paceBias));
    const targetX = agent.x - camera.width / 2;
    const targetY = agent.y - camera.height / 2;
    const maxScrollX = Math.max(0, this.map.widthInPixels - camera.width);
    const maxScrollY = Math.max(0, this.map.heightInPixels - camera.height);
    const boundedX = Phaser.Math.Clamp(targetX, 0, maxScrollX);
    const boundedY = Phaser.Math.Clamp(targetY, 0, maxScrollY);

    camera.scrollX = Phaser.Math.Linear(camera.scrollX, boundedX, clampedLerp);
    camera.scrollY = Phaser.Math.Linear(camera.scrollY, boundedY, clampedLerp);
  }

  private applySceneUiMode(): void {
    const debugMode = this.uiMode === 'debug';
    this.infoText?.setVisible(debugMode);
    this.renderDebugOverlays(true);
    this.updateLandmarkGuides(220);
    this.updateInfoText();
  }

  private applyModePreset(): void {
    if (this.uiMode === 'spectator') {
      this.autoDirectorEnabled = true;
      this.modeBaseZoom = 1.02;
      this.modeFocusZoom = 1.1;
    } else if (this.uiMode === 'story') {
      this.autoDirectorEnabled = true;
      this.modeBaseZoom = 1;
      this.modeFocusZoom = 1.05;
    } else {
      this.autoDirectorEnabled = false;
      this.modeBaseZoom = 1;
      this.modeFocusZoom = 1.02;
    }

    this.directorFocusQueue.length = 0;
    this.directorCurrentAgentId = null;
    this.directorFocusMs = 0;
    this.directorCooldownMs = 0;
    this.cameras.main.setZoom(this.modeBaseZoom);
  }

  private enqueueDirectorCue(agentId: string, reason: string, priority: number): void {
    if (!this.autoDirectorEnabled) {
      return;
    }

    this.directorFocusQueue = pushDirectorCue(this.directorFocusQueue, { agentId, reason, priority }, 8);
  }

  private getCameraCenter(): { x: number; y: number } {
    const worldView = this.cameras.main.worldView;
    return {
      x: worldView.centerX,
      y: worldView.centerY,
    };
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

    const bookmarkState = pruneDirectorBookmarks(
      {
        bookmarkAgentIds: this.directorBookmarkAgentIds,
        nextIndex: this.directorBookmarkIndex,
      },
      activeIds,
    );
    if (
      bookmarkState.nextIndex !== this.directorBookmarkIndex ||
      bookmarkState.bookmarkAgentIds.length !== this.directorBookmarkAgentIds.length
    ) {
      this.directorBookmarkAgentIds = bookmarkState.bookmarkAgentIds;
      this.directorBookmarkIndex = bookmarkState.nextIndex;
      this.persistDirectorBookmarks();
    }

    const selectedAgentId = this.selectedAgent?.agentId ?? null;
    const mostActiveAgentId = this.pickMostActiveServerAgent(agents)?.agentId ?? null;
    const firstAgentId = this.agents[0]?.agentId ?? null;
    const nextSelectedAgentId = resolveSelectedAgentId({
      currentSelectedAgentId: selectedAgentId,
      preferredSelectedAgentId: this.preferredSelectedAgentId,
      activeAgentIds: activeIds,
      serverSelectionInitialized: this.serverSelectionInitialized,
      manualSelectionMade: this.manualSelectionMade,
      mostActiveAgentId,
      firstAgentId,
    });

    if (selectedAgentId !== nextSelectedAgentId) {
      const nextSelectedAgent = nextSelectedAgentId ? this.agentsById.get(nextSelectedAgentId) ?? null : null;
      this.selectAgent(nextSelectedAgent, nextSelectedAgentId !== null);
    }

    if (!this.serverSelectionInitialized) {
      this.serverSelectionInitialized = true;
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

  private pickMostActiveServerAgent(snapshotAgents: AgentData[]): AgentSprite | null {
    const cameraCenter = this.getCameraCenter();
    let bestSprite: AgentSprite | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const data of snapshotAgents) {
      const sprite = this.agentsById.get(data.id);
      if (!sprite) {
        continue;
      }

      const stateWeight =
        data.state === AgentState.Conversing
          ? 4
          : data.state === AgentState.Activity
            ? 3
            : data.state === AgentState.Walking
              ? 2
              : 1;

      const distance = Math.hypot(sprite.x - cameraCenter.x, sprite.y - cameraCenter.y);
      const proximityWeight = Math.max(0, 2.5 - distance / 160);
      const score = stateWeight + proximityWeight;

      if (score > bestScore) {
        bestScore = score;
        bestSprite = sprite;
      }
    }

    return bestSprite ?? this.agents[0] ?? null;
  }

  private rngFloat(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private terrainSeed(tileX: number, tileY: number): number {
    let n = Math.imul(tileX + 1, 374761393) ^ Math.imul(tileY + 1, 668265263);
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return n ^ (n >>> 16);
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

  private persistDirectorBookmarks(): void {
    storeDirectorBookmarkIds(this.directorBookmarkAgentIds, typeof window !== 'undefined' ? window.localStorage : null);
  }
}

function resolveLandmarkAccentAlpha(gameTime: GameTime | null): number {
  if (!gameTime) {
    return 0.05;
  }

  if (gameTime.hour >= 19 || gameTime.hour < 6) {
    return 0.14;
  }

  if (gameTime.hour >= 17 && gameTime.hour < 19) {
    return 0.1;
  }

  if (gameTime.hour >= 6 && gameTime.hour < 8) {
    return 0.08;
  }

  return 0.04;
}

function computeAverageMood(agents: AgentData[]): number | null {
  const moods = agents.map((agent) => agent.mood).filter((mood): mood is number => typeof mood === 'number');
  if (moods.length === 0) {
    return null;
  }
  return moods.reduce((sum, mood) => sum + mood, 0) / moods.length;
}
