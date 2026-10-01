# Validation — 2026-10-01

## Executed checks

- **13 logic tests passed**: six directions, free/blocked arrows, removing blockers, invalid moves, solved states, cyclic deadlocks, parser validation, save sanitization, deterministic generation, monotonicity and replay of every shipped level.
- **7 Chromium UI tests passed**: all five tutorials completed via actual UI; raycast clicking; drag suppression; blocked-arrow feedback; saved unlocks; desktop/mobile layouts; editor edits, invalid import handling, export, generation and playtest; three hint stages; settings and reset; emulated touch tap, drag and pinch; large-level rendering.
- **1 production offline test passed**: install service worker, reload, disable network, reload again, open all 100 level entries without errors.
- TypeScript checking and Vite production build passed.
- Desktop and smartphone screenshots visually inspected. Layout overflow checked at 390×844, 768×1024, 1024×768 and 844×390.

## Content

Five authored tutorial levels plus 95 deterministic selections from 1,140 generated candidates. All 100 have replayable solutions. This is automated heuristic selection, not human quality certification. Generator and live game share collision rules; a reverse-insertion solution is independently replay-tested.

## Rendering

Measured renderer calls after geometry merging:

| Arrows | Calls in main render pass | Resident geometries |
| --- | --- | --- |
| 10 | 11 | 2 |
| 30 | 31 | 2 |
| 50 | 51 | 2 |
| 100 | 101 | 2 |
| 150 | 151 | 2 |

One shared merged arrow geometry and one floor geometry. Per-arrow materials support independent feedback/fade. Shadow passes add GPU work beyond the displayed main-pass counters. Geometry count stayed constant through level changes.

These checks used Linux Chromium with software WebGL. They verify rendering and interaction, **not** 60 FPS on physical phones. iOS/Android device performance, installation dialogs and long-session memory behavior still need real-device testing.

## Fixes found during checks

- Removed an invalid CSS import caught by the production builder.
- Fixed the available-cell budget for cross-shaped generator candidates.
- Reduced geometry draw calls from three per arrow to one.
- Replaced a missing camera icon glyph with an inline SVG.
- Fixed offline static-asset cache matching for the preview server's `Vary: Origin` response. Cached resources are only build-owned, same-origin static assets.

## Remaining product work

Human playtesting and difficulty refinement, physical-device QA, optional editor undo/redo, and configuring a public HTTPS host. The repository and CI artifact are not themselves a published game URL.
