# 8bit-agent-town Implementation Plan (Revised)

## Goals and constraints (from interview)

- 8-bit Pokemon Red / Gameboy Color aesthetic with camera pan and zoom.
- 20+ autonomous agents, observer-only play.
- Full Generative Agents paper features: memory stream, reflection, planning, social propagation.
- Accelerated time with pause and speed control.
- Local LLM only (Ollama / llama.cpp), small models on M4 MacBook Air.
- In-memory state only for gameplay (no database).
- Backend dev friendly workflows and tooling.

## Authoritative engineering constraints

The following constraints supersede any conflicting detail in this document or the phase plans:

1. Determinism contract for simulation:
   - Simulation logic must be driven by tick index and seeded RNG only.
   - Do not use `Date.now()` or `Math.random()` for simulation outcomes.
   - Wall-clock time is allowed only for diagnostics/logging.
2. Non-blocking cognition:
   - Tick loop must never `await` LLM, reflection, or summarization work.
   - Long-running cognitive tasks are queued and applied as deferred results.
3. LLM budget enforcement on local hardware:
   - Maintain strict concurrency limits and per-agent cooldowns.
   - Drop stale queued requests (do not execute outdated intents).
   - Prefer rule-based actions whenever confidence is high.
4. In-memory gameplay state with optional debug artifacts:
   - Runtime state remains in memory only.
   - Optional JSON debug snapshots/event logs are allowed for replay and troubleshooting, not persistence.
5. Monolithic repo, split runtime:
   - Single codebase remains correct, but dev runtime is two cooperative processes (server + client) for clarity and stability.

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
  - Reflection (budgeted, roughly 1-2 times per in-game day per agent)
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
- Relevance: lightweight keyword overlap scoring (BM25 optional later if needed).

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

Each phase has a goal, a set of explicit tasks, and an end state. Do not move to the next phase until the end state is met.

## Completion status (2026-02-07)

- [x] Phase 1 complete (world rendering, movement, camera, pathfinding).
- [x] Phase 2 complete (server authority, deterministic ticks, controls, socket sync).
- [x] Phase 3 complete (Ollama integration, queueing, schema validation, fallback behavior).
- [x] Phase 4 complete (memory stream, reflection, planning, pruning).
- [x] Phase 5 complete (conversation flow, relationship updates, social memory propagation).
- [x] Phase 6 complete (20+ agents, path cache + culling, stress harness and long-run artifacts).
- [x] Phase 7 complete (UI panels, overlays, shortcuts, export, prompt/response tooling).

Current verification baseline:
- `npm run test -- --run` -> 100/100 tests passing.
- `npm run build` -> passing.
- `npm run test:e2e` -> passing.
- `npm run test:e2e:fullstack` -> passing.

### Phase 1: World rendering and movement

Goal: show the town and agents moving in a controllable camera without any server or AI dependencies.

Tasks:
- Create a Vite + Phaser client that boots to a single `TownScene` and renders a blank canvas with a visible background color so it is obvious the render loop is alive.
- Import a Tiled JSON tilemap and tileset from `assets/tiles/`, render ground + object layers, and verify tile alignment (16x16) with nearest-neighbor scaling.
- Add a temporary "debug agents" array in the client that spawns 3-5 sprites at known tile coordinates with unique colors or tint.
- Implement basic pathfinding on the client (A* on a grid from the collision layer) and a simple "click to move" path for one debug agent.
- Add camera pan (click-drag or WASD) and zoom (mouse wheel) with bounds so the camera never shows outside the map.
- Add a lightweight frame-time overlay (text in the corner) to confirm stable FPS during movement.

End state:
- Running the client shows the full map, tiles are crisp and aligned, and at least one agent follows a path across walkable tiles.
- Camera pan and zoom work smoothly without showing outside the map bounds.
- No server process is required; everything runs from `npm run dev` with a static client.

### Phase 2: Simulation loop and scheduling

Goal: move authority to the server and drive movement from a deterministic tick loop.

Tasks:
- Create a Node server with a tick loop at 200 ms and a `TimeManager` that converts real time to game minutes.
- Implement `Simulation` state that owns agent positions, statuses, and a simple state machine (Idle, Walking, Activity).
- Add a WebSocket server with a join handshake that sends a full snapshot on connect.
- Send delta updates each tick with agent positions and state changes; the client interpolates between ticks.
- Implement staggered decision scheduling (per-agent `nextDecisionAt`) with rule-based choices only, no LLM.
- Mirror time controls in the client (pause, 1x, 2x, 4x, 10x) and send controls to the server.

End state:
- With both client and server running, agents move based on server decisions and the client only renders.
- Pausing and changing speed takes effect within one tick and stays consistent across reconnects.
- The same seed produces the same agent movements for a 10-minute simulated run.

### Phase 3: LLM integration and action selection

Goal: connect local LLM inference and use it for high-level action selection with safe fallbacks.

Tasks:
- Implement `OllamaClient` with timeout, retries, and a request queue that enforces single concurrency.
- Define JSON response schemas for action selection and validate with zod; reject invalid JSON and log failures.
- Add prompt templates for action selection that include agent profile, current status, and local context only.
- Gate LLM calls to only trigger when a rule-based decision cannot pick a reasonable action.
- Start with 2-3 LLM-enabled agents and keep others on rules to protect performance during early tests.
- Add a "last LLM response" debug entry in the server log for quick inspection.

End state:
- Start with 2-3 agents requesting LLM actions, then scale once queue/tick metrics are healthy.
- When the LLM is unavailable or times out, agents fall back to rule-based actions and continue moving.
- LLM request rate stays below 1 concurrent call and does not stall the simulation loop.

### Phase 4: Memory, reflection, and planning

Goal: give agents persistent cognition via memory streams, reflection, and daily planning.

Tasks:
- Implement `MemoryStream` per agent with observation, reflection, and plan types plus metadata.
- Add retrieval scoring (recency, importance, relevance) and a function to fetch top K memories for prompts.
- Implement daily planning at the morning boundary with a stored plan queue.
- Implement reflection every N in-game hours and store reflections as high-importance memories.
- Add summarization and pruning rules to cap memory growth without deleting high-importance items.

End state:
- Agents generate a daily plan once per in-game day and reference it in action selection.
- Reflection entries appear in the memory stream and can alter future actions.
- Memory counts stay within the configured limits during a 3-day simulation.

### Phase 5: Conversations and relationships

Goal: enable agents to talk, update relationships, and propagate information.

Tasks:
- Build a `ConversationManager` that locks two agents into a turn-based dialogue with a max turn limit.
- Add dialogue prompts and JSON schema for LLM turns, plus rule-based fallback for short replies.
- Update relationship weights based on sentiment or conversation outcomes.
- Implement social propagation: when A tells B a fact, B stores it as an observation memory.
- Render speech bubbles in the client and append dialogue to the log panel.

End state:
- Agents can start and finish conversations without blocking movement or decision scheduling.
- Relationship weights change measurably after conversations and are visible in the inspector.
- Dialogue appears both as bubbles in the world and in the log panel with timestamps.

### Phase 6: Full town and scale

Goal: scale to a lively town with 20+ agents and multiple locations without degrading performance.

Tasks:
- Expand the tilemap to include 15+ named locations with bounds and metadata.
- Generate 20+ agents with unique profiles, homes, and a small relationship graph.
- Tune decision cadence, pathfinding caching, and render culling for smooth performance.
- Stress test the LLM queue by running a 10-day simulation with logging enabled.

End state:
- 20+ agents navigate the town and maintain stable tick timing for at least 10 in-game days.
- LLM queue backlog stays bounded and the simulation does not stall under load.
- Client renders smoothly with off-screen culling enabled and no major FPS drops.

### Phase 7: UI polish and debug

Goal: provide an observer-friendly UI with inspection tools and debugging support.

Tasks:
- Implement log filters, agent inspector, and time controls as HTML/CSS overlays.
- Add debug overlays for paths, perception radius, and tick/queue stats.
- Implement log export to JSON and a compact prompt/response viewer for the selected agent.
- Final asset pass on sprites and tiles to match the 8-bit aesthetic.

End state:
- The UI surfaces current plans, memories, and relationships for any agent with minimal clicks.
- Debug overlays can be toggled on/off and provide accurate, low-latency information.
- The scene looks cohesive with pixel art assets and consistent scaling.

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

Each task below is intended to be handed to an individual worker. Include a short status note and a brief demo or evidence when marking complete.

### 1. Repo and tooling

Goal: set up a consistent build and dev environment for client and server.

Instructions:
- Create the `src/client`, `src/server`, and `src/shared` folders exactly as laid out in the project structure.
- Add `tsconfig` files for client and server with module resolution that supports path aliases in `src/shared`.
- Configure Vite to build the Phaser client and serve assets from `public/`.
- Add `npm` scripts for `dev` (client + server), `dev:client`, and `dev:server` using `tsx` or `nodemon`.

End state:
- `npm run dev` starts both processes with hot reload, and type checking works in both.
- `npm run dev:client` serves the Phaser app without server errors.
- `npm run dev:server` boots a Node server and logs a listening port.

### 2. Shared types and events

Goal: define stable shared types and event contracts across client and server.

Instructions:
- Define `AgentId`, `LocationId`, `GameTime`, and any core enums in `src/shared/Types.ts`.
- Define WebSocket event types for snapshot, delta, log, and control in `src/shared/Events.ts`.
- Add zod schemas for each event type and expose `parse` helpers for runtime validation.

End state:
- Client and server compile against the same shared types with no duplicate definitions.
- A malformed event payload fails schema validation with a clear error message.

### 3. WebSocket transport

Goal: establish a reliable, versioned WebSocket protocol between client and server.

Instructions:
- Implement a WS server in `src/server/transport/WsServer.ts` that accepts connections and assigns session IDs.
- Define a join handshake where the client sends a version and the server responds with a full snapshot.
- Emit delta updates every tick and include a monotonically increasing `tickId`.
- Support control messages (pause, speed, inspect) and acknowledge them in a server response.

End state:
- A fresh client receives a snapshot within 1 second of connecting.
- Deltas apply cleanly without missed ticks (client logs any skipped tick).
- Control messages change server state and are reflected in subsequent deltas.

### 4. Time manager

Goal: provide consistent game time tracking and speed control on the server.

Instructions:
- Implement `TimeManager` in `src/server/simulation/TimeManager.ts` with tick duration and game-minute conversion.
- Add helpers to convert real milliseconds to game minutes and to format a clock string.
- Emit day boundary events and expose hooks for daily planning and reflection triggers.

End state:
- Changing speed updates the game clock rate immediately without resetting the time.
- A day boundary event fires exactly once per simulated day.

### 5. Tick scheduler

Goal: run a stable tick loop and schedule per-agent decisions.

Instructions:
- Build a fixed timestep loop with drift correction (accumulate delta and process multiple ticks if needed).
- Maintain per-agent `nextDecisionAt` timestamps and skip decisions until due.
- Add hooks for per-tick movement updates and event emission to the log.

End state:
- The tick loop runs within 10 percent of the target interval over 5 minutes.
- No agent makes decisions more frequently than its configured cadence.

### 6. World map and navigation

Goal: import the town map and enable pathfinding on walkable tiles.

Instructions:
- Load the Tiled JSON map and tileset into a `Town` class in `src/server/world/`.
- Parse collision layers into a walkable grid and cache the result on startup.
- Implement A* pathfinding in `Pathfinding.ts` and cache common routes when start/end repeat.
- Define location bounds, tags, and spawn points in a dedicated object layer.

End state:
- A test path from any spawn to any location returns a valid route or a clear "no path" result.
- The server can query location metadata by ID and list all locations.

### 7. Agent data model

Goal: define the in-memory representation of agents and their statuses.

Instructions:
- Create `AgentState` with identity, position, status meters, current action, and plan queue.
- Add `AgentProfile` fields for name, age, occupation, traits, and bio.
- Implement status meter updates over time (energy, hunger, mood) with min/max clamps.

End state:
- The server can serialize a complete `AgentState` into a snapshot event.
- Status meters change predictably across ticks and never exceed 0-100.

### 8. Agent generator

Goal: generate reproducible agents with consistent profiles and relationships.

Instructions:
- Implement a seeded RNG utility in `src/server/agents/AgentGenerator.ts`.
- Generate names, occupations, traits, and home locations using fixed datasets in code or JSON.
- Create an initial relationship graph with 2-4 edges per agent and non-zero weights.

End state:
- The same seed yields identical agents and relationship graphs across runs.
- At least 20 agents can be generated without missing data fields.

### 9. Behavior tree and heuristics

Goal: provide rule-based behavior that works without the LLM.

Instructions:
- Implement a lightweight behavior tree in `src/server/agents/behaviors/BehaviorTree.ts`.
- Add rules for sleeping, eating, working, relaxing based on time of day and status meters.
- Ensure the tree produces deterministic actions for identical inputs.

End state:
- Agents follow reasonable daily routines without any LLM calls.
- The behavior tree returns a valid action for every agent every decision cycle.

### 10. LLM client

Goal: integrate local LLM inference with safe defaults and limits.

Instructions:
- Implement `OllamaClient` with HTTP calls, timeouts, and retry logic in `src/server/llm/`.
- Add a request queue that supports priorities and enforces concurrency of 1.
- Support `format: "json"` and provide a debug flag to log raw responses.

End state:
- A simple test prompt returns valid JSON within the timeout.
- Multiple queued requests are processed in priority order without overlap.

### 11. Prompt templates

Goal: create consistent prompts that fit small local models.

Instructions:
- Implement prompt builders for action selection, dialogue, reflection, and planning in `PromptTemplates.ts`.
- Keep prompts under a fixed token budget (define a target character count).
- Include a system prompt defining agent persona, constraints, and JSON-only output.

End state:
- Each prompt type produces a complete JSON response on the default model in most cases.
- Prompts do not exceed the target size when used with a typical memory set.

### 12. LLM response parsing

Goal: safely parse LLM JSON responses into typed structures.

Instructions:
- Define zod schemas for each response type in `ResponseSchemas.ts`.
- Implement a strict parser that rejects extra keys and invalid enums.
- Provide a fallback action when parsing fails and log the error with context.

End state:
- Invalid LLM outputs never crash the server.
- Parsing failures are logged with enough detail to reproduce the prompt.

### 13. Memory stream

Goal: store and retrieve agent memories with enough metadata for reasoning.

Instructions:
- Implement `MemoryStream` with separate arrays for observations, reflections, and plans.
- Attach metadata: timestamp, location, subjects, importance score, and source (perception, dialogue).
- Add write APIs for perception events and conversation summaries.

End state:
- New memories are appended with the correct metadata.
- Memory writes are cheap enough to call on every tick without noticeable slowdown.

### 14. Memory scoring and retrieval

Goal: retrieve the most relevant memories for a given context.

Instructions:
- Implement a recency decay function that takes in-game time and returns a 0-1 score.
- Add lightweight keyword relevance scoring first; treat BM25 as optional later optimization.
- Combine recency, importance, and relevance into a final score and return top K.

End state:
- A query returns a stable, ordered list of memories with scores.
- The top K list changes logically as time advances and new memories appear.

### 15. Memory summarization and pruning

Goal: control memory growth while preserving key information.

Instructions:
- Implement a summarizer that compresses long conversations into a single memory entry.
- Add pruning rules to drop low-importance observations beyond a threshold.
- Enforce per-agent memory limits and trigger pruning at safe intervals.

End state:
- Memory counts remain under the configured cap after a 3-day run.
- Summaries retain the main facts from the source conversation.

### 16. Perception system

Goal: generate observations from the world in a realistic way.

Instructions:
- Define a perception radius and simple line-of-sight rules in `Perceive.ts`.
- Emit observation events when agents or locations enter the radius.
- Filter out noisy or duplicate events within a short time window.

End state:
- Agents record nearby activity without flooding the memory stream.
- Observation events include correct time and location metadata.

### 17. Planning system

Goal: convert high-level plans into actionable sequences.

Instructions:
- Trigger daily plan generation at the morning boundary and store it as a plan memory.
- Implement hourly plan adjustments when status meters drift or events occur.
- Convert plan items into concrete actions (move to location, start activity).

End state:
- Each agent maintains a plan queue with at least 3-5 items per day.
- Agents follow plan items unless interrupted by higher-priority needs.

### 18. Reflection system

Goal: allow agents to form insights that affect behavior and relationships.

Instructions:
- Schedule reflections every N in-game hours via the time manager.
- Generate a reflection entry from recent memories and store it as high-importance.
- Apply reflection effects to relationship weights or plan priorities.

End state:
- Reflection entries appear at the expected cadence and influence future actions.
- Relationship changes caused by reflection are visible in the inspector.

### 19. Conversation manager

Goal: coordinate multi-turn dialogues without blocking other systems.

Instructions:
- Start conversations based on proximity, relationship weight, and schedule overlap.
- Use turn-based logic with a maximum turn limit and per-turn timeouts.
- Emit speech bubble events and log entries for each turn.

End state:
- Agents can talk while others continue their activities.
- Conversations end gracefully on timeout or when the LLM signals completion.

### 20. Relationship system

Goal: model social connections and update them over time.

Instructions:
- Implement a relationship graph with weights and tags per agent.
- Update weights after conversations and shared events using explicit rules.
- Expose relationship summaries for UI inspection (top 5 strongest ties).

End state:
- Relationship weights change over time and never exceed defined bounds.
- The inspector can show accurate relationship summaries for any agent.

### 21. Event log system

Goal: provide a structured log for observer UI and debugging.

Instructions:
- Define log event types for actions, dialogue, reflections, and system events.
- Store the log on the server with a rolling window and timestamp.
- Render the log on the client with filters by agent and event type.

End state:
- The log panel shows new events in near real time.
- Exporting the log produces valid JSON with timestamps and IDs.

### 22. Client map rendering

Goal: render the world map accurately and efficiently in Phaser.

Instructions:
- Create a Phaser scene that loads the tilemap, tileset, and layers.
- Render ground and objects with correct depth ordering and sorting.
- Set up camera bounds, zoom limits, and pixel-perfect scaling.

End state:
- The map renders exactly as it appears in Tiled.
- Camera movement never shows outside the map bounds.

### 23. Client agent rendering

Goal: render and animate agents smoothly based on server updates.

Instructions:
- Implement an agent sprite manager with pooling to avoid allocations.
- Interpolate positions between ticks and snap to grid on large corrections.
- Display speech bubbles anchored to agent sprites with culling off-screen.

End state:
- Agents move smoothly without jitter during normal tick updates.
- No more than a fixed maximum number of sprites exist after 10 minutes.

### 24. UI overlay

Goal: deliver a clear observer UI on top of the canvas.

Instructions:
- Build log, inspector, and time control panels as HTML/CSS overlays.
- Wire agent selection to populate inspector fields (plan, memories, relationships).
- Implement keyboard shortcuts for pause and speed changes.

End state:
- The UI updates within one tick of state changes.
- Selecting an agent shows their current plan and latest memories.

### 25. Debug overlays

Goal: expose internal state for debugging and tuning.

Instructions:
- Add toggles for path visualization and perception radius in the client.
- Show last LLM prompt/response in a debug panel for the selected agent.
- Display tick rate and LLM queue length in a small HUD.

End state:
- Debug overlays can be toggled without restarting the app.
- The HUD displays accurate metrics updated at least once per second.

### 26. Asset pipeline

Goal: ensure assets are consistent, pixel-perfect, and easy to swap.

Instructions:
- Define tileset and sprite sheet dimensions, naming, and folder structure.
- Add placeholder assets that respect palette and 16x16 grid constraints.
- Configure Phaser to use nearest-neighbor scaling and no smoothing.

End state:
- Assets load without scaling artifacts.
- Replacing a sprite sheet does not require code changes.

### 27. Performance tuning

Goal: keep simulation and rendering responsive under load.

Instructions:
- Reduce UI update frequency for heavy panels and use batched DOM updates.
- Cull off-screen agents and speech bubbles in the client renderer.
- Tune LLM queue delay and decision cadence to keep the tick loop stable.

End state:
- The tick loop remains within 10 percent of target interval with 20+ agents.
- Client frame rate stays smooth with culling enabled.

### 28. Testing

Goal: validate critical systems with automated and manual checks.

Instructions:
- Add unit tests for time manager conversions and memory scoring functions.
- Add integration tests for LLM parsing and action flow with mock responses.
- Create a manual test checklist for 10+ in-game days and log failures.

End state:
- Tests pass locally and cover the most failure-prone logic.
- The manual checklist captures reproducible steps and expected outcomes.

### 29. Documentation

Goal: provide clear setup and troubleshooting guidance for contributors.

Instructions:
- Update README with setup steps, model choices, and runtime controls.
- Add developer notes on prompt tuning, memory limits, and performance tradeoffs.
- Write a troubleshooting section for common Ollama errors and slow inference.

End state:
- A new developer can run the project from README alone.
- Troubleshooting guidance covers the top 3 failure cases.
