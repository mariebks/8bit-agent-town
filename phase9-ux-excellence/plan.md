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

- [x] Add director focus queue in `TownScene` for high-signal events.
- [x] Add auto-director toggle in controls UI.
- [x] Add mode-aware defaults (`Spectator` on, `Story` optional, `Debug` off).
- [x] Add camera choreography (soft pan + temporary zoom focus + cooldown).
- [x] Add unit coverage for director event selection helper logic.

### 2. Story Digest Bar (Top 3 Live Events)

- [x] Add compact top-bar panel showing top 3 recent high-value events.
- [x] Add event scoring/prioritization (relationship/topic/conversation > arrivals/system).
- [x] Render portraits + role badges in digest entries.
- [x] Ensure digest updates without log spam in Spectator mode.
- [x] Add tests for digest extraction/prioritization.

### 3. Conversation UI Upgrade

- [x] Upgrade speech bubbles with speaker name header.
- [x] Add inferred tags (`gossip`, `plan`, `conflict`, `friendly`, `urgent`).
- [x] Add speech pacing queue to reduce stutter/overlap.
- [x] Improve bubble styling and readability for long lines.
- [x] Add tests for tag inference and pacing helper behavior.

### 4. Character Identity Layer

- [x] Extend `AgentData` with occupation + relationship edge data needed for identity UI.
- [x] Add portrait token generator from agent metadata.
- [x] Add role badge rendering in timeline and inspector.
- [x] Add more sprite variation knobs per role/archetype.
- [x] Add tests for identity token helpers.

### 5. Relationship Heatmap View

- [x] Add new relationship heatmap panel for selected agent.
- [x] Render weighted bars/nodes with friend/rival color coding.
- [x] Add quick-open shortcut and mode visibility defaults.
- [x] Make panel robust to missing/partial relationship data.
- [x] Add tests for heatmap row mapping and ordering.

### 6. Preset Modes: Spectator / Story / Debug

- [x] Rename Cinematic to Spectator across UI, storage parsing, and tests.
- [x] Add mode presets that control panel visibility, camera behavior, and overlay quality.
- [x] Preserve backward compatibility for old stored mode key values.
- [x] Update onboarding/help text and shortcut hints.
- [x] Update mode unit/E2E tests for renamed preset labels.

### 7. Ambient Audio + UI SFX

- [x] Add lightweight WebAudio controller (no external assets required).
- [x] Add day-part ambient bed and subtle event chimes.
- [x] Add control toggle with safe defaults and browser autoplay-safe unlock.
- [x] Add graceful fallback when WebAudio unavailable.
- [x] Add tests for audio state transitions and day-part mapping.

### 8. Guided First-Run Flow ("What To Do Next")

- [x] Replace static onboarding with progressive tasks:
  - [x] Select an agent.
  - [x] Turn Follow on.
  - [x] Jump to an event agent.
- [x] Track progress in local storage and dismiss automatically on completion.
- [x] Add reset capability for guided flow state.
- [x] Add tests for flow progression and persistence behavior.

## Review / Test / Ship Loop

- [x] Run `npm run test -- --run`.
- [x] Run `npm run build`.
- [x] Run `npm run test:e2e:fullstack`.
- [x] Run `npm run quality:check`.
- [x] Run `codex review --uncommitted`, apply findings, rerun affected tests.
- [x] Commit in coherent chunks.
- [x] Push to PR branch (`phase9-ux-excellence`).
- [ ] Merge PR to `main`.

## Next Improvements Backlog (9+)

- [x] 9. "Highlights Reel" auto-generated recap of last in-game hour.
- [x] 10. Relationship timeline sparkline in inspector.
- [x] 11. Dynamic weather visuals tied to conversation topics and mood.
- [x] 12. Director bookmark system for returning to memorable moments.
- [x] 13. Compact weather status HUD tied to live topic/mood signals.
- [x] 14. Post-review hardening: game-minute Highlights Reel window, always-fresh relationship trend sampling, and neutral-topic weather bias fix.
- [x] 15. Sprite readability upgrade: deterministic body silhouettes and outfit pattern variation tied to identity traits.
- [x] 16. Focus UI mode: one-click declutter toggle that hides secondary spectator panels for cleaner viewing.
- [x] 17. Agent Finder panel: quick search by name/occupation with one-click camera jump.
- [x] 18. Power-user shortcuts: `/` focuses Agent Finder input, `Shift+F` toggles Focus UI declutter mode.
- [x] 19. Conversation declutter control: optional selected-agent-only speech bubbles in crowded scenes.
- [x] 20. Persistent selected-agent restore: preserve preferred agent selection across refreshes and server sync churn.
- [x] 21. Agent Finder relevance upgrade: typo-tolerant and token-aware ranking for faster camera jumps.
- [x] 22. Conversation rewrite variety: intent-aware anti-repetition fallback lines to keep dialogue quality engaging.
- [x] 23. Story Digest declutter: dedupe near-identical headlines so top moments stay diverse and readable.
- [x] 24. Director bookmark persistence: keep bookmark sets across refresh and prune stale agents after sync.
- [x] 25. Client startup perf: split Phaser/vendor bundles to improve initial load profile.
- [x] 26. Persist selected-only speech toggle across sessions so clutter preferences stick after reload.
- [x] 27. Agent Finder keyboard flow: Arrow navigation + Enter focus with active-row highlighting.
- [x] 28. Agent Finder feedback polish: preserve focus result status briefly before reverting to match-count text.
- [x] 29. Agent Finder perf: skip list DOM rerenders when hits/highlight are unchanged between UI ticks.
- [x] 30. Story Digest perf: avoid digest row rerenders when selected top moments are unchanged.
- [x] 31. Highlights Reel perf: skip summary/list rerenders when snapshot content is unchanged.
- [x] 32. Time Controls feedback polish: keep transient action confirmations visible briefly before status footer reverts to live tick/online text.
- [x] 33. Sprite identity polish: add explicit trait mappings for healer/smith/courier/artist roles so more occupations render with distinct silhouettes and accessories.
