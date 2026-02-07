# Phase 9: UX Excellence and Presentation Upgrade

## Goal

Ship eight UX upgrades that make the town readable, cinematic, and fun to observe for long sessions.

## Definition Of Done

- All 8 upgrade tracks implemented and integrated.
- Unit tests and fullstack E2E pass.
- Manual Playwright run verifies key UX flows.
- Sub-reviewer pass completed and findings applied.
- Changes committed and pushed to `main`.

## Work Queue

### 1. Auto Director Camera

- [ ] Add director focus queue in `TownScene` for high-signal events.
- [ ] Add auto-director toggle in controls UI.
- [ ] Add mode-aware defaults (`Spectator` on, `Story` optional, `Debug` off).
- [ ] Add camera choreography (soft pan + temporary zoom focus + cooldown).
- [ ] Add unit coverage for director event selection helper logic.

### 2. Story Digest Bar (Top 3 Live Events)

- [ ] Add compact top-bar panel showing top 3 recent high-value events.
- [ ] Add event scoring/prioritization (relationship/topic/conversation > arrivals/system).
- [ ] Render portraits + role badges in digest entries.
- [ ] Ensure digest updates without log spam in Spectator mode.
- [ ] Add tests for digest extraction/prioritization.

### 3. Conversation UI Upgrade

- [ ] Upgrade speech bubbles with speaker name header.
- [ ] Add inferred tags (`gossip`, `plan`, `conflict`, `friendly`, `urgent`).
- [ ] Add speech pacing queue to reduce stutter/overlap.
- [ ] Improve bubble styling and readability for long lines.
- [ ] Add tests for tag inference and pacing helper behavior.

### 4. Character Identity Layer

- [ ] Extend `AgentData` with occupation + relationship edge data needed for identity UI.
- [ ] Add portrait token generator from agent metadata.
- [ ] Add role badge rendering in timeline and inspector.
- [ ] Add more sprite variation knobs per role/archetype.
- [ ] Add tests for identity token helpers.

### 5. Relationship Heatmap View

- [ ] Add new relationship heatmap panel for selected agent.
- [ ] Render weighted bars/nodes with friend/rival color coding.
- [ ] Add quick-open shortcut and mode visibility defaults.
- [ ] Make panel robust to missing/partial relationship data.
- [ ] Add tests for heatmap row mapping and ordering.

### 6. Preset Modes: Spectator / Story / Debug

- [ ] Rename Cinematic to Spectator across UI, storage parsing, and tests.
- [ ] Add mode presets that control panel visibility, camera behavior, and overlay quality.
- [ ] Preserve backward compatibility for old stored mode key values.
- [ ] Update onboarding/help text and shortcut hints.
- [ ] Update mode unit/E2E tests for renamed preset labels.

### 7. Ambient Audio + UI SFX

- [ ] Add lightweight WebAudio controller (no external assets required).
- [ ] Add day-part ambient bed and subtle event chimes.
- [ ] Add control toggle with safe defaults and browser autoplay-safe unlock.
- [ ] Add graceful fallback when WebAudio unavailable.
- [ ] Add tests for audio state transitions and day-part mapping.

### 8. Guided First-Run Flow ("What To Do Next")

- [ ] Replace static onboarding with progressive tasks:
  - [ ] Select an agent.
  - [ ] Turn Follow on.
  - [ ] Jump to an event agent.
- [ ] Track progress in local storage and dismiss automatically on completion.
- [ ] Add reset capability for guided flow state.
- [ ] Add tests for flow progression and persistence behavior.

## Review / Test / Ship Loop

- [ ] Run `npm run test -- --run`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:e2e:fullstack`.
- [ ] Run `npm run quality:check`.
- [ ] Run `codex review --uncommitted`, apply findings, rerun affected tests.
- [ ] Commit in coherent chunks.
- [ ] Push to `main`.

## Next Improvements Backlog (9+)

- [ ] 9. "Highlights Reel" auto-generated recap of last in-game hour.
- [ ] 10. Relationship timeline sparkline in inspector.
- [ ] 11. Dynamic weather visuals tied to conversation topics and mood.
- [ ] 12. Director bookmark system for returning to memorable moments.
