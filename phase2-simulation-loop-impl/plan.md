# Phase 2: Simulation Loop and Scheduling - Implementation Plan

## Overview

This phase moves simulation authority from the client to a Node.js server, establishes a deterministic tick loop, and implements WebSocket-based state synchronization. The client becomes a pure renderer that interpolates server-authoritative state.

## Expert corrections (supersedes conflicting details below)

1. Determinism implementation rules:
   - Simulation progression must be tick-driven and integer/fixed-point based.
   - Do not derive simulation outcomes from wall-clock deltas.
   - `Date.now()` may be used for metrics only, never for agent or world decisions.
2. Scheduler behavior:
   - Avoid 1ms polling loops for core simulation progression.
   - Use a fixed timestep scheduler and process bounded catch-up ticks when delayed.
3. Randomness:
   - All stochastic decisions must come from one seeded RNG service passed through systems.
   - No direct `Math.random()` in simulation logic.
4. Networking correctness:
   - Include a monotonic `tickId` sequence in snapshots/deltas and discard out-of-order client updates.
   - Client interpolation should use server tick time windows, not fixed-frame lerp constants.
5. Non-blocking tick loop:
   - Tick processing must not await network or long background jobs.
   - Slow tasks should publish deferred intents/events processed on later ticks.

## Objectives

1. **Server Authority**: All agent positions, states, and decisions are owned by the server
2. **Deterministic Simulation**: Same seed produces identical agent movements over time
3. **Tick-Based Updates**: 200ms tick loop with configurable game time progression
4. **WebSocket Sync**: Full snapshot on connect, delta updates each tick
5. **Time Controls**: Pause, resume, and speed multipliers (1x, 2x, 4x, 10x) synchronized across clients
6. **Staggered Decisions**: Per-agent decision scheduling using rule-based choices only (no LLM)

## Dependencies

### From Phase 1 (assumed complete)
- Vite + Phaser client with TownScene rendering tilemap
- Basic agent sprites with position and color
- A* pathfinding on client (will be moved to server)
- Camera controls (pan, zoom)

### Shared Types (existing in `src/shared/`)
- `AgentId`, `LocationId`, `Position`, `TilePosition`
- `AgentState` enum (Idle, Walking, Conversing, Activity, Sleeping)
- `AgentData`, `LocationData`, `GameTime`
- Zod schemas for `SnapshotEvent`, `DeltaEvent`, `ControlEvent`

### Dependencies to Install
All dependencies should already be in `package.json`:
- `ws` for WebSocket server
- `zod` for runtime validation
- `tsx` for TypeScript server execution

---

## Project Structure

```
src/
├── server/
│   ├── index.ts                    # Entry point, wires up all components
│   ├── simulation/
│   │   ├── Simulation.ts           # Main simulation state container
│   │   ├── TickScheduler.ts        # Fixed-timestep tick loop
│   │   └── TimeManager.ts          # Real-to-game time conversion
│   ├── world/
│   │   ├── Pathfinding.ts          # A* pathfinding (moved from client)
│   │   └── NavGrid.ts              # Walkable grid from collision layer
│   ├── agents/
│   │   ├── Agent.ts                # Server-side agent entity
│   │   ├── AgentManager.ts         # Agent collection and updates
│   │   └── DecisionMaker.ts        # Rule-based decision logic
│   └── transport/
│       ├── WsServer.ts             # WebSocket server and session management
│       └── Events.ts               # Server event helpers
├── shared/
│   ├── Types.ts                    # Shared type definitions
│   ├── Events.ts                   # Event schemas (already exists)
│   └── Constants.ts                # Shared constants (already exists)
└── client/
    └── (existing Phase 1 code, modified for server sync)
```

---

## Step-by-Step Implementation

### Task 1: Time Manager

**File**: `src/server/simulation/TimeManager.ts`

**Purpose**: Advance game time from simulation ticks, handle speed multipliers, and emit day boundary events.

**Implementation Details**:

```typescript
// Core state
- currentGameMinutes: number (total elapsed game minutes)
- speedMultiplier: number (1, 2, 4, 10)
- isPaused: boolean
- dayBoundaryCallbacks: Set<() => void>

// Key methods
- tick(ticksElapsed?: number): void
  - If paused, return early
  - Advance by `ticksElapsed * GAME_MINUTES_PER_TICK * speedMultiplier` (default `ticksElapsed = 1`)
  - Add to `currentGameMinutes`
  - Check for day boundary (every 1440 game minutes), fire callbacks if crossed

- getGameTime(): GameTime
  - Return { day, hour, minute, totalMinutes } computed from currentGameMinutes
  - day = floor(totalMinutes / 1440)
  - hour = floor((totalMinutes % 1440) / 60)
  - minute = totalMinutes % 60

- setSpeed(multiplier: 1 | 2 | 4 | 10): void
- pause(): void
- resume(): void
- onDayBoundary(callback: () => void): () => void (returns unsubscribe)
```

**Success Criteria**:
- Changing speed updates game clock rate immediately without resetting time
- Day boundary event fires exactly once per simulated day
- getGameTime() returns accurate values at any point

---

### Task 2: Tick Scheduler

**File**: `src/server/simulation/TickScheduler.ts`

**Purpose**: Run a fixed-timestep loop with drift correction, invoke per-tick callbacks.

**Implementation Details**:

```typescript
// Core state
- tickInterval: number (200ms from Constants)
- tickId: number (monotonically increasing)
- isRunning: boolean
- accumulatedTime: number (for drift correction)
- lastTickTime: number (monotonic clock timestamp used only for scheduling)
- tickCallbacks: Set<(tickId: number) => void>

// Key methods
- start(): void
  - Set isRunning = true
  - Initialize `lastTickTime` from a monotonic source (for example `performance.now()`)
  - Start scheduler with `setTimeout` cadence near `tickInterval` (not 1ms polling)
  - On each scheduler pass, calculate elapsed from monotonic clock
  - accumulatedTime += elapsed
  - While accumulatedTime >= tickInterval:
    - Process one tick (increment tickId, invoke callbacks)
    - accumulatedTime -= tickInterval
  - Update lastTickTime

- stop(): void
  - Set isRunning = false
  - Clear scheduled timer

- onTick(callback: (tickId: number) => void): () => void (returns unsubscribe)

- getCurrentTickId(): number
```

**Drift Correction Logic**:
- If system lags (e.g., CPU spike), multiple ticks may fire in succession to catch up
- Cap catch-up to MAX_TICKS_PER_FRAME (e.g., 5) to prevent spiral of death

**Success Criteria**:
- Tick loop runs within 10% of target interval over 5 minutes
- Tick IDs are monotonically increasing with no gaps
- Pausing the TimeManager does not stop the tick loop (ticks still fire, but time doesn't advance)

---

### Task 3: NavGrid and Pathfinding

**Files**: 
- `src/server/world/NavGrid.ts`
- `src/server/world/Pathfinding.ts`

**Purpose**: Move pathfinding logic to server, build walkable grid from tilemap data.

**NavGrid Implementation**:

```typescript
// Core state
- grid: boolean[][] (true = walkable)
- width: number
- height: number

// Key methods
- constructor(tilemapData: TilemapData)
  - Parse collision layer to build walkable grid
  - Mark tiles with collision as false

- isWalkable(tileX: number, tileY: number): boolean
- getNeighbors(tileX: number, tileY: number): TilePosition[]
  - Return walkable 4-directional neighbors (or 8-directional if desired)
```

**Pathfinding Implementation** (A* algorithm):

```typescript
// Key methods
- findPath(start: TilePosition, goal: TilePosition, navGrid: NavGrid): TilePosition[] | null
  - Standard A* with Manhattan distance heuristic
  - Return null if no path exists
  - Return array of tiles from start (exclusive) to goal (inclusive)

- Optional: Path caching for repeated start/end pairs
  - Cache key: `${startX},${startY}-${goalX},${goalY}`
  - Invalidate cache if NavGrid changes (not expected in this phase)
```

**Success Criteria**:
- Pathfinding returns valid routes between any two walkable tiles
- Returns null for unreachable destinations
- Performance: < 10ms for paths up to 100 tiles

---

### Task 4: Agent Entity (Server-Side)

**File**: `src/server/agents/Agent.ts`

**Purpose**: Server-owned agent entity with position, state machine, and path following.

**Implementation Details**:

```typescript
interface AgentConfig {
  id: AgentId;
  name: string;
  color: number;
  startTilePosition: TilePosition;
}

class Agent {
  // Identity
  readonly id: AgentId;
  readonly name: string;
  readonly color: number;

  // Position (world coordinates for smooth movement)
  position: Position;
  tilePosition: TilePosition;

  // State machine
  state: AgentState;

  // Pathfinding
  currentPath: TilePosition[] | null;
  pathIndex: number;
  moveSpeed: number; // tiles per second

  // Decision scheduling
  nextDecisionAt: number; // game minute when next decision is due
  decisionCadence: number; // 2-10 game minutes between decisions

  // Methods
  constructor(config: AgentConfig)

  // Movement
  setPath(path: TilePosition[]): void
  updateMovement(deltaGameMinutes: number): void
    - If state !== Walking or no path, return
    - Move position toward next tile in path
    - When reaching tile center, advance pathIndex
    - When path complete, set state to Idle, clear path

  // State transitions
  transitionTo(newState: AgentState): void
    - Validate transition is allowed
    - Update state

  // Serialization
  toAgentData(): AgentData
    - Return data for network transmission
}
```

**State Machine Transitions**:
```
Idle -> Walking (when path assigned)
Walking -> Idle (when path complete)
Walking -> Activity (when reaching activity location)
Activity -> Idle (when activity complete)
Idle -> Sleeping (when bedtime)
Sleeping -> Idle (when waking)
```

**Success Criteria**:
- Agents move smoothly along paths
- State transitions are valid and logged
- Position updates are frame-rate independent

---

### Task 5: Agent Manager

**File**: `src/server/agents/AgentManager.ts`

**Purpose**: Manage collection of agents, coordinate updates.

**Implementation Details**:

```typescript
class AgentManager {
  private agents: Map<AgentId, Agent>;
  private navGrid: NavGrid;
  private pathfinding: Pathfinding;

  constructor(navGrid: NavGrid)

  // Agent lifecycle
  spawnAgent(config: AgentConfig): Agent
  getAgent(id: AgentId): Agent | undefined
  getAllAgents(): Agent[]

  // Bulk operations
  updateAllMovement(deltaGameMinutes: number): void
    - Iterate all agents, call updateMovement

  // Pathfinding delegation
  assignPathToAgent(agentId: AgentId, goalTile: TilePosition): boolean
    - Find path using pathfinding
    - If valid, assign to agent and transition to Walking
    - Return success/failure

  // Serialization
  getSnapshot(): AgentData[]
  getDelta(): AgentData[] // In Phase 2, same as snapshot; optimize later
}
```

**Initial Agent Spawning** (for testing):
- Spawn 5-10 agents at predefined spawn points
- Use seeded RNG for reproducibility

**Success Criteria**:
- Can spawn and track multiple agents
- Bulk movement updates complete in < 5ms for 20 agents
- Pathfinding integration works seamlessly

---

### Task 6: Decision Maker (Rule-Based)

**File**: `src/server/agents/DecisionMaker.ts`

**Purpose**: Make deterministic, rule-based decisions for agents (no LLM in Phase 2).

**Implementation Details**:

```typescript
interface Decision {
  action: 'idle' | 'moveTo' | 'startActivity';
  targetTile?: TilePosition;
  activityType?: string;
  durationMinutes?: number;
}

class DecisionMaker {
  private rng: SeededRNG;
  private navGrid: NavGrid;
  private locationData: LocationData[];

  constructor(seed: number, navGrid: NavGrid, locations: LocationData[])

  makeDecision(agent: Agent, gameTime: GameTime): Decision
    - Based on time of day and agent state, pick an action:
    
    // Time-based rules
    - 22:00-06:00: If not sleeping, go home and sleep
    - 06:00-08:00: Wake up, idle at home
    - 08:00-12:00: Go to work/activity location
    - 12:00-13:00: Go to cafe/park for lunch
    - 13:00-18:00: Continue work or explore
    - 18:00-22:00: Social time, visit random locations

    // Random exploration
    - Pick random walkable location from locationData
    - Use seeded RNG for determinism

  getNextDecisionCadence(): number
    - Return random value between 2-10 game minutes
    - Use seeded RNG
}
```

**Seeded RNG**:
```typescript
class SeededRNG {
  private seed: number;

  constructor(seed: number)

  next(): number // Returns 0-1
  nextInt(min: number, max: number): number
  pick<T>(array: T[]): T
}
```

**Success Criteria**:
- Same seed produces identical decisions over time
- Agents follow reasonable daily routines
- No agent gets stuck without a decision

---

### Task 7: Simulation Container

**File**: `src/server/simulation/Simulation.ts`

**Purpose**: Main simulation state container, orchestrates all components.

**Implementation Details**:

```typescript
class Simulation {
  private tickScheduler: TickScheduler;
  private timeManager: TimeManager;
  private navGrid: NavGrid;
  private agentManager: AgentManager;
  private decisionMaker: DecisionMaker;
  private seed: number;

  // Event emitters
  private onTickCallbacks: Set<(snapshot: SimulationState) => void>;
  private onDayBoundaryCallbacks: Set<(day: number) => void>;

  constructor(config: SimulationConfig)
    - Initialize all components
    - Set up tick callback to process simulation
    - Set up day boundary callback

  // Lifecycle
  start(): void
  stop(): void
  pause(): void
  resume(): void
  setSpeed(multiplier: 1 | 2 | 4 | 10): void

  // Tick processing
  private processTick(tickId: number): void
    - Get deltaGameMinutes from timeManager
    - Update agent movements
    - Process agent decisions (for agents where gameTime >= nextDecisionAt)
    - Emit state to listeners

  private processAgentDecisions(gameTime: GameTime): void
    - For each agent where gameTime.totalMinutes >= agent.nextDecisionAt:
      - Get decision from decisionMaker
      - Execute decision (assign path, change state, etc.)
      - Set agent.nextDecisionAt = gameTime.totalMinutes + decisionMaker.getNextDecisionCadence()

  // State access
  getState(): SimulationState
  getSnapshot(): SnapshotEvent

  // Events
  onTick(callback: (state: SimulationState) => void): () => void
}

interface SimulationConfig {
  seed: number;
  tilemapData: TilemapData;
  initialAgentCount: number;
}

interface SimulationState {
  tickId: number;
  gameTime: GameTime;
  agents: AgentData[];
  isPaused: boolean;
  speed: number;
}
```

**Success Criteria**:
- Simulation runs autonomously after start()
- Pause/resume works correctly
- Speed changes take effect immediately
- State is serializable for network transmission

---

### Task 8: WebSocket Server

**File**: `src/server/transport/WsServer.ts`

**Purpose**: WebSocket server for client connections, handles join handshake and broadcasts.

**Implementation Details**:

```typescript
interface ClientSession {
  id: string;
  ws: WebSocket;
  joinedAt: number;
  lastTickSent: number;
}

class WsServer {
  private wss: WebSocketServer;
  private sessions: Map<string, ClientSession>;
  private simulation: Simulation;

  constructor(port: number, simulation: Simulation)

  start(): void
    - Create WebSocketServer on port
    - Set up connection handler

  private handleConnection(ws: WebSocket): void
    - Generate session ID (uuid or nanoid)
    - Create ClientSession
    - Send initial snapshot: simulation.getSnapshot()
    - Set up message handler for control events

  private handleMessage(session: ClientSession, data: string): void
    - Parse JSON
    - Validate against ControlEventSchema
    - Handle actions:
      - 'pause': simulation.pause()
      - 'resume': simulation.resume()
      - 'setSpeed': simulation.setSpeed(value)
    - Send acknowledgment

  private handleClose(session: ClientSession): void
    - Remove from sessions map
    - Log disconnect

  broadcastDelta(delta: DeltaEvent): void
    - Iterate all sessions
    - Send delta to each connected client
    - Update lastTickSent

  // Called by simulation on each tick
  onSimulationTick(state: SimulationState): void
    - Build DeltaEvent from state
    - broadcastDelta(delta)
}
```

**Protocol**:
1. Client connects via WebSocket
2. Server immediately sends `SnapshotEvent` with full state
3. Each tick, server sends `DeltaEvent` with updated agent positions/states
4. Client can send `ControlEvent` to pause/resume/change speed
5. Server acknowledges control events (optional, for UI feedback)

**Success Criteria**:
- New clients receive snapshot within 100ms of connecting
- Deltas broadcast to all clients each tick
- Control events update simulation and reflect in next delta
- Clean disconnect handling with no memory leaks

---

### Task 9: Server Entry Point

**File**: `src/server/index.ts`

**Purpose**: Wire up all components and start the server.

**Implementation Details**:

```typescript
import { Simulation } from './simulation/Simulation';
import { WsServer } from './transport/WsServer';
import tilemapData from '../../assets/tiles/town.json';

const PORT = 3001;
const SEED = 12345; // Default seed for reproducibility

async function main() {
  console.log('Starting 8bit-agent-town server...');

  // Create simulation
  const simulation = new Simulation({
    seed: SEED,
    tilemapData,
    initialAgentCount: 10,
  });

  // Create WebSocket server
  const wsServer = new WsServer(PORT, simulation);

  // Wire up simulation ticks to WebSocket broadcasts
  simulation.onTick((state) => {
    wsServer.onSimulationTick(state);
  });

  // Start everything
  wsServer.start();
  simulation.start();

  console.log(`Server running on ws://localhost:${PORT}`);
  console.log(`Seed: ${SEED}`);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down...');
    simulation.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

**Success Criteria**:
- `npm run dev:server` starts the server and logs port/seed
- Server accepts WebSocket connections
- Clean shutdown on SIGINT

---

### Task 10: Client WebSocket Integration

**Files to modify**:
- `src/client/index.ts` or `src/client/game/scenes/TownScene.ts`
- New: `src/client/network/WsClient.ts`

**Purpose**: Connect to server, receive state updates, send controls.

**WsClient Implementation**:

```typescript
class WsClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectDelay = 1000;

  // Event handlers
  onSnapshot: ((event: SnapshotEvent) => void) | null = null;
  onDelta: ((event: DeltaEvent) => void) | null = null;
  onConnectionChange: ((connected: boolean) => void) | null = null;

  constructor(url: string)

  connect(): void
    - Create WebSocket(url)
    - Set up onopen, onmessage, onclose, onerror
    - On message, parse JSON and route to appropriate handler

  private handleMessage(data: string): void
    - Parse JSON
    - Switch on event.type:
      - 'snapshot': call onSnapshot
      - 'delta': call onDelta

  // Control methods
  pause(): void
    - Send: { type: 'control', action: 'pause' }

  resume(): void
    - Send: { type: 'control', action: 'resume' }

  setSpeed(multiplier: number): void
    - Send: { type: 'control', action: 'setSpeed', value: multiplier }

  disconnect(): void
}
```

**TownScene Modifications**:

```typescript
// Remove local agent simulation logic
// Add WsClient integration

class TownScene extends Phaser.Scene {
  private wsClient: WsClient;
  private agentSprites: Map<AgentId, AgentSprite>;
  private lastServerState: SimulationState | null = null;
  private lastUpdateTime: number = 0;

  create() {
    // ... existing tilemap setup ...

    // Connect to server
    this.wsClient = new WsClient('ws://localhost:3001');
    
    this.wsClient.onSnapshot = (event) => {
      this.handleSnapshot(event);
    };

    this.wsClient.onDelta = (event) => {
      this.handleDelta(event);
    };

    this.wsClient.connect();
  }

  private handleSnapshot(event: SnapshotEvent): void
    - Create/update all agent sprites from event.agents
    - Store current server state

  private handleDelta(event: DeltaEvent): void
    - Store previous positions for interpolation
    - Update target positions from event.agents
    - Start interpolation toward new positions

  update(time: number, delta: number): void
    - Interpolate agent sprites toward target positions
    - Smooth visual movement between server ticks
}
```

**Interpolation Logic**:
```typescript
// For each agent sprite:
// - Store targetPosition from server delta
// - Each frame, lerp currentPosition toward targetPosition
// - Use LERP_FACTOR (e.g., 0.2) for smooth movement
// - Snap to target if very close (< 0.5 pixels)
```

**Success Criteria**:
- Client connects to server automatically
- Sprites update based on server state
- Movement appears smooth despite 200ms tick interval
- Reconnection works if server restarts

---

### Task 11: Time Controls UI

**File**: `src/client/ui/TimeControls.ts` (or HTML overlay)

**Purpose**: UI for pause, play, and speed controls.

**Implementation Details**:

```typescript
class TimeControls {
  private container: HTMLElement;
  private wsClient: WsClient;
  private isPaused: boolean = false;
  private currentSpeed: number = 1;

  constructor(wsClient: WsClient)

  create(): void
    - Create HTML container with buttons:
      - Pause/Play toggle button
      - Speed buttons: 1x, 2x, 4x, 10x
      - Current time display (Day X, HH:MM)
    - Attach click handlers

  updateTimeDisplay(gameTime: GameTime): void
    - Format and display: "Day {day} - {hour}:{minute}"

  private onPauseClick(): void
    - Toggle isPaused
    - Call wsClient.pause() or wsClient.resume()
    - Update button appearance

  private onSpeedClick(speed: number): void
    - Call wsClient.setSpeed(speed)
    - Update highlighted button
}
```

**CSS Styling**:
- Fixed position at top of screen
- Semi-transparent background
- Retro/pixel-art styled buttons to match theme

**Success Criteria**:
- Pause/play works and reflects in simulation immediately
- Speed changes take effect within one tick
- Time display updates each tick
- Controls are visually consistent with 8-bit aesthetic

---

### Task 12: Determinism Verification

**Purpose**: Ensure same seed produces identical results.

**Test Implementation**:

```typescript
// src/server/tests/determinism.test.ts

describe('Simulation Determinism', () => {
  it('produces identical agent positions after 10 simulated minutes', () => {
    const seed = 12345;
    
    // Run simulation 1
    const sim1 = new Simulation({ seed, ... });
    sim1.start();
    // Fast-forward 10 game minutes
    const state1 = sim1.getState();
    sim1.stop();

    // Run simulation 2
    const sim2 = new Simulation({ seed, ... });
    sim2.start();
    // Fast-forward 10 game minutes
    const state2 = sim2.getState();
    sim2.stop();

    // Compare agent positions
    expect(state1.agents).toEqual(state2.agents);
  });

  it('produces identical paths for same decisions', () => {
    // Test pathfinding returns same results
  });

  it('produces identical decision sequences', () => {
    // Test decision maker with seeded RNG
  });
});
```

**Success Criteria**:
- Two simulation runs with same seed produce byte-identical agent positions
- Test passes consistently

---

## File Dependencies Graph

```
TimeManager ← TickScheduler ← Simulation
     ↑                           ↑
     └────────────────────────────┘
                                 ↑
NavGrid ← Pathfinding ← AgentManager ← Simulation
                              ↑
                       DecisionMaker
                              ↑
                         SeededRNG

WsServer ← Simulation
    ↑
WsClient (client) ← TownScene
```

---

## Potential Challenges

### 1. Tick Timing Precision
**Risk**: JavaScript timers are not precise, may cause drift.
**Mitigation**: Use accumulator-based fixed timestep with catch-up logic.

### 2. Client Interpolation Jitter
**Risk**: Network latency variance causes jerky movement.
**Mitigation**: Buffer one tick of state, interpolate over TICK_INTERVAL_MS.

### 3. State Synchronization on Reconnect
**Risk**: Client reconnects mid-simulation and has stale state.
**Mitigation**: Always send full snapshot on connect, client rebuilds entire state.

### 4. Pathfinding Performance
**Risk**: A* on large maps with many agents may be slow.
**Mitigation**: Cache common paths, limit path length, use jump point search if needed.

### 5. Decision Scheduling Bunching
**Risk**: All agents make decisions at same tick, causing spike.
**Mitigation**: Stagger initial nextDecisionAt values across tick range.

---

## Success Criteria (Phase 2 Complete)

1. **Server Authority**: Client cannot modify agent positions; all movement originates from server
2. **Smooth Rendering**: Agents move smoothly on client despite 200ms tick interval
3. **Time Controls**: Pause/resume/speed changes reflect within one tick
4. **Reconnection**: Fresh client gets correct state immediately
5. **Determinism**: Same seed → same agent positions after 10-minute simulation
6. **Performance**: 20 agents running with < 5ms per tick processing time

---

## Testing Checklist

- [ ] Server starts without errors
- [ ] Client connects and receives snapshot
- [ ] Agents move based on server decisions
- [ ] Pathfinding produces valid routes
- [ ] Pause stops agent movement
- [ ] Resume continues from same position
- [ ] Speed 2x doubles game time progression
- [ ] Speed 4x quadruples game time progression
- [ ] Speed 10x multiplies by 10
- [ ] New client connects and sees current state
- [ ] Determinism test passes (same seed = same movements)
- [ ] 10+ agents run smoothly for 10 simulated minutes
- [ ] No memory leaks after 30 minutes of runtime

---

## Estimated Implementation Order

1. **TimeManager** (1-2 hours) - Foundation for time
2. **TickScheduler** (1-2 hours) - Foundation for updates
3. **NavGrid + Pathfinding** (2-3 hours) - Move from client
4. **Agent + AgentManager** (2-3 hours) - Server-side agents
5. **DecisionMaker** (2-3 hours) - Rule-based AI
6. **Simulation** (2-3 hours) - Orchestration
7. **WsServer** (2-3 hours) - Network layer
8. **Server index.ts** (1 hour) - Wire up
9. **WsClient** (1-2 hours) - Client network
10. **TownScene modifications** (2-3 hours) - Interpolation
11. **TimeControls UI** (1-2 hours) - User controls
12. **Determinism tests** (1-2 hours) - Verification

**Total Estimated Time**: 18-28 hours

---

## Notes for Implementer

- All times are in game minutes internally; only convert to real time at boundaries
- Use `nanoid` or similar for session IDs (already available via uuid pattern)
- Console.log liberally during development; add log levels later
- Keep agent count configurable; start with 5 for easier debugging
- The seed should be logged on server start for reproducibility
- Consider adding a `/debug` endpoint to inspect simulation state (optional)
