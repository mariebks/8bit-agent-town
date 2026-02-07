# Phase 10: Visual Polish and Readability

## Goal

Improve legibility and charm so the simulation feels closer to a polished retro RPG observer experience while keeping performance acceptable at 20+ agents.

## Workstreams

1. Occupation-driven character silhouettes
- [x] Add deterministic occupation traits (headwear/accessory/hair/badge).
- [x] Render trait variants in generated sprite sheets.
- [x] Add unit tests for trait mapping stability.
- [x] Add subtle per-role idle micro-variation without increasing texture atlas count.

2. Sprite readability at zoom levels
- [x] Add optional outline/shadow tuning based on camera zoom.
- [x] Verify selected-agent ring remains visible over bright ground tiles.
- [ ] Add visual regression checklist via Playwright screenshots.

3. Environment visual cohesion
- [ ] Add low-cost tile tint variance to reduce flat terrain repetition.
- [ ] Add day-part ambience pass for landmarks (lights/signage accents).
- [ ] Validate FPS impact with stress profiles.

4. Conversation readability
- [x] Add bubble collision avoidance priority for selected/inspected agents.
- [x] Improve bubble truncation + expansion affordance in story mode.
- [x] Ensure tags stay readable on mobile widths.

5. Layout declutter
- [x] Introduce compact panel preset with progressive disclosure.
- [x] Resolve panel overlap at common laptop resolutions.
- [x] Add onboarding hint to switch compact/full UI density.

## Validation

- `npm run test -- --run`
- `npm run build`
- `npm run test:e2e`
- `npm run test:e2e:fullstack`
- `npm run quality:check`

## Review loop

- Open/update PR with each significant chunk.
- Trigger `@codex review` after each chunk.
- Apply actionable findings, then rerun validation.
