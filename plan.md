# 8bit-agent-town Implementation Plan (Revised)

## Goals and constraints (from interview)

- 8-bit Pokemon Red / Gameboy Color aesthetic with camera pan and zoom.
- 20+ autonomous agents, observer-only play.
- Full Generative Agents paper features: memory stream, reflection, planning, social propagation.
- Accelerated time with pause and speed control.
- Local LLM only (Ollama / llama.cpp), small models on M4 MacBook Air.
- In-memory state only for gameplay (no database).
- Backend dev friendly workflows and tooling.

## Decision review and adjustments (scrutiny)

- Frontend stack: Phaser remains a strong fit for tilemaps and pixel art. Adjustment: use Phaser for world rendering only, and HTML/CSS overlays for log, inspector, and controls. This keeps UI iteration simple and avoids building complex UI inside the canvas.
- Monolithic architecture: the browser still needs a server to own simulation state and call Ollama. Adjustment: single repo and single host, but two processes in dev: a Node simulation server and a browser client. Communication is WebSocket. This preserves simplicity while preventing heavy AI logic in the client.
- In-memory only: memory streams will grow quickly with 20+ agents. Adjustment: memory pruning, summarization, and optional debug snapshots to JSON (for reproducibility only, not gameplay persistence).
- 20+ agents with local LLM: naive LLM calls per tick will not scale. Adjustment: a decision scheduler that staggers agent reasoning, uses rule-based fallbacks for common behaviors, and reserves LLM calls for planning, reflection, and dialogue.
- Local model choice: keep Llama 3.2 3B or Phi-3 Mini, but run quantized variants and low temperature. Add strict JSON outputs and validation to avoid parsing failures.

## System architecture

```
Browser (Phaser + DOM UI)
   |  WebSocket (state deltas, events)
   v
Node Simulation Server
   |  HTTP (local)
   v
Ollama (local LLM)
```

### Process responsibilities

- Client: render map, sprites, speech bubbles, and UI panels. No AI logic.
- Server: authoritative simulation, agent cognition, memory, LLM calls, and event log.
- Ollama: LLM inference only. No game state stored.

### Data flow

- Server emits world state snapshots on join and deltas every tick.
- Client sends UI control events (pause, speed, inspect agent).
- Server pushes agent events (actions, dialogue, reflections) to the log panel.

## Project structure

```
8bit-agent-town/
  src/
    client/
      game/
        scenes/
          BootScene.ts
          TownScene.ts
        sprites/
          AgentSprite.ts
        camera/
          CameraController.ts
      ui/
        LogPanel.ts
        InspectorPanel.ts
        TimeControls.ts
      index.ts
    server/
      index.ts
      simulation/
        Simulation.ts
        TickScheduler.ts
        TimeManager.ts
      world/
        Town.ts
        Location.ts
        Pathfinding.ts
        NavGrid.ts
        Spawns.ts
      agents/
        Agent.ts
        AgentState.ts
        AgentGenerator.ts
        behaviors/
          BehaviorTree.ts
          Activities.ts
          Movement.ts
          Conversation.ts
          Relationships.ts
        cognition/
          Perceive.ts
          Retrieve.ts
          Reflect.ts
          Plan.ts
          Act.ts
      memory/
        MemoryStream.ts
        MemoryScoring.ts
        Summarizer.ts
        Types.ts
      llm/
        OllamaClient.ts
        PromptTemplates.ts
        RequestQueue.ts
        ResponseSchemas.ts
      transport/
        WsServer.ts
        Events.ts
    shared/
      Types.ts
      Events.ts
      Constants.ts
  assets/
    tiles/
    sprites/
    ui/
  tools/
    map/
    prompts/
  public/
  plan.md
```

## Simulation model

### World state

- Tilemap-backed world with named locations (home, cafe, library, etc.).
- Location metadata includes type, capacity, allowed activities, and tags (indoor, social, quiet).
- Nav grid derived from collision layer for A* pathfinding.
- Spawn points for agents and key NPCs.

### Agent state (server-owned)

- Identity: name, age, occupation, traits, short bio.
- Physical: position, path, speed, current location.
- Cognitive: current goal, plan queue, current thought.
- Social: relationship graph with weights and tags.
- Memory: stream of observations, reflections, plans.
- Status: hunger, energy, mood (simple 0-100 scales for behavior gating).

### Agent action loop (staggered)

- Each agent has a scheduled nextDecisionAt time.
- Decision cadence is 2-10 seconds real time (varies by activity).
- LLM calls only when a high-level decision is needed.
- Movement updates and path following run every tick.

### Agent finite states

- Idle
- Walking
- Conversing
- Activity
- Sleeping

## Time system

- Tick interval: 200 ms real time.
- Game time scale: 1 tick = 1 game minute (configurable).
- Speed settings: pause, 1x, 2x, 4x, 10x.
- Day cycle schedule used for routine planning and reflection windows.

## LLM integration

### Model and runtime

- Default model: `llama3.2:3b` or `phi3:mini`.
- Quantized variants preferred for speed.
- Temperature 0.2 to 0.4 for consistency.

### Request queue

- Concurrency: 1 (local CPU bound).
- Priority: dialogue turns > plan updates > reflections > importance scoring.
- Rate limits: min delay 50-200 ms between calls.
- Timeouts: 10-20 seconds, with rule-based fallback.

### JSON-only responses (strict)

Use `format: "json"` and validate with zod or AJV.

Example action response schema:

```json
{
  "action": "MOVE_TO",
  "target": "Library",
  "reason": "I want to read to relax after work"
}
```

### Prompt strategy

- Keep prompts short and structured.
- Use agent profile + retrieved memories + local context only.
- Summarize long conversations before adding to memory.
- Avoid chaining large prompts for small models.

### LLM call gating (performance critical)

- Default behavior uses a rule-based behavior tree.
- LLM is used for:
  - Daily plan generation (once per in-game morning)
  - Reflection (every 3-6 in-game hours)
  - Dialogue turns
  - High-level action changes (when routine fails or new event happens)

## Memory system (Generative Agents)

### Memory types

- Observation: raw events the agent perceived.
- Reflection: higher-level insight derived from observations.
- Plan: future actions (daily or hourly).

### Scoring for retrieval

```
score = 0.5 * recency + 0.3 * importance + 0.2 * relevance
```

- Recency: exponential decay over in-game time.
- Importance: LLM rated 1-10 (batched or heuristic fallback).
- Relevance: BM25 keyword similarity (fast, local, no embeddings).

### Memory pruning

- Keep rolling window of last N observations (configurable, e.g., 200).
- Summarize old conversations into a single memory.
- Drop low-importance observations past a cutoff.

## Relationships and social propagation

- Relationship graph per agent: weighted edges with tags (friend, rival, coworker).
- Relationship updates after conversations and shared events.
- Social propagation: when agent A tells B a fact, B stores it as a memory and can pass it on.
- Conversation triggers: proximity + relationship weight + shared schedule overlap.

## Conversation system

- Turn-based dialogue with a max turn limit.
- Conversation state stored server-side to avoid concurrent overlaps.
- Dialogue messages appear as speech bubbles and in the log.
- End conditions: timeout, agent path priority, or LLM says "END".

## World and map design

- Use Tiled to create a 16x16 tilemap.
- Layers: ground, objects, above-player, collision.
- Object layer for location bounds, spawn points, and interaction hotspots.
- Pathfinding: A* on grid with cached walkable tiles.

## Client rendering

- Phaser 3 for map and sprites.
- Pixel-perfect scaling with nearest-neighbor.
- Camera follows a focal point and supports dragging.
- Off-screen culling for agents and speech bubbles.

## UI overlay

- HTML/CSS panels layered above the canvas.
- Log panel: filter by agent, event type.
- Inspector: current plan, recent memories, relationship summary.
- Time controls: pause, speed, day counter, current time.

## Observability and debug

- Toggle to show agent paths and perception radius.
- Debug panel for last LLM prompt and response per agent.
- Event log supports export to JSON for replay.

## Tooling and dev workflow

- Node 20+, TypeScript, Vite for client.
- `tsx` or `nodemon` for server hot reload.
- `concurrently` to run client and server in dev.
- `vitest` for unit and integration tests.

## Implementation phases (revised)

### Phase 1: World rendering and movement

- Vite + Phaser setup, render static map.
- Tilemap import from Tiled and collision setup.
- Basic agent sprites and pathfinding.
- Camera pan and zoom.

### Phase 2: Simulation loop and scheduling

- Implement tick scheduler and time manager.
- Add agent state machine (Idle, Walking, Activity).
- Staggered decision scheduling (no LLM yet).

### Phase 3: LLM integration and action selection

- Build Ollama client, request queue, and JSON parsing.
- Add action selection prompt and fallback heuristics.
- Limit to 3-5 agents for initial tests.

### Phase 4: Memory, reflection, and planning

- Memory stream and retrieval scoring.
- Reflection generation and daily planning.
- Summarization and pruning.

### Phase 5: Conversations and relationships

- Dialogue manager with turn-based logic.
- Relationship tracking and social propagation.
- Speech bubbles and log integration.

### Phase 6: Full town and scale

- Expand to 15+ locations.
- Add generated agents (20+).
- Performance tuning for request queue and update rates.

### Phase 7: UI polish and debug

- Inspector, filters, time controls.
- Debug overlays and log export.
- Asset pass for sprites and tiles.

## Dependencies (baseline)

```json
{
  "dependencies": {
    "phaser": "^3.70.0",
    "express": "^4.18.0",
    "ws": "^8.16.0",
    "p-queue": "^8.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "tsx": "^4.0.0",
    "concurrently": "^8.0.0",
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "@types/ws": "^8.5.0"
  }
}
```

## Getting started

```bash
npm install
brew install ollama
ollama pull llama3.2:3b
npm run dev
```

## Success criteria

1. 20+ agents move purposefully with scheduled decisions.
2. Agents converse and relationships change over time.
3. Memories influence actions and reflections occur daily.
4. Time controls and observer tools work smoothly.
5. Simulation runs reliably on M4 MacBook Air.

---

## Component Task List (for worker agents)

### 1. Repo and tooling

- Create `src/client`, `src/server`, `src/shared` structure.
- Add TypeScript configs for client and server.
- Add Vite config for Phaser client build.
- Add server dev runner (`tsx`) and `concurrently` scripts.

### 2. Shared types and events

- Define shared `AgentId`, `LocationId`, `GameTime` types.
- Define WebSocket event schemas (snapshot, delta, log, control).
- Add zod schemas for runtime validation of events.

### 3. WebSocket transport

- Implement WS server and client connection flow.
- Add join handshake and initial world snapshot.
- Add delta updates per tick.
- Add client control messages (pause, speed, inspect).

### 4. Time manager

- Implement `TimeManager` with tick scale and speed controls.
- Add conversion helpers (real ms <-> game minutes).
- Add day boundary events for planning and reflection.

### 5. Tick scheduler

- Build a tick loop with fixed timestep and drift correction.
- Maintain per-agent `nextDecisionAt` schedule.
- Add hooks for per-tick movement and event emission.

### 6. World map and navigation

- Import tilemap from Tiled (JSON).
- Build collision and walkable grids.
- Implement A* pathfinding with caching.
- Add location bounds, tags, and spawn points.

### 7. Agent data model

- Create `AgentState` with identity, status, and position.
- Add `AgentProfile` and generated traits.
- Add status meters (energy, hunger, mood) for behavior gating.

### 8. Agent generator

- Build seeded RNG for reproducible agents.
- Generate names, occupations, traits, and home locations.
- Create initial relationship graph (2-4 edges per agent).

### 9. Behavior tree and heuristics

- Implement a light behavior tree for default actions.
- Add rules for sleeping, eating, working, relaxing.
- Integrate with schedules and status meters.

### 10. LLM client

- Implement Ollama HTTP client with retries and timeout.
- Add request queue with priority scheduling.
- Support `format: "json"` responses.

### 11. Prompt templates

- Create prompts for action selection, dialogue, reflection, planning.
- Keep prompts short and consistent across models.
- Add system prompt for agent persona and constraints.

### 12. LLM response parsing

- Define zod schemas for each response type.
- Add strict parser with fallback behavior.
- Log invalid responses for debugging.

### 13. Memory stream

- Implement memory storage with observation, reflection, plan types.
- Add metadata: time, location, subjects, importance.
- Add write APIs for perception and conversation summaries.

### 14. Memory scoring and retrieval

- Implement recency decay function.
- Add BM25 keyword relevance scoring.
- Combine scores to return top K memories.

### 15. Memory summarization and pruning

- Add summarizer to compress old conversations.
- Implement pruning rules for low-importance memories.
- Add memory size limits per agent.

### 16. Perception system

- Define perception radius and line-of-sight rules.
- Generate observation events from nearby agents and locations.
- Add filters for relevant events only.

### 17. Planning system

- Daily plan generation at morning boundary.
- Hourly plan updates and plan queue.
- Plan to action conversion (locations and activities).

### 18. Reflection system

- Reflection scheduling every N game hours.
- Reflection output stored as high-importance memory.
- Reflection results affect relationship weights and plan updates.

### 19. Conversation manager

- Start conversations based on proximity and relationship weights.
- Manage turn-based dialogue and max turn limits.
- Emit speech bubble events and log entries.

### 20. Relationship system

- Relationship graph with weights and tags.
- Update rules based on conversation sentiment and shared events.
- Provide summary data for inspector UI.

### 21. Event log system

- Server-side log event model (action, dialogue, reflection).
- Client log panel rendering and filters.
- Optional export to JSON for debugging.

### 22. Client map rendering

- Phaser scene with tilemap layers.
- Sprite rendering for agents with animations.
- Camera pan, zoom, and bounds.

### 23. Client agent rendering

- Agent sprite manager with pooling.
- Interpolate positions between server ticks.
- Show speech bubbles near agents.

### 24. UI overlay

- HTML/CSS log panel with filters.
- Inspector panel on agent click (plan, memories, relationships).
- Time controls with pause and speed.

### 25. Debug overlays

- Toggle for path and perception radius.
- Show last LLM prompt and response for selected agent.
- Show tick rate and queue length.

### 26. Asset pipeline

- Define tileset and sprite sheet format.
- Add placeholder AI-generated assets.
- Ensure pixel-perfect scaling and alignment.

### 27. Performance tuning

- Reduce update frequency for UI panels.
- Cull off-screen agents and bubbles.
- Tune LLM queue delays and decision cadence.

### 28. Testing

- Unit tests for time manager and memory scoring.
- Integration tests for LLM parsing and action flow.
- Manual test checklist for 10+ in-game days.

### 29. Documentation

- README with setup, Ollama model choices, and controls.
- Developer notes on prompt tuning and memory limits.
- Troubleshooting guide for slow LLM responses.
