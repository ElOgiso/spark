import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ensureAssetBibleAssets } from "../preproduction/ensureAssetBibleAssets";
import { GenerationExecutionEngine } from "../execution/executionEngine";
import { createMemoryIdempotencyStore } from "../execution/idempotency";
import { CreditService } from "../credits/creditService";
import { InMemoryCreditRepository } from "../credits/creditRepository";
import { ProviderSubmissionRegistry } from "../execution/providerSubmission";
import type { MediaProviderAdapter } from "../execution/adapters/types";
import type { GenerationTask } from "../specification/generationTask";
import type { ProductionSpec } from "../specification/productionSpec";

const repoRoot = join(import.meta.dirname, "../../../../..");

function read(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

function mockSpec(): ProductionSpec {
  return {
    version: 1,
    project: {
      id: "prod_p22",
      brandId: "brand_test",
      title: "P22",
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

function mockTask(): GenerationTask {
  return {
    id: "task_p22",
    kind: "video",
    productionId: "prod_p22",
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
  } as GenerationTask;
}

function videoAdapter(submits: { n: number }): MediaProviderAdapter {
  return {
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
      submits.n += 1;
      return { providerJobId: `job_${submits.n}_${req.executionId}`, status: "succeeded" };
    },
    getStatus: async (id) => ({
      providerJobId: id,
      status: "succeeded",
      outputUrl: "https://storage.spark.io/clip.mp4",
    }),
    normalizeOutput: async (job) => ({
      mediaType: "video",
      sourceUrl: job.outputUrl || "https://storage.spark.io/clip.mp4",
      mimeType: "video/mp4",
      providerJobId: job.providerJobId,
      durationSec: 5,
      metadata: {},
    }),
  };
}

test("asset bible refuses paid sheets without explicit studio billing", async () => {
  const { ModelRouter } = await import("../../runtime/modelRouter");
  const original = ModelRouter.executeCategoryRequest;
  let calls = 0;
  ModelRouter.executeCategoryRequest = async () => {
    calls += 1;
    return "https://example.com/should-not-run.png";
  };
  try {
    const result = await ensureAssetBibleAssets({
      bible: [{ tag: "@prop_quiet", role: "prop", sheetKind: "prop", label: "Quiet Prop", notes: "none" }],
      brand: { name: "Studio" },
      productionId: "prod_no_bill",
      existingElements: [],
    });
    assert.equal(calls, 0);
    assert.equal(result.generated.length, 0);
    assert.match(result.errors[0]?.error || "", /explicit studio credit authorization/);
  } finally {
    ModelRouter.executeCategoryRequest = original;
  }
});

test("duplicate execute reuses one submit; forceNewExecution is a new attempt", async () => {
  ProviderSubmissionRegistry.clear();
  const submits = { n: 0 };
  const adapter = videoAdapter(submits);
  const adapters = new Map<string, MediaProviderAdapter>([
    ["video:kling", adapter],
    ["kling", adapter],
  ]);
  const store = createMemoryIdempotencyStore();
  const repo = new InMemoryCreditRepository();
  await repo.setBalance("user_p22", 200);
  const creditService = new CreditService(repo);
  const base = {
    adapters,
    idempotencyStore: store,
    creditService,
    userId: "user_p22",
    requireCredits: true,
    sleep: async () => {},
  };
  const first = await new GenerationExecutionEngine(base).executeTask({ spec: mockSpec(), task: mockTask() });
  assert.equal(first.execution.status, "succeeded");
  assert.equal(submits.n, 1);
  const second = await new GenerationExecutionEngine(base).executeTask({
    spec: mockSpec(),
    task: { ...mockTask(), status: "queued" },
  });
  assert.equal(second.execution.status, "succeeded");
  assert.equal(submits.n, 1);
  ProviderSubmissionRegistry.clear();
  const forced = await new GenerationExecutionEngine({ ...base, forceNewExecution: true }).executeTask({
    spec: mockSpec(),
    task: { ...mockTask(), status: "queued", completedOutput: undefined },
  });
  assert.equal(forced.execution.status, "succeeded");
  assert.equal(submits.n, 2);
  assert.notEqual(forced.execution.id, first.execution.id);
});

test("conversation_sessions migration is text-id, owner-scoped, and closed to anon", () => {
  const sql = read("supabase/migrations/20260926013000_conversation_sessions_secure.sql");
  assert.match(sql, /ALTER COLUMN id TYPE text/i);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /\(select auth\.uid\(\)\) = user_id/);
  assert.match(sql, /REVOKE ALL ON public\.conversation_sessions FROM anon/);
  assert.doesNotMatch(sql, /TO anon/);
  const repo = read("src/app/backend/repositories/conversationSessionRepository.ts");
  assert.match(repo, /conversation_sessions \$\{action\} failed/);
  assert.match(repo, /throw new Error/);
});

test("production generate does not call the asset-bible spender", () => {
  const asset = read("src/app/services/production/productionAssetService.ts");
  assert.equal(asset.includes("ensureAssetBibleAssets"), false);
  assert.equal(asset.includes('executeCategoryRequest("videoGeneration"'), false);
  assert.equal(asset.includes("requestProductionVideoClip("), false);
  const context = read("src/app/state/SparkContext.tsx");
  assert.match(context, /Duplicate generate ignored/);
  const guard = read("src/app/services/production/ProductionGenerationGuard.ts");
  assert.match(guard, /assertEnabled/);
});
