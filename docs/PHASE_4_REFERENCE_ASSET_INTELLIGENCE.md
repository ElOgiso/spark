# Phase 4 — Reference & Asset Intelligence

## Goal

Give Spark a single, deterministic place to register production assets, assign reference authority, resolve shot reference packs, and hand provider-neutral needs to Phase 3 capability routing — without a second continuity/character system, new orchestrator, or UI redesign.

## Non-goals

- No Phase 5–12 features
- No provider agents / new orchestrator
- No wholesale rewrite of `productionAssetService.ts`
- No Supabase-only dependency for SPARK core resolution

## Delivered

### Contracts (`assets/types.ts`)

`AssetCategory`, `ProductionEntityType`, `ReferenceRole`, `ReferenceAuthority`, `AssetLifecycleStatus`, `AssetProvenanceSource`, `AssetRelationshipType`, `AssetScope`, `ReferenceIssueCode`, storage/media/provenance/version/variant/relationship/usage types, `RegisteredAsset`, `ReferenceRequirement`, `ResolvedReference`, `ReferenceIssue`, `ReferenceBundle`, `CapabilityReferenceNeed`, `ReferenceResolutionOptions`.

### Normalize (`assets/normalize.ts`)

- `normalizeProductionAsset(asset, extras?)` lifts legacy `ProductionAsset` (including optional Phase 4 fields).
- Provenance is `unknown` when unclear — never invent approval.
- `assetsFromMaster` maps master `draft|approved|retired` → `candidate|approved|deprecated`.
- `computeReferenceEligible` gates usable reference URLs.

### Registry (`assets/registry.ts`)

In-memory `ProductionAssetRegistry` with register, list (scope-isolated), authority promotion/demotion, lineage, usages, fingerprint lookup, validation, `resetForTests`.

### Resolve (`assets/resolve.ts`)

`resolveReferenceBundle` with documented `SELECTION_POLICY`.  
`buildReferenceRequirementsFromShot` from `ShotReferencePack` + character/prop ids.  
`referenceBundleToCapabilityNeeds` for provider-neutral handoff.

### Character identity

`assets/characterIdentity.ts` + gate re-export/wrapper in `characterSheetGate.ts`. Optional registry path; URL fallback preserved.

### Docs & tests

- `docs/REFERENCE_ASSET_INTELLIGENCE.md`
- `docs/PHASE_4_REFERENCE_ASSET_INTELLIGENCE.md` (this file)
- `productionReferenceAssets.p4.test.ts` covered in `npm test`

## Selection policy (verbatim)

```
explicitAssetId > canonical(+role+variant) > approved/preferred > supporting > candidate(if allowed); never deprecated/rejected; conflict if two canonicals
```

## Issue codes used in resolution

| Code | When |
|------|------|
| `REFERENCE_MISSING` | Required ref unresolved (strict) |
| `REFERENCE_UNRESOLVED` | Optional / soft miss |
| `REFERENCE_AUTHORITY_CONFLICT` | ≥2 canonicals same entity+role+variant |
| `REFERENCE_WRONG_ENTITY` | Explicit asset entity mismatch |
| `REFERENCE_WRONG_ROLE` | Role mismatch without fallback |
| `REFERENCE_VARIANT_UNAVAILABLE` | Requested variant missing, fallback off |
| `REFERENCE_FALLBACK_USED` | Variant fallback selected (`fallbackUsed: true`) |
| `REFERENCE_REJECTED` / `REFERENCE_DEPRECATED` / `REFERENCE_INELIGIBLE` | Validation / explicit reject paths |
| `ASSET_LINEAGE_CYCLE` | Cycle on `derived_from` |

## Compatibility

- Existing `ProductionAsset.assetType` and status values unchanged.
- Optional Phase 4 fields appended to `ProductionAsset`.
- `ShotReferencePack` and `assetSpec` master types reused as-is.
- Phase 3 routers continue to score providers from capability matrix; they consume needs without provider-specific mapping in this module.
