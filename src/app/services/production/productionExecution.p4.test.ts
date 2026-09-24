/**
 * Phase 4 — Media Execution Engine tests (mocks only — no real provider calls).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProductionPlan } from "./intelligence/productionOrchestrator";
import {
  GenerationExecutionEngine,
  executeProduction,
  validateNormalizedOutput,
  transitionStatus,
  canTransition,
  selectReadyBatch,
  prepareTaskInputs,
  createMemoryAssetPersistPort,
  createMemoryIdempotencyStore,
  createMemoryLogger,
  createDefaultAdapterRegistry,
  listRegisteredAdapterCapabilities,
  buildTaskInputHash,
  idempotencyKey,
  findReusableExecution,
  computeBackoffDelayMs,
  makeExecutionError,
  classifyProviderFailure,
  userFacingExecutionMessage,
} from "./execution";
import type { AdapterPorts } from "./execution";
import type { GenerationTask } from "./specification/generationTask";
import type { ExecutionStatus } from "./execution/types";
import type { ProductionDag } from "./dag/productionDag";
import { buildProductionDag } from "./dag/productionDag";
import { attachGenerationTasksToSpec, planGenerationTasks, resolveGenerationTasks } from "./generation/generationPlanner";
import { productionSpecToBrief } from "./specification/adapters";

function mockPorts(overrides?: Partial<AdapterPorts>): AdapterPorts {
  return {
    async submitImage(req) {
      return {
        imageUrl: `https://cdn.example.test/keyframes/${req.taskId}.png`,
        providerJobId: `mock_img_${req.executionId}`,
        provider: req.providerId,
      };
    },
    async submitVideo(req) {
      return {
        videoUrl: `https://cdn.example.test/videos/${req.taskId}.mp4`,
        lastFrameDataUrl: "data:image/jpeg;base64,frame",
        providerJobId: `mock_vid_${req.executionId}`,
        provider: req.providerId,
      };
    },
    async submitVoice(req) {
      return {
        audioUrl: `https://cdn.example.test/voice/${req.taskId}.mp3`,
        providerJobId: `mock_voice_${req.executionId}`,
        durationSec: 12,
        provider: "elevenlabs",
      };
    },
    async submitMerge(req) {
      return {
        videoUrl: `https://cdn.example.test/master/${req.productionId}.mp4`,
        providerJobId: `mock_mux_${req.executionId}`,
        provider: "mux",
      };
    },
    ...overrides,
  };
}

describe("job state machine", () => {
  it("allows pending→queued→running→polling→succeeded", () => {
    assert.equal(canTransition("pending", "queued"), true);
    assert.equal(canTransition("queued", "running"), true);
    assert.equal(canTransition("running", "polling"), true);
    assert.equal(canTransition("polling", "succeeded"), true);
    const t = transitionStatus("running", "failed");
    assert.equal(t.ok, true);
  });

  it("rejects invalid transitions", () => {
    const t = transitionStatus("succeeded", "running");
    assert.equal(t.ok, false);
  });
});

describe("technical output validation", () => {
  it("accepts valid video metadata", () => {
    const r = validateNormalizedOutput(
      {
        mediaType: "video",
        sourceUrl: "https://cdn.example.test/a.mp4",
        mimeType: "video/mp4",
        width: 1080,
        height: 1920,
        durationSec: 5,
        fileSizeBytes: 10_000,
        providerJobId: "j1",
        metadata: {},
      },
      { mediaType: "video", aspectRatio: "9:16", durationSec: 5 }
    );
    assert.equal(r.ok, true);
  });

  it("flags duration and aspect mismatches", () => {
    const r = validateNormalizedOutput(
      {
        mediaType: "video",
        sourceUrl: "https://cdn.example.test/a.mp4",
        mimeType: "video/mp4",
        width: 1920,
        height: 1080,
        durationSec: 4,
        fileSizeBytes: 10_000,
        providerJobId: "j1",
        metadata: {},
      },
      { mediaType: "video", aspectRatio: "9:16", durationSec: 8, durationToleranceSec: 1 }
    );
    assert.equal(r.ok, false);
    assert.equal(r.code, "output_mismatch");
    assert.ok(r.reasons.includes("duration_mismatch"));
    assert.ok(r.reasons.includes("aspect_ratio_mismatch"));
    assert.equal(r.retryable, true);
  });

  it("rejects missing media url", () => {
    const r = validateNormalizedOutput(
      {
        mediaType: "image",
        mimeType: "image/png",
        providerJobId: "j1",
        metadata: {},
        fileSizeBytes: 100,
      },
      { mediaType: "image" }
    );
    assert.equal(r.ok, false);
    assert.ok(r.reasons.includes("missing_media_url"));
  });
});

describe("scheduler concurrency", () => {
  it("runs independent tasks concurrently within limit", () => {
    const tasks: GenerationTask[] = [
      {
        id: "a_keyframe",
        kind: "keyframe",
        productionId: "p1",
        strategy: { modality: "text_to_image" },
        requiredCapabilities: ["text_to_image"],
        selectedProvider: "openai",
        dependsOn: [],
        status: "queued",
      },
      {
        id: "b_keyframe",
        kind: "keyframe",
        productionId: "p1",
        strategy: { modality: "text_to_image" },
        requiredCapabilities: ["text_to_image"],
        selectedProvider: "openai",
        dependsOn: [],
        status: "queued",
      },
      {
        id: "a_video",
        kind: "video",
        productionId: "p1",
        strategy: { modality: "image_to_video" },
        requiredCapabilities: ["image_to_video"],
        selectedProvider: "kling",
        dependsOn: ["a_keyframe"],
        status: "blocked",
      },
    ];
    const dag: ProductionDag = {
      productionId: "p1",
      nodes: tasks.map((t) => ({
        id: t.id,
        kind: t.kind,
        dependsOn: t.dependsOn,
        status: "pending",
      })),
    };
    const batch = selectReadyBatch({
      dag,
      tasks,
      runningTaskIds: new Set(),
      config: { maxConcurrency: 2 },
    });
    assert.equal(batch.taskIds.length, 2);
    assert.ok(batch.taskIds.includes("a_keyframe"));
    assert.ok(batch.taskIds.includes("b_keyframe"));
    assert.ok(!batch.taskIds.includes("a_video"));
  });

  it("waits for dependency before scheduling downstream", () => {
    const tasks: GenerationTask[] = [
      {
        id: "k",
        kind: "keyframe",
        productionId: "p1",
        strategy: { modality: "text_to_image" },
        requiredCapabilities: [],
        selectedProvider: "openai",
        dependsOn: [],
        status: "running",
      },
      {
        id: "v",
        kind: "video",
        productionId: "p1",
        strategy: { modality: "image_to_video" },
        requiredCapabilities: [],
        selectedProvider: "kling",
        dependsOn: ["k"],
        status: "blocked",
      },
    ];
    const dag: ProductionDag = {
      productionId: "p1",
      nodes: [
        { id: "k", kind: "keyframe", dependsOn: [], status: "running" },
        { id: "v", kind: "video", dependsOn: ["k"], status: "pending" },
      ],
    };
    const batch = selectReadyBatch({
      dag,
      tasks,
      runningTaskIds: new Set(["k"]),
      config: { maxConcurrency: 3 },
    });
    assert.ok(!batch.taskIds.includes("v"));
  });
});

describe("adapter registry", () => {
  it("registers real integrations including higgsfield", () => {
    const caps = listRegisteredAdapterCapabilities(createDefaultAdapterRegistry(mockPorts()));
    const ids = caps.map((c) => c.providerId);
    assert.ok(ids.includes("kling"));
    assert.ok(ids.includes("seedance"));
    assert.ok(ids.includes("grok"));
    assert.ok(ids.includes("openai"));
    assert.ok(ids.includes("elevenlabs"));
    assert.ok(ids.includes("higgsfield"));
  });
});

describe("execution engine", () => {
  const measure = async () => ({
    width: 1080,
    height: 1920,
    fileSizeBytes: 50_000,
  });

  it("executes a planned production through adapters with mocks", async () => {
    const plan = createProductionPlan({
      idea: "Create a 30-second luxury commercial for a watch",
      targetDurationSec: 30,
    });
    assert.ok(plan.ok && plan.spec);
    const logger = createMemoryLogger();
    const persist = createMemoryAssetPersistPort();
    const engine = new GenerationExecutionEngine({
      ports: mockPorts(),
      persistPort: persist,
      logger,
      sleep: async () => undefined,
      measureOutput: measure,
      scheduler: { maxConcurrency: 2 },
      backoff: { baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0, maxAttempts: 2 },
    });
    const tasks = planGenerationTasks(plan.spec!).slice(0, 6);
    const dag = buildProductionDag(plan.spec!, tasks);
    const result = await engine.executePlan({ spec: plan.spec!, tasks, dag });
    assert.ok(result.tasks.some((t) => t.status === "succeeded" || t.status === "failed" || t.status === "skipped"));
    assert.ok(logger.events.length > 0);
    assert.ok(logger.events.every((e) => !/api[_-]?key/i.test(JSON.stringify(e))));
  });

  it("rejects invalid tasks", async () => {
    const plan = createProductionPlan({ idea: "Short tip video", targetDurationSec: 20 });
    const bad: GenerationTask = {
      id: "",
      kind: "video",
      productionId: plan.spec!.project.id,
      strategy: { modality: "image_to_video" },
      requiredCapabilities: [],
      dependsOn: [],
      status: "queued",
    };
    const engine = new GenerationExecutionEngine({
      ports: mockPorts(),
      sleep: async () => undefined,
    });
    const result = await engine.executePlan({
      spec: plan.spec!,
      tasks: [bad],
      dag: { productionId: plan.spec!.project.id, nodes: [] },
    });
    assert.ok(result.errors.length > 0);
  });

  it("does not run downstream when dependency fails", async () => {
    const plan = createProductionPlan({ idea: "Educational explainer", targetDurationSec: 40 });
    const ports = mockPorts({
      async submitImage() {
        throw makeExecutionError("generation_failed", "boom", { retryable: false });
      },
    });
    const engine = new GenerationExecutionEngine({
      ports,
      sleep: async () => undefined,
      backoff: { baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0, maxAttempts: 1 },
    });
    const tasks = planGenerationTasks(plan.spec!).map((t) => ({
      ...t,
      maxRetries: 0,
      fallbackProviders: [],
    }));
    const dag = buildProductionDag(plan.spec!, tasks);
    const result = await engine.executePlan({ spec: plan.spec!, tasks, dag });
    const videos = result.tasks.filter((t) => t.kind === "video");
    assert.ok(videos.every((v) => v.status === "skipped" || v.status === "failed"));
  });

  it("retries retryable errors then succeeds", async () => {
    let calls = 0;
    const ports = mockPorts({
      async submitImage(req) {
        calls += 1;
        if (calls < 2) {
          const err: any = new Error("temporary timeout");
          err.code = "timeout";
          err.retryable = true;
          err.message = "temporary timeout";
          throw err;
        }
        return {
          imageUrl: "https://cdn.example.test/ok.png",
          providerJobId: `ok_${req.executionId}`,
          provider: "openai",
        };
      },
    });
    const plan = createProductionPlan({ idea: "Product demo short", targetDurationSec: 20 });
    const keyframe = planGenerationTasks(plan.spec!).find((t) => t.kind === "keyframe" && t.shotId);
    assert.ok(keyframe);
    const engine = new GenerationExecutionEngine({
      ports,
      sleep: async () => undefined,
      backoff: { baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0, maxAttempts: 3 },
      measureOutput: async () => ({ width: 1080, height: 1920, fileSizeBytes: 2000 }),
    });
    const result = await Promise.race([
      engine.executePlan({
        spec: plan.spec!,
        tasks: [{ ...keyframe!, maxRetries: 3, fallbackProviders: [], shotId: undefined }],
        dag: {
          productionId: plan.spec!.project.id,
          nodes: [{ id: keyframe!.id, kind: "keyframe", dependsOn: [], status: "ready" }],
        },
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("test_timeout")), 5000)),
    ]);
    assert.equal(result.tasks[0].status, "succeeded");
    assert.ok(calls >= 2);
  });

  it("does not loop on authentication failure", async () => {
    let calls = 0;
    const ports = mockPorts({
      async submitImage() {
        calls++;
        throw makeExecutionError("authentication_failed", "bad key", { retryable: false });
      },
    });
    const plan = createProductionPlan({ idea: "Social tip", targetDurationSec: 15 });
    const keyframe = planGenerationTasks(plan.spec!).find((t) => t.kind === "keyframe" && t.shotId)!;
    const engine = new GenerationExecutionEngine({
      ports,
      sleep: async () => undefined,
      backoff: { baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0, maxAttempts: 5 },
    });
    const result = await engine.executePlan({
      spec: plan.spec!,
      tasks: [{ ...keyframe, maxRetries: 5, fallbackProviders: ["gemini"] }],
      dag: {
        productionId: plan.spec!.project.id,
        nodes: [{ id: keyframe.id, kind: "keyframe", dependsOn: [], status: "ready" }],
      },
    });
    assert.equal(result.tasks[0].status, "failed");
    assert.equal(calls, 1);
  });

  it("uses compatible fallback provider on generation failure", async () => {
    const providersTried: string[] = [];
    const ports = mockPorts({
      async submitVideo(req) {
        providersTried.push(req.providerId);
        if (req.providerId === "kling") {
          throw makeExecutionError("generation_failed", "kling down", { retryable: true });
        }
        return {
          videoUrl: `https://cdn.example.test/${req.providerId}.mp4`,
          providerJobId: `fb_${req.executionId}`,
          provider: req.providerId,
        };
      },
    });
    const plan = createProductionPlan({ idea: "Luxury watch ad", targetDurationSec: 30 });
    // Seed prior keyframe output via a succeeded keyframe first
    const tasks = planGenerationTasks(plan.spec!);
    const keyframe = tasks.find((t) => t.kind === "keyframe" && t.shotId)!;
    const video = tasks.find((t) => t.kind === "video" && t.dependsOn.includes(keyframe.id))!;
    video.selectedProvider = "kling";
    video.fallbackProviders = ["seedance", "grok"];
    video.maxRetries = 3;

    const engine = new GenerationExecutionEngine({
      ports,
      sleep: async () => undefined,
      backoff: { baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0, maxAttempts: 3 },
      measureOutput: async () => ({
        width: 1080,
        height: 1920,
        fileSizeBytes: 20_000,
      }),
    });
    const result = await engine.executePlan({
      spec: plan.spec!,
      tasks: [
        { ...keyframe, status: "queued" },
        { ...video, status: "blocked" },
      ],
      dag: buildProductionDag(plan.spec!, [keyframe, video]),
    });
    const videoResult = result.tasks.find((t) => t.id === video.id)!;
    assert.equal(videoResult.status, "succeeded");
    assert.ok(providersTried.includes("kling"));
    assert.ok(providersTried.some((p) => p === "seedance" || p === "grok"));
  });

  it("idempotency prevents duplicate submission for same input hash", async () => {
    let submits = 0;
    let videos = 0;
    const ports = mockPorts({
      async submitImage(req) {
        submits++;
        return {
          imageUrl: `https://cdn.example.test/idem.png`,
          providerJobId: `idem_${submits}`,
          provider: "openai",
        };
      },
      async submitVideo(req) {
        videos++;
        assert.ok(req.inputs.some(input => input.role === "first_frame" && input.url === "https://cdn.example.test/idem.png"));
        return { videoUrl: "https://cdn.example.test/resumed.mp4", providerJobId: "resumed-video", provider: req.providerId };
      },
    });
    const plan = createProductionPlan({ idea: "Tip video", targetDurationSec: 15 });
    const keyframe = planGenerationTasks(plan.spec!).find((t) => t.kind === "keyframe" && t.shotId)!;
    const store = createMemoryIdempotencyStore();
    const persist = createMemoryAssetPersistPort();
    const options = {
      ports,
      idempotencyStore: store,
      persistPort: persist,
      sleep: async () => undefined,
      measureOutput: async () => ({ width: 1080, height: 1920, fileSizeBytes: 50000 }),
    };
    const engine = new GenerationExecutionEngine(options);
    const dag = {
      productionId: plan.spec!.project.id,
      nodes: [{ id: keyframe.id, kind: "keyframe", dependsOn: [], status: "ready" as const }],
    };
    const first = await engine.executePlan({ spec: plan.spec!, tasks: [{ ...keyframe }], dag });
    const second = await engine.executePlan({ spec: plan.spec!, tasks: [{ ...keyframe }], dag });
    assert.equal(submits, 1);
    assert.equal(second.assets.length, 1, "same-engine replay must not duplicate returned assets");
    assert.equal(second.tasks[0].productionAssetId, first.assets[0].id);
    assert.equal(persist.assets.length, 1, "replay must not write a new asset");

    const video = { ...planGenerationTasks(plan.spec!).find(task => task.kind === "video" && task.shotId === keyframe.shotId)!, dependsOn: [keyframe.id], dependencies: undefined };
    const resumedTasks = [{ ...keyframe, dependsOn: [], dependencies: undefined }, video];
    const resumedEngine = new GenerationExecutionEngine(options);
    const resumed = await resumedEngine.executePlan({ spec: plan.spec!, tasks: resumedTasks, dag: buildProductionDag(plan.spec!, resumedTasks) });
    assert.equal(resumed.tasks.find(task => task.id === video.id)?.status, "succeeded", JSON.stringify(resumed.errors));
    assert.equal(submits, 1);
    assert.equal(videos, 1);
    assert.equal(persist.assets.length, 2);
    assert.equal(resumed.assets.find(asset => asset.taskId === keyframe.id)?.id, first.assets[0].id);
    const direct = await new GenerationExecutionEngine(options).executeTask({ spec: plan.spec!, task: { ...keyframe } });
    assert.equal(direct.asset?.id, first.assets[0].id);
    assert.equal(direct.asset?.publicUrl, first.assets[0].publicUrl);
    assert.equal(persist.assets.length, 2);

    // Save the completed task in the existing spec, then resume with no old store.
    const savedSpec = JSON.parse(JSON.stringify(attachGenerationTasksToSpec(plan.spec!, [first.tasks[0], video])));
    const reloadedTasks = resolveGenerationTasks(savedSpec).tasks.filter(task => task.id === keyframe.id || task.id === video.id);
    const freshPersist = createMemoryAssetPersistPort();
    const freshEngine = new GenerationExecutionEngine({ ...options, idempotencyStore: createMemoryIdempotencyStore(), persistPort: freshPersist });
    const reloaded = await freshEngine.executePlan({ spec: savedSpec, tasks: reloadedTasks, dag: buildProductionDag(savedSpec, reloadedTasks) });
    assert.equal(reloaded.tasks.find(task => task.id === video.id)?.status, "succeeded", JSON.stringify(reloaded.errors));
    assert.equal(submits, 1, "reload must not regenerate the completed keyframe");
    assert.equal(videos, 2);
    assert.equal(freshPersist.assets.length, 1, "only the new video is persisted");
    assert.equal(reloaded.assets.find(asset => asset.taskId === keyframe.id)?.id, first.assets[0].id);
    const restoredTask = reloadedTasks.find(task => task.id === keyframe.id)!;
    const standalone = await new GenerationExecutionEngine({ ports: {} }).executeTask({ spec: savedSpec, task: restoredTask });
    assert.equal(standalone.execution.id, first.executions[0].id);
    assert.equal(standalone.asset?.id, first.assets[0].id);
    const mismatched = structuredClone(restoredTask);
    mismatched.completedOutput!.asset.productionId = "other-production";
    await assert.rejects(new GenerationExecutionEngine({ ports: {} }).executeTask({ spec: savedSpec, task: mismatched }), (error: any) => error.code === "output_unavailable" && error.retryability === "DO_NOT_RETRY");
  });

  it("cancels queued tasks before execution", async () => {
    const plan = createProductionPlan({ idea: "Comedy short", targetDurationSec: 20 });
    const keyframe = planGenerationTasks(plan.spec!).find((t) => t.kind === "keyframe" && t.shotId);
    assert.ok(keyframe);
    const engine = new GenerationExecutionEngine({
      ports: mockPorts(),
      sleep: async () => undefined,
    });
    engine.cancelTask(keyframe!.id);
    const result = await engine.executePlan({
      spec: plan.spec!,
      tasks: [{ ...keyframe! }],
      dag: {
        productionId: plan.spec!.project.id,
        nodes: [{ id: keyframe!.id, kind: "keyframe", dependsOn: [], status: "ready" }],
      },
    });
    assert.ok(result.tasks[0].status === "skipped" || result.tasks[0].status === "failed");
  });
});

describe("executeProduction entry", () => {
  it("runs DAG reference→keyframe→video→merge shape", async () => {
    const plan = createProductionPlan({
      idea: "Make a funny animated short about two friends",
      targetDurationSec: 30,
    });
    const result = await executeProduction(plan.spec!, {
      ports: mockPorts(),
      sleep: async () => undefined,
      measureOutput: async () => ({ width: 1080, height: 1920, fileSizeBytes: 30_000 }),
      scheduler: { maxConcurrency: 2 },
      backoff: { baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0, maxAttempts: 2 },
    });
    assert.ok(result.tasks.some((t) => t.kind === "keyframe"));
    assert.ok(result.tasks.some((t) => t.kind === "video") || result.tasks.some((t) => t.kind === "keyframe"));
    assert.ok(result.tasks.some((t) => t.kind === "merge"));
    const brief = productionSpecToBrief(result.spec);
    assert.ok((brief.storyboard || []).length > 0);
  });

  it("dryRun completes without adapter ports", async () => {
    const plan = createProductionPlan({ idea: "News explainer", targetDurationSec: 45 });
    const result = await executeProduction(plan.spec!, { dryRun: true, sleep: async () => undefined });
    assert.ok(result.tasks.every((t) => t.status === "succeeded"));
  });
});

describe("input preparation + errors", () => {
  it("prepares first_frame from prior keyframe output", () => {
    const plan = createProductionPlan({ idea: "Travel short", targetDurationSec: 30 });
    const tasks = planGenerationTasks(plan.spec!);
    const video = tasks.find((t) => t.kind === "video")!;
    const keyframeDep = video.dependsOn.find((d) => d.endsWith("_keyframe"))!;
    const prepared = prepareTaskInputs({
      spec: plan.spec!,
      task: video,
      priorOutputs: { [keyframeDep]: "https://cdn.example.test/kf.png" },
    });
    assert.ok(prepared.inputs.some((i) => i.role === "first_frame" && i.url));
  });

  it("classifies provider failures and sanitizes user copy", () => {
    assert.equal(classifyProviderFailure("401 unauthorized api key"), "authentication_failed");
    assert.equal(classifyProviderFailure("429 rate limit"), "rate_limited");
    const msg = userFacingExecutionMessage("retrying");
    assert.equal(msg, "SPARK is retrying this");
    assert.ok(!/kling|runway|api/i.test(msg));
  });

  it("computes backoff with cap", () => {
    const d = computeBackoffDelayMs(5, {
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      jitterRatio: 0,
      maxAttempts: 5,
    });
    assert.ok(d <= 5000);
    assert.ok(d >= 1000);
  });
});

describe("asset-to-video wiring & traceability", () => {
  it("projectAssetsOntoSpec links sourceImageAssetId and videoAssetId to shots and tasks", async () => {
    const { projectAssetsOntoSpec } = await import("./execution/productionExecutionBridge");
    const plan = createProductionPlan({ idea: "High tech commercial", targetDurationSec: 15 });
    const spec = plan.spec!;
    const tasks = planGenerationTasks(spec);
    const shot = spec.scenes[0].shots[0];

    const projected = projectAssetsOntoSpec({
      spec,
      tasks,
      assetResult: {
        brief: productionSpecToBrief(spec),
        scenes: [{ scene: 1, description: "Test", duration: "5s" }],
        productionScenes: [
          {
            scene: 1,
            shotId: shot.id,
            image: "https://jaqzjhabmtvqtvinoafq.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/scenes/scene-01.png",
            videoUrl: "https://jaqzjhabmtvqtvinoafq.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/video/shot-1.mp4",
            sourceImageAssetId: "pa-img-12345",
            videoAssetId: "pa-vid-67890",
            duration: "5s",
            shotList: "shot 1",
            cameraDirection: "static",
            transitions: "cut",
            onScreenText: "",
            pacing: "medium",
            scriptSnippet: "hello",
            visualDescription: "Product in studio lighting",
          },
        ],
        videoUrl: "https://jaqzjhabmtvqtvinoafq.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/video/master.mp4",
      },
      productionId: "p1",
      logger: () => {},
    });

    const projectedShot = projected.spec.scenes[0].shots.find((s) => s.id === shot.id)!;
    assert.equal(projectedShot.sourceImageAssetId, "pa-img-12345");
    assert.equal(projectedShot.videoAssetId, "pa-vid-67890");
    assert.ok(projectedShot.assetIds.includes("pa-img-12345"));
    assert.ok(projectedShot.assetIds.includes("pa-vid-67890"));
    assert.equal(projectedShot.references.firstFrameUrl, "https://jaqzjhabmtvqtvinoafq.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/scenes/scene-01.png");

    const kfTask = projected.tasks.find((t) => t.shotId === shot.id && t.kind === "keyframe")!;
    assert.equal(kfTask.status, "succeeded");
    assert.equal(kfTask.productionAssetId, "pa-img-12345");

    const vidTask = projected.tasks.find((t) => t.shotId === shot.id && t.kind === "video")!;
    assert.equal(vidTask.status, "succeeded");
    assert.equal(vidTask.productionAssetId, "pa-vid-67890");
  });

  it("projectAssetsOntoSpec fails loud when shot videoUrl is missing even if masterOk is true", async () => {
    const { projectAssetsOntoSpec } = await import("./execution/productionExecutionBridge");
    const plan = createProductionPlan({ idea: "Test failover", targetDurationSec: 15 });
    const spec = plan.spec!;
    const tasks = planGenerationTasks(spec);
    const shot = spec.scenes[0].shots[0];

    const projected = projectAssetsOntoSpec({
      spec,
      tasks,
      assetResult: {
        brief: productionSpecToBrief(spec),
        scenes: [{ scene: 1, description: "Test", duration: "5s" }],
        productionScenes: [
          {
            scene: 1,
            shotId: shot.id,
            image: "https://jaqzjhabmtvqtvinoafq.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/scenes/scene-01.png",
            // videoUrl is intentionally missing for this shot
            videoUrl: undefined,
            sourceImageAssetId: "pa-img-12345",
            duration: "5s",
            shotList: "shot 1",
            cameraDirection: "static",
            transitions: "cut",
            onScreenText: "",
            pacing: "medium",
            scriptSnippet: "hello",
            visualDescription: "Product in studio lighting",
          },
        ],
        // Global master exists (e.g. from prior run or slideshow fallback)
        videoUrl: "https://jaqzjhabmtvqtvinoafq.supabase.co/storage/v1/object/public/Spark/brands/b1/p1/video/master.mp4",
      },
      productionId: "p1",
      logger: () => {},
    });

    const vidTask = projected.tasks.find((t) => t.shotId === shot.id && t.kind === "video")!;
    assert.equal(vidTask.status, "failed");
    assert.ok(vidTask.lastError?.includes("Video generation produced no mediaUrl"));

    const projectedShot = projected.spec.scenes[0].shots.find((s) => s.id === shot.id)!;
    assert.equal(projectedShot.generationStatus, "failed");
  });

  it("requestProductionVideoClip rejects empty firstFrameUrl for I2V providers", async () => {
    const { requestProductionVideoClip } = await import("./productionVideoRequest");
    await assert.rejects(
      async () => {
        await requestProductionVideoClip({
          provider: "grok",
          prompt: "camera pan left",
          firstFrameUrl: "",
        });
      },
      /I2V video generation with provider "grok" requires a valid firstFrameUrl/
    );
  });
});


describe("canonical executor task attachment", () => {
  it("blocks dependents of a saved completed task whose output checkpoint is missing", async () => {
    const spec = createProductionPlan({ idea: "Product explanation", targetDurationSec: 15 }).spec!;
    const source = planGenerationTasks(spec).find(task => task.kind === "keyframe" && task.shotId)!;
    const tasks: GenerationTask[] = [
      { ...source, status: "succeeded", dependsOn: [], dependencies: [] },
      { ...source, id: "dependent", dependsOn: [source.id], dependencies: undefined, status: "blocked" },
    ];
    let submits = 0;
    const engine = new GenerationExecutionEngine({ ports: mockPorts({ submitImage: async () => { submits++; throw new Error("must not submit"); } }) });
    const result = await engine.executePlan({ spec, tasks, dag: buildProductionDag(spec, tasks) });
    assert.equal(submits, 0);
    assert.equal(result.tasks[0].status, "failed");
    assert.notEqual(result.tasks[1].status, "succeeded");
    assert.equal(result.tasks[0].reconciliationRequired, true);
    assert.ok(result.errors.some(error => error.includes("no valid saved output")));
    assert.equal(tasks[0].status, "succeeded", "input remains untouched");
  });

  it("does not regenerate completed work when cached output recovery is missing or belongs to another production", async () => {
    const spec = createProductionPlan({ idea: "Product explanation", targetDurationSec: 15 }).spec!;
    const task = { ...planGenerationTasks(spec).find(task => task.kind === "keyframe" && task.shotId)!, dependsOn: [], dependencies: [] };
    const prepared = prepareTaskInputs({ spec, task });
    const inputHash = buildTaskInputHash(task, prepared.prompt, prepared.inputs.map(input => input.url || input.assetRef || ""));
    for (const foreign of [false, true]) {
      const store = createMemoryIdempotencyStore();
      store.set(idempotencyKey(task.productionId, task.id, inputHash), {
        id: "completed", taskId: task.id, productionId: foreign ? "another-production" : task.productionId,
        provider: "openai", status: "succeeded", attempt: 1, maxAttempts: 3, inputAssets: [], inputHash,
        outputAssets: foreign ? [{ mediaType: "image", productionAssetId: "foreign-asset", persistentUrl: "https://cdn.example.test/foreign.png" }] : [],
      });
      let submits = 0;
      const engine = new GenerationExecutionEngine({ idempotencyStore: store, ports: mockPorts({ submitImage: async () => { submits++; throw new Error("must not submit"); } }) });
      const result = await engine.executePlan({ spec, tasks: [task], dag: buildProductionDag(spec, [task]) });
      assert.equal(submits, 0);
      assert.equal(result.tasks[0].status, "failed");
      assert.equal(result.assets.length, 0);
      assert.ok(result.errors.some(error => error.includes("no restorable asset")));
      assert.equal(store.get(idempotencyKey(task.productionId, task.id, inputHash))?.status, "succeeded");
    }
  });

  it("does not requeue saved running or skipped work or unlock its dependent", async () => {
    const spec = createProductionPlan({ idea: "Product explanation", targetDurationSec: 15 }).spec!;
    const source = planGenerationTasks(spec).find(task => task.kind === "keyframe" && task.shotId)!;
    let calls = 0;
    const engine = new GenerationExecutionEngine({ ports: mockPorts({ submitImage: async () => { calls++; throw new Error("must not submit"); } }) });
    const tasks: GenerationTask[] = [
      { ...source, dependsOn: [], dependencies: [], status: "running" },
      { ...source, id: "dependent", dependsOn: [source.id], dependencies: undefined, status: "blocked" },
      { ...source, id: "cancelled-task", dependsOn: [], dependencies: [], status: "skipped" },
    ];
    const result = await engine.executePlan({ spec, tasks, dag: buildProductionDag(spec, tasks) });
    assert.equal(calls, 0);
    assert.deepEqual(result.tasks.map(task => task.status), ["running", "blocked", "skipped"]);
    assert.equal(result.state, "running");
    assert.equal(result.ok, false);
  });

  it("blocks every unresolved execution state in the existing idempotency store", async () => {
    const spec = createProductionPlan({ idea: "Product explanation", targetDurationSec: 15 }).spec!;
    const task = { ...planGenerationTasks(spec).find(task => task.kind === "keyframe" && task.shotId)!, dependsOn: [], dependencies: [] };
    const prepared = prepareTaskInputs({ spec, task });
    const inputHash = buildTaskInputHash(task, prepared.prompt, prepared.inputs.map(input => input.url || input.assetRef || ""));
    const statuses: ExecutionStatus[] = ["ready", "pending", "preparing", "credit_reserved", "submitting", "submitted", "queued", "running", "polling", "retrying", "unknown_submission", "reconciling"];
    for (const status of statuses) {
      const store = createMemoryIdempotencyStore();
      store.set(idempotencyKey(task.productionId, task.id, inputHash), {
        id: "existing", taskId: task.id, productionId: task.productionId, provider: "openai",
        status, attempt: 1, maxAttempts: 3, inputAssets: [], outputAssets: [], inputHash,
      });
      let calls = 0;
      const engine = new GenerationExecutionEngine({ idempotencyStore: store, ports: mockPorts({ submitImage: async () => { calls++; throw new Error("must not submit"); } }) });
      const result = await engine.executePlan({ spec, tasks: [task], dag: buildProductionDag(spec, [task]) });
      assert.equal(calls, 0, status);
      assert.equal(result.tasks[0].status, "running", status);
      assert.equal(result.executions[0].id, "existing", status);
    }
  });

  it("returns newly planned task state on shots that had no attached tasks", async () => {
    const plan = createProductionPlan({ idea: "Product explanation", targetDurationSec: 15 });
    assert.ok(plan.spec);
    const spec = structuredClone(plan.spec!);
    for (const shot of spec.scenes.flatMap(scene => scene.shots)) shot.generationTasks = [];
    const result = await executeProduction(spec, {
      dryRun: true, ports: mockPorts(), sleep: async () => undefined,
      measureOutput: async () => ({ width: 1080, height: 1920, fileSizeBytes: 50000 }),
    });
    for (const shot of result.spec.scenes.flatMap(scene => scene.shots)) {
      const expected = result.tasks.filter(task => task.shotId === shot.id);
      assert.ok(expected.length > 0);
      assert.deepEqual(shot.generationTasks, expected);
    }
    assert.deepEqual(result.spec.productionTasks, result.tasks.filter(task => !task.shotId));
    assert.ok(result.spec.productionTasks?.some(task => task.kind === "merge"));
    assert.ok(spec.scenes.every(scene => scene.shots.every(shot => shot.generationTasks?.length === 0)));
  });
});
