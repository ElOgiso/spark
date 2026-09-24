# SPARK Phase 17 — Observability + Production Memory Record

Audit date: 2026-09-24  
Repository: `ElOgiso/spark`  
Branch: `main` ONLY  
Starting audited live HEAD: `d2896eca367c902630dbb02c253e3aeea54b0cc0`  
Connected Supabase project: `jaqzjhabmtvqtvinoafq`  

---

## 1. Executive Summary

Phase 17 implements canonical observability and production memory for SPARK. It connects the disparate evidence produced across planning, routing, execution, economics, QC, repairs, editorial mastering, publishing, and post-publish performance into one unified, durable, queryable trail.

SPARK can now truthfully and durably answer:
- **What did we try?** (Spec generation, visual plans, scene/shot structure)
- **Why did we choose it?** (Format mode policy, candidate scoring, router rationale, fallback plans)
- **Which provider/model executed it?** (Selected adapter, target model, submission attempts)
- **What did it cost?** (Reservation amounts, settled actual costs, credit holds, or explicit `unknown` cost status)
- **Did the submission succeed?** (Job identifiers, attempt count, provider error codes, `UNKNOWN_SUBMISSION` holds)
- **What asset came back?** (Output asset references, duration, resolution, storage URLs)
- **Did QC accept it?** (Automated & visual analysis verdicts, failure codes, scores, notes)
- **Was it repaired?** (Repair actions, reroutes, modifications, parameter overrides)
- **Did the repair work?** (Lineage tracking: original asset -> failure code -> repair action -> replacement asset -> second QC verdict)
- **What became the final master?** (Editorial mix specifications, multitrack audio bindings, master asset URL)
- **Was it published?** (Platform jobs, target channels, published URLs)
- **How did it perform?** (Post-publish metrics, views, retention, likes, engagement)
- **What should SPARK learn from that outcome?** (Sample-size gated provider reliability, repair effectiveness, craft laws, with unmeasured outcomes strictly barred from learning)

---

## 2. Permanent Architectural Law Compliance

> **SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.**  
> **STORE EVIDENCE FIRST, LEARN SECOND.**  
> **NEVER HALLUCINATE COSTS OR OUTCOMES.**

1. **Meaning vs Execution**: Providers never decide event taxonomy or learning updates. Providers only return raw execution outcomes. SPARK translates outcomes into typed canonical observations.
2. **Evidence First**: All events are persisted into the immutable append-only event store before any learning or optimization updates are derived.
3. **Truthful Cost**: If a provider does not report actual dollar/cent spend or if metrics are unavailable, the record explicitly stamps `actualCostStatus: "unknown"` with `actualCost: undefined`. Costs are never fabricated as `0` or guessed.
4. **No Parallel Engines**: Reused existing `ProductionObserver`, `ProductionLifecycleRunner`, `CreditService`, `VisualAnalysisService`, and `LearningUpdatePipeline`.

---

## 3. Database Schema Decision & Migration

### Schema Evaluation
- `public.audit_logs`: Designed for system/administrative security events with UUID `entity_id` and generic action types. Inappropriate for high-throughput shot/task production events.
- `public.productions`: Represents the mutable working document and latest spec snapshot. Appending execution event arrays directly causes write serialization bottlenecks, document bloat, and concurrency race conditions.
- **Decision**: **New narrow, append-only table `public.production_events`**.
  - Provides indexed foreign keys for fast correlation: `production_id`, `task_id`, `execution_id`, `user_id`, `event_type`.
  - Enforces append-only access privileges (`REVOKE UPDATE, DELETE ON public.production_events FROM authenticated, anon`).
  - Row Level Security (RLS) restricts access to the owning user or workspace admins.

### Migration File
- Location: `supabase/migrations/20260924135502_production_observability_events.sql`
- Creates table `public.production_events`:
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `production_id text NOT NULL`
  - `task_id text`
  - `execution_id text`
  - `user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL`
  - `event_type text NOT NULL`
  - `event_family text NOT NULL`
  - `criticality text NOT NULL CHECK (criticality IN ('critical', 'diagnostic'))`
  - `payload jsonb NOT NULL DEFAULT '{}'::jsonb`
  - `created_at timestamptz NOT NULL DEFAULT now()`

---

## 4. Architecture & Implementation Modules

The canonical observability stack is located at `src/app/services/production/observability/`:

```text
src/app/services/production/observability/
├── index.ts                # Unified barrel exports
├── types.ts                # Canonical event types, families, provenance, trace contracts
├── sanitizer.ts            # Recursive secret and token sanitizer
├── repository.ts           # Dual-mode repository (Supabase + In-Memory for test isolation)
├── observer.ts             # ProductionObserver event emission boundary (fail-closed criticals)
├── productionTrace.ts      # Unified trace builder reconstructing full lifecycle history
├── learningGate.ts         # Sample-size protected gates feeding SPARK memory
└── productionObservability.test.ts # Matrix verification (Tests A–Z)
```

### Key Components

1. **Secret Sanitizer (`sanitizer.ts`)**:
   - Recursively walks all payloads before logging or persistence.
   - Redacts keys and token patterns matching: `authorization`, `api_key`, `access_token`, `refresh_token`, `bearer`, `secret`, `password`, `credential`, `token`, `service_role`.
   - Protects authorization headers (e.g., `Bearer secret...` -> `Bearer [REDACTED]`).

2. **Repository Boundary (`repository.ts`)**:
   - `IProductionObservabilityRepository`: Defines `recordEvent`, `recordEventsBatch`, `getEventsForProduction`, `getEventsForTask`, and `getEventsForExecution`.
   - Detects unit test mode (`VITE_USE_SUPABASE === 'false'`, `NODE_ENV === 'test'`, or `--test` flag) to use `InMemoryProductionObservabilityRepository`, preventing unauthorized remote network calls during testing.
   - On production database errors, truthfully logs and fails closed on critical events.

3. **Observer Boundary (`observer.ts`)**:
   - Distinguishes between `critical` events (e.g. credit reservations, settlements, asset outputs) and `diagnostic` events (e.g. debug telemetry).
   - If writing a `critical` event fails, `recordEvent` throws an error to fail the enclosing transaction closed. Diagnostic failures log a warning and continue non-blockingly.

4. **Trace Reconstruction (`productionTrace.ts`)**:
   - `buildProductionTrace(productionId, repo)` aggregates and sorts all events chronologically.
   - Reconstructs:
     - Planning & routing choices
     - Execution attempts, retries, and unknown submission states
     - Economic ledger: total reservations, settlements, releases, and `actualCostStatus`
     - Asset registry: keyframe stills, video clips, voice audio, background tracks, master videos
     - QC assessments: automated scores, visual inspection, pass/fail verdicts
     - Repair lineages: chains linking `originalAssetId -> failureCode -> repairAction -> replacementAssetId -> secondQcVerdict`
     - Editorial assembly & master media
     - Publishing targets & post-publish analytics

5. **Learning Gates (`learningGate.ts`)**:
   - **Sample-Size Protection**: `deriveProviderReliabilityFromTrace` requires at least 2 measured observations (`minSamplesForPreference >= 2`) before emitting provider reliability adjustments.
   - **Repair Effectiveness**: Records both successful repairs (`repair_recipe`) and failed repairs (`failure_pattern`).
   - **Audience Performance Gate**: Drops unmeasured, missing, or fabricated metrics.
   - **Memory Bridge**: Deduplicates candidate learnings by hash/title to prevent polluting `MemoryItem` records.

---

## 5. Lifecycle & Autonomy Integration

1. **Execution Logging Bridge (`src/app/services/production/execution/observability.ts`)**:
   - Sanitizes `ExecutionLogEvent` payloads.
   - Bridges lifecycle transitions into `ProductionObserver` (`execution_queued`, `execution_submitting`, `execution_submitted`, `execution_running`, `execution_succeeded`, `execution_failed`, `execution_unknown_submission`).
2. **Lifecycle Runner (`src/app/services/production/execution/productionLifecycleRunner.ts`)**:
   - Stamped `actualCostStatus: "unknown"` when provider cost is unmeasured.
   - Emits planning, economic, QC, and completion events to `ProductionObserver`.
3. **Autonomy Learning Pipeline (`src/app/services/production/intelligence/autonomy/learningUpdatePipeline.ts`)**:
   - Integrated `buildOutcomeFromTrace` alongside `buildOutcomeFromLifecycle`.
   - Respects `actualCostStatus` so unmeasured costs are never treated as $0.00.

---

## 6. Verification & Test Suite Summary

### Discovered Test Suite: 100% Passing
- **Phase 17 Dedicated Suite** (`src/app/services/production/observability/productionObservability.test.ts`):
  - **26/26 tests passed** (Tests A through Z).
- **All Project Suites**:
  - **1,375 tests passed across 296 suites** (0 failed, 0 skipped, 0 cancelled).
- **Static Analysis & Build**:
  - `npx tsc --noEmit`: 0 errors.
  - `npm run build`: Clean production build completed in 26.03s.
- **Provider Spend**:
  - **$0.00** (Zero paid provider calls executed).

---

## 7. Operational Readiness & Remaining Gates

- **Database Migration Required**:
  - `supabase/migrations/20260924135502_production_observability_events.sql` has been created locally and typed in `database.types.ts`.
  - It must be applied to live Supabase project `jaqzjhabmtvqtvinoafq` by an authorized admin.
- **Next Phase**:
  - `PHASE 18 — SUPABASE SECURITY & DATA HARDENING`.
  - Strict stop after Phase 17. No Phase 18 implementation is commenced.
