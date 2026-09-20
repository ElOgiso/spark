# SPARK Implementation Plan

Canonical phase register for `ElOgiso/spark`.

**Only Phase 0 is executed by the commit that introduced this file.**

Existing docs (`docs/IMPLEMENTATION_SEQUENCE.md`, `docs/IMPLEMENTATION_SPRINTS.md`, per-phase `docs/PHASE_*.md`) remain historical. This register is the forward plan. Do not create a third roadmap.

| Phase | Name | Status |
|---|---|---|
| 0 | Safe Implementation Baseline | THIS COMMIT — docs + inventory only |
| 1 | Architecture Consolidation | NEXT — not started |
| 2 | Canonical Semantic Contracts | later |
| 3 | ReferenceGraph + StyleBible | later |
| 4 | Craft / Creative Operations | later |
| 5 | Capability + Model Registry | later |
| 6 | Intelligent Model Routing | later |
| 7 | Cost Engine | later |
| 8 | Spark Credit Reservation & Settlement | later |
| 9 | Reliable Generation Execution | later |
| 10 | Provider Payload Compiler | later |
| 11 | Higgsfield Adapter Expansion | later |
| 12 | QC → Repair → Reroute | later |
| 13 | Format Directors / Production Modes | later |
| 14 | Long-Form Visual Planning | later |
| 15 | Audio Director | later |
| 16 | Video Understanding | later |
| 17 | Observability + Production Memory | later |
| 18 | Supabase Security & Data Hardening | later |
| 19 | Admin Economics & Operations | later |
| 20 | UI Integration | later |
| 21 | Full Production Validation | later |
| 22 | Production Readiness | later |

## Phase 0 scope

- Inspect live `main`
- Document both production paths
- Record invariants
- Record verification baseline
- Do **not** consolidate paths
- Do **not** redesign UI
- Do **not** mutate Supabase
- Do **not** spend provider money
- Do **not** implement ReferenceGraph, StyleBible, new ModelRouter, cost engine, credit reservation, new QC, FormatDirector, etc.

## Phase 1 prerequisite (handoff)

Phase 1 may begin only from this contract:

- Keep one ModelRouter
- Keep one credit ledger
- Choose a single generate authority and **migrate** live ProductionAssetService onto the spec/DAG spine (do not delete the live path until adapters carry behavior)
- Treat `src - Copy/` as non-authoritative clutter (do not extend it)
- Extend OS compilers; keep AssetService as executor
- No UI/nav redesign
