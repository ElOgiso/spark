import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { GenerationExecutionEngine } from "./executionEngine";
import { createDurableIdempotencyStore, createMemoryCheckpointJournal } from "./durableIdempotency";
import { executionNeedsReconciliation } from "./idempotency";
import { CreditService } from "../credits/creditService";
import { InMemoryCreditRepository } from "../credits/creditRepository";
import { CostEngine } from "../economics/costEngine";
import { ProviderSubmissionRegistry } from "./providerSubmission";
import type { MediaProviderAdapter } from "./adapters/types";
import type { GenerationTask } from "../specification/generationTask";
import type { ProductionSpec } from "../specification/productionSpec";

function mockSpec(): ProductionSpec {
  return {
    version: 1,
    project: {
      id: "prod_p21r",
      brandId: "brand_test",
      title: "P21R",
      status: "draft",
      aspectRatio: "16:9",
      targetDurationSec: 5,
    },
    creative: { intent: "A futuristic skyline" },
    routing: { defaultProvider: "kling", shotDecisions: [] },
    scenes: [
      {
        id: "sc_1",
        sceneNumber: 1,
        title: "Scene 1",
        shots: [
          {
            id: "sh_1",
            shotNumber: 1,
            title: "Shot 1",
            visualPrompt: "A futuristic skyline",
            compiledPrompt: "A futuristic skyline",
            durationSec: 5,
            aspectRatio: "16:9",
            keyframeUrl: "https://storage.spark.io/still.png",
            references: {
              firstFrameUrl: "https://storage.spark.io/still.png",
              characterRefs: [],
              locationRefs: [],
              styleRefs: [],
            },
            generationTasks: [],
          },
        ],
      },
    ],
  } as ProductionSpec;
}

function mockTask(overrides: Partial<GenerationTask> = {}): GenerationTask {
  return {
    id: "task_p21r",
    kind: "video",
    productionId: "prod_p21r",
    sceneId: "sc_1",
    shotId: "sh_1",
    aspectRatio: "16:9",
    durationSec: 5,
    strategy: { modality: "video", strategy: "image_to_video" },
    requiredCapabilities: ["image_to_video"],
    dependsOn: [],
    status: "planned",
    selectedProvider: "kling",
    selectedModel: "kling-v2-6",
    ...overrides,
  } as GenerationTask;
}

function videoAdapter(submit: MediaProviderAdapter["submit"]): Map<string, MediaProviderAdapter> {
  const adapter: MediaProviderAdapter = {
    providerId: "kling",
    capabilities: () => ({
      providerId: "kling",
      mediaTypes: ["video"],
      strategies: ["image_to_video"],
      capabilities: ["image_to_video"],
      requiresCredentials: [],
      statusMechanism: "poll",
      knownLimitations: [],
    }),
    submit,
    getStatus: async (jobId) => ({ providerJobId: jobId, status: "succeeded", outputUrl: "https://storage.spark.io/clip.mp4" }),
    normalizeOutput: async (job) => ({
      mediaType: "video",
      sourceUrl: job.outputUrl || "https://storage.spark.io/clip.mp4",
      mimeType: "video/mp4",
      providerJobId: job.providerJobId,
      durationSec: 5,
      metadata: {},
    }),
  };
  return new Map([
    ["video:kling", adapter],
    ["kling", adapter],
  ]);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) out.push(path);
  }
  return out;
}

describe("SPARK Phase 21R durable live execution", () => {
  beforeEach(() => {
    ProviderSubmissionRegistry.clear();
  });

  it("reserves, submits, and settles through CreditService", async () => {
    const repo = new InMemoryCreditRepository();
    await repo.setBalance("user_21r", 100);
    const creditService = new CreditService(repo);
    const journal = createMemoryCheckpointJournal();
    let submits = 0;
    const engine = new GenerationExecutionEngine({
      adapters: videoAdapter(async (req) => {
        submits++;
        return { providerJobId: `job_${req.executionId}`, status: "queued" };
      }),
      idempotencyStore: createDurableIdempotencyStore({ journal, persistRemote: false, storage: null }),
      creditService,
      userId: "user_21r",
      requireCredits: true,
      sleep: async () => {},
    });
    const result = await engine.executeTask({ spec: mockSpec(), task: mockTask() });
    assert.equal(submits, 1);
    assert.equal(result.execution.status, "succeeded");
    assert.ok(result.execution.providerJobId);
    assert.equal(typeof result.execution.metadata?.reservationId, "string");
    const ledger = await creditService.getLedger("user_21r");
    assert.ok(ledger.some((tx) => tx.type === "RESERVATION"));
    assert.ok(ledger.some((tx) => tx.type === "CONSUMPTION"));
    assert.ok((await creditService.getBalance("user_21r")) < 100);
    const checkpoint = journal.records.find((r) => r.execution.providerJobId === result.execution.providerJobId);
    assert.ok(checkpoint, "provider job id must be flushed before the process can die");
  });

  it("releases the reservation when the provider is NOT_SUBMITTED", async () => {
    const repo = new InMemoryCreditRepository();
    await repo.setBalance("user_21r", 100);
    const creditService = new CreditService(repo);
    let submits = 0;
    const engine = new GenerationExecutionEngine({
      adapters: videoAdapter(async () => {
        submits++;
        throw new Error("validation failed: missing required field before transmission");
      }),
      idempotencyStore: createDurableIdempotencyStore({ persistRemote: false, storage: null }),
      creditService,
      userId: "user_21r",
      requireCredits: true,
      sleep: async () => {},
    });
    const result = await engine.executeTask({ spec: mockSpec(), task: mockTask() });
    assert.equal(submits, 1);
    assert.equal(result.execution.providerJobId, undefined);
    assert.equal(await creditService.getBalance("user_21r"), 100);
    const ledger = await creditService.getLedger("user_21r");
    assert.ok(ledger.some((tx) => tx.type === "RELEASE"));
  });

  it("holds PENDING_UNKNOWN and a restarted store does not resubmit", async () => {
    const repo = new InMemoryCreditRepository();
    await repo.setBalance("user_21r", 100);
    const creditService = new CreditService(repo);
    const journal = createMemoryCheckpointJournal();
    let submits = 0;
    const adapters = videoAdapter(async () => {
      submits++;
      throw new Error("504 Gateway Timeout: connection reset after send");
    });
    const storeA = createDurableIdempotencyStore({ journal, persistRemote: false, storage: null });
    const first = await new GenerationExecutionEngine({
      adapters,
      idempotencyStore: storeA,
      creditService,
      userId: "user_21r",
      requireCredits: true,
      sleep: async () => {},
    }).executeTask({ spec: mockSpec(), task: mockTask() });

    assert.equal(submits, 1);
    assert.equal(executionNeedsReconciliation(first.execution), true);
    assert.ok((await creditService.getBalance("user_21r")) < 100);
    const ledger = await creditService.getLedger("user_21r");
    assert.ok(ledger.some((tx) => tx.type === "PENDING_UNKNOWN"));
    const held = journal.records.at(-1);
    assert.ok(held);
    assert.equal(held?.execution.metadata?.reservationId, first.execution.metadata?.reservationId);

    ProviderSubmissionRegistry.clear();
    const storeB = createDurableIdempotencyStore({ journal, persistRemote: false, storage: null });
    const second = await new GenerationExecutionEngine({
      adapters,
      idempotencyStore: storeB,
      creditService,
      userId: "user_21r",
      requireCredits: true,
      sleep: async () => {},
    }).executeTask({ spec: mockSpec(), task: mockTask() });
    assert.equal(submits, 1);
    assert.equal(executionNeedsReconciliation(second.execution), true);
    assert.equal(second.execution.id, first.execution.id);
    assert.deepEqual(await creditService.getLedger("user_21r"), ledger);
  });

  it("does not resubmit when process A dies after the pre-submit checkpoint", async () => {
    const journal = createMemoryCheckpointJournal();
    let submits = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const adapters = videoAdapter(async (req) => {
      submits++;
      await gate;
      return { providerJobId: `job_${req.executionId}`, status: "queued" };
    });
    const storeA = createDurableIdempotencyStore({ journal, persistRemote: false, storage: null });
    const pending = new GenerationExecutionEngine({
      adapters,
      idempotencyStore: storeA,
      sleep: async () => {},
    }).executeTask({ spec: mockSpec(), task: mockTask() });

    for (let i = 0; i < 50 && !journal.records.some((r) => r.execution.status === "submitting"); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    const inflight = journal.records.find((r) => r.execution.status === "submitting");
    assert.ok(inflight, "submitting identity must be durable before provider submit returns");
    assert.equal(inflight?.execution.productionId, "prod_p21r");
    assert.equal(inflight?.execution.taskId, "task_p21r");

    ProviderSubmissionRegistry.clear();
    const second = await new GenerationExecutionEngine({
      adapters,
      idempotencyStore: createDurableIdempotencyStore({ journal, persistRemote: false, storage: null }),
      sleep: async () => {},
    }).executeTask({ spec: mockSpec(), task: mockTask() });
    assert.equal(submits, 1);
    assert.equal(second.execution.id, inflight?.execution.id);
    assert.equal(executionNeedsReconciliation(second.execution), true);

    release();
    await pending;
  });

  it("refuses unknown cost instead of reserving zero", async () => {
    const repo = new InMemoryCreditRepository();
    await repo.setBalance("user_21r", 100);
    const creditService = new CreditService(repo);
    let submits = 0;
    const engine = new GenerationExecutionEngine({
      adapters: videoAdapter(async () => {
        submits++;
        return { providerJobId: "should_not", status: "queued" };
      }),
      creditService,
      userId: "user_21r",
      requireCredits: true,
      sleep: async () => {},
    });
    const original = CostEngine.estimateCost;
    CostEngine.estimateCost = (() => ({
      providerId: "kling",
      modelId: "kling-v2-6",
      modality: "video",
      currency: "USD",
      amount: null,
      unit: "per_generation",
      quantity: 1,
      status: "UNKNOWN",
      pricingVersion: "unknown",
      pricingSource: { source: "test", sourceType: "UNKNOWN", confidence: 0 },
    })) as typeof CostEngine.estimateCost;
    try {
      const result = await engine.executeTask({ spec: mockSpec(), task: mockTask() });
      assert.equal(submits, 0);
      assert.match(result.execution.error?.message || "", /Unknown provider cost/);
      assert.equal(await creditService.getBalance("user_21r"), 100);
    } finally {
      CostEngine.estimateCost = original;
    }
  });

  it("keeps paid video submit calls inside the canonical adapter", () => {
    const executionDir = import.meta.dirname;
    const repoRoot = join(executionDir, "../../../../..");
    const files = walk(join(repoRoot, "src")).filter(
      (file) => !file.endsWith(".test.ts") && !file.endsWith("productionVideoRequest.ts")
    );
    const callers = files.filter((file) => readFileSync(file, "utf8").includes("requestProductionVideoClip("));
    const relative = callers.map((file) => file.slice(repoRoot.length + 1)).sort();
    assert.deepEqual(relative, ["src/app/services/production/execution/adapters/videoI2vAdapter.ts"]);
    const asset = readFileSync(join(repoRoot, "src/app/services/production/productionAssetService.ts"), "utf8");
    assert.equal(asset.includes('executeCategoryRequest("videoGeneration"'), false);
    assert.equal(asset.includes('executeCategoryRequest("storyboardImages"'), false);
    const orchestrator = readFileSync(join(repoRoot, "src/app/services/runtime/AIProviderOrchestrator.ts"), "utf8");
    assert.equal(orchestrator.includes("requestProductionVideoClip("), false);
    const service = readFileSync(join(repoRoot, "src/app/services/productionService.ts"), "utf8");
    assert.match(service, /CreditService\.getInstance\(\)/);
    assert.match(service, /requireCredits: params\.requireCredits !== false/);
  });
});
