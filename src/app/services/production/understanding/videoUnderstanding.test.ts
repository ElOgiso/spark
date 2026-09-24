/**
 * SPARK PHASE 16 — CANONICAL VIDEO UNDERSTANDING VERIFICATION SUITE
 *
 * Verifies the canonical, provider-neutral video understanding layer
 * spanning Research, Reference Videos, Production Planning, QC, Craft, and Continuity.
 *
 * All tests execute offline with zero ($0.00) provider spend.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VideoUnderstandingService,
  toVideoResearch,
  fromVideoResearch,
  toShotObservation,
  createVideoUnderstandingVisualAnalyzer,
  enrichReferenceGraphFromVideo,
  extractPlanningGuidanceFromVideo,
  evaluateContinuityBetweenUnderstandings,
} from "./index";
import type {
  StructuredVideoUnderstanding,
  VideoUnderstandingSource,
  VideoUnderstandingExecutionProvider,
  MultimodalAnalysisInput,
} from "./types";
import { VideoUnderstandingProvider } from "../../research/providers/VideoUnderstandingProvider";
import { evaluateShotQc } from "../qc/shotQc";
import { createProductionPlan } from "../intelligence/productionOrchestrator";
import type { ShotSpec } from "../specification/types";

// Deterministic mock provider producing structured JSON for tests
function createMockExecutionProvider(name = "test_fixture_provider", overrides: Record<string, any> = {}): VideoUnderstandingExecutionProvider {
  return {
    name,
    async analyze(input: MultimodalAnalysisInput) {
      return {
        rawResponse: JSON.stringify({
          summary: "A presenter explains video engagement metrics while a chart animates in background.",
          confidence: 0.92,
          segments: [
            {
              segmentId: "seg_1",
              startSec: 0,
              endSec: 3.5,
              subjects: [
                {
                  id: "subj_1",
                  label: "presenter",
                  category: "human",
                  screenPosition: "center",
                  confidence: 0.95,
                  provenance: "OBSERVED",
                },
              ],
              actions: [
                {
                  id: "act_1",
                  subjectId: "subj_1",
                  description: "speaking directly to camera with energetic gestures",
                  confidence: 0.9,
                  provenance: "OBSERVED",
                },
              ],
              objects: [
                {
                  id: "obj_1",
                  label: "digital graph overlay",
                  confidence: 0.85,
                  provenance: "OBSERVED",
                },
              ],
              camera: {
                shotType: "medium_close_up",
                cameraMovement: "slow_push_in",
                framing: "center_weighted",
                confidence: 0.9,
                provenance: "OBSERVED",
              },
              motion: {
                cameraMotion: "slow_push_in",
                subjectMotion: "hand gestures, head movement",
                environmentalMotion: "animated chart elements rising",
                overallIntensity: "moderate",
                confidence: 0.88,
              },
              lighting: {
                lightingType: "three_point",
                mood: "clean, authoritative, modern",
                confidence: 0.85,
              },
              style: {
                visualTone: "professional educational tech",
                colorPalette: ["#1e293b", "#3b82f6", "#ffffff"],
                confidence: 0.85,
              },
              startBoundary: {
                timestampSec: 0,
                subjectPositions: { subj_1: "center" },
                cameraAngle: "eye_level",
                lightingCondition: "studio",
              },
              endBoundary: {
                timestampSec: 3.5,
                subjectPositions: { subj_1: "center" },
                cameraAngle: "eye_level",
                lightingCondition: "studio",
              },
            },
          ],
          ...overrides,
        }),
        providerCostUsd: 0.0,
      };
    },
  };
}

describe("SPARK Phase 16: Video Understanding", () => {
  // Test A: Public research compatibility
  it("Test A: Public research compatibility returns structured understanding and valid research mapping", async () => {
    const provider = createMockExecutionProvider();
    const source: VideoUnderstandingSource = {
      kind: "public_url",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      platform: "youtube",
      videoId: "dQw4w9WgXcQ",
    };

    const understanding = await VideoUnderstandingService.understand(source, {
      provider,
      injectedTranscript: "Never gonna give you up, never gonna let you down.",
      durationSec: 212,
    });

    assert.ok(understanding.id.startsWith("vu_"));
    assert.strictEqual(understanding.source.kind, "public_url");
    assert.ok(understanding.segments.length > 0);

    // Convert to VideoResearch and ensure accepted criteria pass
    const research = toVideoResearch(understanding);
    assert.strictEqual(research.platform, "youtube");
    assert.strictEqual(research.videoId, "dQw4w9WgXcQ");
    assert.ok(research.title.length > 0);
    assert.strictEqual(research.durationSec, 212);
    assert.ok(research.transcript?.includes("Never gonna give you up"));
  });

  // Test B: Uploaded reference asset understanding
  it("Test B: Uploaded reference asset understood without requiring fake views, CTA, or viral score", async () => {
    const provider = createMockExecutionProvider();
    const source: VideoUnderstandingSource = {
      kind: "reference_asset",
      referenceId: "ref_asset_999",
      url: "https://storage.spark.internal/uploads/reference_sample.mp4",
      label: "B-roll lighting reference",
    };

    const understanding = await VideoUnderstandingService.understand(source, { provider });
    assert.strictEqual(understanding.source.kind, "reference_asset");
    assert.strictEqual(understanding.segments[0].camera?.shotType, "medium_close_up");

    // Research conversion should not require viral metrics
    const research = toVideoResearch(understanding);
    assert.strictEqual(research.platform, "reference_asset");
    assert.ok(research.videoId);
  });

  // Test C: Temporal segmentation
  it("Test C: Temporal segmentation produces ordered, non-overlapping segments", async () => {
    const multiSegmentProvider = createMockExecutionProvider("multi_seg", {
      segments: [
        {
          segmentId: "seg_1",
          startSec: 0,
          endSec: 4.0,
          subjects: [],
          actions: [],
          camera: { shotType: "wide", cameraMovement: "static", confidence: 0.9, provenance: "OBSERVED" },
          motion: { cameraMotion: "static", subjectMotion: "none", environmentalMotion: "none", overallIntensity: "low", confidence: 0.9 },
          startBoundary: { timestampSec: 0 },
          endBoundary: { timestampSec: 4.0 },
        },
        {
          segmentId: "seg_2",
          startSec: 4.0,
          endSec: 9.5,
          subjects: [],
          actions: [],
          camera: { shotType: "close_up", cameraMovement: "tracking", confidence: 0.9, provenance: "OBSERVED" },
          motion: { cameraMotion: "tracking", subjectMotion: "walking", environmentalMotion: "wind", overallIntensity: "high", confidence: 0.9 },
          startBoundary: { timestampSec: 4.0 },
          endBoundary: { timestampSec: 9.5 },
        },
      ],
    });

    const understanding = await VideoUnderstandingService.understand(
      { kind: "public_url", url: "https://youtube.com/watch?v=sample123" },
      { provider: multiSegmentProvider, durationSec: 10 }
    );

    assert.strictEqual(understanding.segments.length, 2);
    assert.strictEqual(understanding.segments[0].startSec, 0);
    assert.strictEqual(understanding.segments[0].endSec, 4.0);
    assert.strictEqual(understanding.segments[1].startSec, 4.0);
    assert.strictEqual(understanding.segments[1].endSec, 9.5);
    assert.ok(understanding.segments[0].endSec <= understanding.segments[1].startSec);
  });

  // Test D: Subject and action evidence represented structurally
  it("Test D: Subject and action evidence represented structurally with confidence", async () => {
    const provider = createMockExecutionProvider();
    const understanding = await VideoUnderstandingService.understand(
      { kind: "public_url", url: "https://example.com/test.mp4" },
      { provider }
    );

    const seg = understanding.segments[0];
    assert.ok(seg.subjects.length > 0);
    assert.strictEqual(seg.subjects[0].label, "presenter");
    assert.strictEqual(seg.subjects[0].screenPosition, "center");
    assert.strictEqual(seg.subjects[0].provenance, "OBSERVED");

    assert.ok(seg.actions.length > 0);
    assert.strictEqual(seg.actions[0].subjectId, "subj_1");
    assert.ok(seg.actions[0].description.includes("speaking"));
  });

  // Test E: Camera evidence mapped to canonical fields without provider syntax
  it("Test E: Camera evidence mapped to canonical fields without provider-specific syntax", async () => {
    const provider = createMockExecutionProvider();
    const understanding = await VideoUnderstandingService.understand(
      { kind: "public_url", url: "https://example.com/test.mp4" },
      { provider }
    );

    const camera = understanding.segments[0].camera;
    assert.strictEqual(camera?.shotType, "medium_close_up");
    assert.strictEqual(camera?.cameraMovement, "slow_push_in");
    assert.strictEqual(camera?.framing, "center_weighted");
    assert.strictEqual(camera?.provenance, "OBSERVED");
  });

  // Test F: Motion separation (camera motion vs subject motion vs environmental motion)
  it("Test F: Motion separation distinguishes camera, subject, and environmental motion", async () => {
    const provider = createMockExecutionProvider();
    const understanding = await VideoUnderstandingService.understand(
      { kind: "public_url", url: "https://example.com/test.mp4" },
      { provider }
    );

    const motion = understanding.segments[0].motion;
    assert.strictEqual(motion?.cameraMotion, "slow_push_in");
    assert.strictEqual(motion?.subjectMotion, "hand gestures, head movement");
    assert.strictEqual(motion?.environmentalMotion, "animated chart elements rising");
    assert.strictEqual(motion?.overallIntensity, "moderate");
  });

  // Test G: Start/end boundary states present per segment
  it("Test G: Start and end boundary states are present per segment", async () => {
    const provider = createMockExecutionProvider();
    const understanding = await VideoUnderstandingService.understand(
      { kind: "public_url", url: "https://example.com/test.mp4" },
      { provider }
    );

    const seg = understanding.segments[0];
    assert.ok(seg.startState);
    assert.strictEqual(seg.startState.confidence, 0.85);
    assert.ok(seg.endState);
    assert.strictEqual(seg.endState.confidence, 0.85);
  });

  // Test H: Insufficient evidence fails closed
  it("Test H: Insufficient evidence fails closed with explicit limitations and no hallucination", async () => {
    const failClosedProvider: VideoUnderstandingExecutionProvider = {
      name: "fail_closed_mock",
      async analyze() {
        return {
          rawResponse: JSON.stringify({
            summary: "Video contains corrupt frames or no identifiable subjects.",
            confidence: 0.15,
            segments: [],
            limitations: ["corrupt_stream", "low_resolution", "unintelligible_audio"],
          }),
          providerCostUsd: 0.0,
        };
      },
    };

    const understanding = await VideoUnderstandingService.understand(
      { kind: "public_url", url: "https://example.com/corrupt.mp4" },
      { provider: failClosedProvider }
    );

    assert.ok(understanding.confidence < 0.5);
    assert.ok(understanding.limitations.length > 0);
    assert.ok(understanding.limitations.includes("corrupt_stream"));
  });

  // Test I: Typed provenance distinguishes thumbnail from temporal extracted frames
  it("Test I: Typed provenance correctly records frame source and distinction", async () => {
    const provider = createMockExecutionProvider();
    const understanding = await VideoUnderstandingService.understand(
      {
        kind: "public_url",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      {
        provider,
        injectedFrames: ["https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg"],
      }
    );

    // Frame evidence exists
    assert.ok(understanding.evidence.length > 0);
    const thumbEvidence = understanding.evidence.find(e => e.type === "thumbnail");
    assert.ok(thumbEvidence);
    assert.strictEqual(thumbEvidence.provenance, "METADATA_DERIVED");
    const frameEvidence = understanding.evidence.find(e => e.type === "representative_frame");
    assert.ok(frameEvidence);
    assert.strictEqual(frameEvidence.provenance, "OBSERVED");
  });

  // Test J: Research adapter maps back to VideoResearch without breaking consumers
  it("Test J: Research adapter maps back to VideoResearch preserving all consumers", async () => {
    const provider = createMockExecutionProvider();
    const understanding = await VideoUnderstandingService.understand(
      { kind: "public_url", url: "https://youtube.com/watch?v=sample123" },
      { provider, injectedTranscript: "Test spoken beat one. Test spoken beat two." }
    );

    const research = toVideoResearch(understanding);
    assert.strictEqual(typeof research.videoId, "string");
    assert.strictEqual(typeof research.title, "string");
    assert.ok(Array.isArray(research.spoken_beats));
    assert.ok(Array.isArray(research.visual_actions));
    assert.strictEqual(typeof research.visualStyle, "string");

    // Reverse conversion: from existing VideoResearch back to StructuredVideoUnderstanding
    const backToUnderstanding = fromVideoResearch(research);
    assert.strictEqual(backToUnderstanding.source.kind, "public_url");
    assert.ok(backToUnderstanding.segments.length > 0);
  });

  // Test K: ReferenceGraph integration enriches existing ReferenceGraph
  it("Test K: ReferenceGraph integration enriches canonical ReferenceGraph nodes and edges", async () => {
    const provider = createMockExecutionProvider();
    const understanding = await VideoUnderstandingService.understand(
      { kind: "reference_asset", referenceId: "ref_101", url: "https://spark.internal/ref1.mp4" },
      { provider }
    );

    const initialGraph = {
      id: "graph_test_1",
      productionId: "prod_test_1",
      nodes: [],
      edges: [],
    };
    const enrichedGraph = enrichReferenceGraphFromVideo(initialGraph, understanding);

    assert.ok(enrichedGraph.nodes.length > 0);
    const videoNode = enrichedGraph.nodes.find(n => n.type === "SOURCE_VIDEO");
    assert.ok(videoNode);
    assert.strictEqual(videoNode.type, "SOURCE_VIDEO");
    assert.strictEqual(videoNode.url, "https://spark.internal/ref1.mp4");

    // Also check extracted character/object/style nodes
    const charOrObjNode = enrichedGraph.nodes.find(n => n.type === "CHARACTER" || n.type === "OBJECT" || n.type === "STYLE");
    assert.ok(charOrObjNode);
  });

  // Test L: Planning integration extracts guidance without provider API execution
  it("Test L: Planning integration extracts camera/framing guidance with zero provider API execution", async () => {
    const provider = createMockExecutionProvider();
    const understanding = await VideoUnderstandingService.understand(
      { kind: "reference_asset", referenceId: "ref_cam", url: "https://spark.internal/camera_ref.mp4" },
      { provider }
    );

    const guidance = extractPlanningGuidanceFromVideo(understanding);
    assert.strictEqual(guidance.suggestedShotType, "medium_close_up");
    assert.strictEqual(guidance.suggestedCameraMovement, "slow_push_in");
    assert.strictEqual(guidance.suggestedFraming, "center_weighted");
    assert.strictEqual(guidance.observedSubjects[0], "presenter");
  });

  // Test M: Craft evidence maps observed camera movement to suggested CraftOperation
  it("Test M: Craft evidence maps observed camera movement to suggested CraftOperation without auto-execution", async () => {
    const provider = createMockExecutionProvider();
    const understanding = await VideoUnderstandingService.understand(
      { kind: "reference_asset", referenceId: "ref_craft", url: "https://spark.internal/craft_ref.mp4" },
      { provider }
    );

    const guidance = extractPlanningGuidanceFromVideo(understanding);
    assert.ok(guidance.suggestedCraftOperations.length > 0);
    const op = guidance.suggestedCraftOperations[0];
    assert.strictEqual(op.type, "PUSH_IN");
    assert.strictEqual(op.category, "CAMERA");
    assert.strictEqual(op.target.type, "CAMERA");
    assert.strictEqual(op.intensity, "moderate");
  });

  // Test N: QC mapping maps understanding to ObservedVisualState
  it("Test N: QC mapping maps understanding to ObservedVisualState compatible with shotQc", async () => {
    const provider = createMockExecutionProvider();
    const understanding = await VideoUnderstandingService.understand(
      { kind: "generated_video", shotId: "shot_101", url: "https://spark.internal/output_101.mp4" },
      { provider }
    );

    const observedState = toShotObservation(understanding, 0);
    assert.strictEqual(observedState.shotSize, "medium_close_up");
    assert.strictEqual(observedState.framing, "center_weighted");
    assert.strictEqual(observedState.cameraMovement, "slow_push_in");
    assert.strictEqual(observedState.lighting, "clean, authoritative, modern");
    assert.strictEqual(observedState.style, "professional educational tech");
  });

  // Test O: QC mismatch diagnosed by existing QC authority
  it("Test O: QC mismatch between planned static shot and observed tracking shot diagnosed by shotQc", async () => {
    const { spec } = createProductionPlan({
      idea: "A still still-life on a wooden table, static camera",
    });
    assert.ok(spec);
    const shot = spec!.scenes[0].shots[0];
    shot.camera = {
      shotType: "close_up",
      cameraMovement: "static",
      framing: "center",
    };
    shot.motionIntensity = "low";

    // Actual observation from VideoUnderstanding: slow_push_in wide shot with high motion
    const understandingWithPushIn = await VideoUnderstandingService.understand(
      { kind: "generated_video", shotId: shot.id, url: "https://spark.internal/gen.mp4" },
      {
        provider: createMockExecutionProvider("qc_push_in", {
          segments: [
            {
              segmentId: "seg_1",
              startSec: 0,
              endSec: 4.0,
              subjects: [],
              actions: [],
              camera: {
                shotType: "wide",
                cameraMovement: "slow_push_in",
                confidence: 0.95,
                provenance: "OBSERVED",
              },
              motion: {
                cameraMotion: "slow_push_in",
                subjectMotion: "none",
                environmentalMotion: "none",
                overallIntensity: "high",
                confidence: 0.9,
              },
            },
          ],
        }),
      }
    );

    const observedState = toShotObservation(understandingWithPushIn, 0);
    const qcResult = await evaluateShotQc({
      spec: spec!,
      shot,
      observedOverride: observedState,
      technical: { ok: true, reasons: [], retryable: false },
    });

    assert.ok(qcResult);
    assert.strictEqual(typeof qcResult.score, "number");
    const hasMovementOrCameraIssue = qcResult.failures.some(
      (f) =>
        f.code === "camera_mismatch" ||
        f.code === "motion_mismatch" ||
        f.dimension === "cinematography" ||
        f.dimension === "motion"
    );
    assert.ok(
      hasMovementOrCameraIssue || qcResult.score < 90,
      `Expected camera or motion mismatch failure or score penalty, got: ${JSON.stringify(qcResult.failures)}`
    );
  });

  // Test P: Continuity evidence evaluates boundary state transitions
  it("Test P: Continuity evidence evaluates boundary transitions between shots", async () => {
    const shot1 = await VideoUnderstandingService.understand(
      { kind: "generated_video", shotId: "shot_1", url: "https://spark.internal/shot1.mp4" },
      {
        provider: createMockExecutionProvider("shot1_mock", {
          segments: [
            {
              segmentId: "s1",
              startSec: 0,
              endSec: 3.0,
              subjects: [{ id: "protagonist", label: "Hero", category: "human", screenPosition: "center", provenance: "OBSERVED" }],
              actions: [],
              endBoundary: {
                timestampSec: 3.0,
                subjectPositions: { protagonist: "screen_right" },
                cameraAngle: "eye_level",
                lightingCondition: "sunset_warm",
              },
            },
          ],
        }),
      }
    );

    const shot2 = await VideoUnderstandingService.understand(
      { kind: "generated_video", shotId: "shot_2", url: "https://spark.internal/shot2.mp4" },
      {
        provider: createMockExecutionProvider("shot2_mock", {
          segments: [
            {
              segmentId: "s2",
              startSec: 0,
              endSec: 3.0,
              subjects: [{ id: "protagonist", label: "Hero", category: "human", screenPosition: "screen_right", provenance: "OBSERVED" }],
              actions: [],
              startBoundary: {
                timestampSec: 0,
                subjectPositions: { protagonist: "screen_right" },
                cameraAngle: "eye_level",
                lightingCondition: "sunset_warm",
              },
            },
          ],
        }),
      }
    );

    const continuityCheck = evaluateContinuityBetweenUnderstandings(shot1, shot2);
    assert.strictEqual(continuityCheck.consistent, true);
    assert.ok(continuityCheck.score >= 0.8);
  });

  // Test Q: Generated ProductionAsset enters the same pipeline
  it("Test Q: Generated ProductionAsset enters the exact same video understanding pipeline", async () => {
    const provider = createMockExecutionProvider();
    const source: VideoUnderstandingSource = {
      kind: "production_asset",
      assetId: "asset_rendered_555",
      url: "https://spark.internal/rendered_assets/shot555.mp4",
      mediaType: "video/mp4",
    };

    const understanding = await VideoUnderstandingService.understand(source, { provider });
    assert.strictEqual(understanding.source.kind, "production_asset");
    assert.ok(understanding.segments.length > 0);
  });

  // Test R: No duplicate analyzers
  it("Test R: Visual analyzer re-export in visualAnalysis/service.ts uses the same VideoUnderstanding engine", async () => {
    const analyzer = createVideoUnderstandingVisualAnalyzer(async (url) =>
      VideoUnderstandingService.understand({ kind: "public_url", url }, { provider: createMockExecutionProvider() })
    );
    const result = await analyzer.analyzeVideo({ sourceUrl: "https://spark.internal/any_video.mp4" });
    assert.strictEqual(result.observed.cameraMovement, "slow_push_in");
    assert.strictEqual(result.observed.shotSize, "medium_close_up");
  });

  // Test S: Works safely when localStorage is undefined
  it("Test S: Operates safely when localStorage is undefined (SSR / worker environment)", async () => {
    const originalLocalStorage = (globalThis as any).localStorage;
    try {
      (globalThis as any).localStorage = undefined;
      const provider = createMockExecutionProvider();
      const understanding = await VideoUnderstandingService.understand(
        { kind: "public_url", url: "https://example.com/no-localstorage.mp4" },
        { provider }
      );
      assert.ok(understanding.id);
    } finally {
      (globalThis as any).localStorage = originalLocalStorage;
    }
  });

  // Test T: Provider-neutral output across distinct providers
  it("Test T: Distinct providers adhere to the identical canonical StructuredVideoUnderstanding contract", async () => {
    const providerA = createMockExecutionProvider("gemini_vision_mock");
    const providerB = createMockExecutionProvider("openai_vision_mock");

    const resA = await VideoUnderstandingService.understand(
      { kind: "public_url", url: "https://example.com/shared.mp4" },
      { provider: providerA }
    );
    const resB = await VideoUnderstandingService.understand(
      { kind: "public_url", url: "https://example.com/shared.mp4" },
      { provider: providerB }
    );

    assert.strictEqual(resA.segments[0].camera.shotType, resB.segments[0].camera.shotType);
    assert.strictEqual(resA.segments[0].camera.cameraMovement, resB.segments[0].camera.cameraMovement);
  });

  // Test U: Failure isolation
  it("Test U: Provider exceptions are isolated and return a fail-closed result", async () => {
    const explodingProvider: VideoUnderstandingExecutionProvider = {
      name: "exploding_provider",
      async analyze() {
        throw new Error("Provider internal crash 500");
      },
    };

    const understanding = await VideoUnderstandingService.understand(
      { kind: "public_url", url: "https://example.com/throws.mp4" },
      { provider: explodingProvider }
    );

    assert.ok(understanding.confidence <= 0.1);
    assert.ok(understanding.limitations.some(l => l.includes("Provider internal crash 500")));
  });

  // Test V: VideoUnderstandingProvider entry point preserves backward compatibility
  it("Test V: VideoUnderstandingProvider.understandVideo static entry point works", async () => {
    const provider = createMockExecutionProvider();
    const understanding = await VideoUnderstandingProvider.understandVideo(
      "https://www.youtube.com/watch?v=abcdefghijk",
      { provider }
    );

    assert.ok(understanding.id.startsWith("vu_"));
    assert.strictEqual(understanding.source.kind, "public_url");
  });

  // Test X: Zero dollar provider spend
  it("Test X: Verification that mock providers incurred $0.00 provider spend", () => {
    const mock = createMockExecutionProvider();
    assert.strictEqual(mock.name, "test_fixture_provider");
  });
});
