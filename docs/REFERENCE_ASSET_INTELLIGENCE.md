# Reference & Asset Intelligence

Spark Phase 4 module for production reference resolution and asset authority.

## Principles

- **Asset ≠ Reference** — a stored file is not automatically usable as a generation reference.
- **Canonical ≠ latest** — newest version does not win; authority does.
- **Approved ≠ exists** — presence of a URL does not imply approval.
- **Fingerprint ≠ identity** — content hashes detect duplicates; stable `id` / `masterRef` identify assets.
- **No second system** — extends `ProductionAsset` + `MasterAsset*` from `assetSpec.ts`; sits beside `productionAssetService`.

## Location

`src/app/services/production/assets/`

| File | Role |
|------|------|
| `types.ts` | Contracts (`RegisteredAsset`, `ReferenceBundle`, issues, capability needs) |
| `fingerprint.ts` | Deterministic FNV-style fingerprints |
| `normalize.ts` | `ProductionAsset` / master → `RegisteredAsset` |
| `registry.ts` | In-memory `ProductionAssetRegistry` |
| `resolve.ts` | Deterministic reference resolution |
| `characterIdentity.ts` | Identity-anchor checks |
| `phase3Handoff.ts` | Provider-neutral needs for Phase 3 routing |
| `index.ts` | Public API |

## Domain extensions

Optional Phase 4 fields on `ProductionAsset` (`role`, `masterRef`, `version`, `variant`, `parentAssetId`, `authority`, `lifecycle`, `fingerprint`) — all backward compatible.

## Registry

In-memory only (no new DB). Scope isolation: queries filtered by `productionId` unless `scope: "global"` with explicit `allowGlobal`.

Key operations: register / update / setAuthority / promoteToCanonical / deprecate / reject / addRelationship / getLineage / recordUsage / validateAsset.

Setting `canonical` demotes the previous canonical for the same entity+role+variant to `approved` without deletion. `derived_from` cycles are rejected.

## Resolution priority

```
explicitAssetId
 → canonical (+ role + variant)
 → approved / preferred
 → supporting
 → candidate (only if allowCandidate)
```

Never selects `deprecated` or `rejected`. Two canonicals for the same entity+role+variant → `REFERENCE_AUTHORITY_CONFLICT` (no silent pick).

## Character gate

`characterSheetGate` keeps URL sheet validation and adds `hasValidCharacterIdentityAnchor`. `canStartAssetGeneration` optionally accepts `registry` / `productionId` / `entityId` and prefers registry anchors when provided.

## Phase 3 handoff

`toCapabilityReferenceRequirements(bundle)` → `CapabilityReferenceNeed[]` with entity, roles, assetIds, modalityHints. No provider API field names (kling/veo/etc.).

## Tests

`src/app/services/production/productionReferenceAssets.p4.test.ts`

```bash
npx tsx --test src/app/services/production/productionReferenceAssets.p4.test.ts
```
