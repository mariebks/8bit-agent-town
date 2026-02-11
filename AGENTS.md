# 8bit Agent Town

## Project context

- This is a local-first, monolithic TypeScript project with:
  - Browser client (`src/client`) using Phaser for rendering and UI overlays.
  - Node server (`src/server`) running simulation, cognition, memory, and transport.
  - Shared protocol/types in `src/shared`.
- Primary product goal: a Pokemon-style observer simulation with autonomous agents, not a player-controlled RPG.
- Core constraints from product direction:
  - Works on a MacBook with local models.
  - Supports larger populations (20+ agents) with stable performance.
  - Preserves rich social behavior (memory, relationships, conversations).

## Review guidelines

- Prioritize correctness and regressions over style.
- Flag only high-impact defects by default (P0/P1), but treat the items below as P1 if broken.

### Treat as P1 if violated

- Protocol/schema mismatch:
  - Any mismatch between `src/server/simulation/Simulation.ts` payload fields and `src/shared/Events.ts` / `src/shared/Types.ts`.
  - Any client assumption that can crash on missing/renamed fields.
- Simulation integrity:
  - Pause/resume/speed controls not behaving correctly.
  - Determinism regressions in non-LLM paths when seeded behavior is expected.
  - Relationship/conversation state bugs that silently drop major social signals.
- Local-first operation:
  - Changes that make the app require cloud APIs for core behavior.
  - Regressions where the app fails to run meaningfully with LLM disabled or unavailable.
- Performance and scalability:
  - New per-tick hot-path work that is clearly avoidable and likely to degrade 20+ agent runs.
  - Unbounded queue growth, uncontrolled memory growth, or expensive repeated recomputation.
- UX control regressions:
  - Broken mode switching (`spectator`, `story`, `debug`), panel toggles, keyboard shortcuts, or timeline/inspector basics.

### Focus areas by subsystem

- `src/server/simulation/*`, `src/server/agents/*`:
  - State transitions, queue behavior, and event emission consistency.
- `src/shared/*`:
  - Backward-compatible type/schema evolution and protocol safety.
- `src/client/game/*`, `src/client/ui/*`:
  - Render/update safety, selection/follow behavior, and interaction correctness.

### Testing expectations for non-trivial changes

- Ask for tests when behavior changes in simulation logic, protocol payloads, or UI state derivation.
- Prefer targeted tests plus full validation via:
  - `npm run verify:phase8`

### De-emphasize

- Pure stylistic nits without user or operational impact.
- Refactor suggestions that do not reduce risk, improve correctness, or improve maintainability in a concrete way.
