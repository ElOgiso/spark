# Phase 3 — Media Capability / Provider Intelligence

## Status

Implemented as a production capability module. Complements (does not replace) Phase 3 cinematography + scorecard routing.

## Deliverables

| Path | Role |
|------|------|
| `src/app/services/production/capability/types.ts` | Contracts (`MediaCapabilityProfile`, `CapabilityRequirements`, reason codes, routing decision) |
| `provenance.ts` | Provenance helpers + conservative booleans / control levels / staleness |
| `profiles.ts` | Profiles for kling, seedance, grok, gemini, runway, luma, openai, elevenlabs |
| `adapterSupport.ts` | Adapter capability claims from execution registry + overrides |
| `effective.ts` | Conservative intersection → effective profile + conflicts |
| `validate.ts` | Hard/soft requirement matching |
| `requirements.ts` | ShotSpec → provider-neutral requirements |
| `registry.ts` | Profile registry + candidates + health snapshot |
| `router.ts` | `routeMediaCapability` / `assertExecutableCapability` |
| `index.ts` | Public re-exports |
| `mediaCapability.p3.test.ts` | Scenario coverage A–J + conflicts / provenance / neutrality |
| `docs/MEDIA_CAPABILITY_INTELLIGENCE.md` | Architecture reference |

## Routing integration (minimal)

- `routing/modelScorer.ts` — hard capability filter before soft scorecards
- `routing/providerSelector.ts` — attaches capability reason codes; preference cannot override hard rejects
- `routing/index.ts` — re-exports capability helpers

## Non-goals (explicit)

- No provider agents
- No second `ModelRouter` class
- No invented prices (`economics.known` always false unless authoritative)
- No Phase 4–12 execution / editorial / UI redesign

## Verification

```bash
npm run typecheck
npx tsx --test src/app/services/production/mediaCapability.p3.test.ts
```

## Profiles snapshot

| Provider | `adapterSupported` | Notable effective limits |
|----------|--------------------|---------------------------|
| kling | true | I2V, start+end |
| seedance | true | I2V, start+end, multi typed refs |
| grok | true | I2V, start only (no end frame) |
| gemini | true | T2V/I2V, start only, max ~8s |
| runway | false | Documented only — not executable |
| luma | false | Documented only — not executable |
| openai | true | Image modes |
| elevenlabs | true | TTS |

## Phase 4 handoff

Use `assertExecutableCapability` immediately before submit in the execution engine so unsupported shapes fail closed with structured `RoutingReasonCode`s.
