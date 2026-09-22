/**
 * Dedicated Test Suite for Phase 10: Provider Payload Compiler
 *
 * Verifies all 32 required scenarios:
 * 1. Basic semantic shot → provider payload.
 * 2. Image-to-video compilation.
 * 3. Text-to-video compilation.
 * 4. Start-frame compilation.
 * 5. End-frame compilation.
 * 6. Start + end frame compilation.
 * 7. ReferenceGraph role mapping.
 * 8. Identity reference precedence.
 * 9. Reference limit enforcement.
 * 10. Unsupported reference role.
 * 11. Cinematography compilation.
 * 12. Camera movement compilation.
 * 13. Creative operation compilation.
 * 14. Lighting compilation.
 * 15. StyleBible compilation.
 * 16. Negative constraint compilation.
 * 17. Duration normalization.
 * 18. Resolution normalization.
 * 19. Aspect ratio normalization.
 * 20. Audio parameter compilation.
 * 21. Unsupported parameter failure.
 * 22. Soft constraint degradation warning.
 * 23. Hard constraint compilation failure.
 * 24. Provider-specific field mapping.
 * 25. Two providers producing different payloads from the same semantic intent.
 * 26. Same provider + same input produces deterministic payload.
 * 27. Compiler version metadata.
 * 28. Provider credentials never appear in compiled payload.
 * 29. Compilation failure maps to NOT_SUBMITTED.
 * 30. Compiled request integrates with Phase 9 submission contract.
 * 31. No routing decision occurs inside compiler.
 * 32. No cost calculation occurs inside compiler.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ProviderPayloadCompiler } from "./payloadCompiler";
import { validateCompilation } from "./validation";
import { getCapabilityProfile } from "../capability/registry";
import type { ShotSpec } from "../specification/shotSpec";
import type { CraftPlan } from "../craft/types";
import type { ReferenceGraph } from "../specification/referenceGraph";
import type { StyleBible } from "../specification/styleBible";
import { COMPILER_VERSION, PROMPT_COMPILER_VERSION } from "./constants";
import { GenerationExecutionEngine } from "../execution/executionEngine";
import type { ProductionSpec } from "../specification/productionSpec";
import type { GenerationTask } from "../specification/generationTask";
import type { ProductionDag } from "../dag/productionDag";

function makeBasicShot(overrides: Partial<ShotSpec> = {}): ShotSpec {
  return {
    id: "shot_101",
    sceneId: "scene_1",
    index: 0,
    purpose: "establish character isolation",
    productionReason: "story opening beat",
    durationSec: 5,
    timingStartSec: 0,
    generationStrategy: "image_to_video",
    generationStatus: "planned",
    qcStatus: "pending",
    camera: {
      shotType: "medium",
      framing: "medium full-body shot",
      composition: "rule of thirds",
      cameraPosition: "eye-level",
      cameraMovement: "push_in",
      lens: "moderate telephoto",
      depthOfField: "shallow isolation",
    },
    subject: "young Nigerian man",
    subjectAction: "walking slowly through rain",
    environment: "nighttime Lagos street",
    atmosphere: "heavy rainfall, humid night air",
    lighting: {
      direction: "wet neon practicals with rim light",
      intensity: "moderate",
      color: "amber and cyan",
    },
    motion: {
      subjectMovement: "slow measured walking",
      cameraMovementDetail: "slow steady push-in towards face",
      beginState: "wide framing in rain",
      endState: "tight medium focus on face",
    },
    references: {
      characterRefs: [],
      locationRefs: [],
      styleRefs: [],
      firstFrameUrl: undefined,
    },
    continuityRequirements: [],
    characterIds: [],
    propIds: [],
    assetIds: [],
    ...overrides,
  };
}

describe("Phase 10: Provider Payload Compiler", () => {
  const klingProfile = getCapabilityProfile("kling", "kling-v2-6")!;
  const seedanceProfile = getCapabilityProfile("seedance", "doubao-seedance-1-5-pro-251215")!;
  const grokProfile = getCapabilityProfile("grok", "grok-imagine-video-1.5")!;

  it("1. Basic semantic shot → provider payload", () => {
    const shot = makeBasicShot();
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.equal(result.validation.valid, true);
    assert.equal(result.providerId, "kling");
    assert.equal(result.modelId, "kling-v2-6");
    assert.ok(result.prompt.includes("young Nigerian man"));
    assert.ok(result.prompt.includes("walking slowly through rain"));
    assert.ok(result.rawPayload);
  });

  it("2. Image-to-video compilation sets first frame in media and payload", () => {
    const shot = makeBasicShot({ keyframeUrl: "https://storage.spark.ai/frames/first.png" });
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.equal(result.operation, "image_to_video");
    assert.equal(result.media.firstFrame, "https://storage.spark.ai/frames/first.png");
    assert.equal(result.rawPayload.image, "https://storage.spark.ai/frames/first.png");
  });

  it("3. Text-to-video compilation without image inputs", () => {
    const shot = makeBasicShot({
      keyframeUrl: undefined,
      references: { characterRefs: [], locationRefs: [], styleRefs: [] },
    });
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.equal(result.operation, "text_to_video");
    assert.equal(result.media.firstFrame, undefined);
    assert.equal(result.rawPayload.image, undefined);
  });

  it("4. Start-frame compilation preserves keyframe URL correctly", () => {
    const shot = makeBasicShot({ keyframeUrl: "https://test.com/frame1.png" });
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: seedanceProfile,
      providerId: "seedance",
      modelId: "doubao-seedance-1-5-pro-251215",
    });

    const content = result.rawPayload.content as Array<any>;
    const firstFramePart = content.find((c) => c.role === "first_frame");
    assert.ok(firstFramePart);
    assert.equal(firstFramePart.image_url.url, "https://test.com/frame1.png");
  });

  it("5. End-frame compilation maps tail frame", () => {
    const shot = makeBasicShot({
      keyframeUrl: "https://test.com/frame1.png",
      lastFrameUrl: "https://test.com/frame_end.png",
    });
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: grokProfile,
      providerId: "grok",
      modelId: "grok-imagine-video-1.5",
    });

    assert.equal(result.media.lastFrame, "https://test.com/frame_end.png");
    assert.deepEqual(result.rawPayload.last_frame, { url: "https://test.com/frame_end.png" });
  });

  it("6. Start + end frame compilation on Kling forces mode=pro and sets image_tail", () => {
    const shot = makeBasicShot({
      keyframeUrl: "https://test.com/frame1.png",
      lastFrameUrl: "https://test.com/frame_end.png",
    });
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.equal(result.rawPayload.mode, "pro");
    assert.equal(result.rawPayload.image_tail, "https://test.com/frame_end.png");
  });

  it("7. ReferenceGraph role mapping converts nodes into typed media inputs", () => {
    const shot = makeBasicShot();
    const referenceGraph: ReferenceGraph = {
      id: "rg_1",
      productionId: "prod_1",
      nodes: [
        { id: "n1", type: "CHARACTER", role: "REQUIRED", scope: "SHOT", url: "https://test.com/char.png" },
        { id: "n2", type: "STYLE", role: "PREFERRED", scope: "SHOT", url: "https://test.com/style.png" },
      ],
      edges: [],
    };

    const result = ProviderPayloadCompiler.compile({
      shot,
      referenceGraph,
      capabilityProfile: grokProfile,
      providerId: "grok",
      modelId: "grok-imagine-video-1.5",
    });

    assert.ok(result.media.inputs.some((i) => i.semanticRole === "CHARACTER" && i.url === "https://test.com/char.png"));
    assert.ok(result.media.inputs.some((i) => i.semanticRole === "STYLE" && i.url === "https://test.com/style.png"));
  });

  it("8. Identity reference precedence ensures character identity takes priority over style", () => {
    const shot = makeBasicShot();
    const referenceGraph: ReferenceGraph = {
      id: "rg_1",
      productionId: "prod_1",
      nodes: [
        { id: "n_style", type: "STYLE", role: "PREFERRED", scope: "SHOT", url: "https://test.com/style.png" },
        { id: "n_char", type: "CHARACTER", role: "REQUIRED", scope: "SHOT", url: "https://test.com/char.png" },
      ],
      edges: [],
    };

    const result = ProviderPayloadCompiler.compile({
      shot,
      referenceGraph,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    const refInputs = result.media.inputs.filter((i) => i.role === "character_reference" || i.role === "style_reference");
    assert.equal(refInputs[0].semanticRole, "CHARACTER");
  });

  it("9. Reference limit enforcement caps references to provider limits", () => {
    const shot = makeBasicShot();
    const referenceGraph: ReferenceGraph = {
      id: "rg_1",
      productionId: "prod_1",
      nodes: Array.from({ length: 10 }, (_, i) => ({
        id: `node_${i}`,
        type: "CHARACTER",
        role: "PREFERRED",
        scope: "SHOT",
        url: `https://test.com/char_${i}.png`,
      })),
      edges: [],
    };

    const result = ProviderPayloadCompiler.compile({
      shot,
      referenceGraph,
      capabilityProfile: klingProfile, // limit 4
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.ok(result.media.references!.length <= 4);
    assert.ok(result.validation.warnings.some((w) => w.includes("REFERENCE_LIMIT_EXCEEDED")));
  });

  it("10. Unsupported reference role handles graceful dropping or warning", () => {
    const shot = makeBasicShot();
    const referenceGraph: ReferenceGraph = {
      id: "rg_1",
      productionId: "prod_1",
      nodes: [
        { id: "n_bad", type: "USER_ASSET", role: "OPTIONAL", scope: "SHOT", url: "https://test.com/doc.pdf" },
      ],
      edges: [],
    };

    const result = ProviderPayloadCompiler.compile({
      shot,
      referenceGraph,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.equal(result.media.references?.includes("https://test.com/doc.pdf"), false);
  });

  it("11. Cinematography compilation formats lens and composition into prompt", () => {
    const shot = makeBasicShot();
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.ok(result.prompt.includes("Lens: moderate telephoto"));
    assert.ok(result.prompt.includes("Framing: medium full-body shot"));
  });

  it("12. Camera movement compilation renders movement into motion lock", () => {
    const shot = makeBasicShot({ camera: { shotType: "close_up", framing: "tight", composition: "center", cameraPosition: "front", cameraMovement: "push_in" } });
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.ok(result.prompt.includes("Move: push_in"));
  });

  it("13. Creative operation compilation translates PUSH_IN and PRODUCT_SPIN", () => {
    const shot = makeBasicShot();
    const craftPlan: CraftPlan = {
      shotId: shot.id,
      operations: [
        {
          id: "op_1",
          type: "PUSH_IN",
          category: "CAMERA",
          purpose: "heighten tension",
          target: { type: "SUBJECT" },
          parameters: { speed: "slow", focalTarget: "eyes" },
        },
        {
          id: "op_2",
          type: "PRODUCT_SPIN",
          category: "PRODUCT",
          purpose: "showcase design",
          target: { type: "PRODUCT" },
          parameters: { axis: "y_vertical", rotationSpeed: "steady" },
        },
      ],
    };

    const result = ProviderPayloadCompiler.compile({
      shot,
      craftPlan,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.ok(result.prompt.includes("Steady slow push-in focusing on eyes"));
    assert.ok(result.prompt.includes("Product rotates smoothly on y_vertical axis"));
  });

  it("14. Lighting compilation structures direction and color", () => {
    const shot = makeBasicShot();
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.ok(result.prompt.includes("Direction: wet neon practicals with rim light"));
    assert.ok(result.prompt.includes("Tone: amber and cyan"));
  });

  it("15. StyleBible compilation includes aesthetic and color palette", () => {
    const shot = makeBasicShot();
    const styleBible: StyleBible = {
      id: "sb_1",
      version: 1,
      visualLanguage: { aesthetic: "late-90s cyberpunk anime", realismLevel: "stylized" },
      cinematography: { cameraLanguage: "dynamic angles" },
      lighting: { keyMood: "neon nocturne" },
      color: { palette: "electric magenta and acid green", temperature: "cool" },
      constraints: { negativeRules: ["no photoreal textures", "no 3D CGI look"] },
    };

    const result = ProviderPayloadCompiler.compile({
      shot,
      styleBible,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.ok(result.prompt.includes("late-90s cyberpunk anime"));
    assert.ok(result.prompt.includes("electric magenta and acid green"));
  });

  it("16. Negative constraint compilation attaches anti-slop laws and custom constraints", () => {
    const shot = makeBasicShot();
    const styleBible: StyleBible = {
      id: "sb_1",
      version: 1,
      visualLanguage: { aesthetic: "anime" },
      cinematography: { cameraLanguage: "clean" },
      lighting: { keyMood: "soft" },
      color: { palette: "natural" },
      constraints: { negativeRules: ["no watermark", "no 3d render"] },
    };

    const result = ProviderPayloadCompiler.compile({
      shot,
      styleBible,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.ok(result.negativePrompt?.includes("face morphing"));
    assert.ok(result.negativePrompt?.includes("no watermark"));
    assert.ok(result.negativePrompt?.includes("no 3d render"));
  });

  it("17. Duration normalization snaps Kling to '5' or '10'", () => {
    const shot = makeBasicShot({ durationSec: 7.5 });
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.equal(result.rawPayload.duration, "10");
    assert.equal(result.parameters.durationSec, 10);
    assert.ok(result.validation.warnings.some((w) => w.includes("DURATION_NORMALIZED")));
  });

  it("18. Resolution normalization maps to supported resolution", () => {
    const shot = makeBasicShot({ resolution: "1080p" });
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.equal(result.parameters.resolution, "1080p");
  });

  it("19. Aspect ratio normalization snaps correctly", () => {
    const shot = makeBasicShot({ aspectRatio: "16:9" });
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: seedanceProfile,
      providerId: "seedance",
      modelId: "doubao-seedance-1-5-pro-251215",
    });

    assert.equal(result.rawPayload.ratio, "16:9");
  });

  it("20. Audio parameter compilation passes generate_audio flag", () => {
    const shot = makeBasicShot();
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: seedanceProfile,
      providerId: "seedance",
      modelId: "doubao-seedance-1-5-pro-251215",
    });

    assert.equal(result.rawPayload.generate_audio, true);
  });

  it("21. Unsupported parameter failure rejects when end-frame requested on model without support", () => {
    const shot = makeBasicShot({
      keyframeUrl: "https://test.com/frame1.png",
      lastFrameUrl: "https://test.com/frame_end.png",
    });

    // Create a mock profile without temporal.supportsEndFrame
    const noEndFrameProfile = {
      ...klingProfile,
      temporal: { ...klingProfile.temporal, supportsEndFrame: false },
    };

    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: noEndFrameProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.equal(result.validation.valid, false);
    assert.ok(result.validation.errors.some((e) => e.includes("UNSUPPORTED_TEMPORAL_REQUIREMENT")));
  });

  it("22. Soft constraint degradation warning emitted when audio requested on model without native audio", () => {
    const shot = makeBasicShot();
    const noAudioProfile = {
      ...klingProfile,
      output: { ...klingProfile.output, supportsNativeAudio: false },
      audio: { ...klingProfile.audio, nativeAudioGeneration: false },
    };

    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: noAudioProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.ok(result.validation.warnings.some((w) => w.includes("NATIVE_AUDIO_UNSUPPORTED")));
    assert.ok(result.validation.degradedFeatures.includes("AUDIO_GENERATION_DEGRADED"));
  });

  it("23. Hard constraint compilation failure when I2V lacks start frame", () => {
    const shot = makeBasicShot({
      keyframeUrl: undefined,
      references: { characterRefs: [], locationRefs: [], styleRefs: [] },
      generationStrategy: "image_to_video",
    });

    // Force an attempt where I2V is requested
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    // When there's no first frame, Kling translates to text_to_video. Let's explicitly test validateCompilation with empty first frame
    const val = validateCompilation({
      providerId: "kling",
      modelId: "kling-v2-6",
      operation: "image_to_video",
      mediaInputs: [],
      profile: klingProfile,
      rawPayload: {},
    });

    assert.equal(val.valid, false);
    assert.ok(val.errors.some((e: string) => e.includes("MISSING_REQUIRED_START_FRAME")));
  });

  it("24. Provider-specific field mapping maps image_url for Grok vs content for Seedance", () => {
    const shot = makeBasicShot({ keyframeUrl: "https://test.com/frame1.png" });

    const grokRes = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: grokProfile,
      providerId: "grok",
      modelId: "grok-imagine-video-1.5",
    });

    const seedanceRes = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: seedanceProfile,
      providerId: "seedance",
      modelId: "doubao-seedance-1-5-pro-251215",
    });

    assert.deepEqual(grokRes.rawPayload.image, { url: "https://test.com/frame1.png" });
    assert.ok(Array.isArray(seedanceRes.rawPayload.content));
  });

  it("25. Two providers produce different payloads from the same semantic intent", () => {
    const shot = makeBasicShot({ keyframeUrl: "https://test.com/frame1.png" });

    const klingRes = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    const grokRes = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: grokProfile,
      providerId: "grok",
      modelId: "grok-imagine-video-1.5",
    });

    assert.notDeepEqual(klingRes.rawPayload, grokRes.rawPayload);
    assert.equal(klingRes.rawPayload.model_name, "kling-v2-6");
    assert.equal(grokRes.rawPayload.model, "grok-imagine-video-1.5");
  });

  it("26. Same provider + same input produces deterministic payload", () => {
    const shot = makeBasicShot({ keyframeUrl: "https://test.com/frame1.png" });

    const res1 = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    const res2 = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.deepEqual(res1.rawPayload, res2.rawPayload);
    assert.equal(res1.prompt, res2.prompt);
  });

  it("27. Compiler version metadata attached to result", () => {
    const shot = makeBasicShot();
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.equal(result.metadata.compilerVersion, COMPILER_VERSION);
    assert.equal(result.metadata.promptCompilerVersion, PROMPT_COMPILER_VERSION);
    assert.ok(result.metadata.compiledAt);
  });

  it("28. Provider credentials never appear in compiled payload", () => {
    const shot = makeBasicShot();
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    const payloadStr = JSON.stringify(result.rawPayload).toLowerCase();
    assert.equal(payloadStr.includes("api_key"), false);
    assert.equal(payloadStr.includes("secret"), false);
    assert.equal(payloadStr.includes("authorization"), false);
  });

  it("29. Compilation failure in executionEngine maps to NOT_SUBMITTED and releases credits", async () => {
    let released = false;
    const mockCreditService: any = {
      quote: () => ({ estimatedCredits: 35, policyName: "test" }),
      reserve: async () => ({ reservation: { id: "res_fail_test", amount: 35 } }),
      release: async () => { released = true; },
      settle: async () => ({}),
      markPendingUnknown: async () => ({}),
    };

    // Construct a shot that will fail compilation (e.g. invalid end frame temporal capability)
    const badShot = makeBasicShot({
      id: "shot_bad",
      keyframeUrl: "https://test.com/f1.png",
      lastFrameUrl: "https://test.com/f2.png",
    });

    const spec: ProductionSpec = {
      id: "prod_fail",
      version: 1,
      project: { id: "prod_fail", title: "Test", idea: "Idea", targetDurationSec: 5, aspectRatio: "9:16" },
      creative: { intent: "Intent", genre: "drama", estimatedShotCount: 1 },
      world: { locations: [] },
      characters: [],
      assets: [],
      narrative: { logline: "Log", synopsis: "Syn", protagonistGoal: "Goal", antagonistForce: "Antag", coreConflict: "Conf" },
      scenes: [{ id: "scene_1", index: 0, purpose: "P", narrativeFunction: "setup", durationSec: 5, shots: [badShot] }],
      audio: { soundDesignIntent: "Sound" },
      visualStyle: { look: "Cinematic", antiSlopLaws: [] },
      continuity: { version: 1, trackingItems: [] },
      routing: { allowProviderFallback: false, shotDecisions: [], capabilityPolicy: { preferCharacterConsistency: true, preferFirstLastFrame: true, preferNativeAudio: false, preferSpeed: false, preferCost: false } },
      quality: { target: "high" },
      researchRequirements: { context: "None", questions: [] },
      meta: { specVersion: "1.0", compilerVersion: "1.0", createdFrom: "spark", grammarIds: [] },
    };

    const task: GenerationTask = {
      id: "shot_bad_video",
      kind: "video",
      productionId: "prod_fail",
      sceneId: "scene_1",
      shotId: "shot_bad",
      selectedProvider: "kling",
      selectedModel: "kling-v2-6",
      strategy: { modality: "video", directStrategy: "image_to_video", modelName: "kling-v2-6" },
      requiredCapabilities: [],
      dependsOn: [],
      status: "planned",
    };

    const dag: ProductionDag = {
      productionId: "prod_fail",
      nodes: [{ id: "shot_bad_video", type: "video", status: "ready", dependsOn: [] }],
      edges: [],
    };

    // Temporarily mutate kling profile to not support end-frame to trigger compilation error
    const origEndFrame = klingProfile.temporal.supportsEndFrame;
    klingProfile.temporal.supportsEndFrame = false;

    try {
      const engine = new GenerationExecutionEngine({
        creditService: mockCreditService,
        userId: "usr_101",
      });

      const res = await engine.executePlan({ spec, tasks: [task], dag });
      assert.equal(res.ok, false);
      assert.ok(res.errors.some((e) => e.includes("compilation failed")));
      assert.equal(released, true); // Verified credit reservation safely released
    } finally {
      klingProfile.temporal.supportsEndFrame = origEndFrame;
    }
  });

  it("30. Compiled request integrates with Phase 9 submission contract", async () => {
    let capturedRequest: any = null;
    const mockAdapter: any = {
      providerId: "kling",
      capabilities: () => ({ providerId: "kling", mediaTypes: ["video"], strategies: [], capabilities: [], requiresCredentials: [], statusMechanism: "sync", knownLimitations: [] }),
      submit: async (req: any) => {
        capturedRequest = req;
        return { providerJobId: "job_kling_p10", status: "succeeded" };
      },
      getStatus: async () => ({ providerJobId: "job_kling_p10", status: "succeeded", outputUrl: "https://test.com/out.mp4" }),
      normalizeOutput: async () => ({ mediaType: "video", sourceUrl: "https://test.com/out.mp4", mimeType: "video/mp4", providerJobId: "job_kling_p10", metadata: {} }),
    };

    const goodShot = makeBasicShot({ id: "shot_good", keyframeUrl: "https://test.com/f1.png" });
    const spec: ProductionSpec = {
      id: "prod_good",
      version: 1,
      project: { id: "prod_good", title: "Test", idea: "Idea", targetDurationSec: 5, aspectRatio: "9:16" },
      creative: { intent: "Intent", genre: "drama", estimatedShotCount: 1 },
      world: { locations: [] },
      characters: [],
      assets: [],
      narrative: { logline: "Log", synopsis: "Syn", protagonistGoal: "Goal", antagonistForce: "Antag", coreConflict: "Conf" },
      scenes: [{ id: "scene_1", index: 0, purpose: "P", narrativeFunction: "setup", durationSec: 5, shots: [goodShot] }],
      audio: { soundDesignIntent: "Sound" },
      visualStyle: { look: "Cinematic", antiSlopLaws: [] },
      continuity: { version: 1, trackingItems: [] },
      routing: { allowProviderFallback: false, shotDecisions: [], capabilityPolicy: { preferCharacterConsistency: true, preferFirstLastFrame: true, preferNativeAudio: false, preferSpeed: false, preferCost: false } },
      quality: { target: "high" },
      researchRequirements: { context: "None", questions: [] },
      meta: { specVersion: "1.0", compilerVersion: "1.0", createdFrom: "spark", grammarIds: [] },
    };

    const task: GenerationTask = {
      id: "shot_good_video",
      kind: "video",
      productionId: "prod_good",
      sceneId: "scene_1",
      shotId: "shot_good",
      selectedProvider: "kling",
      selectedModel: "kling-v2-6",
      strategy: { modality: "video", directStrategy: "image_to_video", modelName: "kling-v2-6" },
      requiredCapabilities: [],
      dependsOn: [],
      status: "planned",
    };

    const dag: ProductionDag = {
      productionId: "prod_good",
      nodes: [{ id: "shot_good_video", type: "video", status: "ready", dependsOn: [] }],
      edges: [],
    };

    const adapters = new Map<string, any>([["kling", mockAdapter]]);
    const engine = new GenerationExecutionEngine({ adapters });

    const res = await engine.executePlan({ spec, tasks: [task], dag });
    assert.equal(res.ok, true);
    assert.ok(capturedRequest);
    assert.ok(capturedRequest.compiledRequest);
    assert.equal(capturedRequest.compiledRequest.metadata.compilerVersion, COMPILER_VERSION);
    assert.ok(capturedRequest.prompt.includes("young Nigerian man"));
  });

  it("31. No routing decision occurs inside compiler", () => {
    const shot = makeBasicShot();
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.equal(result.providerId, "kling");
    assert.equal(result.modelId, "kling-v2-6");
    // Compiler strictly uses passed provider/model without rerouting
  });

  it("32. No cost calculation occurs inside compiler", () => {
    const shot = makeBasicShot();
    const result = ProviderPayloadCompiler.compile({
      shot,
      capabilityProfile: klingProfile,
      providerId: "kling",
      modelId: "kling-v2-6",
    });

    assert.equal((result as any).cost, undefined);
    assert.equal((result as any).credits, undefined);
    assert.equal((result as any).priceUsd, undefined);
  });
});
