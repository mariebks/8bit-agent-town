# Phase 7: UI Polish and Debug — Implementation Plan

## Objectives

Deliver an observer-friendly user interface with inspection tools and debugging support that allows users to:
1. Monitor and filter simulation events in real-time
2. Inspect any agent's plans, memories, and relationships with minimal clicks
3. Toggle debug overlays for paths, perception radius, and tick/queue stats
4. Export logs and view LLM prompts/responses for debugging
5. Achieve visual cohesion with pixel art assets and consistent 8-bit aesthetic

## Implementation Status (2026-02-06)

- [x] Inspector, prompt/response viewer, debug metrics panel, and JSON log export are implemented.
- [x] DOM panel updates are throttled (120ms interval), decoupled from the Phaser render loop.
- [x] Log panel now supports event-type and agent-id filtering.
- [x] Toggleable path/perception overlays implemented (`V`/`R` + panel buttons) with FPS-based downsample/suppression.
- [x] Keyboard shortcut layer implemented for panel toggles (`D`, `I`, `P`, `L`) with focus-safe input handling.

## Expert corrections (supersedes conflicting details below)

1. UI update budgets are required:
   - Non-critical DOM panels should update at throttled cadence (for example 5-10Hz), not every render frame.
   - Keep Phaser render loop and DOM updates decoupled.
2. Debug overlays must degrade gracefully:
   - Large overlays (paths, bounds, grids) should auto-disable or downsample under FPS pressure.
3. Prompt/response viewer safety:
   - Redact sensitive fields and cap stored prompt/response size per interaction.
   - Keep a bounded ring buffer rather than unbounded history.
4. Visual language consistency:
   - Treat emoji-based iconography as optional; default to pixel icons for cohesive style.
5. Usability on MacBook workflow:
   - Ensure keyboard shortcuts do not conflict with text inputs and browser defaults.
   - Confirm panel layouts remain usable on smaller laptop resolutions.

## Prerequisites

Before starting Phase 7, the following must be complete:
- Phase 6: Full town with 20+ agents, stable tick timing, bounded LLM queue
- WebSocket transport delivering state deltas and events to client
- Memory stream, relationship system, and planning system operational
- Basic client rendering with Phaser and agent sprites functional

## Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Window                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              HTML/CSS Overlay Layer                    │  │
│  │  ┌──────────┐ ┌──────────────┐ ┌──────────────────┐  │  │
│  │  │  Time    │ │   Inspector  │ │     Log Panel    │  │  │
│  │  │ Controls │ │    Panel     │ │  (filterable)    │  │  │
│  │  └──────────┘ └──────────────┘ └──────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │              Debug Overlay (toggleable)          │ │  │
│  │  │  • Path visualization  • Perception radius       │ │  │
│  │  │  • Tick/queue stats    • Prompt/response viewer  │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Phaser Canvas (game world)               │  │
│  │         Agents, Map, Speech Bubbles, Effects          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Separation of Concerns**: UI panels are pure HTML/CSS, not Phaser GameObjects
2. **Reactive Updates**: Panels subscribe to state changes via a pub/sub bus
3. **Performance**: DOM updates are batched; only visible data is rendered
4. **Keyboard-First**: All major actions have keyboard shortcuts
5. **Non-Intrusive Debug**: Debug overlays don't affect simulation logic

---

## Step-by-Step Implementation

### Task 1: UI Infrastructure and Panel Framework

**Goal**: Establish the HTML/CSS overlay system and panel lifecycle management.

#### 1.1 Create UI Container Structure

Create `src/client/ui/UIManager.ts`:
```typescript
interface UIPanel {
  id: string;
  element: HTMLElement;
  show(): void;
  hide(): void;
  update(state: GameState): void;
  destroy(): void;
}

class UIManager {
  private panels: Map<string, UIPanel>;
  private container: HTMLElement;
  
  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'ui-overlay';
    this.container.className = 'ui-overlay';
    document.body.appendChild(this.container);
  }
  
  registerPanel(panel: UIPanel): void;
  getPanel<T extends UIPanel>(id: string): T | undefined;
  updateAll(state: GameState): void;
  setLayout(layout: 'default' | 'compact' | 'debug'): void;
}
```

#### 1.2 Create Base CSS Framework

Create `src/client/ui/styles/base.css`:
```css
/* 8-bit aesthetic variables */
:root {
  --pixel-font: 'Press Start 2P', 'Courier New', monospace;
  --ui-bg: rgba(16, 24, 32, 0.92);
  --ui-border: #4a5568;
  --ui-accent: #68d391;
  --ui-text: #e2e8f0;
  --ui-text-dim: #718096;
  --ui-warning: #f6ad55;
  --ui-error: #fc8181;
}

.ui-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
}

.ui-panel {
  pointer-events: auto;
  background: var(--ui-bg);
  border: 2px solid var(--ui-border);
  font-family: var(--pixel-font);
  font-size: 10px;
  color: var(--ui-text);
  image-rendering: pixelated;
}
```

#### 1.3 Implement Event Bus for UI Updates

Create `src/client/ui/UIEventBus.ts`:
```typescript
type UIEventType = 
  | 'agent:selected'
  | 'agent:deselected'
  | 'state:updated'
  | 'log:new'
  | 'debug:toggle';

class UIEventBus {
  private listeners: Map<UIEventType, Set<Function>>;
  
  on(event: UIEventType, callback: Function): () => void;
  emit(event: UIEventType, payload?: any): void;
  off(event: UIEventType, callback: Function): void;
}
```

**Acceptance Criteria**:
- UI overlay container renders above Phaser canvas
- Panels can be registered, shown, hidden, and destroyed
- Event bus delivers updates within 16ms of state change
- CSS variables support easy theming

---

### Task 2: Log Panel Implementation

**Goal**: Create a filterable, scrollable event log panel.

#### 2.1 Log Panel Structure

Create `src/client/ui/LogPanel.ts`:
```typescript
interface LogEntry {
  id: string;
  timestamp: number;        // Game time
  realTime: number;         // Wall clock
  type: LogEventType;       // 'action' | 'dialogue' | 'reflection' | 'system'
  agentId?: string;
  agentName?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

type LogEventType = 'action' | 'dialogue' | 'reflection' | 'system' | 'memory' | 'plan';

interface LogFilters {
  types: Set<LogEventType>;
  agentIds: Set<string>;
  searchQuery: string;
  timeRange?: { start: number; end: number };
}

class LogPanel implements UIPanel {
  private entries: LogEntry[];
  private filteredEntries: LogEntry[];
  private filters: LogFilters;
  private maxEntries: number;       // Rolling window (e.g., 1000)
  private virtualScroller: VirtualScroller;
  
  constructor(options: LogPanelOptions);
  
  addEntry(entry: LogEntry): void;
  setFilters(filters: Partial<LogFilters>): void;
  exportToJSON(): string;
  clear(): void;
  scrollToBottom(): void;
  scrollToEntry(id: string): void;
}
```

#### 2.2 Log Panel HTML Template

```html
<div class="log-panel ui-panel" id="log-panel">
  <div class="log-header">
    <span class="log-title">Event Log</span>
    <div class="log-controls">
      <button class="log-btn" data-action="export" title="Export JSON">EXP</button>
      <button class="log-btn" data-action="clear" title="Clear">CLR</button>
      <button class="log-btn" data-action="scroll-lock" title="Auto-scroll">LOCK</button>
    </div>
  </div>
  
  <div class="log-filters">
    <input type="text" class="log-search" placeholder="Search...">
    <div class="log-type-filters">
      <label><input type="checkbox" data-type="action" checked> Actions</label>
      <label><input type="checkbox" data-type="dialogue" checked> Dialogue</label>
      <label><input type="checkbox" data-type="reflection" checked> Reflections</label>
      <label><input type="checkbox" data-type="system"> System</label>
    </div>
  </div>
  
  <div class="log-entries" id="log-entries">
    <!-- Virtual scrolling renders visible entries only -->
  </div>
  
  <div class="log-stats">
    <span id="log-count">0 entries</span>
    <span id="log-filtered">showing all</span>
  </div>
</div>
```

#### 2.3 Virtual Scrolling for Performance

Implement virtual scrolling to handle 1000+ log entries:
```typescript
class VirtualScroller {
  private itemHeight: number;
  private viewportHeight: number;
  private totalItems: number;
  private visibleStart: number;
  private visibleEnd: number;
  private buffer: number;  // Extra items above/below viewport
  
  setItems(items: LogEntry[]): void;
  getVisibleRange(): { start: number; end: number };
  render(container: HTMLElement, renderItem: (entry: LogEntry) => HTMLElement): void;
  scrollTo(index: number): void;
}
```

#### 2.4 Log Entry Styling by Type

```css
.log-entry {
  padding: 4px 8px;
  border-bottom: 1px solid var(--ui-border);
  display: flex;
  gap: 8px;
}

.log-entry[data-type="action"] .log-icon::before { content: '[ACT]'; }
.log-entry[data-type="dialogue"] .log-icon::before { content: '[DIA]'; }
.log-entry[data-type="reflection"] .log-icon::before { content: '[REF]'; }
.log-entry[data-type="system"] .log-icon::before { content: '[SYS]'; }
.log-entry[data-type="memory"] .log-icon::before { content: '[MEM]'; }
.log-entry[data-type="plan"] .log-icon::before { content: '[PLN]'; }

.log-timestamp {
  color: var(--ui-text-dim);
  min-width: 50px;
}

.log-agent {
  color: var(--ui-accent);
  cursor: pointer;
}

.log-agent:hover {
  text-decoration: underline;
}
```

**Acceptance Criteria**:
- Log panel displays entries with timestamps and icons
- Filtering by type updates immediately (<50ms)
- Search filters by content with debounced input
- Clicking agent name selects that agent in inspector
- Export produces valid JSON with all entries
- Virtual scrolling handles 1000+ entries at 60fps

---

### Task 3: Agent Inspector Panel

**Goal**: Show detailed agent information with plans, memories, and relationships.

#### 3.1 Inspector Panel Structure

Create `src/client/ui/InspectorPanel.ts`:
```typescript
interface InspectorData {
  agent: {
    id: string;
    name: string;
    age: number;
    occupation: string;
    traits: string[];
    bio: string;
  };
  status: {
    state: AgentState;
    position: { x: number; y: number };
    currentLocation: string;
    energy: number;
    hunger: number;
    mood: number;
  };
  cognition: {
    currentGoal: string;
    currentThought: string;
    planQueue: PlanItem[];
  };
  memories: {
    recent: Memory[];
    reflections: Memory[];
  };
  relationships: {
    name: string;
    weight: number;
    tags: string[];
  }[];
}

class InspectorPanel implements UIPanel {
  private selectedAgentId: string | null;
  private tabs: Map<string, HTMLElement>;
  private activeTab: string;
  
  constructor();
  
  selectAgent(agentId: string): void;
  deselectAgent(): void;
  setActiveTab(tab: 'overview' | 'plans' | 'memories' | 'relationships'): void;
  refresh(): void;
}
```

#### 3.2 Inspector HTML Template

```html
<div class="inspector-panel ui-panel" id="inspector-panel">
  <div class="inspector-header">
    <span class="inspector-title" id="inspector-title">No Agent Selected</span>
    <button class="inspector-close" data-action="close">✕</button>
  </div>
  
  <div class="inspector-tabs">
    <button class="tab active" data-tab="overview">Overview</button>
    <button class="tab" data-tab="plans">Plans</button>
    <button class="tab" data-tab="memories">Memories</button>
    <button class="tab" data-tab="relations">Relations</button>
  </div>
  
  <div class="inspector-content">
    <!-- Overview Tab -->
    <div class="tab-content active" id="tab-overview">
      <div class="agent-identity">
        <div class="agent-avatar" id="agent-avatar"></div>
        <div class="agent-info">
          <div class="agent-name" id="agent-name">—</div>
          <div class="agent-occupation" id="agent-occupation">—</div>
          <div class="agent-traits" id="agent-traits"></div>
        </div>
      </div>
      
      <div class="status-meters">
        <div class="meter">
          <span class="meter-label">Energy</span>
          <div class="meter-bar"><div class="meter-fill" id="meter-energy"></div></div>
        </div>
        <div class="meter">
          <span class="meter-label">Hunger</span>
          <div class="meter-bar"><div class="meter-fill" id="meter-hunger"></div></div>
        </div>
        <div class="meter">
          <span class="meter-label">Mood</span>
          <div class="meter-bar"><div class="meter-fill" id="meter-mood"></div></div>
        </div>
      </div>
      
      <div class="current-state">
        <div class="state-item">
          <span class="state-label">State:</span>
          <span class="state-value" id="current-state">—</span>
        </div>
        <div class="state-item">
          <span class="state-label">Location:</span>
          <span class="state-value" id="current-location">—</span>
        </div>
        <div class="state-item">
          <span class="state-label">Goal:</span>
          <span class="state-value" id="current-goal">—</span>
        </div>
      </div>
    </div>
    
    <!-- Plans Tab -->
    <div class="tab-content" id="tab-plans">
      <div class="plan-header">Current Plan Queue</div>
      <ul class="plan-list" id="plan-list"></ul>
    </div>
    
    <!-- Memories Tab -->
    <div class="tab-content" id="tab-memories">
      <div class="memory-section">
        <div class="memory-header">Recent Observations</div>
        <ul class="memory-list" id="memory-observations"></ul>
      </div>
      <div class="memory-section">
        <div class="memory-header">Reflections</div>
        <ul class="memory-list" id="memory-reflections"></ul>
      </div>
    </div>
    
    <!-- Relationships Tab -->
    <div class="tab-content" id="tab-relations">
      <div class="relations-header">Relationships</div>
      <ul class="relations-list" id="relations-list"></ul>
    </div>
  </div>
</div>
```

#### 3.3 Agent Selection Integration

Wire agent selection from Phaser canvas to inspector:
```typescript
// In TownScene.ts
this.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
  if (gameObject instanceof AgentSprite) {
    UIEventBus.emit('agent:selected', { agentId: gameObject.agentId });
  }
});

// Background click deselects
this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
  if (!pointer.downElement || pointer.downElement === this.game.canvas) {
    UIEventBus.emit('agent:deselected');
  }
});
```

#### 3.4 Inspector Styling

```css
.inspector-panel {
  position: fixed;
  right: 16px;
  top: 16px;
  width: 280px;
  max-height: calc(100vh - 32px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.inspector-tabs {
  display: flex;
  border-bottom: 2px solid var(--ui-border);
}

.tab {
  flex: 1;
  padding: 8px 4px;
  background: transparent;
  border: none;
  color: var(--ui-text-dim);
  cursor: pointer;
  font-family: var(--pixel-font);
  font-size: 8px;
}

.tab.active {
  color: var(--ui-accent);
  border-bottom: 2px solid var(--ui-accent);
}

.status-meters .meter {
  margin: 8px 0;
}

.meter-bar {
  height: 8px;
  background: var(--ui-border);
  border-radius: 2px;
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  background: var(--ui-accent);
  transition: width 0.3s ease;
}

.meter-fill.low { background: var(--ui-error); }
.meter-fill.medium { background: var(--ui-warning); }

.relations-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.relation-weight {
  color: var(--ui-accent);
}

.relation-weight.negative {
  color: var(--ui-error);
}
```

**Acceptance Criteria**:
- Clicking an agent in the game selects them in inspector
- Tab switching is instant with no layout shift
- Status meters update in real-time
- Plan queue shows all items with clear ordering
- Memories show timestamp and importance score
- Relationships sorted by weight, show tags
- Close button deselects agent

---

### Task 4: Time Controls Panel

**Goal**: Provide intuitive pause, speed, and time display controls.

#### 4.1 Time Controls Structure

Create `src/client/ui/TimeControls.ts`:
```typescript
type GameSpeed = 0 | 1 | 2 | 4 | 10;

interface TimeState {
  isPaused: boolean;
  speed: GameSpeed;
  gameTime: number;      // Minutes since start
  dayNumber: number;
  timeOfDay: string;     // "Morning", "Afternoon", etc.
  clockString: string;   // "Day 3 - 14:30"
}

class TimeControls implements UIPanel {
  private state: TimeState;
  private onSpeedChange: (speed: GameSpeed) => void;
  private onPauseToggle: (paused: boolean) => void;
  
  constructor(callbacks: TimeControlCallbacks);
  
  setSpeed(speed: GameSpeed): void;
  togglePause(): void;
  update(state: TimeState): void;
  
  // Keyboard shortcuts
  private bindKeyboard(): void;
}
```

#### 4.2 Time Controls HTML

```html
<div class="time-controls ui-panel" id="time-controls">
  <div class="time-display">
    <div class="day-counter" id="day-counter">Day 1</div>
    <div class="clock" id="game-clock">06:00</div>
    <div class="time-of-day" id="time-of-day">Morning</div>
  </div>
  
  <div class="speed-controls">
    <button class="speed-btn" data-speed="0" title="Pause (Space)">PAUSE</button>
    <button class="speed-btn active" data-speed="1" title="1x (1)">1×</button>
    <button class="speed-btn" data-speed="2" title="2x (2)">2×</button>
    <button class="speed-btn" data-speed="4" title="4x (3)">4×</button>
    <button class="speed-btn" data-speed="10" title="10x (4)">10×</button>
  </div>
  
  <div class="time-progress">
    <div class="day-progress-bar">
      <div class="day-progress-fill" id="day-progress"></div>
    </div>
  </div>
</div>
```

#### 4.3 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Toggle pause |
| 1 | Set speed 1x |
| 2 | Set speed 2x |
| 3 | Set speed 4x |
| 4 | Set speed 10x |
| Escape | Deselect agent |
| D | Toggle debug overlay |
| L | Focus log search |

```typescript
private bindKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        this.togglePause();
        break;
      case 'Digit1':
        this.setSpeed(1);
        break;
      case 'Digit2':
        this.setSpeed(2);
        break;
      case 'Digit3':
        this.setSpeed(4);
        break;
      case 'Digit4':
        this.setSpeed(10);
        break;
    }
  });
}
```

#### 4.4 Time Controls Styling

```css
.time-controls {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.time-display {
  text-align: center;
}

.day-counter {
  font-size: 12px;
  color: var(--ui-accent);
}

.clock {
  font-size: 16px;
  font-weight: bold;
}

.time-of-day {
  font-size: 8px;
  color: var(--ui-text-dim);
}

.speed-controls {
  display: flex;
  gap: 4px;
}

.speed-btn {
  width: 32px;
  height: 24px;
  background: transparent;
  border: 1px solid var(--ui-border);
  color: var(--ui-text);
  cursor: pointer;
  font-family: var(--pixel-font);
  font-size: 8px;
}

.speed-btn.active {
  background: var(--ui-accent);
  color: var(--ui-bg);
}

.speed-btn:hover:not(.active) {
  border-color: var(--ui-accent);
}

.day-progress-bar {
  width: 100px;
  height: 4px;
  background: var(--ui-border);
  border-radius: 2px;
}

.day-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4a5568 0%, #f6ad55 50%, #4a5568 100%);
  transition: width 0.2s ease;
}
```

**Acceptance Criteria**:
- Time display updates every tick
- Speed buttons reflect current speed
- Pause/resume works via button and Space key
- Day progress bar shows position in day cycle
- Speed change takes effect within one tick
- Keyboard shortcuts work when not typing in input

---

### Task 5: Debug Overlays

**Goal**: Provide toggleable visual debugging tools for paths, perception, and stats.

#### 5.1 Debug Overlay Manager

Create `src/client/ui/DebugOverlay.ts`:
```typescript
interface DebugOptions {
  showPaths: boolean;
  showPerceptionRadius: boolean;
  showTickStats: boolean;
  showLLMQueue: boolean;
  showGridLines: boolean;
  showLocationBounds: boolean;
}

class DebugOverlay implements UIPanel {
  private options: DebugOptions;
  private graphics: Phaser.GameObjects.Graphics;
  private statsText: Phaser.GameObjects.Text;
  
  constructor(scene: Phaser.Scene);
  
  setOption(key: keyof DebugOptions, value: boolean): void;
  toggleOption(key: keyof DebugOptions): void;
  
  // Called each frame
  render(state: DebugState): void;
  
  private renderPaths(agents: AgentState[]): void;
  private renderPerceptionRadius(agent: AgentState): void;
  private renderTickStats(stats: TickStats): void;
  private renderLLMQueue(queue: LLMQueueStatus): void;
  private renderGridLines(): void;
  private renderLocationBounds(locations: Location[]): void;
}
```

#### 5.2 Path Visualization

Draw agent movement paths on the Phaser canvas:
```typescript
private renderPaths(agents: AgentState[]): void {
  if (!this.options.showPaths) return;
  
  this.graphics.clear();
  
  for (const agent of agents) {
    if (!agent.path || agent.path.length === 0) continue;
    
    // Draw path line
    this.graphics.lineStyle(2, 0x68d391, 0.6);
    this.graphics.beginPath();
    this.graphics.moveTo(agent.position.x, agent.position.y);
    
    for (const point of agent.path) {
      this.graphics.lineTo(point.x * TILE_SIZE + TILE_SIZE / 2, point.y * TILE_SIZE + TILE_SIZE / 2);
    }
    
    this.graphics.strokePath();
    
    // Draw destination marker
    const dest = agent.path[agent.path.length - 1];
    this.graphics.fillStyle(0x68d391, 0.8);
    this.graphics.fillCircle(dest.x * TILE_SIZE + TILE_SIZE / 2, dest.y * TILE_SIZE + TILE_SIZE / 2, 4);
  }
}
```

#### 5.3 Perception Radius

Show the perception area for selected agent:
```typescript
private renderPerceptionRadius(agent: AgentState): void {
  if (!this.options.showPerceptionRadius || !agent) return;
  
  const PERCEPTION_RADIUS = 64; // pixels
  
  // Semi-transparent circle
  this.graphics.lineStyle(2, 0x68d391, 0.8);
  this.graphics.strokeCircle(agent.position.x, agent.position.y, PERCEPTION_RADIUS);
  
  // Fill with very low alpha
  this.graphics.fillStyle(0x68d391, 0.1);
  this.graphics.fillCircle(agent.position.x, agent.position.y, PERCEPTION_RADIUS);
  
  // Mark perceived agents
  for (const perceivedId of agent.perceivedAgents) {
    const perceived = this.getAgentPosition(perceivedId);
    if (perceived) {
      this.graphics.lineStyle(1, 0xf6ad55, 0.5);
      this.graphics.lineBetween(
        agent.position.x, agent.position.y,
        perceived.x, perceived.y
      );
    }
  }
}
```

#### 5.4 Stats HUD

Create `src/client/ui/StatsHUD.ts`:
```typescript
interface TickStats {
  tickNumber: number;
  tickDuration: number;
  avgTickDuration: number;
  agentCount: number;
  activeDecisions: number;
}

interface LLMQueueStatus {
  pending: number;
  processing: boolean;
  avgResponseTime: number;
  lastError?: string;
}

class StatsHUD {
  private element: HTMLElement;
  
  constructor();
  
  update(tickStats: TickStats, llmStatus: LLMQueueStatus): void;
}
```

HTML for stats HUD:
```html
<div class="stats-hud ui-panel" id="stats-hud">
  <div class="stat-row">
    <span class="stat-label">Tick:</span>
    <span class="stat-value" id="stat-tick">0</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">Tick Time:</span>
    <span class="stat-value" id="stat-tick-time">0ms</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">Agents:</span>
    <span class="stat-value" id="stat-agents">0</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">LLM Queue:</span>
    <span class="stat-value" id="stat-llm-queue">0</span>
  </div>
  <div class="stat-row">
    <span class="stat-label">LLM Avg:</span>
    <span class="stat-value" id="stat-llm-avg">0ms</span>
  </div>
</div>
```

#### 5.5 Debug Toggle Controls

```html
<div class="debug-controls ui-panel" id="debug-controls">
  <div class="debug-title">Debug (D to toggle)</div>
  <label class="debug-option">
    <input type="checkbox" data-debug="showPaths"> Show Paths
  </label>
  <label class="debug-option">
    <input type="checkbox" data-debug="showPerceptionRadius"> Perception Radius
  </label>
  <label class="debug-option">
    <input type="checkbox" data-debug="showGridLines"> Grid Lines
  </label>
  <label class="debug-option">
    <input type="checkbox" data-debug="showLocationBounds"> Location Bounds
  </label>
  <label class="debug-option">
    <input type="checkbox" data-debug="showTickStats" checked> Tick Stats
  </label>
  <label class="debug-option">
    <input type="checkbox" data-debug="showLLMQueue" checked> LLM Queue
  </label>
</div>
```

**Acceptance Criteria**:
- Debug panel toggles with D key
- Path visualization shows current path for all walking agents
- Perception radius shows for selected agent only
- Stats HUD updates at least once per second
- Grid lines align exactly with tile boundaries
- Location bounds match Tiled object layer data
- All overlays have no measurable FPS impact (<1ms)

---

### Task 6: Prompt/Response Viewer

**Goal**: Allow debugging of LLM interactions for any selected agent.

#### 6.1 LLM Debug Panel

Create `src/client/ui/LLMDebugPanel.ts`:
```typescript
interface LLMInteraction {
  id: string;
  timestamp: number;
  agentId: string;
  type: 'action' | 'dialogue' | 'reflection' | 'plan';
  prompt: string;
  response: string;
  responseTime: number;
  success: boolean;
  error?: string;
}

class LLMDebugPanel implements UIPanel {
  private interactions: Map<string, LLMInteraction[]>;  // By agent
  private selectedAgentId: string | null;
  private maxInteractionsPerAgent: number;
  
  constructor();
  
  addInteraction(interaction: LLMInteraction): void;
  showForAgent(agentId: string): void;
  formatPrompt(prompt: string): string;  // Syntax highlighting
  formatResponse(response: string): string;
}
```

#### 6.2 Compact Viewer HTML

```html
<div class="llm-debug-panel ui-panel" id="llm-debug-panel">
  <div class="llm-debug-header">
    <span class="llm-debug-title">LLM Debug</span>
    <select id="llm-interaction-select">
      <option value="">Select interaction...</option>
    </select>
  </div>
  
  <div class="llm-interaction-details">
    <div class="llm-section">
      <div class="llm-section-header">
        <span>Prompt</span>
        <button class="copy-btn" data-target="prompt" title="Copy">COPY</button>
      </div>
      <pre class="llm-prompt" id="llm-prompt"></pre>
    </div>
    
    <div class="llm-section">
      <div class="llm-section-header">
        <span>Response</span>
        <span class="response-time" id="response-time"></span>
        <button class="copy-btn" data-target="response" title="Copy">COPY</button>
      </div>
      <pre class="llm-response" id="llm-response"></pre>
    </div>
  </div>
  
  <div class="llm-stats">
    <span id="llm-interaction-count">0 interactions</span>
  </div>
</div>
```

#### 6.3 Syntax Highlighting

```typescript
private formatPrompt(prompt: string): string {
  // Highlight JSON blocks
  const jsonRegex = /```json\n([\s\S]*?)\n```/g;
  prompt = prompt.replace(jsonRegex, '<code class="json">$1</code>');
  
  // Highlight system/user/assistant markers
  prompt = prompt.replace(/(System:|User:|Assistant:)/g, '<span class="role">$1</span>');
  
  // Highlight memory references
  prompt = prompt.replace(/\[Memory: (.*?)\]/g, '<span class="memory">[Memory: $1]</span>');
  
  return prompt;
}

private formatResponse(response: string): string {
  try {
    const parsed = JSON.parse(response);
    return `<code class="json">${JSON.stringify(parsed, null, 2)}</code>`;
  } catch {
    return `<span class="raw">${escapeHtml(response)}</span>`;
  }
}
```

#### 6.4 Styling

```css
.llm-debug-panel {
  position: fixed;
  left: 16px;
  bottom: 16px;
  width: 400px;
  max-height: 300px;
  display: none;
}

.llm-debug-panel.visible {
  display: block;
}

.llm-prompt, .llm-response {
  max-height: 100px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.3);
  padding: 8px;
  margin: 4px 0;
  font-size: 9px;
  white-space: pre-wrap;
  word-break: break-all;
}

.llm-prompt .role {
  color: var(--ui-accent);
  font-weight: bold;
}

.llm-prompt .memory {
  color: var(--ui-warning);
}

.llm-response .json {
  color: var(--ui-text);
}

.response-time {
  color: var(--ui-text-dim);
  font-size: 8px;
}
```

**Acceptance Criteria**:
- Panel shows last 10 LLM interactions for selected agent
- Dropdown allows selecting any interaction
- Prompt and response display with syntax highlighting
- Copy buttons work for both prompt and response
- Response time shown in milliseconds
- Panel only visible when debug mode is on

---

### Task 7: Log Export to JSON

**Goal**: Enable export of event logs for replay and debugging.

#### 7.1 Export Format

```typescript
interface LogExport {
  version: string;
  exportedAt: string;
  gameTime: {
    start: number;
    end: number;
    dayStart: number;
    dayEnd: number;
  };
  filters: LogFilters;
  entries: LogEntry[];
  agents: {
    id: string;
    name: string;
  }[];
  stats: {
    totalEntries: number;
    byType: Record<LogEventType, number>;
    byAgent: Record<string, number>;
  };
}
```

#### 7.2 Export Implementation

```typescript
class LogPanel {
  exportToJSON(): string {
    const export_data: LogExport = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      gameTime: {
        start: this.entries[0]?.timestamp ?? 0,
        end: this.entries[this.entries.length - 1]?.timestamp ?? 0,
        dayStart: Math.floor(this.entries[0]?.timestamp / MINUTES_PER_DAY) ?? 0,
        dayEnd: Math.floor(this.entries[this.entries.length - 1]?.timestamp / MINUTES_PER_DAY) ?? 0,
      },
      filters: this.filters,
      entries: this.filteredEntries,
      agents: this.getUniqueAgents(),
      stats: this.calculateStats(),
    };
    
    return JSON.stringify(export_data, null, 2);
  }
  
  downloadExport(): void {
    const json = this.exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `town-log-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
  }
}
```

**Acceptance Criteria**:
- Export button downloads JSON file
- File contains all entries matching current filters
- Stats section summarizes entry counts
- File is valid JSON and can be re-imported
- Filename includes current date

---

### Task 8: Final Asset Pass

**Goal**: Ensure visual cohesion with consistent 8-bit aesthetic.

#### 8.1 Asset Audit Checklist

| Asset Type | Requirements | Location |
|------------|--------------|----------|
| Tileset | 16×16 tiles, max 4-color palette per tile, no anti-aliasing | `assets/tiles/` |
| Agent sprites | 16×16 or 16×24, 4-frame walk cycle, consistent palette | `assets/sprites/agents/` |
| UI icons | 8×8 or 16×16, same palette as UI theme | `assets/ui/` |
| Speech bubbles | Pixel-perfect borders, no gradients | Generated or `assets/ui/` |

#### 8.2 Palette Standardization

Define a master 8-bit palette:
```typescript
// src/client/constants/Palette.ts
export const PALETTE = {
  // Background colors
  BG_DARK: 0x101820,
  BG_MEDIUM: 0x2d3748,
  BG_LIGHT: 0x4a5568,
  
  // Accent colors
  ACCENT_GREEN: 0x68d391,
  ACCENT_BLUE: 0x63b3ed,
  ACCENT_ORANGE: 0xf6ad55,
  ACCENT_RED: 0xfc8181,
  
  // Text colors
  TEXT_LIGHT: 0xe2e8f0,
  TEXT_DIM: 0x718096,
  
  // World colors (for tiles/sprites)
  GRASS_DARK: 0x2d5016,
  GRASS_LIGHT: 0x4a7c23,
  WATER: 0x3182ce,
  STONE: 0x718096,
  WOOD: 0x8b6914,
  ROOF: 0xc53030,
};
```

#### 8.3 Scaling Configuration

Ensure pixel-perfect rendering:
```typescript
// Phaser config
const config: Phaser.Types.Core.GameConfig = {
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 2,  // 2x or 3x scaling
  },
};

// CSS for UI
.ui-panel {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```

#### 8.4 Font Loading

Load pixel font for UI:
```css
@font-face {
  font-family: 'Press Start 2P';
  src: url('/assets/fonts/PressStart2P-Regular.ttf') format('truetype');
  font-display: swap;
}
```

#### 8.5 Asset Replacement Guide

For each placeholder asset that needs replacement:
1. Maintain exact dimensions (16×16 base)
2. Use only colors from PALETTE
3. No transparency gradients (only 0% or 100% alpha)
4. Test at 1x, 2x, and 3x zoom
5. Verify no sub-pixel positioning

**Acceptance Criteria**:
- All sprites use consistent palette
- No blurry or anti-aliased edges visible
- UI font is pixel-perfect at all sizes
- Zoom levels (1x, 2x, 3x) produce clean scaling
- Speech bubbles match overall aesthetic

---

## Dependencies

### External Dependencies
None new required. Uses existing project dependencies:
- Phaser 3 (rendering, input)
- TypeScript (type safety)
- Vite (bundling)

### Internal Dependencies
- Phase 6 complete (20+ agents, stable simulation)
- WebSocket transport operational
- Memory and relationship systems functional

## Potential Challenges

| Challenge | Mitigation |
|-----------|------------|
| DOM updates causing frame drops | Batch DOM updates, use requestAnimationFrame, limit update frequency to 10Hz for non-critical UI |
| Virtual scrolling complexity | Use proven virtual scroll pattern, test with 1000+ entries |
| Phaser/DOM interaction latency | Use event bus with debouncing, avoid synchronous cross-context calls |
| Pixel font rendering issues | Test across browsers, provide fallback font stack |
| Debug overlay performance | Use Graphics object pooling, clear and redraw only visible elements |

## Success Criteria

1. **Usability**
   - [ ] Select any agent with single click
   - [ ] View agent plans, memories, relationships within 2 clicks
   - [ ] Filter log by type and agent with immediate response
   - [ ] Export log to JSON successfully

2. **Performance**
   - [ ] UI updates do not cause frame drops (<16ms)
   - [ ] Log panel handles 1000+ entries at 60fps
   - [ ] Debug overlays add <1ms to frame time

3. **Debugging**
   - [ ] Toggle debug overlays with single keypress
   - [ ] View last 10 LLM prompts/responses per agent
   - [ ] Stats HUD shows accurate tick and queue metrics

4. **Visual Cohesion**
   - [ ] All assets use consistent 8-bit palette
   - [ ] No blurry or anti-aliased pixels visible
   - [ ] UI matches game aesthetic

## File Structure (New/Modified)

```
src/client/
  ui/
    UIManager.ts          (new)
    UIEventBus.ts         (new)
    LogPanel.ts           (new)
    InspectorPanel.ts     (new)
    TimeControls.ts       (new)
    DebugOverlay.ts       (new)
    LLMDebugPanel.ts      (new)
    StatsHUD.ts           (new)
    styles/
      base.css            (new)
      log-panel.css       (new)
      inspector.css       (new)
      time-controls.css   (new)
      debug.css           (new)
  constants/
    Palette.ts            (new)
  game/
    scenes/
      TownScene.ts        (modified - add agent selection events)
public/
  assets/
    fonts/
      PressStart2P-Regular.ttf  (new)
```

## Testing Checklist

### Manual Testing
- [ ] Select agent by clicking sprite
- [ ] Deselect by clicking background
- [ ] All inspector tabs display correct data
- [ ] Log filters work individually and combined
- [ ] Search filters log in real-time
- [ ] Export produces valid JSON
- [ ] All keyboard shortcuts work
- [ ] Speed changes take effect immediately
- [ ] Pause/resume works correctly
- [ ] Debug overlays toggle on/off
- [ ] Paths render correctly for walking agents
- [ ] Perception radius follows selected agent
- [ ] Stats HUD shows accurate data
- [ ] LLM debug panel shows interactions
- [ ] Copy buttons work
- [ ] No visual artifacts at different zoom levels

### Performance Testing
- [ ] 60fps maintained with debug overlays on
- [ ] Log panel smooth with 1000+ entries
- [ ] No memory leaks after 30 minutes

---

## Estimated Effort

| Task | Effort |
|------|--------|
| UI Infrastructure | 4 hours |
| Log Panel | 6 hours |
| Inspector Panel | 6 hours |
| Time Controls | 3 hours |
| Debug Overlays | 5 hours |
| LLM Debug Panel | 4 hours |
| Log Export | 2 hours |
| Asset Pass | 4 hours |
| Integration & Testing | 6 hours |
| **Total** | **40 hours** |
