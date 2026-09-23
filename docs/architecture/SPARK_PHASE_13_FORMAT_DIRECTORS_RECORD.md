# Phase 13 — shared format director planning

Date: 2026-09-23. Base main: `33fcfd2de4e603b25e1cad7e2c37ea58d0c43c7c`.

Extends existing `resolveGeneratePlan`, chapter audio authority, canonical adapters,
visual planning, task selection and AssetService. No new orchestrator, execution
pipeline, provider router, credit system or UI surface.

## Implemented

- Narrator aliases select stills and external narration, overriding stale talent flags.
- Explicit Hybrid VO scenes select stills; talent scenes retain generated video.
- Cinematic selects generated video and in-world dialogue without external TTS.
- Legacy adaptation honors immutable mode snapshots, preserves silent talent intent,
  and derives creative/audio requirements from scenes instead of hardcoded narration.
- Visual planning and operational enrichment respect still-only scenes. Video
  continuity does not require a nonexistent preceding still-scene video.
- Shared task selection excludes saved video/voice work forbidden by the mode and
  refreshes dependencies; changed dependencies invalidate old completion evidence.
- Canonical voice preparation reads narration rather than the project idea and
  excludes Hybrid talent lines.

## Compatibility and remaining gates

Older canonical specs without explicit scene audio authority retain their existing
Hybrid B-roll visual plans. Narration text alone is not proof that visuals must be
stills. Explicit audio authority is preserved by the legacy adapters going forward.
Existing supported content formats continue through these same three modes.

This is the Phase 13 planning implementation, not production-readiness certification.
No paid end-to-end generation was run. Existing Phase 12 live compiler/QC gates,
mixed-media master assembly validation, durable execution, and real provider/output
verification remain open. Long-form asset classification and richer audio timeline
work remain Phases 14 and 15.

## Verification

Baseline: typecheck, build and 1,280 tests passed. Added format regression tests for
mode aliases, task graphs, mixed Hybrid narration, saved-task exclusion, silent
speech authority and operational enrichment. Final verification: all 1,290 tests passed; TypeScript typecheck and production
build passed. Existing build warnings remain.
