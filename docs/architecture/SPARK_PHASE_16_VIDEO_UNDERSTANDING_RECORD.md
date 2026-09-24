# Phase 16 — Canonical Video Understanding Architecture Record

Date: 2026-09-24. Audited GitHub main: `609936a51e9f5919def798eb1025b393769aef2f` (feat(audio): integrate Phase 15 audio director with editorial timeline).
Program: SPARK Roadmap, Phase 16 Video Understanding.

---

## Core Architectural Authority & Law

> **SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.**

Phase 16 consolidates video understanding across SPARK without creating duplicate intelligence stacks:
- Research (`VideoUnderstandingProvider.ts` / `ResearchDepartmentService` / `ResearchSourceService`)
- Reference Assets (Uploaded user videos, brand references, style references)
- Production Planning (`PlanningGuidanceMapper` / `ShotSpec`)
- Craft Direction (`CraftOperation` suggestions / `CraftPlan`)
- Quality Control (`toShotObservation` / `evaluateShotQc` / `ObservedVisualState`)
- Continuity (`evaluateContinuityBetweenUnderstandings` / boundary state tracking)

All consumers share a single canonical evidence-based representation: `StructuredVideoUnderstanding`.

---

## Implemented Architecture

### 1. Unified Contracts (`src/app/services/production/understanding/types.ts`)
- `VideoUnderstandingSource`: Unifies `public_url`, `production_asset`, `reference_asset`, and `generated_video`.
- `EvidenceProvenance`: Factual provenance tracking (`OBSERVED`, `TRANSCRIPT_DERIVED`, `MODEL_INFERRED`, `METADATA_DERIVED`, `UNKNOWN`).
- `FrameEvidenceType`: Strict frame classification distinguishing `thumbnail` from `representative_frame`, `timestamped_extracted_frame`, and `user_supplied_frame`.
- `ObservedMotionState`: Explicit separation of `cameraMotion`, `subjectMotion`, and `environmentalMotion`.
- `ObservedBoundaryState`: Temporal boundary visual state (`startState`, `endState`) for video-to-video continuity and last-frame chaining.
- `StructuredVideoUnderstanding`: Ordered non-overlapping temporal segments (`VideoUnderstandingSegment`), synthesized summary, evidence references, overall confidence, and explicit failure limitations.

### 2. Canonical Video Understanding Service (`src/app/services/production/understanding/videoUnderstandingService.ts`)
- `VideoUnderstandingService.understand(source, options)`: Single point of ingestion and multimodal video analysis.
- Supports pluggable `VideoUnderstandingExecutionProvider` for deterministic offline testing ($0.00 spend).
- Fallback to `ModelRouter.executeCategoryRequest("videoUnderstanding", ...)` for live execution.
- Fail-closed behavior: Unparseable responses or errors yield explicit limitations (`limitations: [...]`) and zero confidence without hallucinated claims.

### 3. Subsystem Mappers & Adapters
- **Research Adapter (`researchAdapter.ts`)**:
  - `toVideoResearch(understanding)`: Converts canonical understanding into existing `VideoResearch` format, ensuring 100% backward compatibility with `researchWatchWinners.test.ts`, `researchSourceService.ts`, and `researchDepartmentService.ts`.
  - `fromVideoResearch(research)`: Reconstructs canonical `StructuredVideoUnderstanding` from existing research objects.
- **QC Mapper (`qcMapper.ts`)**:
  - `toShotObservation(understanding, segmentIndex)`: Maps understanding into canonical `ObservedVisualState` for direct consumption by `evaluateShotQc`.
  - `createVideoUnderstandingVisualAnalyzer(fn)`: Plugs into `VisualAnalysisService` without duplicate vision analyzers.
- **ReferenceGraph Integration (`referenceGraphMapper.ts`)**:
  - `enrichReferenceGraphFromVideo(graph, understanding)`: Extracts and links `SOURCE_VIDEO`, `CHARACTER`, `LOCATION`, `OBJECT`, `STYLE`, `START_FRAME`, and `END_FRAME` nodes directly into the existing canonical `ReferenceGraph`.
- **Planning Guidance (`planningGuidanceMapper.ts`)**:
  - `extractPlanningGuidanceFromVideo(understanding)`: Extracts shotType, camera movement, framing, lighting, actions, and subjects.
  - Suggests registered `CraftOperation`s (e.g. `PUSH_IN`, `PAN`, `TILT`, `TRACK`) without automatic provider execution.
- **Continuity Evidence (`continuityEvidence.ts`)**:
  - `evaluateContinuityBetweenUnderstandings(shotA, shotB)`: Compares `shotA.endState` with `shotB.startState` to evaluate spatial and visual consistency across shot cuts.

---

## Verification & Test Evidence

1. **Phase 16 Test Suite (`src/app/services/production/understanding/videoUnderstanding.test.ts`)**:
   - 23/23 tests passing:
     - Test A: Public research compatibility returns structured understanding and valid research mapping.
     - Test B: Uploaded reference asset understood without requiring fake views, CTA, or viral score.
     - Test C: Temporal segmentation produces ordered, non-overlapping segments.
     - Test D: Subject and action evidence represented structurally with confidence.
     - Test E: Camera evidence mapped to canonical fields without provider-specific syntax.
     - Test F: Motion separation distinguishes camera, subject, and environmental motion.
     - Test G: Start and end boundary states are present per segment.
     - Test H: Insufficient evidence fails closed with explicit limitations and no hallucination.
     - Test I: Typed provenance correctly records frame source and distinction.
     - Test J: Research adapter maps back to VideoResearch preserving all consumers.
     - Test K: ReferenceGraph integration enriches canonical ReferenceGraph nodes and edges.
     - Test L: Planning integration extracts camera/framing guidance with zero provider API execution.
     - Test M: Craft evidence maps observed camera movement to suggested CraftOperation without auto-execution.
     - Test N: QC mapping maps understanding to ObservedVisualState compatible with shotQc.
     - Test O: QC mismatch between planned static shot and observed tracking shot diagnosed by shotQc.
     - Test P: Continuity evidence evaluates boundary transitions between shots.
     - Test Q: Generated ProductionAsset enters the exact same video understanding pipeline.
     - Test R: Visual analyzer re-export in visualAnalysis/service.ts uses the same VideoUnderstanding engine.
     - Test S: Operates safely when localStorage is undefined (SSR / worker environment).
     - Test T: Distinct providers adhere to the identical canonical StructuredVideoUnderstanding contract.
     - Test U: Provider exceptions are isolated and return a fail-closed result.
     - Test V: VideoUnderstandingProvider.understandVideo static entry point works.
     - Test X: Verification that mock providers incurred $0.00 provider spend.

2. **Full Repository Verification**:
   - `npm test`: 1,335 tests passing across 294 test suites (0 failures, 0 skipped).
   - `npm run typecheck`: 0 TypeScript errors across the entire codebase.
   - `npm run build`: Production Next.js / Vite build completed successfully in 1m 10s.
   - Provider spend: $0.00 (all tests deterministic and offline).
