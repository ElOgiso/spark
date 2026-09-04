# Phase 0 — Current Production Data Flow Audit

Notion constraints honored: locked navigation (SPARK / MY SPARK / VIRAL SPARKS / REVIEW / CALENDAR / ANALYTICS / MORE), product objects (Brand, Spark, Production, Review Item…), hide complexity, no workflow-builder UI, no provider/UI redesign in this phase.

## CURRENT flow (as implemented today)

```
ViralSpark (opportunity)
  → evaluateSparkForProduction / viralSparkGate
  → ProductionBriefService.generateBrief
       → ProductionBrief (+ beats, storyboard ProductionScene[])
  → Production (+ ReviewItem)
  → ProductionGenerationGuard / characterSheetGate
  → ProductionAssetService.generateAssets
       → storyboard stills (ModelRouter / image providers)
       → voice (ElevenLabs / TTS)
       → per-scene I2V (productionVideoRequest → /api/runtime/video)
            OR express narratorVideoCompiler slideshow
       → visualContinuityGate (advisory last-frame chain)
       → optional sceneVideoMerger / hybrid compile
  → Review (CreativeReview + Production Assets Gallery)
  → Approve / Publish Job
  → Analytics → Memory
```

## Where concepts live today

| Concept | Current representation | Location |
|---------|------------------------|----------|
| Brand / Character / Niche | `Brand`, `Character` | `domain/types.ts`, MY SPARK |
| Opportunity / idea | `ViralSpark` | VIRAL SPARKS |
| Production | `Production` | domain + Supabase `productions` |
| Brief | `ProductionBrief` | nested on Production / ReviewItem |
| Beat | `ProductionBriefBeat` | brief.beats |
| Scene | `ProductionScene` (+ brief.storyboard) | ≈ one clip / beat today |
| Shot | **not explicit** (scene ≈ shot) | gap this phase fills |
| Asset (persisted) | `ProductionAsset` | Supabase `production_assets` |
| Video request | `productionVideoRequest` + `_videoContract` | api/runtime |
| Provider | `ModelRouter` / `providerCapabilities` / format settings | runtime |
| Continuity | start/end state + lastFrameUrl + visualContinuityGate | production services |
| QC | viralSparkGate, characterSheetGate, generation guard | production services |
| Generated media | scene URLs + master `videoUrl` / brief.generatedAssets | Production / assets |

## Preserve vs adapt

| Keep as-is | Adapt via converters | New canonical layer |
|------------|----------------------|---------------------|
| ProductionBrief / Beat / Scene | → ProductionSpec / SceneSpec / ShotSpec | `specification/*` |
| ProductionAsset persistence | AssetSpec **references** ProductionAsset ids | assetSpec |
| Provider implementations | untouched | routingSpec contract only |
| UI / navigation | untouched | no new nav |

## Target hierarchy (Phase 1)

```
ProductionSpec
 └── SceneSpec[]
      └── ShotSpec[]          ← fundamental visual unit
           └── GenerationTask
                └── AssetSpec → ProductionAsset (existing)
```

## Phase boundary

- **This phase:** types, validators, legacy adapters, attach ProductionSpec on create (adapter only).
- **Later phases:** Creative Director, intelligent model scoring, full continuity/QC/audio engines, UI surfaces only when required inside existing REVIEW/MY SPARK.
