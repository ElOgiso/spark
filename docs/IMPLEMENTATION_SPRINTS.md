# SPARK Implementation Sprints

This document outlines the daily executable engineering sprints required to transition SPARK's architecture into a functional multi-agent runtime. Each sprint represents approximately one working day of development.

---

## Sprint 1: Policy & Pipeline Engines
* **Goal**: Establish the stateless governance and sequencing services.
* **Files**:
  - `src/app/services/executivePolicyEngine.ts` [NEW]
  - `src/app/services/pipelineEngine.ts` [NEW]
* **Success Criteria**:
  - Toggling automation settings correctly changes step progression rules.
  - No workflow sequences are hardcoded in views.
* **Tests**: Jest unit tests validating step inputs vs output approval flags.
* **Rollback Criteria**: Code compilation errors or breaking existing dashboard navigation triggers.

---

## Sprint 2: Capability Analyzer & Registry Catalog
* **Goal**: Implement task requirements profiling and the agent registry directory.
* **Files**:
  - `src/app/services/capabilityAnalyzer.ts` [NEW]
  - `src/app/services/agentRegistry.ts` [NEW]
* **Success Criteria**:
  - Task requests return structured `CapabilityProfile` configurations.
  - Registry validates agent metadata manifests.
* **Tests**: Unit tests verifying capabilities lookup queries.
* **Rollback Criteria**: Unknown task types crash the application.

---

## Sprint 3: Model Routing & History Logging
* **Goal**: Build the routing scoring logic and telemetry history ledger.
* **Files**:
  - `src/app/services/modelRouter.ts` [NEW]
  - `src/app/services/performanceHistory.ts` [NEW]
* **Success Criteria**:
  - Router selects optimal provider routes based on health metrics.
  - Logs are persisted in the database.
* **Tests**: Simulating network timeouts to verify route penalties.
* **Rollback Criteria**: High routing latency.

---

## Sprint 4: Execution Adapter & Provider Mappers
* **Goal**: Implement the provider-agnostic runtime adapters.
* **Files**:
  - `src/app/services/executionAdapter.ts` [NEW]
  - `src/app/backend/providers/` [NEW]
* **Success Criteria**:
  - Adapter normalizes API responses to `AgentResult`.
  - Abort controllers successfully cancel active HTTP completions.
* **Tests**: Mock API calls testing network timeouts and rate limit recoveries.
* **Rollback Criteria**: Provider SDK dependency leaks in agent classes.

---

## Sprint 5: Database Connection & Orchestrator Hookups
* **Goal**: Sync the Supabase Postgres database and bind all components to `SparkContext`.
* **Files**:
  - `src/app/state/SparkContext.tsx` [MODIFY]
  - `src/app/backend/repositories/` [MODIFY]
* **Success Criteria**:
  - Context mutations write directly to the database.
  - Dashboard is fully active on boot.
* **Tests**: CRUD operations tested against Supabase staging.
* **Rollback Criteria**: Data desync or blank home grids.
