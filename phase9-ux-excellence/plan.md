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
- [x] 34. Timeline interaction upgrade: make timeline cards with agents clickable/focusable for instant camera jump and selection.
- [x] 35. Timeline clutter reduction: dedupe near-identical consecutive cards within a short tick window.
- [x] 36. Timeline perf polish: skip timeline rerenders when incoming events are fully deduped and visible entries are unchanged.
- [x] 37. Next Event Agent reliability: skip stale queue entries and continue cycling until a focusable live agent is found.
- [x] 38. Story Digest interaction upgrade: click/keyboard focus digest moments to jump camera/selection to the related agent.
- [x] 39. Highlights Reel interaction upgrade: focus the current spotlight agent directly from the reel panel.
- [x] 40. Relationship Heatmap interaction upgrade: click/keyboard focus a tie row to jump directly to that connected agent.
- [x] 41. Power-user jump shortcut: add `J` to trigger the same Next Event Agent navigation path as the controls button.
- [x] 42. Shortcut discoverability polish: label Next Event Agent control with `(J)` so keyboard navigation is self-discoverable.
- [x] 43. Shortcut hint polish: surface `(/)` in Agent Finder placeholder and `(Shift+F)` in Focus UI control label.
- [x] 44. Occupation sprite fidelity pass: map generated occupations (`barista`, `baker`, `clerk`, `student`, `retired`, `trainer`) to distinct trait silhouettes and role-aware idle motion profiles.
- [x] 45. Declutter escape hatch: map `Escape` to clear selected agent + follow mode and verify behavior through fullstack keyboard flow.
- [x] 46. Speech clutter cap: in spectator/story modes cap simultaneous non-selected speech bubbles by nearest-distance priority while always preserving selected-agent bubbles.
- [x] 47. Speech declutter hotkey: map `B` to toggle Selected Speech mode and surface shortcut discoverability directly in controls label text.
- [x] 48. Shortcut coach panel: add `?` keyboard toggle for an in-app cheat sheet so controls remain discoverable without leaving simulation view.
- [x] 49. Agent Finder recents: persist recently focused agents and prioritize them in subsequent searches to speed repeated camera jumps.
- [x] 50. Shortcut discoverability controls: add a visible `Shortcuts (?)` button in View Mode so mouse-first users can open/close shortcut help without memorizing keys.
- [x] 51. Escape semantics polish: close the shortcut cheatsheet with `Esc` before continuing with standard scene declutter behavior.
- [x] 52. Panel hotkey badges: surface panel toggle keys (`D/I/P/L/T/C/H`) inside panel headers for immediate discoverability.
- [x] 53. Bookmark workflow shortcuts: add `K` (bookmark selected) and `G` (jump next bookmark) with control labels and shortcut parser coverage.
- [x] 54. Shortcut button state sync: keep `Shortcuts (?)` button active state aligned when panel visibility changes via keyboard, not just clicks.
- [x] 55. Timeline filter chips: add `All/Social/Conflict/Planning/System` toggles to reduce event noise and keep focus on the currently relevant story signal.
- [x] 56. Debug perf HUD summary: surface visible agent/speech counts and speech queue depth alongside existing metrics for faster local performance tuning.
- [x] 57. Small-screen stack layout: add `max-width: 700px` overrides that prioritize core controls and prevent panel collisions on tighter viewports.
- [x] 58. Camera pacing control: add `Smooth/Snappy` camera pace toggle in controls and `Z` shortcut for faster cinematic retargeting.
- [x] 59. Bookmark management UI: show live bookmark chips in controls and allow one-click bookmark removal without requiring keyboard cycling.
- [x] 60. Speech readability polish: fade non-selected bubbles by distance and message age so nearby/new conversations stay legible without hard pop-in.
- [x] 61. Sprite readability polish: adaptive ground shadows for selected/zoomed-out agents so silhouettes remain trackable in busy scenes.
- [x] 62. Timeline continuity polish: persist timeline filter chips across reloads so observers keep their chosen story lens.
- [x] 63. Camera continuity polish: persist Smooth/Snappy camera pace preference across reloads for stable spectator behavior.
