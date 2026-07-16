# Phase 13: SPARK Implementation Blueprint

This blueprint outlines the specific file modifications, risk assessments, and dependency paths required to transition SPARK from local mock states into the active Multi-Agent Runtime Kernel.

---

## 1. Subsystem Responsibility Matrix

| Subsystem File / Module | Responsibility Today | Responsibility After Runtime | Modifications Required | Risks | Dependencies |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`SparkContext.tsx`** | Coordinates local React state and serializes directly to LocalStorage. | Central orchestrator. Coordinates DB sync, triggers agent dispatch queues, handles policy halts. | - Expose `generateDecisionPlan()` and `executePlan()`. <br>- Route all state mutations through service layers instead of local array state updates. | State desynchronization during asynchronous transitions. | Repositories, Services, Pipeline Engine |
| **`executivePolicyEngine.ts`** | *None* (Hardcoded mode checks run inline in context). | Authority on approval checks, rate throttle limits, and publish gates. | - Create new service file containing static policies for manual/balanced/autonomous runs. | Restricting access flags incorrectly, causing execution blocks. | Brand configurations |
| **`pipelineEngine.ts`** | *None* (Sequencing is mapped directly inside context approve methods). | Standard workflow transition router (Discovery $\rightarrow$ Analytics). | - Create new service file mapping input/output schemas per stage and retry limits. | Infinite loop runs on failures. | None |
| **`capabilityAnalyzer.ts`** | *None* | Shared service defining task capability profiles (token windows, search requirements). | - Create new service profiling Research, Creative, and Director tasks. | Misconfiguring required model flags (e.g. asking for vision on text tasks). | None |
| **`agentRegistry.ts`** | *None* | Autoritative catalog of active agent definitions and health parameters. | - Create new service managing metadata validation and dynamic capability queries. | Bypassing valid fallback candidates when principal agent is degraded. | None |
| **`agentDispatcher.ts`** | *None* | Spawns agent execution threads based on registry lookup. | - Create new service executing tasks provider-agnostically. | UI blocking on heavy operations. | Agent Registry |
| **`modelRouter.ts`** | *None* | Scores target routes based on health, cost, and latency. | - Create new service routing to optimal model provider. | Misallocating route weights. | Performance History |
| **`executionAdapter.ts`** | *None* | Orchestrates the HTTP provider completion calls, back-off retry loops, and abort handlers. | - Create new service normalizing inputs/outputs via provider contracts. | Latency overhead during translation mappings. | Provider Adapters |
| **`providerAdapters/`** | *None* | Vendor-specific SDK wrappers for Gemini, OpenAI, and Claude. | - Create provider adapters wrapping model call parameters. | Vendor API change regressions. | LLM Client SDKs |
| **`performanceHistory.ts`** | *None* | Database logger storing token logs and feedback to adapt router scoring. | - Create database logger mapping execution parameters. | Ingestion bottlenecks. | Repository Layer |
| **`repositories/`** | Safe mock-fallback wrapper methods returning unconfigured payloads. | Active database repositories executing Supabase SQL transactions. | - Activate Supabase client connections.<br>- Write real-time select, update, and insert methods. | Connection drop-offs, database locks. | Supabase Client |
| **`AIChatModal.tsx`** | Conversational UI showing video card previews and buttons. | Executive console. Inputs intent and visualizes flowchart decision cards. | - Connect `generateDecisionPlan` callback. <br>- Render execution plan card widgets inline. | UI clutter during long pipelines. | `SparkContext` |
| **`MySpark.tsx`** | AI workspace showing prompts and mock briefings. | Operations room. Triggers research tasks and displays insights. | - Feed prompt actions directly to the decision engine. | Breaking layout responsiveness on mobile. | `SparkContext` |
