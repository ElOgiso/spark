# Phase 6 — Operational Storyboard → Generation Pipeline

Provider-neutral operational path from locked ShotSpec (+ optional storyboard panel) into executable `GenerationTask` nodes.

## Architecture rule

**ShotSpec remains canonical.** Storyboard panels are visualization / execution-prep only. This phase does **not** introduce a parallel planner, router, DAG, provider agent, or UI.

```text
ShotSpec (+ optional StoryboardPanelSpec / ReferenceManifest)
  → GenerationIntent          (appearance ⊥ motion; hard vs soft constraints)
  → CapabilityResolution      (scoreProvidersForShot + strategyToRequiredCapabilities)
  → GenerationTask[]          (existing DAG contract + Phase 6 trace fields)
```

## Real path (code)

| Step | Module | Function |
|------|--------|----------|
| 1 | `generation/buildGenerationIntent.ts` | `buildGenerationIntent` — reuses `compileVideoGenerationIntent`, `buildStoryboardPanelFromShot`, `buildReferenceManifest`, `scoreShotGenerationRisk` |
| 2 | `generation/capabilityResolution.ts` | `resolveGenerationCapabilities` — `scoreProvidersForShot(shot, routing.capabilityPolicy, …)` |
| 3 | `generation/compileIntentToTasks.ts` | `compileGenerationIntentToTasks` — emits `GenerationTask` + optional multimodal request |
| 4 | `generation/operationalPipeline.ts` | `planOperationalShotGeneration` — composes 1→2→3 |
| 5 | `generation/generationFailure.ts` | `classifyGenerationFailure` — actionable failure classes |

Optional wire-in: `applyVisualPlanningPipeline(..., { enableOperationalGeneration: true, storyboardPanels })` (default **OFF**). When enabled, per-shot video/keyframe tasks for panels provided via options are replaced with operational tasks. Existing Phase 3 `planGenerationTasks` path is unchanged when the flag is off.

## Contracts

- **Source of truth for Phase 6 type names:** `generation/generationIntent.ts`
- **GenerationTask** (`specification/generationTask.ts`) gains optional Phase 6 fields only: `intentId`, `panelId`, `referenceManifestId`, `storyboardId`, `generationMode`, `appearanceBrief`, `motionBrief`, `hardConstraintIds`, `softPreferenceIds`, `degradationNotes`, `candidateIndex`, `candidateCount`, `traceJson`
- Seedance / multimodal ceilings remain in the **capability registry** (`providerCapabilities.maxMultimodalReferences`) — never hard-coded here

## Hard vs soft

- Hard constraints (identity, product, aspect ratio, duration, continuity, blocking reference conflicts) are never silently dropped.
- Soft preferences (camera move, lighting, high-res) may be dropped with explicit `degradation.action = "drop_soft_preference"`.
- Missing hard capabilities try `fallback_provider`; otherwise `block`.

## Candidate policy

Risk from `scoreShotGenerationRisk` maps to recommended candidate count (configurable via `candidateCounts`; defaults low=1 / medium=2 / high=3).

## Tests

`src/app/services/production/productionPhase6Operational.test.ts` — deterministic, no live provider calls.

## Storyboard density & sheets

`chooseStoryboardLayout` selects readable layouts (`1x5`, `2x2`, `2x4`, `3x3`, `3x4`, `4x4`, `4x5`, sequences).
`packStoryboardSheets` paginates panels (default max 12/sheet) while preserving global chronological order.

## Prop visual contracts

`PropVisualContract` / `buildPropVisualContract` / `createPropMaster` treat continuity-critical props as first-class visual entities (not generic attachments).

## Cherry-pick & local regeneration

`selectAndRecordCandidate` records the winning candidate on `GenerationIntent.trace`.
`planShotLocalRegeneration` regenerates only the failed shot (plus last-frame chain dependents when enabled); approved neighbors stay in `preserveShotIds`.

## Acceptance

`productionPhase6Acceptance.test.ts` — John/coffee-shop structural E2E (no live providers).
