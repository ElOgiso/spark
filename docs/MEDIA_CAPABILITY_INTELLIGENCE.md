# Media Capability / Provider Intelligence

## Purpose

Answer conservatively: **what can SPARK actually execute today?**

This module is a knowledge/contract layer under `src/app/services/production/capability/`. It is **not** a second `ModelRouter`, and it does **not** invent provider agents, prices, or UI.

## Separation of concerns

| Layer | Meaning | Used for hard reject? |
|-------|---------|------------------------|
| Provider profile facts | Documented / verified model capabilities | Input to intersection |
| Adapter claims | What SPARK adapters can send today | Input to intersection |
| Effective capability | `provider ∩ adapter ∩ config` (conservative) | Yes |
| Preferences | Preferred provider/model, objective | Soft score only |
| Observed performance | Success / latency / quality samples | Soft (when `known`) |
| Economics | Credits / USD | Soft **only when `economics.known`** |
| Health | `ServiceHealthMonitor` status | Soft + hard for error/disabled |

Skills (Phase 2) and cinematography routing remain separate.

## Architecture

```
CapabilityRequirements
  → listProviderModelCandidates (profile + effective + health)
  → validateCapabilityRequirements (hard filter)
  → score by RoutingObjective weights
  → MediaRoutingDecision (+ capability-compatible fallbacks)
```

Public entry points:

- `routeMediaCapability(requirements, options?)`
- `assertExecutableCapability(req, providerId, modelId?)`
- `capabilityRequirementsFromShot(shot, opts?)`
- `validateCapabilityRequirements(req, effective)`
- `resolveEffectiveCapability(profile, claim|null)`

Production shot routing (`scoreProvidersForShot` / `selectProviderForShot`) applies the same hard filter before soft scorecards. Preferences cannot resurrect a hard-rejected provider.

## Hard vs soft

**Hard rejects** (examples): missing adapter, unsupported mode/modality, missing start/end frame support, insufficient reference types/count, unsupported duration/aspect, unsupported continuation/extension.

**Soft warnings**: camera `prompt_only` gaps, preference nudges, cost/latency/quality when data is known.

## Effective capability

When no adapter exists, temporal modes and reference execution are disabled even if marketing docs claim support (`adapterSupported: false`, conflicts surfaced as `CAPABILITY_CONFLICT`).

Adapter overrides encode SPARK reality (e.g. Grok start-frame only; Kling/Seedance start+end).

## Extending a provider

1. Add/update a `MediaCapabilityProfile` in `profiles.ts` (facts only; `economics.known: false` unless authoritative).
2. Ensure an execution adapter is registered (otherwise effective capability stays non-executable).
3. Record adapter overrides in `adapterSupport.ts` when registry snapshots are incomplete.
4. Cover with a focused case in `mediaCapability.p3.test.ts`.

## Limitations

- No live provider discovery or price scraping.
- No Phase 4 job execution, persistence, or QC wiring in this module.
- Duration validation uses declared min/max / supported spans; runtime may still snap to native values.
- Performance and economics remain `known: false` until authoritative feeds exist.

## Phase 4 readiness

Effective capability + `assertExecutableCapability` are intended as pre-execution guards for the media execution engine. Phase 4 should call them before provider submit, without re-implementing capability matrices inside adapters.
