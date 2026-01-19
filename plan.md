# 8bit-agent-town Implementation Plan

## Overview

Build a generative agents simulation inspired by the Stanford "Generative Agents: Interactive Simulacra of Human Behavior" paper. The simulation features 20+ AI agents living in a full town with 8-bit Pokemon Red/Gameboy Color aesthetics. Agents have complex behaviors, form relationships, and interact realistically—all powered by local LLMs running on an M4 MacBook Air.

---

## Core Architecture

### Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Frontend | **Phaser.js 3** | Excellent tilemap support, built-in sprite/animation systems, well-documented, good fit for Pokemon-style 8-bit games |
| Backend | **Node.js + TypeScript** | Monolithic architecture for simplicity, TypeScript for type safety |
| AI/LLM | **Ollama** | Local LLM inference, easy API, supports small models |
| LLM Models | **Llama 3.2 3B** or **Phi-3 Mini** | Small enough to run on M4 MacBook Air with good performance |
| Build Tool | **Vite** | Fast HMR, excellent TypeScript support |
| State | **In-memory only** | No persistence required, simplifies implementation |

### Application Structure

```
8bit-agent-town/
├── src/
│   ├── client/                 # Phaser.js game client
│   │   ├── scenes/
│   │   │   ├── BootScene.ts    # Asset loading
│   │   │   ├── TownScene.ts    # Main game scene
│   │   │   └── UIScene.ts      # HUD overlay (log panel, inspection)
│   │   ├── sprites/
│   │   │   └── AgentSprite.ts  # Agent visual representation
│   │   ├── ui/
│   │   │   ├── SpeechBubble.ts
│   │   │   ├── LogPanel.ts
│   │   │   └── InspectorPanel.ts
│   │   └── Game.ts             # Phaser game initialization
│   │
│   ├── server/                 # Backend server
│   │   ├── index.ts            # Express + WebSocket server
│   │   ├── simulation/
│   │   │   ├── Simulation.ts   # Main simulation loop
│   │   │   ├── TimeManager.ts  # Accelerated time system
│   │   │   └── World.ts        # World state management
│   │   └── api/
│   │       └── routes.ts       # REST endpoints for debugging
│   │
│   ├── agents/                 # Agent system (core logic)
│   │   ├── Agent.ts            # Base agent class
│   │   ├── AgentGenerator.ts   # Random agent generation
│   │   ├── memory/
│   │   │   ├── MemoryStream.ts # Observation/reflection storage
│   │   │   ├── MemoryRetrieval.ts # Relevance-based memory search
│   │   │   └── types.ts        # Memory types (observation, reflection, plan)
│   │   ├── cognition/
│   │   │   ├── Perceive.ts     # What does agent notice?
│   │   │   ├── Retrieve.ts     # What memories are relevant?
│   │   │   ├── Reflect.ts      # Form higher-level insights
│   │   │   ├── Plan.ts         # Daily/hourly planning
│   │   │   └── Act.ts          # Decide immediate action
│   │   └── behaviors/
│   │       ├── Movement.ts     # Pathfinding and navigation
│   │       ├── Conversation.ts # Multi-turn dialogue
│   │       ├── Activities.ts   # Eating, sleeping, working, etc.
│   │       └── Relationships.ts # Friendship/rivalry tracking
│   │
│   ├── world/                  # World definition
│   │   ├── Town.ts             # Town layout and locations
│   │   ├── Location.ts         # Building/area definition
│   │   ├── pathfinding.ts      # A* or similar
│   │   └── maps/
│   │       └── town.json       # Tiled map export
│   │
│   ├── llm/                    # LLM integration
│   │   ├── OllamaClient.ts     # Ollama HTTP client
│   │   ├── PromptTemplates.ts  # All prompt templates
│   │   ├── RequestQueue.ts     # Queue and rate limiting
│   │   └── ResponseParser.ts   # Parse structured LLM outputs
│   │
│   └── shared/                 # Shared types and utilities
│       ├── types.ts
│       ├── events.ts           # WebSocket event definitions
│       └── constants.ts
│
├── assets/
│   ├── sprites/                # Agent sprites (AI-generated)
│   ├── tiles/                  # Tileset for map
│   └── ui/                     # UI elements
│
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── plan.md
```

---

## Agent System Design

### Memory Architecture (From Generative Agents Paper)

Each agent maintains a **Memory Stream** containing three types of memories:

#### 1. Observations
Raw perceptions of the world:
```typescript
interface Observation {
  id: string;
  type: 'observation';
  description: string;      // "Isabella is talking to Klaus at the cafe"
  timestamp: GameTime;
  location: string;
  subjects: string[];       // Agent IDs involved
  importance: number;       // 1-10 score from LLM
}
```

#### 2. Reflections
Higher-level insights derived from observations:
```typescript
interface Reflection {
  id: string;
  type: 'reflection';
  description: string;      // "Klaus seems to be interested in Isabella romantically"
  timestamp: GameTime;
  evidence: string[];       // IDs of supporting observations
  importance: number;
}
```

#### 3. Plans
Intended actions:
```typescript
interface Plan {
  id: string;
  type: 'plan';
  description: string;      // "Go to the library to read in the afternoon"
  timeframe: 'day' | 'hour' | 'immediate';
  scheduledTime?: GameTime;
  location?: string;
  completed: boolean;
}
```

### Cognitive Loop

Each agent runs through this loop on their decision tick:

```
1. PERCEIVE  → What's happening around me?
     ↓
2. RETRIEVE  → What memories are relevant to this?
     ↓
3. REFLECT   → (Periodically) Form new insights
     ↓
4. PLAN      → What should I do next?
     ↓
5. ACT       → Execute the decided action
```

### Memory Retrieval Algorithm

When retrieving relevant memories, score each by:
- **Recency**: How recent is the memory? (exponential decay)
- **Importance**: How significant was it? (LLM-rated 1-10)
- **Relevance**: How related to current context? (keyword/embedding similarity)

```typescript
score = α * recency + β * importance + γ * relevance
// Return top-k memories by score
```

For local LLMs without embeddings, use keyword matching for relevance scoring.

### Agent Generation

Agents are procedurally generated with:
- **Name**: Random from name lists
- **Age**: 18-75
- **Occupation**: From list (shopkeeper, teacher, farmer, artist, etc.)
- **Personality traits**: 3-5 traits (friendly, curious, grumpy, etc.)
- **Daily routine template**: Based on occupation
- **Initial relationships**: Randomized connections to 2-4 other agents

---

## World Design

### Town Locations (15+ required)

| Location | Purpose | Typical Activities |
|----------|---------|-------------------|
| Town Square | Central hub | Meeting, socializing |
| General Store | Shopping | Buying supplies, chatting |
| Cafe | Dining/Social | Eating, conversations |
| Library | Knowledge | Reading, studying |
| Park | Recreation | Walking, relaxing |
| School | Education | Teaching, learning |
| Town Hall | Administration | Community events |
| Church | Spiritual | Reflection, gatherings |
| Farm | Agriculture | Working, harvesting |
| Blacksmith | Trade | Crafting, repairs |
| Inn | Lodging | Resting, travelers |
| Homes (5+) | Residential | Sleeping, private time |
| Pond/River | Nature | Fishing, contemplation |
| Market Stalls | Commerce | Trading, browsing |
| Garden | Nature | Tending plants |

### Map Implementation

Use **Tiled** map editor to create the tilemap:
- 16x16 pixel tiles
- Multiple layers (ground, objects, above-player)
- Collision layer for pathfinding
- Object layer marking locations and spawn points

---

## Time System

### Accelerated Time

```typescript
interface TimeConfig {
  tickIntervalMs: number;     // Real-time ms between simulation ticks (e.g., 100ms)
  gameMinutesPerTick: number; // How many game minutes pass per tick (e.g., 1)
  // At these settings: 1 real second = 10 game minutes
  //                    1 real minute = 10 game hours
  //                    ~2.4 real minutes = 1 game day
}
```

### Speed Controls

- **Pause**: Freeze simulation, allow inspection
- **Normal**: 1x speed (default settings above)
- **Fast**: 2x-4x speed
- **Ultra**: 10x speed (for testing)

### Daily Cycle

```
00:00-06:00  Night (most agents sleeping)
06:00-08:00  Morning (waking, breakfast)
08:00-12:00  Morning work/activities
12:00-13:00  Lunch
13:00-17:00  Afternoon work/activities
17:00-19:00  Evening (dinner, socializing)
19:00-22:00  Night activities (entertainment, home)
22:00-00:00  Bedtime transition
```

---

## LLM Integration

### Ollama Setup

Required model: `llama3.2:3b` or `phi3:mini`

```bash
# Install Ollama
brew install ollama

# Pull model
ollama pull llama3.2:3b
```

### Request Management

With 20+ agents, LLM calls must be carefully managed:

```typescript
class LLMRequestQueue {
  private queue: PriorityQueue<LLMRequest>;
  private concurrency: number = 1;  // Ollama handles one at a time
  private minDelayMs: number = 50;  // Prevent overload

  // Priority levels:
  // 1. Immediate actions (conversations in progress)
  // 2. Planning (daily/hourly plans)
  // 3. Reflection (can be deferred)
  // 4. Importance scoring (can be batched)
}
```

### Prompt Templates

#### Action Decision
```
You are {agent_name}, a {age}-year-old {occupation} in a small town.
Your personality: {traits}
Current time: {time}
Current location: {location}
You see: {observations}

Recent relevant memories:
{retrieved_memories}

Your current plan: {current_plan}

What do you do next? Choose one:
- MOVE_TO [location]: Go somewhere
- TALK_TO [person]: Start conversation
- ACTIVITY [action]: Do an activity
- WAIT: Stay and observe

Respond in format:
ACTION: [action type]
TARGET: [target if applicable]
REASON: [brief internal reasoning]
```

#### Conversation
```
You are {agent_name} talking to {other_agent_name}.
Your relationship: {relationship_description}
Context: {situation}
Conversation so far:
{dialogue_history}

What do you say next? Keep it brief (1-2 sentences).
If the conversation should end naturally, say [END_CONVERSATION].
```

#### Reflection
```
Recent observations:
{recent_observations}

Based on these observations, what high-level insight or reflection can you derive?
Focus on patterns, relationships, or important conclusions.
Respond with a single insight statement.
```

### Response Parsing

All LLM responses should be parsed with fallbacks:
```typescript
function parseActionResponse(response: string): AgentAction {
  // Try to extract structured format
  const actionMatch = response.match(/ACTION:\s*(\w+)/i);
  const targetMatch = response.match(/TARGET:\s*(.+)/i);

  if (!actionMatch) {
    // Fallback: default to WAIT
    return { type: 'WAIT', reason: 'Could not parse response' };
  }

  // Validate action type
  // Return parsed action or fallback
}
```

---

## UI Components

### 1. Speech Bubbles

Pokemon-style text boxes appearing near agents:
- Show during active conversations
- Auto-dismiss after 3-5 seconds
- Queue multiple messages
- Typewriter text effect

### 2. Log Panel (Right Side)

Scrolling event log showing:
- Agent actions: "Isabella walked to the cafe"
- Conversations: Summarized or full
- Reflections: "Klaus realized he enjoys Isabella's company"
- Filterable by agent or event type

### 3. Inspector Panel (Click to Open)

When clicking an agent:
- Current status/activity
- Current thoughts (last action reason)
- Relationship summary
- Recent memories (last 5-10)
- Current day plan

### 4. Time/Speed Controls (Top Bar)

- Current game time display
- Speed buttons: Pause | 1x | 2x | 4x
- Day counter

---

## Implementation Phases

### Phase 1: Foundation
**Goal: Basic world rendering and agent movement**

1. Set up project structure (Vite + TypeScript + Phaser)
2. Create basic Phaser scene with tilemap
3. Design and export tilemap from Tiled (or create programmatically)
4. Implement basic agent sprites that can move
5. Add A* pathfinding on collision layer
6. Create basic time system with pause/play

**Deliverable**: Agents walking randomly around a visible map

### Phase 2: LLM Integration
**Goal: Agents make LLM-powered decisions**

1. Set up Ollama client with request queue
2. Implement prompt templates
3. Create basic Agent class with decide() method
4. Wire agent decisions to movement
5. Add response parsing with fallbacks
6. Test with 3-5 agents

**Deliverable**: Agents moving purposefully based on LLM decisions

### Phase 3: Memory System
**Goal: Agents remember and use memories**

1. Implement MemoryStream class
2. Add observation creation from perceptions
3. Implement memory retrieval (recency + importance)
4. Add reflection generation (periodic)
5. Implement daily planning

**Deliverable**: Agents with working memory that influences decisions

### Phase 4: Social Interactions
**Goal: Agents have conversations and relationships**

1. Implement conversation system (multi-turn dialogue)
2. Add speech bubble UI
3. Create relationship tracking
4. Implement information propagation
5. Add relationship-aware behavior

**Deliverable**: Agents talking to each other meaningfully

### Phase 5: Full Town & Scale
**Goal: Complete town with 20+ agents**

1. Expand map to full 15+ locations
2. Implement agent generator
3. Add remaining agent activities (eating, sleeping, working)
4. Generate 20+ diverse agents
5. Performance tune LLM queue for scale

**Deliverable**: Full simulation with 20+ agents

### Phase 6: UI Polish
**Goal: Complete observer experience**

1. Implement log panel
2. Add inspector panel (click agents)
3. Add time controls
4. Create AI-generated sprites
5. Polish animations and transitions
6. Add sound effects (optional)

**Deliverable**: Polished observer experience

---

## Agent Actions Reference

| Action | Description | LLM Involvement |
|--------|-------------|-----------------|
| MOVE_TO | Navigate to location | Decision only |
| TALK_TO | Initiate conversation | Decision + dialogue |
| CONTINUE_TALK | Continue conversation | Dialogue generation |
| ACTIVITY | Perform activity | Decision only |
| WAIT | Stay in place | Decision only |
| END_CONVERSATION | Stop talking | Decision only |

---

## Key Technical Decisions

### Why Phaser.js?
- Built-in tilemap support (perfect for Pokemon-style)
- Sprite animation system
- Input handling
- Scene management
- Large community and documentation
- Easier learning curve than raw canvas for backend devs

### Why Monolithic Architecture?
- Simpler to develop and debug
- Single process for game state and LLM calls
- No network latency between components
- Easier to run locally

### Why In-Memory State?
- Simplifies implementation significantly
- No database setup needed
- Fast iteration during development
- Can add persistence later if needed

### Why Small Local LLM?
- Privacy (no data leaves machine)
- No API costs
- Works offline
- Good enough for behavior simulation

---

## Performance Considerations

### LLM Call Optimization

1. **Batch when possible**: Importance scoring can batch multiple observations
2. **Cache common patterns**: Store common action patterns
3. **Stagger decisions**: Not all agents decide on same tick
4. **Priority queue**: Urgent actions (conversations) get priority
5. **Timeout handling**: Cancel slow requests, use fallback actions

### Rendering Optimization

1. **Cull off-screen agents**: Don't render what's not visible
2. **Object pooling**: Reuse speech bubble objects
3. **Throttle updates**: UI panels update every N frames, not every frame

---

## Testing Strategy

### Unit Tests
- Memory retrieval scoring
- Time system calculations
- Action parsing
- Pathfinding

### Integration Tests
- Agent decision loop with mock LLM
- Conversation flow
- Memory creation from observations

### Manual Testing
- Watch simulation for 10+ game days
- Check for stuck agents
- Verify conversations make sense
- Ensure memories influence behavior

---

## Future Enhancements (Out of Scope)

These are explicitly NOT part of the initial implementation:
- Persistence/save states
- Player-controlled character
- Procedural world generation
- Multi-machine distribution
- Web deployment (beyond local)
- Voice/audio for agents

---

## Dependencies

```json
{
  "dependencies": {
    "phaser": "^3.70.0",
    "express": "^4.18.0",
    "ws": "^8.16.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/ws": "^8.5.0"
  }
}
```

---

## Getting Started Commands

```bash
# Install dependencies
npm install

# Install and start Ollama
brew install ollama
ollama serve &
ollama pull llama3.2:3b

# Run development server
npm run dev

# Open browser to http://localhost:5173
```

---

## Success Criteria

The implementation is complete when:
1. 20+ agents are visible and moving purposefully in the town
2. Agents have conversations that make contextual sense
3. Agents remember past events and reference them
4. Agents form and maintain relationships
5. Time passes at configurable speeds with working pause
6. Observer can see agent thoughts, logs, and inspect individuals
7. Simulation runs smoothly on M4 MacBook Air
8. Agents exhibit emergent social behaviors (information spreading, relationship dynamics)
