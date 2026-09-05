# Visual Preproduction & Storyboard Bridge

Provider-neutral visual preproduction for Spark Production OS.

## Architecture rule

**ShotSpec is canonical.** Storyboard is visualization + execution-prep around ShotSpec — never a second source of truth.

```text
CharacterMaster / LocationMaster / ProductMaster
  → Visual contracts (CharacterVisualContract, …)
VisualStyleSpec + CreativeSpec + ProjectSpec
  → VisualTreatment
SceneSpec.shots: ShotSpec[]
  → StoryboardPanelSpec (panel.shotId → ShotSpec.id)
  → StoryboardBlueprint
  → VideoGenerationIntent (appearance ⊥ motion)
  → MultimodalVideoGenerationRequest (budget from capability registry)
```

## Module map

`src/app/services/production/preproduction/`

| File | Role |
|------|------|
| `types.ts` | Shared contracts |
| `visualContracts.ts` | Treatment + character/location/product contracts |
| `referenceManifest.ts` | Classification, conflicts, budget optimizer |
| `storyboardBlueprint.ts` | Panels from ShotSpec, validation, localized repair |
| `videoGenerationBridge.ts` | Intent + multimodal request (motion separate) |
| `shotRisk.ts` | Generation risk + candidate recommendations |
| `candidateStrategy.ts` | QC-like candidate ranking (no network) |
| `visualLock.ts` | Locks; version change requires reason + impact |
| `filmmakingPrinciples.ts` | Look / assets / purpose principles (§36–38) |
| `index.ts` | Public re-exports |

## Reference budget

`optimizeReferenceBudget` reads `maxMultimodalReferences` from `providerCapabilities` / capability matrix.

- Seedance registry value is currently **12** — stored in the capability registry, **not** hard-coded in cinematography or storyboard.
- Update via `setMaxMultimodalReferences(providerId, n)`.

## Continuity & QC

Reuses existing continuity fields on ShotSpec / SceneSpec and QC-like dimensions for candidate ranking. Does **not** introduce a second QC, continuity, asset, or request system.

## Optional pipeline hook

`applyVisualPlanningPipeline(..., { enrichVisualTreatment: true })` may attach a `VisualTreatment` without a new orchestrator.

## Tests

`src/app/services/production/productionVisualPreproduction.test.ts` — deterministic, no network.
