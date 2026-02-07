# Phase 8: Experience Polish, Conversation Depth, and UX Simplification

## Purpose

This phase upgrades the app from "technically complete MVP" to "pleasant and legible to play for long sessions."

Focus areas:
- Make the game easier to use without reading docs.
- Make agent dialogue more coherent, varied, and narratively meaningful.
- Reduce visual clutter and panel overload while preserving power-user observability.
- Improve art direction toward a polished Game Boy Color / Pokemon-inspired feel.

This phase is intentionally experience-first, not architecture-first.

## Non-Goals

- Rewriting core simulation architecture.
- Adding online multiplayer.
- Switching engines or framework stack.
- Shipping copyrighted Pokemon assets.

## Current Problems (Observed)

1. Too many overlays/panels compete for attention.
2. Conversation output can feel generic, repetitive, or context-thin.
3. Important events are hard to distinguish from noisy logs.
4. Visual hierarchy is inconsistent; "debug look" dominates "game look."
5. First-time users are not guided into meaningful interactions.

## Product Targets

By end of phase:
- A new user can open the app and understand "what to watch" within 15 seconds.
- Dialogue feels character-consistent and situationally grounded.
- UI defaults feel uncluttered; advanced tools remain available on demand.
- Town presentation feels cohesive and intentionally retro.
- 30-minute sessions remain readable without debug fatigue.

## Design Principles

1. Progressive disclosure:
   - Show only high-value info by default.
   - Keep deep debug one click/shortcut away.
2. Observer-first readability:
   - Emphasize what changed and why, not raw event firehose.
3. Character continuity:
   - Conversations must reference goals, memories, and relationships.
4. Low-friction controls:
   - Mouse-first defaults, keyboard acceleration for experts.
5. Performance-safe polish:
   - Any visual enhancement must degrade gracefully under load.

## Workstreams

### Workstream A: UX and Information Architecture

#### A1. Introduce UI Modes

Add mode toggle with persistent preference:
- `Cinematic` (default): minimal HUD, soft notifications, no debug noise.
- `Story`: key events + selected agent card + compact timeline.
- `Debug`: existing full instrumentation, overlays, queue metrics.

Implementation:
- Add `UiMode` state in client UI manager.
- Gate panel visibility and update frequency by mode.
- Save mode in localStorage.

Acceptance:
- App always boots in last selected mode.
- `Cinematic` shows no more than two persistent panels.
- Switching modes does not reload scene or lose selection.

#### A2. Replace Raw Log Stream with Event Timeline

Introduce "timeline cards" for important events:
- Plan created/changed.
- Conversation started/ended.
- Relationship shift (friend/rival threshold crossing).
- Reflection generated.
- Notable movement (arrived at key location).

Keep raw log available only in Debug mode.

Acceptance:
- Timeline is readable at a glance.
- Raw log remains exportable and filterable.

#### A3. Improve Selection and Focus Model

Selection behavior:
- Single click selects agent.
- Click empty map clears selection.
- Optional "pin" mode keeps agent centered.

Focus tools:
- "Follow selected agent" toggle.
- Quick jump to next "interesting" event agent.

Acceptance:
- Selection persistence is stable across server deltas/reconnects.
- Follow mode can be toggled without camera jitter.

### Workstream B: Conversation Quality and Narrative Interest

#### B1. Conversation Engine Upgrade

Add explicit conversation state model:
- `topic`, `intent`, `tone`, `turnGoal`, `conversationArc`.
- Turn memory window (last N turns + relevant memories + relationship context).
- Exit reasons that feel natural (`topic_exhausted`, `schedule_pressure`, `social_discomfort`).

Acceptance:
- Consecutive turns stay on-topic unless explicit pivot.
- End reasons are logged and explainable.

#### B2. Better Prompt Composition

Prompt template changes:
- Include character voice summary (trait-linked style).
- Include current plan pressure (where agent should be soon).
- Include relationship stance with partner.
- Include one recent memory and one older relevant memory.
- Hard constraints: short turn length and structured JSON response.

Acceptance:
- Reduced repetitive phrasing in sampled sessions.
- More references to shared context and place.

#### B3. Topic and Gossip System

Add lightweight social topic graph:
- Topics discovered from events and conversations.
- Topics have novelty/decay score.
- Agents carry known topics with confidence.

Conversation behavior:
- Prioritize high-salience unknown/shared topics.
- Support "heard from X" provenance for social propagation.

Acceptance:
- Topics visibly propagate across agents over time.
- Conversations demonstrate variation beyond generic small talk.

#### B4. Dialogue Quality Safeguards

Add runtime guards:
- Repetition detector for near-duplicate messages.
- Fallback rewrite when output is too generic/off-schema.
- Max consecutive fallback threshold -> temporary rule-based cooldown.

Acceptance:
- No repeated identical line loops in long runs.
- Queue health remains within current budgets.

### Workstream C: Visual Polish and Pokemon-Inspired Cohesion

#### C1. Art Direction System

Define visual tokens:
- Color palette inspired by GBC-era constraints.
- Typography pair for retro readability (no novelty fonts in debug text).
- Consistent border, panel depth, and icon style rules.

Acceptance:
- Unified palette and spacing across all panels.
- No "mixed style" components.

#### C2. Scene Presentation Improvements

Enhancements:
- Better sprite readability (shadow/outline consistency).
- Subtle day-part tinting (morning/day/evening/night).
- Gentle camera easing presets.
- Contextual ambient particles only in Cinematic mode.

Acceptance:
- Visual changes do not break pixel crispness.
- FPS remains within current acceptance thresholds.

#### C3. "Pokemon-like" without IP Risk

Direction:
- Use original tiles/sprites with similar readability principles.
- Emphasize route clarity, landmark composition, and color blocking.
- Avoid direct copying of protected asset designs.

Acceptance:
- Town visually communicates paths/regions clearly.
- Cohesive retro identity with original assets.

### Workstream D: Onboarding and Day-1 Usability

#### D1. First-Run Guided Overlay

3-step onboarding:
1. "Watch agents live their day."
2. "Click an agent to inspect story/context."
3. "Use Timeline/Follow for interesting moments."

Dismissible and remembered.

Acceptance:
- First-run overlay appears once unless reset.
- Returning users are not interrupted.

#### D2. Smart Defaults

Defaults:
- Start in `Cinematic` mode.
- Auto-select "most active" nearby agent at startup (if no manual selection).
- Keep Debug off by default.

Acceptance:
- New sessions begin with clean, understandable presentation.

### Workstream E: Quality, Metrics, and Regression Safety

#### E1. Conversation Quality Evaluation Harness

Add offline scoring script for sampled runs:
- Topicality score.
- Repetition rate.
- Memory/reference usage rate.
- Relationship-consistency score.

Store report artifact under `output/quality/`.

Acceptance:
- Baseline metrics captured before and after changes.
- Regression thresholds defined and enforced.

#### E2. Expanded E2E Coverage

Add tests for:
- UI mode switching/persistence.
- Timeline card generation for key events.
- Selection/follow behavior.
- Copy actions and export behavior (existing + new flows).

Acceptance:
- CI-equivalent local suite includes these scenarios.

## Implementation Sequence

1. UX Mode system + timeline foundation (A1, A2).
2. Selection/follow and onboarding improvements (A3, D1, D2).
3. Conversation state + prompt upgrades (B1, B2).
4. Topic/gossip propagation and safeguards (B3, B4).
5. Visual token pass + scene polish (C1, C2, C3).
6. Evaluation harness + final test expansion (E1, E2).

## Rollout Strategy

- Behind feature flags:
  - `UI_MODE_SYSTEM`
  - `TIMELINE_UI`
  - `CONVO_V2`
  - `POLISH_VISUALS`
- Dogfood in Debug mode first.
- Then switch default mode to Cinematic when quality metrics pass.

## Risk Register

1. Risk: More complex prompt context increases latency.
   - Mitigation: strict token budget and relevance cap.
2. Risk: Visual polish hurts FPS on large agent counts.
   - Mitigation: mode-based effects + dynamic downgrade.
3. Risk: Timeline abstraction hides useful debug detail.
   - Mitigation: keep raw logs in Debug mode.
4. Risk: Topic propagation creates runaway meme loops.
   - Mitigation: topic decay and novelty thresholds.

## Done Definition

Phase is done when all are true:
- UX mode system, timeline, onboarding, and follow mode are implemented.
- Conversation quality harness shows measurable improvement vs baseline.
- Visual pass completed with cohesive retro style and no IP-risk assets.
- Unit/integration/E2E suites pass, including new usability flows.
- 30-minute manual playtest in Cinematic mode feels clear and uncluttered.

## Commands for Verification

- `npm run test -- --run`
- `npm run build`
- `npm run test:e2e`
- `npm run test:e2e:fullstack`
- `npm run stress:profiles`

Optional quality harness (new in this phase):
- `npm run quality:conversations`
