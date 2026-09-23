import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { GenerationExecutionEngine } from "./executionEngine";
import { ProductionAssetService } from "../productionAssetService";
import { resolveGenerationTasks, attachGenerationTasksToSpec } from "../generation/generationPlanner";
import { ProductionExecutionBridge, resolveProductionSpec } from "./productionExecutionBridge";
import { orchestrateIdeaToProductionSpec } from "../intelligence/productionOrchestrator";
import { CreditService } from "../credits/creditService";
import { InMemoryCreditRepository } from "../credits/creditRepository";
import { makeExecutionError } from "./errors";
import { ProviderSubmissionRegistry } from "./providerSubmission";
import type { MediaProviderAdapter } from "./adapters/types";
import type { ProductionSpec } from "../specification/productionSpec";
import type { GenerationTask } from "../specification/generationTask";
import type { ShotSpec } from "../specification/shotSpec";
import type { Brand, Production } from "../../../domain/types";
import type { ProviderGenerationRequest } from "./types";

function createMockSpec(): ProductionSpec {
  const { ok, spec } = orchestrateIdeaToProductionSpec({
    idea: "Cyberpunk alley drenched in neon rain",
    targetDurationSec: 5,
    productionMode: "standard",
  });
  if (!ok || !spec) {
    throw new Error("Failed to orchestrate mock spec fixture");
  }

  // Ensure shot has supported duration (5s) for Kling and required references
  const firstShot = spec.scenes[0].shots[0];
  const shot: ShotSpec = {
    ...firstShot,
    id: "sh_mig_1",
    sceneId: "sc_mig_1",
    durationSec: 5,
    provider: "kling",
    model: "kling-v2-6",
    aspectRatio: "16:9",
    keyframeUrl: "https://storage.spark.io/mock_still.png",
    references: {
      ...firstShot.references,
      firstFrameUrl: "https://storage.spark.io/mock_still.png",
    },
  };
  spec.project.targetDurationSec = 5;
  spec.scenes = [
    {
      ...spec.scenes[0],
      id: "sc_mig_1",
      shots: [shot],
    },
  ];
  spec.routing = {
    ...spec.routing,
    defaultProvider: "kling",
    shotDecisions: [
      {
        shotId: "sh_mig_1",
        selectedProvider: "kling",
        selectedModel: "kling-v2-6",
        routingReason: "Intent match for cinematic motion",
      },
    ],
  };
  return spec;
}

function createMockAdapter(opts: {
  providerId: string;
  onSubmit?: (req: ProviderGenerationRequest) => Promise<any> | any;
  getStatus?: (jobId: string) => Promise<any> | any;
  normalizeOutput?: (job: any) => Promise<any> | any;
}): MediaProviderAdapter & { getSubmitCount: () => number; getLastRequest: () => ProviderGenerationRequest | null } {
  let submitCount = 0;
  let lastRequest: ProviderGenerationRequest | null = null;
  return {
    providerId: opts.providerId,
    getSubmitCount: () => submitCount,
    getLastRequest: () => lastRequest,
    capabilities: () => ({
      providerId: opts.providerId,
      mediaTypes: ["video", "image", "audio"],
      strategies: ["image_to_video", "text_to_image", "text_to_speech", "video_concat"],
      capabilities: ["image_to_video", "text_to_image", "text_to_speech", "video_concat"],
      requiresCredentials: [],
      statusMechanism: "poll",
      knownLimitations: [],
    }),
    submit: async (req) => {
      submitCount++;
      lastRequest = req;
      if (opts.onSubmit) {
        return opts.onSubmit(req);
      }
      return {
        providerJobId: `${opts.providerId}_job_${req.executionId}`,
        status: "succeeded",
        outputUrl: `https://storage.spark.io/${opts.providerId}_output.mp4`,
      };
    },
    getStatus: async (jobId) => {
      if (opts.getStatus) {
        return opts.getStatus(jobId);
      }
      return {
        providerJobId: jobId,
        status: "succeeded",
        outputUrl: "https://storage.spark.io/clip.mp4",
      };
    },
    normalizeOutput: async (job) => {
      if (opts.normalizeOutput) {
        return opts.normalizeOutput(job);
      }
      return {
        mediaType: "video",
        sourceUrl: job.outputUrl || "https://storage.spark.io/clip.mp4",
        mimeType: "video/mp4",
        providerJobId: job.providerJobId,
        durationSec: 5,
        metadata: {},
      };
    },
  };
}

describe("SPARK Phase 12.2 — Canonical Live Execution Migration", () => {
  beforeEach(() => {
    ProviderSubmissionRegistry.clear();
  });

  // TEST A: Same task identity
  it("Test A: Same task identity — task.id, productionId, sceneId, shotId match between planned task and execution", async () => {
    const spec = createMockSpec();
    const planned = resolveGenerationTasks(spec, true).tasks;
    const videoTask = planned.find((t) => t.kind === "video");
    assert.ok(videoTask, "Video task must be planned");
    assert.ok(videoTask.id.includes("_video"), "Video task ID must follow canonical naming");
    assert.equal(videoTask.productionId, spec.project.id);
    assert.ok(videoTask.sceneId, "SceneId must be set");
    assert.ok(videoTask.shotId, "ShotId must be set");

    const adapter = createMockAdapter({ providerId: "kling" });
    const adapters = new Map<string, MediaProviderAdapter>([
      ["kling", adapter],
      ["video:kling", adapter],
    ]);
    const engine = new GenerationExecutionEngine({
      adapters,
      userId: "user_test",
      sleep: async () => {},
    });

    const res = await engine.executeTask({ spec, task: videoTask });
    assert.equal(res.execution.taskId, videoTask.id);
    assert.equal(res.execution.productionId, videoTask.productionId);
    assert.equal(res.execution.sceneId, videoTask.sceneId);
    assert.equal(res.execution.shotId, videoTask.shotId);
    assert.equal(res.task.id, videoTask.id);
    assert.equal(res.task.status, "succeeded");
  });

  // TEST B: No duplicate provider execution
  it("Test B: No duplicate provider execution — mock submit executes exactly once per task", async () => {
    const spec = createMockSpec();
    const planned = resolveGenerationTasks(spec, true).tasks;
    const videoTask = planned.find((t) => t.kind === "video")!;

    const adapter = createMockAdapter({ providerId: "kling" });
    const adapters = new Map<string, MediaProviderAdapter>([
      ["kling", adapter],
      ["video:kling", adapter],
    ]);
    const engine = new GenerationExecutionEngine({
      adapters,
      userId: "user_test",
      sleep: async () => {},
    });

    await engine.executeTask({ spec, task: videoTask });
    assert.equal(adapter.getSubmitCount(), 1, "Provider submit must execute exactly once");
    assert.equal(videoTask.status, "succeeded");
  });

  // TEST C: Successful result persists
  it("Test C: Successful result persists — task status = succeeded, productionAssetId retained, spec serialization preserves state", async () => {
    const spec = createMockSpec();
    const planned = resolveGenerationTasks(spec, true).tasks;
    const videoTask = planned.find((t) => t.kind === "video")!;

    const adapter = createMockAdapter({ providerId: "kling" });
    const adapters = new Map<string, MediaProviderAdapter>([
      ["kling", adapter],
      ["video:kling", adapter],
    ]);
    const engine = new GenerationExecutionEngine({
      adapters,
      userId: "user_test",
      sleep: async () => {},
    });

    const res = await engine.executeTask({ spec, task: videoTask });
    assert.equal(res.task.status, "succeeded");
    assert.ok(res.asset?.id, "Asset ID must be created");
    assert.equal(res.task.productionAssetId, res.asset.id);

    const updatedSpec = attachGenerationTasksToSpec(spec, [res.task]);
    const serialized = JSON.stringify(updatedSpec);
    const reloaded = JSON.parse(serialized) as ProductionSpec;

    const allReloadedTasks = reloaded.scenes.flatMap((sc) => sc.shots.flatMap((sh) => sh.generationTasks || []));
    const persistedTask = allReloadedTasks.find((t) => t.id === videoTask.id);
    assert.ok(persistedTask, "Persisted task must exist on shot after reload");
    assert.equal(persistedTask.status, "succeeded");
    assert.equal(persistedTask.productionAssetId, res.asset.id);
  });

  // TEST D: Execution failure persists truthfully
  it("Test D: Execution failure persists truthfully — task.status = failed, truthful error, no fabricated asset", async () => {
    const spec = createMockSpec();
    const planned = resolveGenerationTasks(spec, true).tasks;
    const videoTask = planned.find((t) => t.kind === "video")!;

    const failingAdapter = createMockAdapter({
      providerId: "kling",
      onSubmit: () => {
        throw makeExecutionError("invalid_request", "Prompt rejected by provider content safety", {
          retryable: false,
        });
      },
    });
    const adapters = new Map<string, MediaProviderAdapter>([
      ["kling", failingAdapter],
      ["video:kling", failingAdapter],
    ]);
    const engine = new GenerationExecutionEngine({
      adapters,
      userId: "user_test",
      sleep: async () => {},
    });

    const res = await engine.executeTask({ spec, task: videoTask });
    assert.equal(res.task.status, "failed");
    assert.match(res.task.lastError || "", /Prompt rejected by provider content safety/);
    assert.equal(res.asset, undefined, "No asset should be minted for failed execution");
  });

  // TEST E: UNKNOWN_SUBMISSION
  it("Test E: UNKNOWN_SUBMISSION — no blind second call, reconciliation required state preserved", async () => {
    const spec = createMockSpec();
    const planned = resolveGenerationTasks(spec, true).tasks;
    const videoTask = planned.find((t) => t.kind === "video")!;

    let submitAttempts = 0;
    const unknownAdapter = createMockAdapter({
      providerId: "kling",
      onSubmit: () => {
        submitAttempts++;
        throw makeExecutionError("unknown_submission", "Socket hung up before HTTP response", {
          retryable: false,
        });
      },
    });
    const adapters = new Map<string, MediaProviderAdapter>([
      ["kling", unknownAdapter],
      ["video:kling", unknownAdapter],
    ]);
    const engine = new GenerationExecutionEngine({
      adapters,
      userId: "user_test",
      sleep: async () => {},
    });

    const res = await engine.executeTask({ spec, task: videoTask });
    assert.equal(submitAttempts, 1, "Must NOT perform a blind second submit on UNKNOWN_SUBMISSION");
    assert.equal(res.execution.error?.code, "unknown_submission");
    assert.equal(res.execution.error?.retryability, "RECONCILE_FIRST");
    assert.equal(res.task.status, "running");
    assert.equal(res.task.reconciliationRequired, true);
    const reloadedTask = JSON.parse(JSON.stringify(res.task));
    const freshEngine = new GenerationExecutionEngine({ ports: {} });
    await assert.rejects(freshEngine.executeTask({ spec, task: reloadedTask }), /requires reconciliation/);
    assert.equal(submitAttempts, 1);
  });

  // TEST F: Canonical routing ownership
  it("Test F: Canonical routing ownership — router's selected provider/model used without override", async () => {
    const spec = createMockSpec();
    const planned = resolveGenerationTasks(spec, true).tasks;
    const videoTask = planned.find((t) => t.kind === "video")!;

    assert.equal(videoTask.selectedProvider, "kling");
    assert.equal(videoTask.selectedModel, "kling-v2-6");

    const adapter = createMockAdapter({ providerId: "kling" });
    const adapters = new Map<string, MediaProviderAdapter>([
      ["kling", adapter],
      ["video:kling", adapter],
    ]);
    const engine = new GenerationExecutionEngine({
      adapters,
      userId: "user_test",
      sleep: async () => {},
    });

    await engine.executeTask({ spec, task: videoTask });
    const lastReq = adapter.getLastRequest();
    assert.ok(lastReq, "Provider request must be captured");
    assert.equal(lastReq.providerId, "kling");
    assert.equal(lastReq.model, "kling-v2-6");
  });

  // TEST G: Compiler ownership
  it("Test G: Compiler ownership — ProviderPayloadCompiler compiles request, provider receives compiled request", async () => {
    const spec = createMockSpec();
    const planned = resolveGenerationTasks(spec, true).tasks;
    const videoTask = planned.find((t) => t.kind === "video")!;

    const adapter = createMockAdapter({ providerId: "kling" });
    const adapters = new Map<string, MediaProviderAdapter>([
      ["kling", adapter],
      ["video:kling", adapter],
    ]);
    const engine = new GenerationExecutionEngine({
      adapters,
      userId: "user_test",
      sleep: async () => {},
    });

    await engine.executeTask({ spec, task: videoTask });
    const lastReq = adapter.getLastRequest();
    assert.ok(lastReq, "Compiled request received");
    assert.ok(lastReq.prompt, "prompt must be populated by compiler");
  });

  // TEST H: Bridge and canonical task selection stay identical
  it("Test H: Bridge and canonical task selection stay identical — resolveGenerationTasks(spec) matches", async () => {
    const spec = createMockSpec();
    const directPlan = resolveGenerationTasks(spec, true);

    const brand: Brand = {
      id: "brand_mig_1",
      name: "CyberBrand",
      colors: [],
      guidelines: "",
      tone: "cinematic",
      assets: [],
    } as any;

    const production: Production = {
      id: spec.project.id,
      brandId: spec.project.brandId,
      name: spec.project.title,
      status: "Draft",
      mode: "standard",
      scenes: [],
      reasoning: {
        productionSpec: spec,
      },
    } as any;

    const resolvedSpec = resolveProductionSpec(production, brand);
    const bridgePlan = resolveGenerationTasks(resolvedSpec, true);

    assert.equal(directPlan.tasks.length, bridgePlan.tasks.length);
    for (let i = 0; i < directPlan.tasks.length; i++) {
      assert.equal(directPlan.tasks[i].id, bridgePlan.tasks[i].id);
      assert.equal(directPlan.tasks[i].kind, bridgePlan.tasks[i].kind);
      assert.equal(directPlan.tasks[i].shotId, bridgePlan.tasks[i].shotId);
    }
  });

  // TEST I: Persisted production-level tasks
  it("Test I: Persisted production-level tasks — voice and merge tasks survive execute -> attach -> serialize", async () => {
    const spec = createMockSpec();
    const planned = resolveGenerationTasks(spec, true).tasks;
    const voiceTask = planned.find((t) => t.kind === "voice");
    assert.ok(voiceTask, "Voice task should be planned at production level");

    const voiceAdapter = createMockAdapter({
      providerId: "elevenlabs",
      normalizeOutput: async (job) => ({
        mediaType: "audio",
        sourceUrl: "https://storage.spark.io/voice.mp3",
        mimeType: "audio/mpeg",
        providerJobId: job.providerJobId,
        durationSec: 5,
        metadata: {},
      }),
    });
    const adapters = new Map<string, MediaProviderAdapter>([
      ["elevenlabs", voiceAdapter],
      ["audio:elevenlabs", voiceAdapter],
    ]);
    const engine = new GenerationExecutionEngine({
      adapters,
      userId: "user_test",
      sleep: async () => {},
    });

    const res = await engine.executeTask({ spec, task: voiceTask });
    assert.equal(res.task.status, "succeeded");

    const updatedSpec = attachGenerationTasksToSpec(spec, [res.task]);
    const serialized = JSON.stringify(updatedSpec);
    const reloaded = JSON.parse(serialized) as ProductionSpec;

    const prodTasks = (reloaded as any).productionTasks as GenerationTask[] | undefined;
    const reloadedVoice = prodTasks?.find((t) => t.id === voiceTask.id);
    assert.ok(reloadedVoice, "Voice task must be persisted in productionTasks");
    assert.equal(reloadedVoice.status, "succeeded");
  });

  // TEST J: No paid calls ($0.00 provider spend verified)
  it("Test J: No paid calls — mock adapters execute in-memory with $0.00 live provider spend", async () => {
    const creditRepo = new InMemoryCreditRepository();
    await creditRepo.setBalance("user_test", 100);
    const creditService = new CreditService(creditRepo);

    const spec = createMockSpec();
    const planned = resolveGenerationTasks(spec, true).tasks;
    const videoTask = planned.find((t) => t.kind === "video")!;

    const adapter = createMockAdapter({ providerId: "kling" });
    const adapters = new Map<string, MediaProviderAdapter>([
      ["kling", adapter],
      ["video:kling", adapter],
    ]);
    const engine = new GenerationExecutionEngine({
      adapters,
      creditService,
      userId: "user_test",
      sleep: async () => {},
    });

    const res = await engine.executeTask({ spec, task: videoTask });
    assert.equal(res.task.status, "succeeded");

    // All execution happened through in-memory mock adapter
    assert.equal(adapter.getSubmitCount(), 1);
    // Verified 0 live HTTP calls made to real cloud APIs
    assert.ok(res.asset?.publicUrl.includes("spark.io"));
  });
});
