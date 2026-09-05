# Cinematic Shot Intelligence

Provider-neutral look development and shot-direction planning for Spark Production OS.

This layer extends the existing cinematography planners (`shotPlanner`, `cameraPlanner`, `blockingPlanner`, `lightingPlanner`). It does **not** introduce a second orchestrator, provider agent, or competing shot type.

## Pipeline position

```text
CreativeSpec + ProjectSpec
  → VisualTreatment (project look)
  → SceneSpec (optional intentional look override)
  → CoveragePlan (mode-aware: express | standard | deep)
  → ShotSpec + ShotCinematicIntelligence
  → capability / reference requirements
  → PromptCompiler (semantic → provider compile later)
  → Continuity / QC / Editorial (downstream)
```

Semantic cinematic intent is decided **before** provider selection and prompt syntax.

## Visual treatment (look development)

`VisualTreatment` is the project-level look bible:

- look preset + label (semantic, not a provider preset)
- palette / contrast / saturation
- lighting mood, texture, atmosphere
- camera language, lens character, depth-of-field language
- aspect-ratio **intent** (not “21:9 = cinematic”)
- references, principles, confidence, provenance

Inheritance:

```text
production VisualTreatment
  → scene override (requires explicit reason + scope)
  → shot-level realization via ShotCinematicIntelligence.lookSignature
```

Color finishing is **not** a substitute for cinematography. Look = coordinated lighting, composition, lens/camera language, blocking, motion, performance, editorial rhythm, sound, and finishing.

## Shot purpose before camera

Every shot carries a `dramaticPurpose` (e.g. establish geography, deliver dialogue, capture reaction, emphasize emotion). Framing, lens intent, depth of field, and movement are derived **after** purpose.

## Coverage

`planCoverage` chooses a minimum sufficient set for the scene and production mode:

| Mode | Behavior |
|------|----------|
| express | Master + essential narrative / critical reaction or insert |
| standard | Balanced primary coverage + important inserts / transitions |
| deep | Performance angles, reactions, inserts, cutaways, editorial options — without redundant spam |

Redundant role pairs are flagged when detected.

## Motivated camera movement

`planMotivatedMovement` requires a narrative, emotional, spatial, or editorial justification. If none exists, movement falls back to `static` / `none_static_preferred`.

Moving shots can carry a physical path: start → path → subject anchor → speed → optional reveal → end.

## Temporal beats

Complex shots are structured as ordered beats (`start` → `development` → `end`) with duration hints. The prompt compiler decides whether to emit timestamps, natural-language sequence, or provider controls.

## Spatial continuity

Shot cinematic intelligence tracks axis, screen direction, eyeline, and camera side. Axis policy is `preserve` by default. Intentional crosses require `axisCrossReason` (and preferably a transition mechanism).

## Editorial handoff

Each shot can declare outgoing / required incoming state, cut reason, and transition motivation so Phase 6–7 can consume continuity without regenerating intent.

## Reference & capability requirements

The cinematic layer **emits** requirements; it does not resolve assets or call providers:

- character / location / prop / style / start-frame / end-frame references
- image-to-video, temporal control, camera motion, duration, etc.

Unsupported capability is surfaced as `capabilityFallback` (constraint + creative risk + options), never as silent mutation of creative intent.

## Validation & gate

`validateCinematicShot` checks purpose, movement motivation, axis policy, and reference completeness.

`evaluateCinematicGate` aggregates treatment presence, shot purpose, movement motivation, and reference readiness before a plan is considered cinematic-ready.

Quality is multi-dimensional (purpose clarity, coverage value, composition, camera motivation, spatial/temporal coherence, continuity readiness, capability fit, editorial utility, reference readiness) — not a single vanity “cinematic score.”

## Principles (A–J)

Encoded in `CINEMATIC_PRINCIPLES`:

1. Cinematic is systemic  
2. Look before generation  
3. Assets before shots  
4. Purpose before camera  
5. Motion must be motivated  
6. Sequence before isolated clip  
7. Semantic intent before provider syntax  
8. Capability truth beats prompt fantasy  
9. Continuity is multi-dimensional  
10. Quality is not prompt length  

## Non-goals

- No Higgsfield / Veo / Kling director agents  
- No provider API calls or media generation in this layer  
- No second continuity engine or cinematography subsystem  
- No UI redesign  
- No replacement of `ProductionSpec` / `SceneSpec` / `ShotSpec`  

## Tests

`src/app/services/production/productionCinematic.p5.test.ts`
