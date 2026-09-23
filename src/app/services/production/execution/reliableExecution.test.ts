import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { GenerationExecutionEngine } from "./executionEngine";
import { CreditService } from "../credits/creditService";
import { InMemoryCreditRepository } from "../credits/creditRepository";
import { normalizeProviderStatus } from "./adapters/types";
import { classifyRetryability, makeExecutionError } from "./errors";
import { buildSubmissionIdempotencyKey, ProviderSubmissionRegistry, submitWithReliability } from "./providerSubmission";
import { ReconciliationEngine } from "./reconciliationEngine";
import { createMemoryIdempotencyStore } from "./idempotency";
import type { MediaProviderAdapter } from "./adapters/types";
import type { GenerationTask } from "../specification/generationTask";
import type { ProductionSpec } from "../specification/productionSpec";
import type { ProviderGenerationRequest, ProviderJobStatus } from "./types";

function mockSpec(): ProductionSpec {
  return {
    version: 1,
    project: {
      id: "prod_p9_test",
      brandId: "brand_test",
      title: "P9 Test",
      status: "draft",
      aspectRatio: "16:9",
      targetDurationSec: 5,
    } as any,
    creative: {
      intent: "A futuristic skyline",
    } as any,
    routing: { defaultProvider: "kling", shotDecisions: [] } as any,
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
            voicePrompt: "Welcome to the future",
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
    ] as any,
  } as any;
}

function mockTask(overrides: Partial<GenerationTask> = {}): GenerationTask {
  return {
    id: "task_p9_1",
    kind: "video",
    productionId: "prod_p9_test",
    sceneId: "sc_1",
    shotId: "sh_1",
    aspectRatio: "16:9",
    durationSec: 5,
    strategy: {
      modality: "video",
      strategy: "image_to_video",
    },
    requiredCapabilities: ["image_to_video"],
    dependsOn: [],
    status: "planned",
    selectedModel: "kling-v2-6",
    ...overrides,
  };
}

describe("SPARK Phase 9: Reliable Generation Execution", () => {
  beforeEach(() => {
    ProviderSubmissionRegistry.clear();
  });
  it("1. Complete happy path: quotes & reserves credits, submits, polls, succeeds, and settles actual credits", async () => {
    const repo = new InMemoryCreditRepository();
    await repo.setBalance("user_123", 100);
    const creditService = new CreditService(repo);

    const mockAdapter: MediaProviderAdapter = {
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
      submit: async (req) => ({ providerJobId: `kling_job_${req.executionId}`, status: "queued" }),
      getStatus: async (jobId) => ({ providerJobId: jobId, status: "succeeded", outputUrl: "https://storage.spark.io/clip.mp4" }),
      normalizeOutput: async (job) => ({
        mediaType: "video",
        sourceUrl: job.outputUrl!,
        mimeType: "video/mp4",
        providerJobId: job.providerJobId,
        durationSec: 5,
        metadata: {},
      }),
    };

    const adapters = new Map<string, MediaProviderAdapter>([
      ["video:kling", mockAdapter],
      ["kling", mockAdapter],
    ]);

    const engine = new GenerationExecutionEngine({
      adapters,
      creditService,
      userId: "user_123",
      sleep: async () => {},
    });

    const spec = mockSpec();
    const task = mockTask({
      selectedProvider: "kling",
      selectedModel: "kling-v2-6",
    });

    const result = await engine.executePlan({
      spec,
      tasks: [task],
      dag: { productionId: spec.project.id, nodes: [{ id: task.id, status: "pending", dependsOn: [] }], dependentsIndex: {}, version: 1 },
    });

    assert.equal(result.ok, true);
    assert.equal(result.executions.length, 1);
    assert.equal(result.executions[0].status, "succeeded");

    // Check credits were settled: Kling 5s at $0.35 = 35 credits
    const balance = await creditService.getBalance("user_123");
    assert.equal(balance, 65); // 100 - 35 = 65

    const ledger = await creditService.getLedger("user_123");
    assert.equal(ledger.length >= 2, true);
    assert.equal(ledger[0].type, "RESERVATION");
    assert.equal(ledger[0].delta, -35);
  });

  it("2. Pre-acceptance failure (NOT_SUBMITTED) cleanly releases credit reservation", async () => {
    const repo = new InMemoryCreditRepository();
    await repo.setBalance("user_123", 100);
    const creditService = new CreditService(repo);

    const rejectingAdapter: MediaProviderAdapter = {
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
      submit: async () => {
        throw makeExecutionError("invalid_request", "Prompt violated content safety guidelines", {
          retryable: false,
        });
      },
      getStatus: async (id) => ({ providerJobId: id, status: "failed" }),
      normalizeOutput: async () => { throw new Error(); },
    };

    const adapters = new Map<string, MediaProviderAdapter>([
      ["video:kling", rejectingAdapter],
      ["kling", rejectingAdapter],
    ]);

    const engine = new GenerationExecutionEngine({
      adapters,
      creditService,
      userId: "user_123",
      sleep: async () => {},
    });

    const spec = mockSpec();
    const task = mockTask({ selectedProvider: "kling" });

    const result = await engine.executePlan({
      spec,
      tasks: [task],
      dag: { productionId: spec.project.id, nodes: [{ id: task.id, status: "pending", dependsOn: [] }], dependentsIndex: {}, version: 1 },
    });

    assert.equal(result.ok, false);
    assert.equal(result.executions[0].status, "exhausted");

    // Full refund/release of reservation: balance restored to 100
    const balance = await creditService.getBalance("user_123");
    assert.equal(balance, 100);

    const ledger = await creditService.getLedger("user_123");
    const releaseTx = ledger.find((tx) => tx.type === "RELEASE");
    assert.ok(releaseTx, "Expected RELEASE ledger transaction");
    assert.equal(releaseTx?.delta, 35);
  });

  it("3. Ambiguous timeout produces UNKNOWN_SUBMISSION and preserves hold in PENDING_UNKNOWN without releasing credits", async () => {
    const repo = new InMemoryCreditRepository();
    await repo.setBalance("user_123", 100);
    const creditService = new CreditService(repo);
    const idempotencyStore = createMemoryIdempotencyStore();
    let submits = 0;

    const timeoutAdapter: MediaProviderAdapter = {
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
      submit: async () => {
        submits++;
        throw new Error("504 Gateway Timeout: connection reset after send");
      },
      getStatus: async (id) => ({ providerJobId: id, status: "failed" }),
      normalizeOutput: async () => { throw new Error(); },
    };

    const adapters = new Map<string, MediaProviderAdapter>([
      ["video:kling", timeoutAdapter],
      ["kling", timeoutAdapter],
    ]);

    const engine = new GenerationExecutionEngine({
      adapters,
      idempotencyStore,
      creditService,
      userId: "user_123",
      sleep: async () => {},
    });

    const spec = mockSpec();
    const task = mockTask({ selectedProvider: "kling" });

    const result = await engine.executePlan({
      spec,
      tasks: [task],
      dag: { productionId: spec.project.id, nodes: [{ id: task.id, status: "pending", dependsOn: [] }], dependentsIndex: {}, version: 1 },
    });

    assert.equal(result.ok, false);
    assert.equal(result.state, "running");
    assert.equal(result.tasks[0].status, "running");
    assert.equal(result.executions[0].status, "reconciling");
    assert.equal(result.executions[0].completedAt, undefined);
    // CRITICAL: Credits MUST NOT be released when submission outcome is unknown!
    const balance = await creditService.getBalance("user_123");
    assert.equal(balance, 65); // 35 credits remain protected under PENDING_UNKNOWN hold

    const ledger = await creditService.getLedger("user_123");
    const holdTx = ledger.find((tx) => tx.type === "PENDING_UNKNOWN");
    assert.ok(holdTx, "Expected PENDING_UNKNOWN ledger transaction");
    const submissionReplay = await submitWithReliability(timeoutAdapter, {
      providerId: "kling", modality: "video", prompt: "A futuristic skyline",
      productionId: task.productionId, taskId: task.id, executionId: "replay", inputs: [],
    }, { attempt: 1, inputHash: result.executions[0].inputHash });
    assert.equal(submissionReplay.outcome, "UNKNOWN_SUBMISSION");
    assert.equal(submits, 1);
    // A new executor using the existing store must not reserve or submit again,
    // even if its caller passes the original planned task.
    ProviderSubmissionRegistry.clear();
    const resumed = new GenerationExecutionEngine({ adapters, idempotencyStore, creditService, userId: "user_123", sleep: async () => {} });
    const replay = await resumed.executePlan({ spec, tasks: [task], dag: result.dag });
    assert.equal(replay.tasks[0].status, "running");
    assert.equal(submits, 1);
    assert.deepEqual(await creditService.getLedger("user_123"), ledger);
  });

  it("4. Reconciliation successfully recovers in-flight provider job ID (FOUND) and completes execution", async () => {
    const repo = new InMemoryCreditRepository();
    await repo.setBalance("user_123", 100);
    const creditService = new CreditService(repo);

    let submitAttempts = 0;
    const flakyAdapter: MediaProviderAdapter = {
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
      submit: async (req) => {
        submitAttempts++;
        throw new Error("ECONNRESET: socket hang up");
      },
      getStatus: async (jobId) => {
        if (jobId === "kling_recovered_job_99") {
          return { providerJobId: jobId, status: "succeeded", outputUrl: "https://storage.spark.io/recovered.mp4" };
        }
        return { providerJobId: jobId, status: "failed", errorMessage: "unknown_job" };
      },
      normalizeOutput: async (job) => ({
        mediaType: "video",
        sourceUrl: job.outputUrl!,
        mimeType: "video/mp4",
        providerJobId: job.providerJobId,
        durationSec: 5,
        metadata: {},
      }),
    };

    const adapters = new Map<string, MediaProviderAdapter>([
      ["video:kling", flakyAdapter],
      ["kling", flakyAdapter],
    ]);

    const engine = new GenerationExecutionEngine({
      adapters,
      creditService,
      userId: "user_123",
      sleep: async () => {},
      // Injected reconciliation lookup finds the job that the provider actually created
      lookupFn: async (idempotencyKey) => {
        return {
          providerJobId: "kling_recovered_job_99",
          status: "succeeded",
          outputUrl: "https://storage.spark.io/recovered.mp4",
        };
      },
    });

    const spec = mockSpec();
    const task = mockTask({ selectedProvider: "kling" });

    const result = await engine.executePlan({
      spec,
      tasks: [task],
      dag: { productionId: spec.project.id, nodes: [{ id: task.id, status: "pending", dependsOn: [] }], dependentsIndex: {}, version: 1 },
    });

    assert.equal(result.ok, true);
    assert.equal(result.executions[0].status, "succeeded");
    assert.equal(result.executions[0].providerJobId, "kling_recovered_job_99");

    const balance = await creditService.getBalance("user_123");
    assert.equal(balance, 65); // Settled correctly upon successful reconciliation
  });

  it("5. Reconciliation confirms request never reached provider (CONFIRMED_NOT_SUBMITTED) and releases credit hold", async () => {
    const repo = new InMemoryCreditRepository();
    await repo.setBalance("user_123", 100);
    const creditService = new CreditService(repo);

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
      submit: async () => {
        throw new Error("Gateway timeout");
      },
      getStatus: async (id) => ({ providerJobId: id, status: "failed" }),
      normalizeOutput: async () => { throw new Error(); },
    };

    const adapters = new Map<string, MediaProviderAdapter>([["video:kling", adapter], ["kling", adapter]]);

    const engine = new GenerationExecutionEngine({
      adapters,
      creditService,
      userId: "user_123",
      sleep: async () => {},
      lookupFn: async () => null, // Confirms: job does NOT exist on provider
    });

    const spec = mockSpec();
    const task = mockTask({ selectedProvider: "kling" });

    const result = await engine.executePlan({
      spec,
      tasks: [task],
      dag: { productionId: spec.project.id, nodes: [{ id: task.id, status: "pending", dependsOn: [] }], dependentsIndex: {}, version: 1 },
    });

    assert.equal(result.ok, false);
    // Since reconciliation confirmed not submitted, the hold is safely released
    const balance = await creditService.getBalance("user_123");
    assert.equal(balance, 100);
  });

  it("6. Retry classifier correctly marks UNKNOWN_SUBMISSION as RECONCILE_FIRST", () => {
    const unknownErr = makeExecutionError("unknown_submission", "Connection dropped after payload send");
    assert.equal(classifyRetryability(unknownErr), "RECONCILE_FIRST");

    const authErr = makeExecutionError("authentication_failed", "Invalid API key");
    assert.equal(classifyRetryability(authErr), "DO_NOT_RETRY");

    const capErr = makeExecutionError("unsupported_capability", "120s video unsupported");
    assert.equal(classifyRetryability(capErr), "DO_NOT_RETRY");

    const rateErr = makeExecutionError("rate_limited", "Rate limit exceeded");
    assert.equal(classifyRetryability(rateErr), "SAFE_TO_RETRY");
  });

  it("7. Provider status normalization across Kling, Seedance, Grok, Higgsfield, Gemini", () => {
    assert.equal(normalizeProviderStatus("kling", 200), "SUCCEEDED");
    assert.equal(normalizeProviderStatus("kling", 99), "RUNNING");
    assert.equal(normalizeProviderStatus("kling", 500), "FAILED");

    assert.equal(normalizeProviderStatus("seedance", "SUCCEEDED"), "SUCCEEDED");
    assert.equal(normalizeProviderStatus("seedance", "RUNNING"), "RUNNING");
    assert.equal(normalizeProviderStatus("seedance", "QUEUED"), "QUEUED");
    assert.equal(normalizeProviderStatus("seedance", "FAILED"), "FAILED");

    assert.equal(normalizeProviderStatus("grok", "done"), "SUCCEEDED");
    assert.equal(normalizeProviderStatus("grok", "processing"), "RUNNING");
    assert.equal(normalizeProviderStatus("grok", "pending"), "QUEUED");
    assert.equal(normalizeProviderStatus("grok", "error"), "FAILED");

    assert.equal(normalizeProviderStatus("higgsfield", "completed"), "SUCCEEDED");
    assert.equal(normalizeProviderStatus("higgsfield", "queued"), "QUEUED");
  });

  it("8. Submission idempotency prevents duplicate provider jobs on replayed attempt", async () => {
    ProviderSubmissionRegistry.clear();

    let remoteCalls = 0;
    let finishSubmission!: () => void;
    const pendingSubmission = new Promise<void>(resolve => { finishSubmission = resolve; });
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
      submit: async (req) => {
        remoteCalls++;
        await pendingSubmission;
        return { providerJobId: "kling_job_idem_1", status: "queued" };
      },
      getStatus: async (id) => ({ providerJobId: id, status: "succeeded" }),
      normalizeOutput: async () => ({ mediaType: "video", sourceUrl: "url", mimeType: "video/mp4", providerJobId: "id", durationSec: 5, metadata: {} }),
    };

    const request: ProviderGenerationRequest = {
      providerId: "kling",
      modality: "video",
      prompt: "prompt",
      productionId: "prod_1",
      taskId: "task_1",
      executionId: "exec_1",
      inputs: [],
    };

    const first = submitWithReliability(adapter, request, { attempt: 1, inputHash: "hash_123" });
    try {
      const concurrent = await submitWithReliability(adapter, request, { attempt: 1, inputHash: "hash_123" });
      assert.equal(concurrent.outcome, "UNKNOWN_SUBMISSION");
      assert.equal(remoteCalls, 1);
    } finally {
      finishSubmission();
    }
    const res1 = await first;
    assert.equal(res1.outcome, "SUBMITTED");
    assert.equal(remoteCalls, 1);

    // Replay identical attempt
    const res2 = await submitWithReliability(adapter, request, { attempt: 1, inputHash: "hash_123" });
    assert.equal(res2.outcome, "SUBMITTED");
    assert.equal((res2 as any).providerJobId, "kling_job_idem_1");
    assert.equal(remoteCalls, 1); // Deduplicated!
  });

  it("9. Polling network glitch does not falsely abort a healthy in-flight job", async () => {
    let pollAttempts = 0;
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
      submit: async (req) => ({ providerJobId: `kling_glitch_${req.executionId}`, status: "queued" }),
      getStatus: async (jobId) => {
        pollAttempts++;
        if (pollAttempts === 1) return { providerJobId: jobId, status: "running" };
        if (pollAttempts === 2) throw new Error("Transient network glitch during poll");
        return { providerJobId: jobId, status: "succeeded", outputUrl: "https://storage.spark.io/success.mp4" };
      },
      normalizeOutput: async (job) => ({
        mediaType: "video",
        sourceUrl: job.outputUrl!,
        mimeType: "video/mp4",
        providerJobId: job.providerJobId,
        durationSec: 5,
        metadata: {},
      }),
    };

    const adapters = new Map<string, MediaProviderAdapter>([["video:kling", adapter], ["kling", adapter]]);

    const engine = new GenerationExecutionEngine({
      adapters,
      sleep: async () => {},
    });

    const spec = mockSpec();
    const task = mockTask({ selectedProvider: "kling" });

    const result = await engine.executePlan({
      spec,
      tasks: [task],
      dag: { productionId: spec.project.id, nodes: [{ id: task.id, status: "pending", dependsOn: [] }], dependentsIndex: {}, version: 1 },
    });

    assert.equal(result.ok, true);
    assert.equal(result.executions[0].status, "succeeded");
  });

  it("10. Multi-attempt retry accumulates billable provider costs for final credit settlement", async () => {
    const repo = new InMemoryCreditRepository();
    await repo.setBalance("user_123", 200);
    const creditService = new CreditService(repo);

    let attemptCount = 0;
    const retryAdapter: MediaProviderAdapter = {
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
      submit: async (req) => {
        attemptCount++;
        return { providerJobId: `kling_att_${attemptCount}`, status: "queued" };
      },
      getStatus: async (jobId) => {
        if (jobId === "kling_att_1") {
          // Attempt 1 fails at provider after billable compute
          return { providerJobId: jobId, status: "failed", errorMessage: "Rendering failed during video output" };
        }
        return { providerJobId: jobId, status: "succeeded", outputUrl: "https://storage.spark.io/final.mp4" };
      },
      normalizeOutput: async (job) => ({
        mediaType: "video",
        sourceUrl: job.outputUrl!,
        mimeType: "video/mp4",
        providerJobId: job.providerJobId,
        durationSec: 5,
        metadata: {},
      }),
    };

    const adapters = new Map<string, MediaProviderAdapter>([["video:kling", retryAdapter], ["kling", retryAdapter]]);

    const engine = new GenerationExecutionEngine({
      adapters,
      creditService,
      userId: "user_123",
      sleep: async () => {},
    });

    const spec = mockSpec();
    spec.project.id = "prod_p9_test_10";
    const task = mockTask({
      id: "task_p9_10",
      productionId: "prod_p9_test_10",
      selectedProvider: "kling",
      maxRetries: 2,
    });

    const result = await engine.executePlan({
      spec,
      tasks: [task],
      dag: { productionId: spec.project.id, nodes: [{ id: task.id, status: "pending", dependsOn: [] }], dependentsIndex: {}, version: 1 },
    });

    assert.equal(result.ok, true);
    assert.equal(result.executions[0].status, "succeeded");
    assert.equal(attemptCount, 2);

    // Both attempts were billable ($0.35 + $0.35 = $0.70 -> 70 credits)
    const balance = await creditService.getBalance("user_123");
    assert.equal(balance, 130); // 200 - 70 = 130 credits
  });
});
