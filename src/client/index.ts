import Phaser from 'phaser';
import { MAP_HEIGHT_TILES, MAP_WIDTH_TILES, TILE_SIZE } from '@shared/Constants';
import { DeltaEvent, SnapshotEvent } from '@shared/Events';
import { BootScene } from './game/scenes/BootScene';
import { TownScene } from './game/scenes/TownScene';
import { SimulationSocket } from './network/SimulationSocket';
import { InspectorPanel } from './ui/InspectorPanel';
import { LogPanel } from './ui/LogPanel';
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
const timeControls = new TimeControls({
  onControl: (action, value) => simulationSocket.sendControl(action, value),
});

uiManager.registerPanel(timeControls);
uiManager.registerPanel(inspectorPanel);
uiManager.registerPanel(logPanel);

const uiState: UISimulationState = {
  connected: false,
  tickId: 0,
  gameTime: null,
  agents: [],
  events: [],
};

simulationSocket.onConnection((connected) => {
  uiState.connected = connected;
  getTownScene()?.setServerConnectionState(connected);
});

simulationSocket.onSnapshot((event) => {
  applyServerEvent(event);
  const scene = getTownScene();
  scene?.setServerConnectionState(true);
  scene?.applyServerSnapshot(event.agents, event.gameTime);
});

simulationSocket.onDelta((event) => {
  applyServerEvent(event);
  const scene = getTownScene();
  scene?.setServerConnectionState(true);
  scene?.applyServerDelta(event.agents, event.gameTime);
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
