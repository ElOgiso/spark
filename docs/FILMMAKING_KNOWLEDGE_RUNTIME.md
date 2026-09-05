# Filmmaking Knowledge & Skill Runtime

## A. Purpose

SPARK already contains production architecture (Creative Director, ProductionSpec, ShotSpec, planners, prompt packs, continuity heuristics). Much of the filmmaking knowledge that should inform those systems was previously implicit in prompts, hardcoded in services, or unversioned.

This runtime makes filmmaking knowledge **explicit, classified, versioned, composable, and selectable** so production intelligence can reason with reusable principles instead of only repeating tutorial-style prompts.

Skills are **knowledge/procedure modules**, not autonomous agents.

## B. Architecture

```text
Filmmaking Knowledge (catalog)
        ↓
Skill Registry (versioned, in-process)
        ↓
Skill Resolver (context tags → applicable skills)
        ↓
Skill Composition (structured merge + conflict detection)
        ↓
ShotFilmmakingGuidance on ShotSpec
        ↓
Visual planning / prompt compilation
        ↓
ShotSpec / GenerationTask planning (unchanged execution path)
```

Code map:

| Layer | Module |
|-------|--------|
| Schema | `src/app/services/production/knowledge/types.ts` |
| Registry | `src/app/services/production/knowledge/registry.ts` |
| Resolver | `src/app/services/production/knowledge/resolver.ts` |
| Composer | `src/app/services/production/knowledge/composer.ts` |
| Runtime | `src/app/services/production/knowledge/runtime.ts` |
| Library | `src/app/services/production/knowledge/library/` |
| Integration | `visualPlanningPipeline.ts` → `applyFilmmakingSkillsToProduction` → `promptCompiler.ts` |

This extends existing production intelligence. It does **not** replace MemoryService, CapabilityRegistry, ModelRouter, or productionPromptPacks.

## C. Skill schema

A `FilmmakingSkill` includes:

- Identity: `id`, `name`, `version`, `status`, `createdAt`, `updatedAt`
- Semantics: `domain`, `stages`, `purpose`, `applicability`
- Knowledge: `principles[]`, `rules[]`, `procedure[]`, `constraints`, `qualityCriteria`, `failureModes`
- Provenance: `sourceType`, `evidenceLevel`, classification / priority on principles & rules
- Output hints: `promptContextKeys`, `templates`, `metadata`

Composed output (`ComposedSkillOutput` / `ShotFilmmakingGuidance`):

```ts
{
  skillIds, skillVersions,
  constraints, recommendations,
  promptContext, generationRequirements, continuityRequirements,
  qualityCriteria, warnings, conflicts
}
```

## D. Skill categories / initial library

Domains: story, character, environment, cinematography, generation, continuity, storyboard, audio, editorial, quality.

Initial production skills (provider-neutral):

| Skill ID | Domain focus |
|----------|--------------|
| `reference-first-visual-continuity` | continuity |
| `character-visual-contract` | character |
| `character-sheet` | character |
| `location-anchor` | environment |
| `storyboard-blueprint` | storyboard |
| `motion-prompting` | generation |
| `timeline-prompting` | generation |
| `start-end-frame-control` | generation |
| `shot-handoff` | continuity |
| `previous-video-continuation` | generation / continuity |
| `parallel-vs-sequential-generation` | generation |
| `continuity-first-generation` | continuity |
| `shot-purpose` | cinematography |
| `cinematic-coverage` | cinematography |
| `camera-movement-purpose` | cinematography |
| `visual-style-consistency` | cinematography |
| `prompt-compilation-principles` | generation |
| `generation-quality-criteria` | quality |
| `failure-awareness` | quality |
| `reference-selection` | continuity |

A test-only companion skill (`camera-movement-tracking-bias`) exists to exercise conflict detection; it is experimental and not a production law.

## E. Knowledge classification

Every principle/rule carries:

- `classification`: general-filmmaking | ai-filmmaking | generation-technique | provider-specific | experimental | heuristic | verified | unverified | deprecated
- `evidenceLevel`: verified | heuristic | experimental | provider-specific | deprecated

Tutorial-derived claims default to **heuristic** / research-derived. They do not become universal laws unless marked verified with appropriate priority.

## F. Priority

Resolution order (`KNOWLEDGE_PRIORITY_ORDER`):

```text
project_constraints
  → production_requirements
  → creator_preferences
  → general_filmmaking
  → ai_generation_heuristics
  → provider_specific
  → experimental
```

Provider **capability facts** (Phase 3+) may override generic assumptions when an explicit contract says a capability is or is not supported. Filmmaking skills in this phase stay capability-*need* oriented (e.g. “need start-frame”), never vendor-hardcoded.

Memory preferences remain distinct from global filmmaking knowledge and must not auto-promote to law.

## G. Conflict handling

When two skills emit contradictory structured rules on the same `topic` (e.g. camera movement), the composer records a `SkillConflict` with:

- `topic`, competing skill ids / values
- `resolution`: `higher_priority` | `different_context` | `optional_ignored` | `needs_review` | `unresolved`
- optional `winnerSkillId`

Conflicts are surfaced in `warnings` / `conflicts` on guidance — never silently concatenated into nonsense prompts (“static tracking”).

## H. Versioning

Each skill has semantic `version` (`major.minor.patch`). Shot observability stores `filmmakingSkillIds` and `filmmakingSkillVersions` so a production remains explainable after catalog updates.

Status: `active` | `experimental` | `deprecated` | `disabled`. Deprecated/disabled skills are not selected by the resolver.

## I. Integration

Primary consumer (Phase 2):

1. `applyVisualPlanningPipeline` routes shots
2. `applyFilmmakingSkillsToProduction(spec)` resolves/composes per shot and attaches `shot.filmmakingGuidance`
3. `compileProductionPrompts` injects FILMMAKING CONSTRAINTS / GUIDANCE / SKILL CONTEXT / WARNINGS from guidance
4. Existing generation planning / DAG continue unchanged (no provider calls from skills)

Public API: `src/app/services/production/knowledge/index.ts`.

## J. Future extension

Later knowledge drops should:

1. Distill research into principles (no verbatim tutorial copy)
2. Classify evidence and priority
3. Match existing skill ids before creating new ones
4. Version and activate (or deprecate)

Phase 11 may connect learning feedback. Phase 3 owns provider capability intelligence. Phase 9 owns full QC engines. This runtime only prepares structured criteria and constraints for those phases.
