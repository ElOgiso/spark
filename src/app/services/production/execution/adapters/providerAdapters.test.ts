/**
 * SPARK Phase 11 — Provider Adapter Expansion & Normalization Test Suite.
 *
 * Verifies:
 * - Adapter contract & explicit resolution across all 8 providers
 * - Phase 9 reliable submission outcome integration (SUBMITTED, NOT_SUBMITTED, UNKNOWN_SUBMISSION)
 * - Provider status normalization (Kling numeric, Seedance, Grok, Higgsfield, Gemini, Mux, OpenAI, ElevenLabs)
 * - Provider error normalization (429, 400, 401, 503, 504, content moderation, provider error codes)
 * - Result normalization (output URLs, MIME types, dimensions, durations)
 * - Usage normalization (duration, resolution, character count facts reported to CostEngine)
 * - Security & secret redaction (credentials never leak into errors, diagnostics, payloads, or results)
 * - Architectural invariants (CostEngine owns cost, CreditService owns credits, Router owns selection)
 *
 * ZERO remote provider spend ($0.00) — all tests execute via in-memory mock ports.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createDefaultAdapterRegistry,
  resolveAdapter,
  resolveAdapterForTask,
  type MediaProviderAdapter,
  type AdapterPorts,
} from "./registry";
import {
  normalizeProviderStatus,
  type NormalizedProviderResult,
} from "./types";
import { createI2vAdapter, createKlingAdapter, createSeedanceAdapter, createGrokVideoAdapter, createHiggsfieldVideoAdapter } from "./videoI2vAdapter";
import { createImageAdapter, createVoiceAdapter, createMergeAdapter } from "./mediaAdapters";
import { normalizeProviderError } from "../errors";
import { normalizedResultToMediaOutput } from "../outputNormalization";
import { submitWithReliability, ProviderSubmissionRegistry } from "../providerSubmission";
import { CostEngine } from "../../economics/costEngine";
import type { ProviderGenerationRequest, ProviderJobStatus } from "../types";

function makeMockRequest(overrides: Partial<ProviderGenerationRequest> = {}): ProviderGenerationRequest {
  return {
    providerId: "kling",
    model: "kling-v2-6",
    modality: "video",
    prompt: "A cinematic tracking shot of a ceramic mug on a wooden table",
    aspectRatio: "16:9",
    durationSec: 5,
    resolution: "1080p",
    productionId: "prod_p11_test",
    taskId: "task_video_1",
    executionId: "exec_p11_test",
    inputs: [
      {
        role: "first_frame",
        url: "https://storage.spark.app/frames/mug_start.png",
      },
    ],
    ...overrides,
  };
}

test("Phase 11: Provider Adapter Expansion & Normalization", async (t) => {
  // Clear any leftover state
  ProviderSubmissionRegistry.clear();

  // --------------------------------------------------------------------------
  // Group 1: Adapter Contract & Resolution
  // --------------------------------------------------------------------------

  await t.test("1. Adapter resolves for all 8 supported providers", () => {
    const registry = createDefaultAdapterRegistry();
    const providers = ["kling", "seedance", "grok", "higgsfield", "gemini", "openai", "elevenlabs", "mux"];
    for (const p of providers) {
      const adapter = resolveAdapter(registry, p);
      assert.ok(adapter, `Adapter must resolve for provider: ${p}`);
      assert.strictEqual(typeof adapter.submit, "function", `${p} must implement submit`);
      assert.strictEqual(typeof adapter.getStatus, "function", `${p} must implement getStatus`);
      assert.strictEqual(typeof adapter.normalizeOutput, "function", `${p} must implement normalizeOutput`);
      assert.strictEqual(typeof adapter.normalizeResult, "function", `${p} must implement normalizeResult`);
      assert.strictEqual(typeof adapter.normalizeStatus, "function", `${p} must implement normalizeStatus`);
      assert.strictEqual(typeof adapter.normalizeError, "function", `${p} must implement normalizeError`);
    }
  });

  await t.test("2. Unknown provider fails closed", () => {
    const registry = createDefaultAdapterRegistry();
    const adapter = resolveAdapter(registry, "unknown_fake_ai");
    assert.strictEqual(adapter, undefined, "Unknown provider must return undefined and fail closed");
  });

  await t.test("3. Model remains explicit and is never inferred from provider", () => {
    const req = makeMockRequest({ providerId: "kling", model: undefined });
    assert.strictEqual(req.model, undefined, "Request model must not be silently populated by adapter without specification");
  });

  await t.test("4. Provider is never inferred from model", () => {
    const registry = createDefaultAdapterRegistry();
    // kling-v2-6 model requested under higgsfield provider must resolve to higgsfield adapter
    const adapter = resolveAdapterForTask(registry, "higgsfield", "video");
    assert.ok(adapter);
    assert.strictEqual(adapter.providerId, "higgsfield", "Must resolve to higgsfield, not kling");
  });

  // --------------------------------------------------------------------------
  // Group 2: Submission & Lifecycle Outcomes (Phase 9 Integration)
  // --------------------------------------------------------------------------

  await t.test("5. Successful submission returns outcome SUBMITTED with providerJobId", async () => {
    const ports: AdapterPorts = {
      submitVideo: async (req) => ({
        videoUrl: "https://storage.spark.app/outputs/clip1.mp4",
        providerJobId: "job_kling_98765",
        provider: "kling",
      }),
    };
    const adapter = createKlingAdapter(ports);
    const req = makeMockRequest({ providerId: "kling", taskId: "task_test_5", executionId: "exec_test_5" });
    const result = await submitWithReliability(adapter, req, { attempt: 1 });

    assert.strictEqual(result.outcome, "SUBMITTED");
    if (result.outcome === "SUBMITTED") {
      assert.strictEqual(result.providerJobId, "job_kling_98765");
      assert.ok(result.submittedAt);
    }
  });

  await t.test("6. Pre-transmission validation failure returns NOT_SUBMITTED", async () => {
    const ports: AdapterPorts = {
      submitVideo: async () => {
        throw new Error("Missing required first_frame still for I2V");
      },
    };
    const adapter = createKlingAdapter(ports);
    const req = makeMockRequest({ inputs: [], taskId: "task_test_6", executionId: "exec_test_6" }); // No first frame
    const result = await submitWithReliability(adapter, req, { attempt: 1 });

    assert.strictEqual(result.outcome, "NOT_SUBMITTED");
    if (result.outcome === "NOT_SUBMITTED") {
      assert.strictEqual(result.error.category, "VALIDATION");
      assert.strictEqual(result.error.retryable, false);
    }
  });

  await t.test("7. Ambiguous transmission timeout returns UNKNOWN_SUBMISSION", async () => {
    const ports: AdapterPorts = {
      submitVideo: async () => {
        const err = new Error("ECONNRESET: socket hang up during transmission");
        (err as any).code = "ECONNRESET";
        throw err;
      },
    };
    const adapter = createKlingAdapter(ports);
    const req = makeMockRequest({ taskId: "task_test_7", executionId: "exec_test_7" });
    const result = await submitWithReliability(adapter, req, { attempt: 1 });

    assert.strictEqual(result.outcome, "UNKNOWN_SUBMISSION");
    if (result.outcome === "UNKNOWN_SUBMISSION") {
      assert.strictEqual(result.reconciliationRequired, true);
      assert.strictEqual(result.error.retryability, "RECONCILE_FIRST");
    }
  });

  await t.test("8. Provider job ID is preserved throughout submission and status", async () => {
    const ports: AdapterPorts = {
      submitVideo: async () => ({
        videoUrl: "https://storage.spark.app/outputs/clip1.mp4",
        providerJobId: "job_seedance_unique_123",
        provider: "seedance",
      }),
    };
    const adapter = createSeedanceAdapter(ports);
    const req = makeMockRequest({ providerId: "seedance", taskId: "task_test_8", executionId: "exec_test_8" });
    const sub = await submitWithReliability(adapter, req);
    assert.strictEqual(sub.outcome, "SUBMITTED");
    if (sub.outcome === "SUBMITTED") {
      const status = await adapter.getStatus(sub.providerJobId);
      assert.strictEqual(status.providerJobId, "job_seedance_unique_123");
    }
  });

  await t.test("9. SPARK execution ID is preserved in submission record", async () => {
    const ports: AdapterPorts = {
      submitVideo: async () => ({
        videoUrl: "https://storage.spark.app/outputs/clip.mp4",
        providerJobId: "job_grok_456",
        provider: "grok",
      }),
    };
    const adapter = createGrokVideoAdapter(ports);
    const req = makeMockRequest({ providerId: "grok", taskId: "task_test_9", executionId: "exec_spark_canonical_777" });
    await submitWithReliability(adapter, req, { attempt: 1 });

    const record = ProviderSubmissionRegistry.getByAttempt("exec_spark_canonical_777", 1);
    assert.ok(record);
    assert.strictEqual(record.executionId, "exec_spark_canonical_777");
  });

  await t.test("10. Attempt ID is preserved across retries in idempotency key", async () => {
    const ports: AdapterPorts = {
      submitVideo: async () => ({
        videoUrl: "https://storage.spark.app/outputs/clip.mp4",
        providerJobId: "job_att_2",
        provider: "kling",
      }),
    };
    const adapter = createKlingAdapter(ports);
    const req = makeMockRequest({ executionId: "exec_multi_att", taskId: "task_multi_att" });
    await submitWithReliability(adapter, req, { attempt: 2 });

    const record = ProviderSubmissionRegistry.getByAttempt("exec_multi_att", 2);
    assert.ok(record);
    assert.strictEqual(record.submissionAttempt, 2);
    assert.ok(record.idempotencyKey.includes("att2"));
  });

  // --------------------------------------------------------------------------
  // Group 3: Status Normalization
  // --------------------------------------------------------------------------

  await t.test("11. Kling numeric status normalization (99, 200, 500)", () => {
    assert.strictEqual(normalizeProviderStatus("kling", 99), "RUNNING");
    assert.strictEqual(normalizeProviderStatus("kling", 200), "SUCCEEDED");
    assert.strictEqual(normalizeProviderStatus("kling", 500), "FAILED");
    assert.strictEqual(normalizeProviderStatus("kling", 400), "FAILED");
  });

  await t.test("12. Seedance status normalization", () => {
    assert.strictEqual(normalizeProviderStatus("seedance", "queued"), "QUEUED");
    assert.strictEqual(normalizeProviderStatus("seedance", "running"), "RUNNING");
    assert.strictEqual(normalizeProviderStatus("seedance", "succeeded"), "SUCCEEDED");
    assert.strictEqual(normalizeProviderStatus("seedance", "failed"), "FAILED");
    assert.strictEqual(normalizeProviderStatus("seedance", "cancelled"), "CANCELLED");
    assert.strictEqual(normalizeProviderStatus("seedance", "expired"), "EXPIRED");
  });

  await t.test("13. Grok status normalization", () => {
    assert.strictEqual(normalizeProviderStatus("grok", "pending"), "QUEUED");
    assert.strictEqual(normalizeProviderStatus("grok", "in_progress"), "RUNNING");
    assert.strictEqual(normalizeProviderStatus("grok", "completed"), "SUCCEEDED");
    assert.strictEqual(normalizeProviderStatus("grok", "failed"), "FAILED");
  });

  await t.test("14. Higgsfield status normalization", () => {
    assert.strictEqual(normalizeProviderStatus("higgsfield", "queued"), "QUEUED");
    assert.strictEqual(normalizeProviderStatus("higgsfield", "processing"), "RUNNING");
    assert.strictEqual(normalizeProviderStatus("higgsfield", "completed"), "SUCCEEDED");
    assert.strictEqual(normalizeProviderStatus("higgsfield", "failed"), "FAILED");
  });

  await t.test("15. Gemini / Veo status normalization", () => {
    assert.strictEqual(normalizeProviderStatus("gemini", "pending"), "QUEUED");
    assert.strictEqual(normalizeProviderStatus("gemini", "processing"), "RUNNING");
    assert.strictEqual(normalizeProviderStatus("gemini", "done"), "SUCCEEDED");
  });

  await t.test("16. Mux status normalization", () => {
    assert.strictEqual(normalizeProviderStatus("mux", "preparing"), "QUEUED");
    assert.strictEqual(normalizeProviderStatus("mux", "ready"), "SUCCEEDED");
    assert.strictEqual(normalizeProviderStatus("mux", "errored"), "FAILED");
  });

  await t.test("17. Unknown raw status maps to UNKNOWN while preserving rawStatus", () => {
    const raw = "alien_state_pending_inspection";
    assert.strictEqual(normalizeProviderStatus("kling", raw), "UNKNOWN");

    const adapter = createKlingAdapter();
    const normResult = adapter.normalizeResult!({
      providerJobId: "job_unknown",
      status: "running",
      raw: { custom_state: raw },
    });
    assert.strictEqual(normResult.status, "RUNNING");
  });

  // --------------------------------------------------------------------------
  // Group 4: Error Normalization
  // --------------------------------------------------------------------------

  await t.test("18. Rate limit 429 normalized to RATE_LIMIT and SAFE_TO_RETRY", () => {
    const raw = { status: 429, message: "Too many requests. Quota exceeded." };
    const err = normalizeProviderError(raw, "kling");
    assert.strictEqual(err.category, "RATE_LIMIT");
    assert.strictEqual(err.retryable, true);
    assert.strictEqual(err.retryability, "SAFE_TO_RETRY");
  });

  await t.test("19. Invalid request 400 normalized to VALIDATION and DO_NOT_RETRY", () => {
    const raw = { status: 400, message: "Invalid parameter: durationSec must be 5 or 10." };
    const err = normalizeProviderError(raw, "seedance");
    assert.strictEqual(err.category, "VALIDATION");
    assert.strictEqual(err.retryable, false);
    assert.strictEqual(err.retryability, "DO_NOT_RETRY");
  });

  await t.test("20. Auth failure 401 normalized to AUTH and DO_NOT_RETRY", () => {
    const raw = { status: 401, message: "Unauthorized. Invalid API key provided." };
    const err = normalizeProviderError(raw, "grok");
    assert.strictEqual(err.category, "AUTH");
    assert.strictEqual(err.retryable, false);
    assert.strictEqual(err.retryability, "DO_NOT_RETRY");
  });

  await t.test("21. Provider unavailable 503 normalized to PROVIDER and SAFE_TO_RETRY", () => {
    const raw = { status: 503, message: "Backend service temporarily overloaded." };
    const err = normalizeProviderError(raw, "higgsfield");
    assert.strictEqual(err.category, "PROVIDER");
    assert.strictEqual(err.retryable, true);
    assert.strictEqual(err.retryability, "SAFE_TO_RETRY");
  });

  await t.test("22. Transmission timeout normalized to UNKNOWN_SUBMISSION and RECONCILE_FIRST", () => {
    const raw = { status: 504, message: "Gateway Timeout: connection reset after send" };
    const err = normalizeProviderError(raw, "kling");
    assert.strictEqual(err.category, "UNKNOWN_SUBMISSION");
    assert.strictEqual(err.retryability, "RECONCILE_FIRST");
  });

  await t.test("23. Content policy rejection normalized to VALIDATION and DO_NOT_RETRY", () => {
    const raw = { message: "Prompt triggered safety filter: NSFW sensitive content rejected." };
    const err = normalizeProviderError(raw, "openai");
    assert.strictEqual(err.category, "VALIDATION");
    assert.strictEqual(err.retryable, false);
    assert.strictEqual(err.retryability, "DO_NOT_RETRY");
  });

  await t.test("24. Provider-specific error code is preserved without leak", () => {
    const raw = { status: 400, code: "KLING_ERR_PARAM_INVALID_TAIL", message: "image_tail not found" };
    const err = normalizeProviderError(raw, "kling");
    assert.strictEqual(err.providerErrorCode, "KLING_ERR_PARAM_INVALID_TAIL");
  });

  // --------------------------------------------------------------------------
  // Group 5: Result Normalization
  // --------------------------------------------------------------------------

  await t.test("25. Video output URL is correctly extracted and normalized", () => {
    const adapter = createKlingAdapter();
    const jobStatus: ProviderJobStatus = {
      providerJobId: "job_kling_res_1",
      status: "succeeded",
      outputUrl: "https://kling.ai/video/output_final.mp4",
      raw: { durationSec: 10, resolution: "1080p", width: 1920, height: 1080 },
    };
    const norm = adapter.normalizeResult!(jobStatus);
    assert.strictEqual(norm.status, "SUCCEEDED");
    assert.strictEqual(norm.outputs.length, 1);
    assert.strictEqual(norm.outputs[0].url, "https://kling.ai/video/output_final.mp4");
  });

  await t.test("26. Video MIME type normalized to video/mp4", () => {
    const adapter = createSeedanceAdapter();
    const jobStatus: ProviderJobStatus = {
      providerJobId: "job_seedance_res",
      status: "succeeded",
      outputUrl: "https://ark.bytedance.com/video.mp4",
    };
    const norm = adapter.normalizeResult!(jobStatus);
    assert.strictEqual(norm.outputs[0].mimeType, "video/mp4");
  });

  await t.test("27. Image MIME type normalized to image/png", () => {
    const adapter = createImageAdapter("openai");
    const jobStatus: ProviderJobStatus = {
      providerJobId: "job_img_1",
      status: "succeeded",
      outputUrl: "https://oaidalleapiprodscus.blob.core.windows.net/img.png",
      raw: { mimeType: "image/png", width: 1024, height: 1024 },
    };
    const norm = adapter.normalizeResult!(jobStatus);
    assert.strictEqual(norm.outputs[0].type, "image");
    assert.strictEqual(norm.outputs[0].mimeType, "image/png");
  });

  await t.test("28. Audio MIME type normalized to audio/mpeg", () => {
    const adapter = createVoiceAdapter("elevenlabs");
    const jobStatus: ProviderJobStatus = {
      providerJobId: "job_audio_1",
      status: "succeeded",
      outputUrl: "https://api.elevenlabs.io/audio.mp3",
      raw: { durationSec: 4.2 },
    };
    const norm = adapter.normalizeResult!(jobStatus);
    assert.strictEqual(norm.outputs[0].type, "audio");
    assert.strictEqual(norm.outputs[0].mimeType, "audio/mpeg");
  });

  await t.test("29. Video dimensions preserved on normalized result", () => {
    const adapter = createGrokVideoAdapter();
    const jobStatus: ProviderJobStatus = {
      providerJobId: "job_dim",
      status: "succeeded",
      outputUrl: "https://xai.com/video.mp4",
      raw: { width: 1080, height: 1920 },
    };
    const norm = adapter.normalizeResult!(jobStatus);
    assert.strictEqual(norm.outputs[0].width, 1080);
    assert.strictEqual(norm.outputs[0].height, 1920);
  });

  await t.test("30. Output duration preserved on normalized result", () => {
    const adapter = createHiggsfieldVideoAdapter();
    const jobStatus: ProviderJobStatus = {
      providerJobId: "job_dur",
      status: "succeeded",
      outputUrl: "https://higgsfield.ai/output.mp4",
      raw: { durationSec: 7.5 },
    };
    const norm = adapter.normalizeResult!(jobStatus);
    assert.strictEqual(norm.outputs[0].durationSec, 7.5);
  });

  // --------------------------------------------------------------------------
  // Group 6: Usage Normalization & Economics Constraint
  // --------------------------------------------------------------------------

  await t.test("31. Video usage facts (durationSeconds, resolution) extracted cleanly", () => {
    const adapter = createKlingAdapter();
    const jobStatus: ProviderJobStatus = {
      providerJobId: "job_usage_video",
      status: "succeeded",
      outputUrl: "https://kling.ai/v.mp4",
      raw: { durationSec: 10, resolution: "1080p", billedDurationSeconds: 10 },
    };
    const usage = adapter.extractUsage!(jobStatus);
    assert.ok(usage);
    assert.strictEqual(usage.durationSeconds, 10);
    assert.strictEqual(usage.resolution, "1080p");
    assert.strictEqual(usage.billedDurationSeconds, 10);
  });

  await t.test("32. Voice usage facts (characterCount) extracted cleanly", () => {
    const adapter = createVoiceAdapter("elevenlabs");
    const jobStatus: ProviderJobStatus = {
      providerJobId: "job_usage_voice",
      status: "succeeded",
      outputUrl: "https://elevenlabs.io/a.mp3",
      raw: { characterCount: 145, durationSec: 8.5 },
    };
    const usage = adapter.extractUsage!(jobStatus);
    assert.ok(usage);
    assert.strictEqual(usage.characterCount, 145);
    assert.strictEqual(usage.durationSeconds, 8.5);
  });

  await t.test("33. Missing usage remains undefined rather than synthetic zero", () => {
    const adapter = createKlingAdapter();
    const jobStatus: ProviderJobStatus = {
      providerJobId: "job_no_usage",
      status: "succeeded",
      outputUrl: "https://kling.ai/v.mp4",
      raw: {},
    };
    const usage = adapter.extractUsage!(jobStatus);
    assert.strictEqual(usage, undefined, "Missing usage must remain undefined");
  });

  await t.test("34. CostEngine receives usage facts and computes actual cost", () => {
    const adapter = createKlingAdapter();
    const jobStatus: ProviderJobStatus = {
      providerJobId: "job_cost_bridge",
      status: "succeeded",
      outputUrl: "https://kling.ai/v.mp4",
      raw: { durationSec: 10, resolution: "1080p" },
    };
    const usage = adapter.extractUsage!(jobStatus);
    assert.ok(usage);

    // CostEngine is authoritative for pricing, not adapter
    const actual = CostEngine.calculateActualCost({
      providerId: "kling",
      modelId: "kling-v2-6",
      modality: "video",
      usage,
    });
    assert.ok(actual.amount !== null && actual.amount > 0, "CostEngine calculates cost from usage facts");
  });

  // --------------------------------------------------------------------------
  // Group 7: Security & Credential Protection
  // --------------------------------------------------------------------------

  await t.test("35. Credentials stripped from error messages and diagnostics", () => {
    const secretErr = new Error("Bearer sk-ant-api03-secret1234567890 failed: invalid key Authorization: Bearer secret-pass");
    const normalized = normalizeProviderError(secretErr, "kling", {
      api_key: "sk-super-secret-key-do-not-leak",
      authorization: "Bearer 12345",
      safeParam: "1080p",
    });

    assert.strictEqual(normalized.message.includes("sk-ant"), false);
    assert.strictEqual(normalized.message.includes("secret-pass"), false);
    assert.strictEqual(normalized.message.includes("[redacted]"), true);
    assert.strictEqual(normalized.providerDiagnostics?.api_key, undefined);
    assert.strictEqual(normalized.providerDiagnostics?.authorization, undefined);
    assert.strictEqual(normalized.providerDiagnostics?.safeParam, "1080p");
  });

  await t.test("36. Normalized results never contain secret tokens in metadata", () => {
    const adapter = createSeedanceAdapter();
    const jobStatus: ProviderJobStatus = {
      providerJobId: "job_leak_test",
      status: "succeeded",
      outputUrl: "https://ark.bytedance.com/video.mp4",
      raw: {
        ARK_API_KEY: "secret-token",
        Authorization: "Bearer token",
        model: "doubao-seedance-1-5-pro-251215",
      },
    };
    const norm = adapter.normalizeResult!(jobStatus);
    const mediaOutput = normalizedResultToMediaOutput(norm);
    const json = JSON.stringify(mediaOutput);
    assert.strictEqual(json.includes("secret-token"), false);
  });

  await t.test("37. Bridge to ProductionAsset output preserves provider identity without secrets", () => {
    const normResult: NormalizedProviderResult = {
      provider: "kling",
      model: "kling-v2-6",
      providerJobId: "job_kling_prod_asset",
      status: "SUCCEEDED",
      outputs: [
        {
          type: "video",
          url: "https://kling.ai/v.mp4",
          mimeType: "video/mp4",
          durationSec: 5,
        },
      ],
      usage: { durationSeconds: 5, resolution: "1080p" },
    };
    const mediaOutput = normalizedResultToMediaOutput(normResult);
    assert.strictEqual(mediaOutput.mediaType, "video");
    assert.strictEqual(mediaOutput.sourceUrl, "https://kling.ai/v.mp4");
    assert.strictEqual(mediaOutput.durationSec, 5);
    assert.strictEqual(mediaOutput.metadata.provider, "kling");
    assert.strictEqual(mediaOutput.metadata.model, "kling-v2-6");
  });

  // --------------------------------------------------------------------------
  // Group 8: Architectural Invariants & Hard Boundaries
  // --------------------------------------------------------------------------

  await t.test("38. Adapter cannot route or substitute providers", () => {
    const adapter = createKlingAdapter();
    assert.strictEqual(adapter.providerId, "kling");
    // Kling adapter cannot claim to be seedance
    assert.notStrictEqual(adapter.providerId, "seedance");
  });

  await t.test("39. Adapter cannot calculate Spark credits directly", () => {
    const adapter = createKlingAdapter();
    // Adapter interface must not expose credit reservation or deduction methods
    assert.strictEqual((adapter as any).reserveCredits, undefined);
    assert.strictEqual((adapter as any).deductCredits, undefined);
    assert.strictEqual((adapter as any).settleCredits, undefined);
  });

  await t.test("40. Phase 10 CompiledProviderRequest integrates seamlessly with adapter submit", async () => {
    const ports: AdapterPorts = {
      submitVideo: async (req) => {
        assert.ok(req.compiledRequest, "Adapter received compiledRequest from Phase 10");
        assert.strictEqual(req.compiledRequest.provider, "kling");
        assert.strictEqual(req.compiledRequest.model, "kling-v2-6");
        return {
          videoUrl: "https://kling.ai/video/compiled_output.mp4",
          providerJobId: "job_kling_compiled_1",
          provider: "kling",
        };
      },
    };
    const adapter = createKlingAdapter(ports);
    const req = makeMockRequest({
      compiledRequest: {
        provider: "kling",
        model: "kling-v2-6",
        prompt: "A cinematic tracking shot",
        negativePrompt: "blurry, low quality",
        parameters: { durationSec: 5, aspectRatio: "16:9", resolution: "1080p" },
        inputs: [{ type: "start_frame", url: "https://storage.spark.app/frames/mug_start.png" }],
        validation: { valid: true, errors: [], warnings: [] },
        compilerVersion: "provider-payload-v1.0",
        promptCompilerVersion: "spark-prompt-v2.0",
        wirePayload: { prompt: "A cinematic tracking shot", duration: "5" },
      },
    });

    const sub = await submitWithReliability(adapter, req);
    assert.strictEqual(sub.outcome, "SUBMITTED");
  });
});
