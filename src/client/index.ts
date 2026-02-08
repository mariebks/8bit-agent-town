import Phaser from 'phaser';
import { MAP_HEIGHT_TILES, MAP_WIDTH_TILES, TILE_SIZE } from '@shared/Constants';
import { DeltaEvent, SnapshotEvent } from '@shared/Events';
import { AmbientAudioController } from './audio/AmbientAudioController';
import { BootScene } from './game/scenes/BootScene';
import { TownScene } from './game/scenes/TownScene';
import { SimulationSocket } from './network/SimulationSocket';
import { AgentFinderPanel } from './ui/AgentFinderPanel';
import { DebugPanel } from './ui/DebugPanel';
import { HighlightsReelPanel } from './ui/HighlightsReelPanel';
import { InspectorPanel } from './ui/InspectorPanel';
import { LogPanel } from './ui/LogPanel';
import { ModeSwitcherPanel } from './ui/ModeSwitcherPanel';
import { OnboardingPanel } from './ui/OnboardingPanel';
import { PromptViewer } from './ui/PromptViewer';
import { RelationshipHeatmapPanel } from './ui/RelationshipHeatmapPanel';
import { StoryDigestPanel } from './ui/StoryDigestPanel';
import { TimelinePanel } from './ui/TimelinePanel';
import { pickFocusableInterestingAgent } from './ui/InterestingAgentJump';
import { UIEventBus } from './ui/UIEventBus';
import { UIManager } from './ui/UIManager';
import { WeatherStatusPanel } from './ui/WeatherStatusPanel';
import { applyFocusUiDataset, loadFocusUiEnabled, storeFocusUiEnabled } from './ui/FocusUi';
import { resolveModeShortcut, resolveOverlayShortcut, resolvePanelShortcut, resolveUtilityShortcut } from './ui/KeyboardShortcuts';
import { TimeControls } from './ui/TimeControls';
import { UISimulationState } from './ui/types';
import { nextUiDensity } from './ui/UiDensity';
import { nextUiMode } from './ui/UiMode';
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
const audioController = new AmbientAudioController();

const uiState: UISimulationState = {
  connected: false,
  tickId: 0,
  gameTime: null,
  metrics: null,
  agents: [],
  events: [],
  uiMode: uiManager.getMode(),
  uiDensity: uiManager.getDensity(),
  selectedAgentId: null,
  manualSelectionMade: false,
  followSelected: false,
  autoDirectorEnabled: true,
  audioEnabled: false,
  lastJumpedAgentId: null,
};

let focusUiEnabled = loadFocusUiEnabled(typeof window !== 'undefined' ? window.localStorage : null);
applyFocusUiDataset(focusUiEnabled, typeof document !== 'undefined' ? document.body.dataset : undefined);

function toggleFocusUi(): boolean {
  focusUiEnabled = !focusUiEnabled;
  applyFocusUiDataset(focusUiEnabled, typeof document !== 'undefined' ? document.body.dataset : undefined);
  storeFocusUiEnabled(focusUiEnabled, typeof window !== 'undefined' ? window.localStorage : null);
  return focusUiEnabled;
}

if (typeof window !== 'undefined') {
  audioController.bindUnlockGestures(window);
}

const logPanel = new LogPanel();
const inspectorPanel = new InspectorPanel({
  getSelectedAgentId: () => getTownScene()?.getSelectedAgentId() ?? null,
});
const debugPanel = new DebugPanel({
  getSelectedAgentId: () => getTownScene()?.getSelectedAgentId() ?? null,
  getOverlayState: () =>
    getTownScene()?.getDebugOverlayState() ?? {
      pathEnabled: true,
      perceptionEnabled: true,
      updateStride: 1,
      pathSampleStep: 1,
      perceptionSuppressed: false,
    },
  onTogglePathOverlay: () => {
    const enabled = getTownScene()?.togglePathOverlay();
    if (enabled === undefined) {
      return;
    }
    uiState.events = [
      ...uiState.events,
      {
        type: 'log',
        level: 'info',
        message: `debug path overlay ${enabled ? 'enabled' : 'disabled'}`,
      },
    ];
  },
  onTogglePerceptionOverlay: () => {
    const enabled = getTownScene()?.togglePerceptionOverlay();
    if (enabled === undefined) {
      return;
    }
    uiState.events = [
      ...uiState.events,
      {
        type: 'log',
        level: 'info',
        message: `debug perception overlay ${enabled ? 'enabled' : 'disabled'}`,
      },
    ];
  },
});
const promptViewer = new PromptViewer({
  getSelectedAgentId: () => getTownScene()?.getSelectedAgentId() ?? null,
});
const timelinePanel = new TimelinePanel({
  onFocusAgent: (agentId) => {
    const focused = getTownScene()?.focusAgentById(agentId) ?? false;
    if (focused) {
      uiState.lastJumpedAgentId = agentId;
      void audioController.playCue('jump');
    }
    return focused;
  },
});
const storyDigestPanel = new StoryDigestPanel();
const highlightsReelPanel = new HighlightsReelPanel();
const weatherStatusPanel = new WeatherStatusPanel();
const agentFinderPanel = new AgentFinderPanel({
  onFocusAgent: (agentId) => {
    const focused = getTownScene()?.focusAgentById(agentId) ?? false;
    if (focused) {
      uiState.lastJumpedAgentId = agentId;
      void audioController.playCue('jump');
    }
    return focused;
  },
});
const relationshipHeatmapPanel = new RelationshipHeatmapPanel({
  getSelectedAgentId: () => getTownScene()?.getSelectedAgentId() ?? null,
});
const onboardingPanel = new OnboardingPanel({
  getProgress: () => ({
    selectedAgent: Boolean(uiState.manualSelectionMade),
    followEnabled: Boolean(uiState.followSelected),
    jumpedToEvent: Boolean(uiState.lastJumpedAgentId),
  }),
  getDensity: () => uiManager.getDensity(),
  onToggleDensity: () => {
    const density = nextUiDensity(uiManager.getDensity());
    uiManager.setDensity(density);
    return density;
  },
  onResetProgress: () => {
    uiState.lastJumpedAgentId = null;
  },
});
const timeControls = new TimeControls({
  onControl: (action, value) => simulationSocket.sendControl(action, value),
  onToggleFollowSelected: () => getTownScene()?.toggleFollowSelectedAgent() ?? false,
  onToggleAutoDirector: () => getTownScene()?.toggleAutoDirector() ?? false,
  onToggleAudio: () => audioController.toggleEnabled(),
  onToggleHeatmap: () => uiManager.togglePanel('relationship-heatmap-panel'),
  onToggleFocusUi: () => toggleFocusUi(),
  onToggleSelectedOnlySpeech: () => getTownScene()?.toggleSelectedOnlySpeech() ?? false,
  onAddBookmark: () => {
    const bookmarked = getTownScene()?.addBookmarkForSelectedAgent() ?? null;
    if (bookmarked) {
      uiState.events = [
        ...uiState.events,
        {
          type: 'log',
          level: 'info',
          message: `director bookmark saved: ${bookmarked}`,
        },
      ];
    }
    return bookmarked;
  },
  onJumpToBookmark: () => {
    const focused = getTownScene()?.focusNextDirectorBookmark() ?? null;
    if (focused) {
      uiState.lastJumpedAgentId = focused;
      void audioController.playCue('jump');
    }
    return focused;
  },
  getFollowSelectedEnabled: () => getTownScene()?.isFollowingSelectedAgent() ?? false,
  getAutoDirectorEnabled: () => getTownScene()?.isAutoDirectorEnabled() ?? false,
  getAudioEnabled: () => audioController.isEnabled(),
  getHeatmapVisible: () => uiManager.isPanelVisible('relationship-heatmap-panel'),
  getFocusUiEnabled: () => focusUiEnabled,
  getSelectedOnlySpeechEnabled: () => getTownScene()?.isSelectedOnlySpeech() ?? false,
  onJumpToInteresting: () => {
    const scene = getTownScene();
    if (!scene) {
      return null;
    }

    const focused = pickFocusableInterestingAgent(
      () => timelinePanel.nextInterestingAgentId(),
      timelinePanel.interestingAgentCount(),
      (agentId) => scene.focusAgentById(agentId),
    );
    uiState.lastJumpedAgentId = focused;
    if (focused) {
      void audioController.playCue('jump');
    }
    return focused;
  },
});
const modeSwitcherPanel = new ModeSwitcherPanel({
  getMode: () => uiManager.getMode(),
  getDensity: () => uiManager.getDensity(),
  onModeChange: (mode) => {
    uiManager.setMode(mode);
  },
  onDensityChange: (density) => {
    uiManager.setDensity(density);
  },
});

uiManager.registerPanel(modeSwitcherPanel, {
  visibleIn: ['spectator', 'story', 'debug'],
});
uiManager.registerPanel(onboardingPanel, {
  visibleIn: ['spectator', 'story', 'debug'],
});
uiManager.registerPanel(storyDigestPanel, {
  visibleIn: ['spectator', 'story'],
});
uiManager.registerPanel(weatherStatusPanel, {
  visibleIn: ['spectator', 'story'],
});
uiManager.registerPanel(highlightsReelPanel, {
  visibleIn: ['spectator', 'story'],
});
uiManager.registerPanel(agentFinderPanel, {
  visibleIn: ['spectator', 'story', 'debug'],
});
uiManager.registerPanel(timelinePanel, {
  visibleIn: ['spectator', 'story', 'debug'],
});
uiManager.registerPanel(timeControls, {
  visibleIn: ['spectator', 'story', 'debug'],
});
uiManager.registerPanel(inspectorPanel, {
  visibleIn: ['story', 'debug'],
});
uiManager.registerPanel(relationshipHeatmapPanel, {
  visibleIn: ['story', 'debug'],
});
uiManager.registerPanel(debugPanel, {
  visibleIn: ['debug'],
  updateEvery: {
    spectator: 2,
    story: 2,
    debug: 1,
  },
});
uiManager.registerPanel(promptViewer, {
  visibleIn: ['debug'],
  updateEvery: {
    spectator: 2,
    story: 2,
    debug: 1,
  },
});
uiManager.registerPanel(logPanel, {
  visibleIn: ['debug'],
});

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

uiEventBus.on('ui:modeChanged', (mode) => {
  uiState.uiMode = mode as UISimulationState['uiMode'];
  getTownScene()?.setUiMode(uiState.uiMode);
  uiState.events = [
    ...uiState.events,
    {
      type: 'log',
      level: 'info',
      message: `mode switched: ${uiState.uiMode}`,
    },
  ];
});

uiEventBus.on('ui:densityChanged', (density) => {
  uiState.uiDensity = density as UISimulationState['uiDensity'];
  uiState.events = [
    ...uiState.events,
    {
      type: 'log',
      level: 'info',
      message: `ui density: ${uiState.uiDensity}`,
    },
  ];
});

simulationSocket.onSnapshot((event) => {
  applyServerEvent(event);
  const scene = getTownScene();
  scene?.setServerConnectionState(true);
  scene?.applyServerSnapshot(event.agents, event.gameTime);
  scene?.applyServerEvents(event.events ?? []);
  void audioController.setDayPart(event.gameTime);
  queueAudioCuesFromEvents(event.events ?? []);
});

simulationSocket.onDelta((event) => {
  applyServerEvent(event);
  const scene = getTownScene();
  scene?.setServerConnectionState(true);
  scene?.applyServerDelta(event.agents, event.gameTime);
  scene?.applyServerEvents(event.events ?? []);
  void audioController.setDayPart(event.gameTime);
  queueAudioCuesFromEvents(event.events ?? []);
});

simulationSocket.connect();

window.addEventListener('keydown', (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null;
  const shortcutInput = {
    key: event.key,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    targetTagName: target?.tagName,
    targetIsContentEditable: target?.isContentEditable,
  };
  const panelShortcut = resolvePanelShortcut(shortcutInput);
  const overlayShortcut = resolveOverlayShortcut(shortcutInput);
  const modeShortcut = resolveModeShortcut(shortcutInput);
  const utilityShortcut = resolveUtilityShortcut(shortcutInput);

  if (!panelShortcut && !overlayShortcut && !modeShortcut && !utilityShortcut) {
    return;
  }

  event.preventDefault();
  if (utilityShortcut === 'focus-agent-finder') {
    agentFinderPanel.focusQueryInput();
    return;
  }

  if (utilityShortcut === 'toggle-focus-ui') {
    toggleFocusUi();
    return;
  }

  if (modeShortcut === 'cycle-ui-mode') {
    uiManager.setMode(nextUiMode(uiManager.getMode()));
    return;
  }

  if (modeShortcut === 'cycle-ui-density') {
    uiManager.setDensity(nextUiDensity(uiManager.getDensity()));
    return;
  }

  if (panelShortcut) {
    const isVisible = uiManager.togglePanel(panelShortcut);
    uiState.events = [
      ...uiState.events,
      {
        type: 'log',
        level: 'info',
        message: `panel ${panelShortcut} ${isVisible ? 'shown' : 'hidden'}`,
      },
    ];
    return;
  }

  const scene = getTownScene();
  if (!scene || !overlayShortcut) {
    return;
  }

  if (overlayShortcut === 'path-overlay') {
    const enabled = scene.togglePathOverlay();
    uiState.events = [
      ...uiState.events,
      {
        type: 'log',
        level: 'info',
        message: `debug path overlay ${enabled ? 'enabled' : 'disabled'}`,
      },
    ];
    return;
  }

  const enabled = scene.togglePerceptionOverlay();
  uiState.events = [
    ...uiState.events,
    {
      type: 'log',
      level: 'info',
      message: `debug perception overlay ${enabled ? 'enabled' : 'disabled'}`,
    },
  ];
});

// Decouple DOM panel updates from render frames.
window.setInterval(() => {
  const scene = getTownScene();
  scene?.setUiMode(uiState.uiMode);
  uiState.selectedAgentId = scene?.getSelectedAgentId() ?? null;
  uiState.manualSelectionMade = scene?.hasManualSelectionMade() ?? false;
  uiState.followSelected = scene?.isFollowingSelectedAgent() ?? false;
  uiState.autoDirectorEnabled = scene?.isAutoDirectorEnabled() ?? false;
  uiState.audioEnabled = audioController.isEnabled();
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

function queueAudioCuesFromEvents(events: unknown[]): void {
  for (const event of events) {
    if (!event || typeof event !== 'object') {
      continue;
    }

    const typed = event as Record<string, unknown>;
    if (typed.type === 'relationshipShift') {
      void audioController.playCue('relationship');
      continue;
    }
    if (typed.type === 'conversationStart') {
      void audioController.playCue('conversation');
      continue;
    }
    if (typed.type === 'topicSpread') {
      void audioController.playCue('topic');
    }
  }
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
