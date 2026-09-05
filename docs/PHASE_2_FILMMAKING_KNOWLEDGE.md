# Phase 2 — Filmmaking Knowledge & Skill Runtime

## Before

Filmmaking knowledge lived as:

- Implicit prose inside prompt packs / compilers
- Hardcoded heuristics in cinematography / continuity services
- Unversioned rules scattered across production modules
- Memory preferences without clear separation from general filmmaking law
- No structured skill discovery, composition, conflict, or evidence classification

## After

A dedicated **knowledge runtime** under `src/app/services/production/knowledge/`:

- Versioned skill catalog (provider-neutral)
- Context-tag resolver
- Structured composition + conflict detection
- Attachment onto `ShotSpec.filmmakingGuidance`
- Consumption by visual planning → prompt compilation

No second memory system, prompt engine, orchestrator, provider-agent swarm, ProductionSpec duplicate, or UI redesign.

## New / modified services

### Created

| File | Role |
|------|------|
| `src/app/services/production/knowledge/types.ts` | Schema |
| `src/app/services/production/knowledge/registry.ts` | In-process registry |
| `src/app/services/production/knowledge/resolver.ts` | Skill selection |
| `src/app/services/production/knowledge/composer.ts` | apply / compose / conflicts |
| `src/app/services/production/knowledge/runtime.ts` | Production attachment |
| `src/app/services/production/knowledge/library/helpers.ts` | Catalog helpers |
| `src/app/services/production/knowledge/library/catalog.ts` | Initial skill library |
| `src/app/services/production/knowledge/library/index.ts` | Library bootstrap |
| `src/app/services/production/knowledge/index.ts` | Public exports |
| `src/app/services/production/filmmakingKnowledge.p2.test.ts` | Phase 2 tests |
| `docs/FILMMAKING_KNOWLEDGE_RUNTIME.md` | Runtime architecture doc |
| `docs/PHASE_2_FILMMAKING_KNOWLEDGE.md` | This change report |

### Modified

| File | Change |
|------|--------|
| `src/app/services/production/specification/shotSpec.ts` | `filmmakingGuidance` + observability fields |
| `src/app/services/production/generation/visualPlanningPipeline.ts` | Call `applyFilmmakingSkillsToProduction` before prompt compile |
| `src/app/services/production/generation/promptCompiler.ts` | Inject structured skill guidance into compiled prompts |
| `package.json` | Register filmmaking knowledge tests |

## Initial skill library

Production skills:

1. `reference-first-visual-continuity`
2. `character-visual-contract`
3. `character-sheet`
4. `location-anchor`
5. `storyboard-blueprint`
6. `motion-prompting`
7. `timeline-prompting`
8. `start-end-frame-control`
9. `shot-handoff`
10. `previous-video-continuation`
11. `parallel-vs-sequential-generation`
12. `continuity-first-generation`
13. `shot-purpose`
14. `cinematic-coverage`
15. `camera-movement-purpose`
16. `visual-style-consistency`
17. `prompt-compilation-principles`
18. `generation-quality-criteria`
19. `failure-awareness`
20. `reference-selection`

Supporting / test companion: `camera-movement-tracking-bias` (experimental conflict fixture).

## Runtime flow (code-level)

```text
createProductionPlan / applyVisualPlanningPipeline(spec)
  → routeProductionShots(spec)
  → applyFilmmakingSkillsToProduction(spec)
       → skillContextFromShot(spec, sceneId, shot)
       → resolveSkills(ctx)          // registry + applicability tags
       → composeSkillOutputs(skills) // structured merge + conflicts
       → shot.filmmakingGuidance = … // + continuityRequirements merge
       → observability.filmmakingSkillIds / Versions
  → compileProductionPrompts(spec)
       → append FILMMAKING CONSTRAINTS / GUIDANCE / SKILL CONTEXT
  → planGenerationTasks / DAG (unchanged; no skill-driven provider calls)
```

Standalone API:

```ts
runFilmmakingSkills(ctx) → ComposedSkillOutput
resolveSkillIds(ctx) → string[]
applySkill(skill, ctx) → SkillApplicationOutput
```

## Integration points

| Consumer | How |
|----------|-----|
| Visual planning pipeline | Mandatory step before prompt compile |
| Prompt compiler | Reads `shot.filmmakingGuidance` |
| ShotSpec | Persists guidance + skill id/version observability |

Not integrated in this phase: ModelRouter, provider adapters, QC repair, DAG scheduler, Creative Director agents as separate personalities, UI.

## Architectural quality check

| Question | Answer |
|----------|--------|
| Second memory system? | No — MemoryService untouched |
| Second prompt engine? | No — extends existing promptCompiler |
| Provider agents? | No |
| Second orchestrator? | No |
| Duplicate ProductionSpec? | No — only ShotSpec guidance field |
| New UI? | No |
| Vendors hardcoded in filmmaking principles? | No — capability needs only |
| Tutorial heuristics as universal laws? | No — classified heuristic/verified |

## Tests

See validation section in the Phase 2 completion summary. Focused suite: `filmmakingKnowledge.p2.test.ts` (discovery, location, motion, continuity, isolation, composition, conflict, versioning, classification, provider neutrality, pipeline/prompt integration).

## Remaining gaps (intentional)

| Deferred to | Gap |
|-------------|-----|
| Phase 3 | Provider capability intelligence / vendor contracts |
| Phase 4 | Full reference & asset intelligence |
| Phase 5 | Cinematic shot generation intelligence beyond coverage heuristics |
| Phase 6–8 | Storyboard→shot pipeline depth, continuity engine, DAG execution |
| Phase 9 | Full QC + automated repair consuming qualityCriteria |
| Phase 11 | Automated knowledge extraction / learning loop |
