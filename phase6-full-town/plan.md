# Phase 6: Full Town and Scale - Implementation Plan

## Overview

This phase scales the 8-bit agent town simulation from a small prototype to a fully populated town with 20+ agents navigating 15+ named locations. The focus is on performance optimization and stability under load.

## Expert corrections (supersedes conflicting details below)

1. Run two stress profiles, not one:
   - Profile A: deterministic baseline with LLM disabled (engine correctness/perf floor).
   - Profile B: realistic LLM-on profile with strict queue budgets (behavior/perf ceiling).
2. Agent ramp-up should be staged:
   - Validate at 10 agents, then 15, then 20+, instead of jumping straight to max load.
3. Logging strategy must be bounded:
   - Full verbose logs for 10 in-game days are too heavy by default.
   - Use rotating logs plus sampled high-detail windows around anomalies.
4. Performance targets should emphasize distribution metrics:
   - Track p50/p95/p99 tick durations, queue wait times, and fallback rates.
   - Base pass/fail on percentile budgets, not averages alone.
5. Cache correctness before cache size:
   - Path/route caching must include invalidation and staleness guarantees.
   - Wrong cached routes are worse than cache misses.

## Objectives

1. Expand the tilemap to include 15+ named locations with bounds and metadata
2. Generate 20+ agents with unique profiles, homes, and relationship graphs
3. Tune decision cadence, pathfinding caching, and render culling for smooth performance
4. Stress test the LLM queue by running a 10-day simulation with logging enabled

## Implementation Status (2026-02-06)

- [x] Pathfinding cache added with explicit invalidation support and cache hit/miss metrics.
- [x] LLM queue health/backpressure metrics added and surfaced through simulation snapshots/deltas.
- [x] Debug panel now shows queue pressure/health and path cache metrics.
- [x] Unit coverage added for queue backpressure/health and path cache invalidation behavior.
- [x] Stress harness added for profile runs (baseline no-LLM + LLM-on), with JSON report output.
- [x] Backpressure-driven decision throttling now reduces LLM enqueues and increases cadence under load.
- [ ] Long-run memory/tick budget reporting artifacts.

## Prerequisites

Before starting Phase 6, the following must be complete:
- Phases 1-5 fully implemented and verified
- Basic tilemap with collision layers working
- WebSocket transport established between client and server
- LLM integration with request queue and fallback behavior
- Memory stream, reflection, and planning systems operational
- Conversation manager and relationship system functional

---

## Task 1: Expand Tilemap to 15+ Named Locations

### Objective
Create a rich town environment with diverse locations that support varied agent activities.

### Approach
Extend the existing Tiled JSON map to include at least 15 named locations with proper bounds, metadata, and navigation points.

### Implementation Details

#### 1.1 Location Inventory (Minimum 15)
Define the following locations in the tilemap object layer:

| ID | Name | Type | Tags | Capacity |
|---|---|---|---|---|
| home_1-8 | Agent Homes | residential | indoor, private | 2 |
| cafe | Central Café | commercial | indoor, social, food | 8 |
| library | Town Library | public | indoor, quiet, learning | 10 |
| park | Town Park | outdoor | outdoor, social, relaxation | 20 |
| market | Farmers Market | commercial | outdoor, social, food | 15 |
| town_hall | Town Hall | government | indoor, formal | 12 |
| clinic | Health Clinic | medical | indoor, quiet | 6 |
| school | Elementary School | education | indoor, learning | 20 |
| bakery | Corner Bakery | commercial | indoor, food | 5 |
| gym | Community Gym | recreation | indoor, activity | 8 |
| plaza | Central Plaza | outdoor | outdoor, social | 25 |
| bookstore | Used Bookstore | commercial | indoor, quiet | 4 |
| garden | Community Garden | outdoor | outdoor, activity | 10 |
| diner | Pete's Diner | commercial | indoor, food, social | 12 |
| workshop | Craft Workshop | commercial | indoor, activity | 6 |

#### 1.2 Location Metadata Schema
Update `src/shared/Types.ts`:

```typescript
export interface LocationMetadata {
  id: LocationId;
  name: string;
  type: 'residential' | 'commercial' | 'public' | 'outdoor' | 'government' | 'medical' | 'education' | 'recreation';
  bounds: { x: number; y: number; width: number; height: number };
  tags: string[];
  capacity: number;
  spawnPoint: TilePosition;
  allowedActivities: string[];
  openHours?: { start: number; end: number }; // 24-hour format
}
```

#### 1.3 Update Town.ts
Modify `src/server/world/Town.ts`:

```typescript
export class Town {
  private locations: Map<LocationId, LocationMetadata>;
  private locationsByType: Map<string, LocationId[]>;
  private locationsByTag: Map<string, LocationId[]>;
  
  loadLocationsFromMap(mapData: TiledMapData): void;
  getLocation(id: LocationId): LocationMetadata | undefined;
  getLocationsByType(type: string): LocationMetadata[];
  getLocationsByTag(tag: string): LocationMetadata[];
  getLocationAtPosition(pos: TilePosition): LocationMetadata | undefined;
  getLocationCapacity(id: LocationId): { current: number; max: number };
  isLocationOpen(id: LocationId, gameTime: GameTime): boolean;
  getNearestLocation(pos: TilePosition, filter?: LocationFilter): LocationMetadata | null;
}
```

#### 1.4 Location Spawns
Update `src/server/world/Spawns.ts`:

```typescript
export interface SpawnConfiguration {
  agentSpawns: Map<AgentId, LocationId>; // Home assignments
  locationSpawns: Map<LocationId, TilePosition[]>; // Spawn points per location
}

export function generateSpawnConfiguration(
  locations: LocationMetadata[],
  agentCount: number
): SpawnConfiguration;
```

### Files to Modify/Create
- `assets/tiles/town.json` - Expand Tiled map with 15+ locations
- `src/shared/Types.ts` - Add LocationMetadata interface
- `src/server/world/Town.ts` - Location management methods
- `src/server/world/Location.ts` - Individual location class
- `src/server/world/Spawns.ts` - Spawn point configuration

### Verification
- [ ] Map loads without errors in Phaser
- [ ] All 15+ locations have valid bounds that don't overlap
- [ ] Each location has at least one navigable spawn point
- [ ] Location queries return correct results
- [ ] Capacity tracking works correctly

---

## Task 2: Generate 20+ Agents with Unique Profiles

### Objective
Create a diverse population of agents with distinct personalities, occupations, homes, and social connections.

### Implementation Details

#### 2.1 Agent Profile Dataset
Create `src/server/agents/data/profiles.json`:

```json
{
  "firstNames": ["Alex", "Jordan", "Sam", "Morgan", "Taylor", "Casey", "Riley", "Quinn", "Avery", "Skyler", "Dakota", "Reese", "Finley", "Hayden", "Phoenix", "River", "Sage", "Blake", "Drew", "Jamie", "Pat", "Ellis", "Rowan", "Lane", "Emery"],
  "occupations": [
    { "id": "teacher", "workplace": "school", "schedule": { "start": 8, "end": 16 } },
    { "id": "librarian", "workplace": "library", "schedule": { "start": 9, "end": 17 } },
    { "id": "barista", "workplace": "cafe", "schedule": { "start": 6, "end": 14 } },
    { "id": "baker", "workplace": "bakery", "schedule": { "start": 5, "end": 13 } },
    { "id": "nurse", "workplace": "clinic", "schedule": { "start": 7, "end": 19 } },
    { "id": "shopkeeper", "workplace": "market", "schedule": { "start": 8, "end": 18 } },
    { "id": "cook", "workplace": "diner", "schedule": { "start": 10, "end": 20 } },
    { "id": "gardener", "workplace": "garden", "schedule": { "start": 7, "end": 15 } },
    { "id": "artisan", "workplace": "workshop", "schedule": { "start": 9, "end": 17 } },
    { "id": "clerk", "workplace": "town_hall", "schedule": { "start": 9, "end": 17 } },
    { "id": "trainer", "workplace": "gym", "schedule": { "start": 6, "end": 22 } },
    { "id": "bookseller", "workplace": "bookstore", "schedule": { "start": 10, "end": 18 } },
    { "id": "retired", "workplace": null, "schedule": null },
    { "id": "student", "workplace": "school", "schedule": { "start": 8, "end": 15 } }
  ],
  "traits": [
    "friendly", "reserved", "curious", "cautious", "energetic", "calm",
    "talkative", "observant", "creative", "practical", "optimistic", "realistic",
    "adventurous", "homebody", "social", "independent", "helpful", "competitive"
  ],
  "interests": [
    "reading", "gardening", "cooking", "fitness", "art", "music",
    "nature", "games", "gossip", "learning", "crafts", "food"
  ]
}
```

#### 2.2 Enhanced Agent Profile Type
Update `src/server/agents/AgentState.ts`:

```typescript
export interface AgentProfile {
  id: AgentId;
  name: string;
  age: number;
  occupation: OccupationData;
  traits: string[]; // 2-3 traits
  interests: string[]; // 2-3 interests
  bio: string;
  homeLocation: LocationId;
}

export interface AgentFullState extends AgentProfile {
  position: Position;
  tilePosition: TilePosition;
  state: AgentState;
  statusMeters: {
    energy: number;   // 0-100
    hunger: number;   // 0-100
    mood: number;     // 0-100
    social: number;   // 0-100
  };
  currentAction: AgentAction | null;
  planQueue: PlannedAction[];
  nextDecisionAt: number; // Game time in minutes
}
```

#### 2.3 Agent Generator Update
Update `src/server/agents/AgentGenerator.ts`:

```typescript
export class AgentGenerator {
  private rng: SeededRNG;
  private profileData: ProfileDataset;
  private usedNames: Set<string>;
  
  constructor(seed: number);
  
  generateAgents(count: number, locations: LocationMetadata[]): AgentFullState[];
  
  private generateProfile(index: number, availableHomes: LocationId[]): AgentProfile;
  private generateBio(profile: AgentProfile): string;
  private assignHome(availableHomes: LocationId[]): LocationId;
  private selectTraits(count: number): string[];
  private selectInterests(count: number): string[];
  private selectOccupation(): OccupationData;
}
```

#### 2.4 Relationship Graph Generation
Create `src/server/agents/RelationshipGenerator.ts`:

```typescript
export interface RelationshipEdge {
  targetId: AgentId;
  weight: number; // -1 to 1 (negative = dislike, positive = like)
  type: 'neighbor' | 'coworker' | 'friend' | 'acquaintance' | 'family';
  sharedInterests: string[];
}

export class RelationshipGenerator {
  constructor(seed: number);
  
  generateRelationships(
    agents: AgentProfile[],
    locations: LocationMetadata[]
  ): Map<AgentId, RelationshipEdge[]>;
  
  private createNeighborRelationships(agents: AgentProfile[]): void;
  private createCoworkerRelationships(agents: AgentProfile[]): void;
  private createInterestBasedFriendships(agents: AgentProfile[]): void;
}
```

#### 2.5 Relationship Rules
- Agents in adjacent homes are neighbors (weight 0.2-0.5)
- Agents with same occupation are coworkers (weight 0.3-0.6)
- Agents sharing 2+ interests may be friends (weight 0.4-0.8)
- Each agent has 2-5 relationships initially
- No agent should have zero relationships

### Files to Modify/Create
- `src/server/agents/data/profiles.json` - Name/trait datasets
- `src/server/agents/AgentState.ts` - Enhanced agent types
- `src/server/agents/AgentGenerator.ts` - Full generator
- `src/server/agents/RelationshipGenerator.ts` - Relationship initialization
- `src/server/agents/SeededRNG.ts` - Reproducible randomness

### Verification
- [ ] Same seed produces identical agent set
- [ ] All agents have valid profiles with no missing fields
- [ ] Each agent has a home assigned
- [ ] Each agent has 2-5 initial relationships
- [ ] Occupation distribution is varied (not all same job)
- [ ] Bio generation produces readable text

---

## Task 3: Performance Tuning

### Objective
Ensure the simulation maintains stable tick timing and smooth rendering with 20+ agents.

### Implementation Details

#### 3.1 Decision Cadence Tuning
Update `src/server/simulation/TickScheduler.ts`:

```typescript
export const DECISION_CADENCE_CONFIG = {
  // Base cadence in game minutes
  base: {
    idle: 5,          // Check every 5 game minutes when idle
    walking: 10,      // Less frequent when walking
    activity: 15,     // Even less when engaged in activity
    conversing: 2,    // More frequent during conversations
    sleeping: 30      // Rarely check when sleeping
  },
  // Jitter range (±) to prevent synchronized decisions
  jitterPercent: 0.2,
  // Maximum agents making LLM decisions per tick
  maxLLMDecisionsPerTick: 1,
  // Cooldown between LLM calls for same agent (game minutes)
  llmCooldown: 30
};

export function calculateNextDecisionTime(
  agent: AgentFullState,
  currentTime: number,
  rng: SeededRNG
): number;

export function prioritizeDecisions(
  agents: AgentFullState[],
  currentTime: number,
  maxToProcess: number
): AgentId[];
```

#### 3.2 Pathfinding Caching
Update `src/server/world/Pathfinding.ts`:

```typescript
export class PathfindingCache {
  private cache: Map<string, CachedPath>;
  private maxSize: number;
  private hitCount: number;
  private missCount: number;
  
  constructor(maxSize: number = 500);
  
  private generateKey(start: TilePosition, end: TilePosition): string;
  
  get(start: TilePosition, end: TilePosition): TilePosition[] | null;
  set(start: TilePosition, end: TilePosition, path: TilePosition[]): void;
  invalidateNear(position: TilePosition, radius: number): void;
  clear(): void;
  getStats(): { size: number; hitRate: number };
}

interface CachedPath {
  path: TilePosition[];
  timestamp: number;
  accessCount: number;
}
```

#### 3.3 Location-to-Location Route Cache
Pre-compute common routes between locations:

```typescript
export class RouteCache {
  private routes: Map<string, TilePosition[]>;
  
  constructor();
  
  precomputeRoutes(locations: LocationMetadata[], navGrid: NavGrid): void;
  getRoute(fromLocation: LocationId, toLocation: LocationId): TilePosition[] | null;
}
```

#### 3.4 Render Culling Configuration
Update client rendering in `src/client/game/sprites/AgentSprite.ts`:

```typescript
export const CULLING_CONFIG = {
  // Distance from camera center to hide agents (in pixels)
  cullDistance: 400,
  // Distance at which to reduce update frequency
  lodDistance: 300,
  // Speech bubble hide distance
  bubbleCullDistance: 250,
  // Update intervals (in frames)
  nearUpdateInterval: 1,
  farUpdateInterval: 3,
  culledUpdateInterval: 10
};

export class AgentSpriteManager {
  private visibleAgents: Set<AgentId>;
  private lodAgents: Set<AgentId>;
  
  updateCulling(cameraCenter: Position, cameraZoom: number): void;
  isAgentVisible(agentId: AgentId): boolean;
  getAgentLOD(agentId: AgentId): 'near' | 'far' | 'culled';
}
```

#### 3.5 Tick Budget Monitoring
Add performance tracking to `src/server/simulation/Simulation.ts`:

```typescript
export interface TickMetrics {
  tickNumber: number;
  duration: number;
  agentUpdates: number;
  pathfindingCalls: number;
  llmCalls: number;
  memoryOperations: number;
  cacheHits: number;
  cacheMisses: number;
}

export class TickBudget {
  private readonly targetMs: number = 200;
  private readonly warningThreshold: number = 180;
  private history: TickMetrics[];
  
  startTick(): void;
  checkpoint(phase: string): void;
  endTick(): TickMetrics;
  getAverageTickTime(lastN: number): number;
  isOverBudget(): boolean;
}
```

### Files to Modify/Create
- `src/server/simulation/TickScheduler.ts` - Decision cadence
- `src/server/world/Pathfinding.ts` - Add caching layer
- `src/server/world/RouteCache.ts` - Pre-computed routes
- `src/client/game/sprites/AgentSpriteManager.ts` - Culling
- `src/server/simulation/TickBudget.ts` - Performance monitoring

### Verification
- [ ] Tick timing stays within 10% of 200ms target
- [ ] Pathfinding cache hit rate > 60% after warm-up
- [ ] No visible jitter in agent movement
- [ ] Client FPS stays above 30 with 20+ agents
- [ ] Memory usage remains stable over 10-day simulation

---

## Task 4: LLM Queue Stress Testing

### Objective
Validate that the LLM queue remains bounded and the simulation does not stall under sustained load.

### Implementation Details

#### 4.1 Enhanced Queue Metrics
Update `src/server/llm/RequestQueue.ts`:

```typescript
export interface QueueMetrics {
  currentSize: number;
  maxSizeReached: number;
  totalProcessed: number;
  totalDropped: number;
  averageWaitTime: number;
  averageProcessTime: number;
  timeoutsCount: number;
  fallbacksTriggered: number;
}

export const QUEUE_LIMITS = {
  maxSize: 50,
  maxWaitTimeMs: 30000,
  dropPolicy: 'oldest-low-priority' as const,
  priorities: {
    dialogue: 1,
    planning: 2,
    reflection: 3,
    importance: 4
  }
};

export class RequestQueue {
  getMetrics(): QueueMetrics;
  isHealthy(): boolean;
  getBackpressureLevel(): 'normal' | 'elevated' | 'critical';
}
```

#### 4.2 Queue Backpressure Handling
```typescript
export class BackpressureHandler {
  private readonly thresholds = {
    elevated: 20,  // Queue size
    critical: 40
  };
  
  shouldThrottleAgent(agentId: AgentId): boolean;
  getRecommendedCadenceMultiplier(): number;
  notifyQueueSize(size: number): void;
}
```

#### 4.3 Stress Test Runner
Create `src/server/testing/StressTest.ts`:

```typescript
export interface StressTestConfig {
  durationDays: number;
  agentCount: number;
  speedMultiplier: number;
  enableLogging: boolean;
  checkpointIntervalMinutes: number;
}

export interface StressTestResults {
  totalTicks: number;
  totalGameDays: number;
  tickTimingStats: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  llmStats: QueueMetrics;
  memoryStats: {
    peakHeapUsed: number;
    avgHeapUsed: number;
  };
  agentStats: {
    totalDecisions: number;
    llmDecisions: number;
    fallbackDecisions: number;
  };
  issues: StressTestIssue[];
}

export class StressTestRunner {
  constructor(config: StressTestConfig);
  
  async run(): Promise<StressTestResults>;
  private logCheckpoint(day: number): void;
  private detectIssue(tick: number, metrics: TickMetrics): StressTestIssue | null;
}
```

#### 4.4 Logging Configuration
Update `src/server/utils/Logger.ts`:

```typescript
export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  enableFileLogging: boolean;
  logDir: string;
  rotateDaily: boolean;
  includeMetrics: boolean;
}

export const STRESS_TEST_LOG_CONFIG: LogConfig = {
  level: 'info',
  enableFileLogging: true,
  logDir: './logs/stress-test',
  rotateDaily: true,
  includeMetrics: true
};
```

#### 4.5 Simulation Stability Checks
Add to `src/server/simulation/Simulation.ts`:

```typescript
export class SimulationHealthCheck {
  private stuckAgentThreshold: number = 60; // Game minutes
  private tickOverrunCount: number = 0;
  
  checkAgentProgress(agents: AgentFullState[]): AgentId[];
  checkTickTiming(metrics: TickMetrics): boolean;
  checkMemoryGrowth(currentSize: number, baselineSize: number): boolean;
  checkQueueHealth(metrics: QueueMetrics): boolean;
  
  getHealthReport(): SimulationHealthReport;
}
```

### Files to Modify/Create
- `src/server/llm/RequestQueue.ts` - Enhanced metrics
- `src/server/llm/BackpressureHandler.ts` - Throttling
- `src/server/testing/StressTest.ts` - Test runner
- `src/server/utils/Logger.ts` - Logging config
- `src/server/simulation/SimulationHealthCheck.ts` - Health monitoring

### Verification
- [ ] Simulation runs for 10 in-game days without stalling
- [ ] Queue size never exceeds max limit
- [ ] Fallback rate stays below 10% under normal conditions
- [ ] No memory leaks detected
- [ ] All agents make at least 1 decision per game day
- [ ] Tick timing violations < 1% of total ticks

---

## Step-by-Step Implementation Order

### Day 1-2: Location System
1. Design and create expanded tilemap in Tiled
2. Update LocationMetadata types
3. Implement Town.ts location management
4. Add spawn configuration
5. Verify map loads and locations query correctly

### Day 3-4: Agent Generation
1. Create profile dataset JSON
2. Implement SeededRNG utility
3. Build AgentGenerator with full profiles
4. Implement RelationshipGenerator
5. Verify reproducibility with seed testing

### Day 5-6: Performance Tuning
1. Implement decision cadence configuration
2. Add pathfinding cache
3. Implement route pre-computation
4. Add client-side culling
5. Implement tick budget monitoring

### Day 7-8: Stress Testing
1. Add queue metrics and limits
2. Implement backpressure handler
3. Build stress test runner
4. Configure logging for stress tests
5. Run 10-day simulation and analyze results

### Day 9-10: Stabilization
1. Fix issues discovered in stress testing
2. Tune parameters based on metrics
3. Final verification of all success criteria
4. Document performance characteristics

---

## Dependencies

### External
- No new npm packages required
- Existing dependencies: phaser, ws, p-queue, zod

### Internal (from previous phases)
- Phase 1: Map rendering, pathfinding
- Phase 2: Tick scheduler, WebSocket transport
- Phase 3: LLM client, request queue
- Phase 4: Memory stream
- Phase 5: Conversation manager, relationships

---

## Potential Challenges

### 1. Pathfinding Scaling
**Risk**: A* with 20+ agents may cause tick overruns.
**Mitigation**: 
- Cache frequently used routes
- Pre-compute location-to-location paths
- Limit path recalculations per tick

### 2. LLM Queue Saturation
**Risk**: Too many agents requesting LLM calls simultaneously.
**Mitigation**:
- Stagger decision times with jitter
- Implement backpressure throttling
- Increase use of rule-based fallbacks

### 3. Memory Growth
**Risk**: 20+ agents accumulating memories may exhaust memory.
**Mitigation**:
- Enforce per-agent memory limits
- Aggressive pruning of low-importance items
- Monitor heap usage during stress tests

### 4. Client Rendering Performance
**Risk**: Too many sprites may cause FPS drops.
**Mitigation**:
- Implement distance-based culling
- Use LOD for far agents
- Pool sprite objects

---

## Success Criteria

1. **20+ Active Agents**: All agents navigate the town with purposeful behavior
2. **Stable Tick Timing**: 95%+ of ticks complete within 220ms (10% tolerance)
3. **10-Day Stress Test**: Simulation runs without crashes or stalls
4. **Bounded LLM Queue**: Queue size never exceeds 50 requests
5. **Smooth Rendering**: Client maintains 30+ FPS with culling enabled
6. **Memory Stability**: Heap usage does not grow unbounded over 10 days
7. **Reproducibility**: Same seed produces same agent behaviors

---

## Configuration Checklist

### Server Configuration (`src/server/config.ts`)
```typescript
export const PHASE6_CONFIG = {
  agentCount: 25,
  locationCount: 15,
  seed: 42,
  tickIntervalMs: 200,
  maxLLMQueueSize: 50,
  llmTimeoutMs: 20000,
  pathCacheSize: 500,
  memoryLimitPerAgent: 200,
  stressTestDays: 10
};
```

### Client Configuration (`src/client/config.ts`)
```typescript
export const PHASE6_CLIENT_CONFIG = {
  cullDistance: 400,
  lodDistance: 300,
  targetFPS: 60,
  enableDebugOverlay: true
};
```

---

## Testing Checklist

### Unit Tests
- [ ] LocationMetadata validation
- [ ] AgentGenerator reproducibility
- [ ] RelationshipGenerator edge cases
- [ ] PathfindingCache correctness
- [ ] Decision cadence calculations

### Integration Tests
- [ ] Full simulation with 20+ agents for 1 game day
- [ ] LLM queue under load (mock fast responses)
- [ ] Client connects and renders all agents

### Stress Tests
- [ ] 10-day simulation with logging
- [ ] Memory profiling over extended run
- [ ] Queue saturation scenarios

---

## Deliverables

1. Expanded tilemap with 15+ locations
2. Agent generator producing 20+ unique profiles
3. Relationship graph initialization
4. Pathfinding cache implementation
5. Render culling system
6. Stress test runner and results
7. Performance metrics dashboard/logs
8. Configuration files for tuning parameters
