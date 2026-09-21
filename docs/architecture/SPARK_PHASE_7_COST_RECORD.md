# SPARK Phase 7 Architecture Record: Cost Engine & Economic Optimization

**Repository:** `ElOgiso/spark`  
**Branch:** `main`  
**Baseline Commit:** `89d64a3` (`chore(routing): harden canonical routing authority`)  
**Phase:** 7 — Cost Engine & Economic Optimization  
**Status:** COMPLETE & VERIFIED  
**Date:** 2026-09-21  

---

## 1. Executive Summary

Phase 7 establishes **one canonical Cost Engine** for SPARK, creating a normalized provider economics layer that answers:
1. **Pre-flight**: *"How much will this exact generation request cost Spark before execution?"* (`CostEstimate`)
2. **Post-flight**: *"What did this generation actually cost Spark after execution?"* (`ActualProviderCost`)

### Core Architecture
```text
Semantic Generation Intent
        ↓
Capability Requirements
        ↓
Canonical Router (router.ts)
        ↓
providerId + modelId + configuration
        ↓
Cost Engine (costEngine.ts)
        ↓
exact / estimated provider cost (CostEstimate)
        ↓
Generation Execution (adapters)
        ↓
actual provider usage (ProviderUsageReport)
        ↓
actual provider cost (ActualProviderCost)
        ↓
economic record
```

---

## 2. Authority Consolidation & Boundaries

| Concern | Authoritative Module | Responsibility | Boundary Notes |
|---|---|---|---|
| **Cost Engine** | `src/app/services/production/economics/costEngine.ts` | Pre-flight estimation, post-execution actual cost, retry accumulation, budget evaluation | Single source of truth for provider economics |
| **Pricing Registry** | `src/app/services/production/economics/pricingRegistry.ts` | Canonical rule catalog with full provenance (`source`, `sourceType`, `confidence`, `effectiveFrom`) | Extensible via `registerPricingRule`, test-isolated via `reset()` |
| **Economics Types** | `src/app/services/production/economics/types.ts` | Normalized contracts (`CostEstimate`, `ActualProviderCost`, `AttemptCostRecord`, etc.) | USD-denominated canonical numbers |
| **Canonical Router** | `src/app/services/production/capability/router.ts` | Consumes `CostEngine.estimateCost` for budget filtering and attaches `estimatedCost` to resolved models | Does **NOT** own pricing formulas or tables |
| **Provider Adapters** | `src/app/services/production/execution/adapters/types.ts` | Provider execution boundary; optional `estimateCost` and `resolveActualCost` hooks | Does **NOT** calculate global SPARK pricing |
| **Credit Engine** | Strictly Deferred to **Phase 8** | Spark Credit balance, user charging, reservation, settlement, ledger | **Zero credit balance or ledger mutations in Phase 7** |

---

## 3. Key Invariants & Architectural Guarantees

1. **Unknown Economics Must Never Look Free**:
   - If a model, provider, or configuration has no verified pricing rule, `CostEngine.estimateCost` returns `status: "UNKNOWN"` and `amount: null`. It **never** returns `0` or free.
2. **Fail-Safe Budget Compliance**:
   - `CostEngine.evaluateBudget(estimate, maxBudget)`:
     - `amount <= maxBudget`: `approved: true, reason: "UNDER_BUDGET"`
     - `amount > maxBudget`: `approved: false, reason: "EXCEEDS_BUDGET"`
     - `status === "UNKNOWN"`: `approved: false, reason: "UNKNOWN_COST"` (never assumes under budget).
3. **Configuration-Sensitive Pricing**:
   - Billable variables are respected: duration, resolution multipliers (e.g. 1.5x for 1080p), audio add-ons ($0.05), per-image rates, per-character rates.
4. **Estimated vs. Actual Cost Separation**:
   - `CostEstimate` (pre-flight) and `ActualProviderCost` (post-flight) are distinct structures with explicit usage reports (`ProviderUsageReport`) and `estimateId` linkability.
5. **Retry Cost Accumulation**:
   - `CostEngine.accumulateAttemptCosts(attempts)` sums all paid attempts (e.g. Attempt 1 $0.35 + Attempt 2 $0.35 = $0.70).
   - If any attempt outcome is unconfirmed or timed out (`status: "timeout" | "unknown"`), the accumulated cost status remains `"UNKNOWN"`.
6. **Unknown Submission Safety**:
   - Submissions that time out or have uncertain provider outcomes are treated as `status: "UNKNOWN"` with `amount: null`, preserving Phase 5.2 unknown-submission safety.
7. **Strict Determinism**:
   - Zero randomness (`Math.random()` = 0, `Date.now()` excluded from calculation formulas). Identical requests produce identical estimates.
8. **Pricing Provenance**:
   - Every rule and estimate carries provenance: `source`, `sourceType` (`OFFICIAL_PROVIDER`, `PROVIDER_API`, `ADMIN_CONFIG`, `INTERNAL_ESTIMATE`, `UNKNOWN`), `confidence` (0.0–1.0), and `verifiedAt`.

---

## 4. Verification & Test Suite

1. **Dedicated Phase 7 Test Suite**:
   - File: `src/app/services/production/costEngine.test.ts`
   - **20 / 20 tests passing (100%)** covering:
     1. Exact pricing (video, image, audio)
     2. Configuration-sensitive pricing (duration, resolution, audio add-on)
     3. Unknown pricing fails safely
     4. Budget rejection on cost ceiling exceedance
     5. Budget acceptance within ceiling
     6. Unknown budget behavior fails safe
     7. Estimate vs actual cost separation
     8. Retry accumulation across attempts
     9. Unknown submission handling
     10. Deterministic calculation
     11. Pricing provenance tracking
     12. Router integration (`estimatedCost` attachment and `budget.maxProviderCost` enforcement)
     13. Legacy ModelRouter facade compatibility
     14. No credit mutation (Phase 8 boundary strictly preserved)

2. **Phase 3, 5, 6 Regression Suites**:
   - Files: `canonicalRouter.test.ts`, `mediaCapability.p3.test.ts`, `videoCapabilityBoundary.test.ts`, `failClosedVideoSubmit.test.ts`, `capabilityFactLayer.test.ts`
   - **74 / 74 tests passing (100%)**

3. **Full Repository Test Suite (`npm test`)**:
   - **838 passed, 2 failed** (exact match with documented pre-existing baseline failures: `officialI2vFrames.test.ts` and `assetBibleFromBrief.test.ts`).

4. **Production Build & Typecheck**:
   - `npm run build`: Built successfully in 37.70s.
   - Zero TypeScript errors in all Phase 7 files.

5. **Remote Provider Spend**:
   - **$0.00 spent**. Entire phase ran offline with mock/synthetic data.
