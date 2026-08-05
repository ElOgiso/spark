# SPARK Implementation Sequence

This document defines the step-by-step development sequence for implementing the Multi-Agent Operating System layers in SPARK.

---

## Phase 1: Stateless Infrastructure & Policy Engine
1. **Scaffold Policy & Pipeline Services**:
   - Create `src/app/services/executivePolicyEngine.ts`.
   - Create `src/app/services/pipelineEngine.ts`.
2. **Refactor Hardcoded Context Checks**:
   - Replace manual `state.automationMode === "autonomous"` checks in `SparkContext.tsx` with `ExecutivePolicyEngine.canProceed()`.
   - Update `sparkService.ts` to query `ExecutivePolicyEngine` for publishing and scheduling policies.
3. **Verify Local Compilations**:
   - Boot local dev server, toggle modes, and confirm the approved pipeline flow is retained.

---

## Phase 2: Capability Analyzer & Routing Contracts
1. **Scaffold Analyzer & Router**:
   - Create `src/app/services/capabilityAnalyzer.ts` implementing `ICapabilityAnalyzer`.
   - Create `src/app/services/modelRouter.ts` implementing `IModelRouter`.
2. **Scaffold Performance History Log**:
   - Create `src/app/services/performanceHistory.ts` implementing `IPerformanceHistory`.
3. **Integrate the Model Routing Flow**:
   - Update `SparkContext` and the department services to request capability profiling and route checks before task execution.

---

## Phase 3: Active Supabase Reconciler
1. **Deploy Postgres Tables**:
   - Apply migrations inside `supabase/migrations/` to the active remote Supabase project.
2. **Activate Supabase Client**:
   - Set `VITE_USE_SUPABASE=true` in `.env.local`.
   - Configure context boots to query `profileRepository` and `brandRepository` instead of loading local mock seeds.
3. **Migrate Memory Actions**:
   - Update `addMemoryItem` and `createProduction` in the context to save records remotely via repositories.

---

## Phase 4: Model Providers & LLM Connectors
1. **Scaffold Provider Adapters**:
   - Create `src/app/backend/providers/geminiProvider.ts` implementing `ILlmProvider`.
   - Create Anthropic and OpenAI adapter modules.
2. **Connect Agent Generative Logic**:
   - Replace simulated markdown replies in `MySpark.tsx` and script builders with active Gemini Flash/Pro LLM completions.
