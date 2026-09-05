# Continuity State & Propagation (SPARK Prompt Phase 7)

> **Naming note:** Docs “Phase 7” also refers to **Autonomous Creative Director**.
> This document describes the **Continuity State & Propagation** layer from the SPARK
> Phase 7 implementation prompt — expected continuity state, not Creative Director.

## Purpose

Answer: **what should remain true from one shot to the next, and how does expected
state evolve through the production?**

```
Expected ContinuityState
      ↓
Deterministic Propagation (+ ContinuityDelta)
      ↓
Continuity Constraints (hard / soft)
      ↓
Generation Handoff (provider-agnostic)
```

Phase 9 owns pixel inspection against expected state.
Phase 8 (execution DAG) consumes continuity dependencies for scheduling.

## Hierarchy (unchanged)

```
ProductionSpec → SceneSpec → ShotSpec → (StoryboardPanel) → GenerationIntent → GenerationTask
```

Continuity operates **across** this hierarchy. It does not create a parallel production tree.

## Reused infrastructure

| Existing | Role |
|----------|------|
| `specification/continuitySpec.ts` | Canonical ContinuityState + ShotContinuityBridge |
| `continuity/continuityEngine.ts` | ProductionSpec → bridges (used by visual planning) |
| `qc/evaluators/continuityEvaluator.ts` | Consumes expected ContinuityState |
| Reference / visual-contract systems | Not duplicated — continuity resolves refs via existing IDs |

## Contracts

- **ContinuityState** — expected state at a production point (characters, props, products, wardrobe, spatial, axis, lighting, temporal, locks, source/confidence)
- **ContinuityDelta** — added / removed / changed / moved / transformed / transferred / consumed
- **ContinuityConstraint** — IDENTITY, WARDROBE, PROP, SCREEN_DIRECTION, AXIS, … with hard/soft severity
- **ContinuityConflict** — hard / soft / intentional / unresolved
- **ContinuityGenerationHandoff** — inherited/required/start/end state + allowed/forbidden changes + risk
- **ContinuityLock** — versioned locks that block implicit mutation
- **ContinuityImpactReport** — downstream shots affected by a continuity-critical change

## Deterministic modules

| Module | Responsibility |
|--------|----------------|
| `continuityDelta.ts` | Apply deltas; prop transfer sync; lock enforcement |
| `continuityScope.ts` | production → scene → sequence → shot inheritance; scene resets |
| `continuityLocks.ts` | Lock helpers |
| `continuityPropagation.ts` | Shot-sequence propagation (cached state + delta) |
| `continuityConflicts.ts` | Expected vs declared conflict detection |
| `continuityConstraints.ts` | Required vs optional constraints from state |
| `continuityRisk.ts` | Continuity risk scoring |
| `continuityImpact.ts` | Downstream impact analysis (no auto-regen) |
| `continuityQuery.ts` | Last-seen, who holds prop, wardrobe version, axis side |
| `generationHandoff.ts` | Provider-agnostic GenerationIntent handoff |
| `continuityEngine.ts` | Legacy ProductionSpec path + Phase 7 bridge enrichment |

## Scope rules (default)

| Facet | Scope |
|-------|-------|
| Character identity | production |
| Wardrobe | scene |
| Props / products | sequence |
| Screen direction | sequence |
| Camera | shot |
| Location / weather / lighting | scene |
| Visual treatment | production |

Scene transitions reset sequence props unless `carryProps` is explicit.
Temporal discontinuities (`time_jump`, flashback, …) must be intentional.

## Generation integration

`buildGenerationHandoff` produces:

- `inheritedState` / `requiredState` / `startState` / `targetEndState`
- `requiredConstraints` / `optionalConstraints`
- `allowedChanges` / `forbiddenChanges`
- `risk` + `references`

`handoffToContinuityRequirements` flattens to string lists for Phase 6 GenerationIntent
consumers without circular provider dependencies.

## Explicit non-goals

- No pixel / CLIP / face similarity (Phase 9)
- No DAG worker scheduling (Phase 8)
- No second continuity engine or UI dashboard
- No provider-specific prompt logic inside continuity modules

## Tests

`src/app/services/production/continuityPropagation.p7.test.ts`

Covers inheritance, delta application, prop transfer, locks, coffee-shop acceptance
(SHOT_01–08), missing-cup / wardrobe / screen-direction conflicts, cross-scene scope,
impact analysis, risk, and generation handoff.
