import Phaser from 'phaser';
import { MAP_HEIGHT_TILES, MAP_WIDTH_TILES, TILE_SIZE } from '@shared/Constants';
import { DeltaEvent, SnapshotEvent } from '@shared/Events';
import { BootScene } from './game/scenes/BootScene';
import { TownScene } from './game/scenes/TownScene';
import { SimulationSocket } from './network/SimulationSocket';
import { DebugPanel } from './ui/DebugPanel';
import { InspectorPanel } from './ui/InspectorPanel';
import { LogPanel } from './ui/LogPanel';
import { PromptViewer } from './ui/PromptViewer';
import { UIEventBus } from './ui/UIEventBus';
import { UIManager } from './ui/UIManager';
import { TimeControls } from './ui/TimeControls';
import { UISimulationState } from './ui/types';
import './ui/styles/base.css';

const fallbackWidthPx = MAP_WIDTH_TILES * TILE_SIZE;
const fallbackHeightPx = MAP_HEIGHT_TILES * TILE_SIZE;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: fallbackWidthPx,
  height: fallbackHeightPx,
  pixelArt: true,
  backgroundColor: '#1a1a2e',
  scene: [BootScene, TownScene],
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

const simulationSocket = new SimulationSocket();
const uiEventBus = new UIEventBus();
const uiManager = new UIManager(uiEventBus);

const logPanel = new LogPanel();
const inspectorPanel = new InspectorPanel({
  getSelectedAgentId: () => getTownScene()?.getSelectedAgentId() ?? null,
});
const debugPanel = new DebugPanel({
  getSelectedAgentId: () => getTownScene()?.getSelectedAgentId() ?? null,
});
const promptViewer = new PromptViewer({
  getSelectedAgentId: () => getTownScene()?.getSelectedAgentId() ?? null,
});
const timeControls = new TimeControls({
  onControl: (action, value) => simulationSocket.sendControl(action, value),
});

uiManager.registerPanel(timeControls);
uiManager.registerPanel(inspectorPanel);
uiManager.registerPanel(debugPanel);
uiManager.registerPanel(promptViewer);
uiManager.registerPanel(logPanel);

const uiState: UISimulationState = {
  connected: false,
  tickId: 0,
  gameTime: null,
  metrics: null,
  agents: [],
  events: [],
};

simulationSocket.onConnection((connected) => {
  uiState.connected = connected;
  getTownScene()?.setServerConnectionState(connected);
});

simulationSocket.onJoinAck((ack) => {
  uiState.events = [
    ...uiState.events,
    {
      type: 'log',
      level: ack.accepted ? 'info' : 'error',
      message: ack.accepted
        ? `joined simulation protocol v${ack.protocolVersion}`
        : `join rejected: ${ack.reason ?? 'unknown reason'}`,
    },
  ];
});

simulationSocket.onControlAck((ack) => {
  uiState.events = [
    ...uiState.events,
    {
      type: 'log',
      level: ack.accepted ? 'info' : 'warn',
      message: ack.accepted ? `control accepted: ${ack.action}` : `control rejected: ${ack.reason ?? ack.action}`,
    },
  ];
});

simulationSocket.onSnapshot((event) => {
  applyServerEvent(event);
  const scene = getTownScene();
  scene?.setServerConnectionState(true);
  scene?.applyServerSnapshot(event.agents, event.gameTime);
  scene?.applyServerEvents(event.events ?? []);
});

simulationSocket.onDelta((event) => {
  applyServerEvent(event);
  const scene = getTownScene();
  scene?.setServerConnectionState(true);
  scene?.applyServerDelta(event.agents, event.gameTime);
  scene?.applyServerEvents(event.events ?? []);
});

simulationSocket.connect();

// Decouple DOM panel updates from render frames.
window.setInterval(() => {
  uiManager.updateAll(uiState);
  uiState.events = [];
}, 120);

declare global {
  interface Window {
    __agentTownGame?: Phaser.Game;
    __agentTownSocket?: SimulationSocket;
  }
}

if (typeof window !== 'undefined') {
  window.__agentTownGame = game;
  window.__agentTownSocket = simulationSocket;
}

function applyServerEvent(event: SnapshotEvent | DeltaEvent): void {
  uiState.tickId = event.tickId;
  uiState.gameTime = event.gameTime;
  uiState.metrics = event.metrics ?? uiState.metrics;
  uiState.agents = event.agents;
  uiState.events = [...uiState.events, ...(event.events ?? [])];
}

function getTownScene(): TownScene | null {
  try {
    const scene = game.scene.getScene('TownScene');
    if (scene instanceof TownScene) {
      return scene;
    }
  } catch {
    return null;
  }

  return null;
}
