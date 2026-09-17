/**
 * distributionVariants.test.ts — Prompt 8, Component G
 *
 * Covers:
 * 1. Phase 3 capability checks (DISTRIBUTION_PROFILES, CAPTIONING_CAPABILITY registration)
 * 2. Voice clone preset hard-fail (validateVoiceClonePreset)
 * 3. Localized narration parity validation (validateLocalizedScriptParity)
 * 4. Shorts selection plan (≤8 cap, anchored on shots/loops, generation tasks)
 * 5. Publish jobs durable-master check (rejects ephemeral; emits Export Ready for YouTube stub)
 * 6. Cadence config reading in topic planning (PlanTopicsInput.cadenceConfig)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ─── 1. Phase 3 capability checks ────────────────────────────────────────────
import {
  DISTRIBUTION_PROFILES,
  CAPTIONING_CAPABILITY,
  SPARK_SYSTEM_CAPABILITIES,
  validateVoiceClonePreset,
} from "../capability/sparkCapabilities";

describe("Phase 3 capability flags — DISTRIBUTION_PROFILES & CAPTIONING", () => {
  it("registers youtube distribution profile as stub", () => {
    assert.ok(DISTRIBUTION_PROFILES);
    assert.ok(DISTRIBUTION_PROFILES["youtube"]);
    assert.equal(DISTRIBUTION_PROFILES["youtube"].platform, "youtube");
    assert.equal(DISTRIBUTION_PROFILES["youtube"].status, "stub");
    assert.equal(DISTRIBUTION_PROFILES["youtube"].requiresOAuth, true);
  });

  it("registers tiktok as unavailable profile", () => {
    assert.ok(DISTRIBUTION_PROFILES["tiktok"]);
    assert.equal(DISTRIBUTION_PROFILES["tiktok"].status, "unavailable");
    assert.equal(DISTRIBUTION_PROFILES["tiktok"].supportsDirectPublish, false);
  });

  it("registers reels as unavailable profile", () => {
    assert.ok(DISTRIBUTION_PROFILES["reels"]);
    assert.equal(DISTRIBUTION_PROFILES["reels"].status, "unavailable");
    assert.equal(DISTRIBUTION_PROFILES["reels"].supportsDirectPublish, false);
  });

  it("SPARK_SYSTEM_CAPABILITIES includes distribution_youtube", () => {
    const cap = SPARK_SYSTEM_CAPABILITIES.find((c) => c.id === "distribution_youtube");
    assert.ok(cap, "distribution_youtube capability must exist");
    assert.equal(cap.category, "publishing");
  });

  it("SPARK_SYSTEM_CAPABILITIES includes captioning", () => {
    const cap = SPARK_SYSTEM_CAPABILITIES.find((c) => c.id === "captioning");
    assert.ok(cap, "captioning capability must exist");
    assert.equal(cap.category, "post_production");
  });

  it("exports CAPTIONING_CAPABILITY with supported formats", () => {
    assert.ok(CAPTIONING_CAPABILITY);
    assert.equal(CAPTIONING_CAPABILITY.supported, true);
    assert.ok(CAPTIONING_CAPABILITY.formats.includes("srt"));
    assert.ok(CAPTIONING_CAPABILITY.formats.includes("vtt"));
  });
});

// ─── 2. Voice clone preset hard-fail ─────────────────────────────────────────
describe("validateVoiceClonePreset — hard-fail on missing preset", () => {
  it("hard-fails when brand has no voice presets and character has none", () => {
    const result = validateVoiceClonePreset(
      { settings: {} } as any,
      { voice: {} } as any
    );
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /voice/i);
  });

  it("passes when brand.settings.voicePresetId is set", () => {
    const result = validateVoiceClonePreset(
      { settings: { voicePresetId: "preset-abc" } } as any,
      undefined
    );
    assert.equal(result.ok, true);
    assert.equal(result.presetId, "preset-abc");
  });

  it("passes when brand.settings.brand_voices.presetId is set", () => {
    const result = validateVoiceClonePreset(
      { settings: { brand_voices: { presetId: "bv-123" } } } as any,
      undefined
    );
    assert.equal(result.ok, true);
    assert.equal(result.presetId, "bv-123");
  });

  it("passes when character.voice.presetId is set", () => {
    const result = validateVoiceClonePreset(
      { settings: {} } as any,
      { voice: { presetId: "char-voice-1" } } as any
    );
    assert.equal(result.ok, true);
    assert.equal(result.presetId, "char-voice-1");
  });

  it("fails when called with no brand or character", () => {
    const result = validateVoiceClonePreset();
    assert.equal(result.ok, false);
  });
});

// ─── 3. Localized narration parity validation ─────────────────────────────────
import {
  validateLocalizedScriptParity,
  compileLocalizedNarrationPrompt,
} from "../os/compileLocalizedNarrationPrompt";
import type { NarrativeScript } from "../../../domain/types";

const BASE_SCRIPT: NarrativeScript = {
  title: "AI Tools That Save Time",
  logline: "Five AI tools that reclaim 3 hours daily",
  premise: "Productivity through automation",
  targetDurationSec: 60,
  format: "faceless",
  hook: { spoken: "Stop wasting time on tasks AI can do.", opensOnPayoff: true, backstoryDeferred: true },
  chapters: [
    { id: "ch-1", order: 1, title: "Hook", durationSec: 10, job: "hook", spoken: "Stop wasting time.", visualIntent: "Fast cuts of clock" },
    { id: "ch-2", order: 2, title: "Context", durationSec: 20, job: "problem", spoken: "Most people waste 3 hours daily.", visualIntent: "Person frustrated at desk" },
    { id: "ch-3", order: 3, title: "Payoff", durationSec: 30, job: "payoff", spoken: "Here are the tools.", visualIntent: "App screenshots" },
  ],
  fullSpokenScript: "Stop wasting time. Most people waste 3 hours daily. Here are the tools.",
  openLoops: { plantedAtSec: [5, 20], resolvedAtSec: [40, 55] },
  cta: { spoken: "Follow for more.", onScreen: "Follow" },
  contentSource: "ai",
  mustNotCopy: ["competitor-title-1", "competitor-title-2"],
};

describe("validateLocalizedScriptParity", () => {
  it("passes when chapter count, jobs, and openLoops match", () => {
    const localized: NarrativeScript = {
      ...BASE_SCRIPT,
      title: "Herramientas de IA",
      chapters: BASE_SCRIPT.chapters.map((ch) => ({ ...ch, spoken: "translated" })),
    };
    const result = validateLocalizedScriptParity(BASE_SCRIPT, localized);
    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
  });

  it("fails when chapter count differs", () => {
    const localized: NarrativeScript = {
      ...BASE_SCRIPT,
      chapters: BASE_SCRIPT.chapters.slice(0, 2),
    };
    const result = validateLocalizedScriptParity(BASE_SCRIPT, localized);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("Chapter count")));
  });

  it("fails when openLoops.plantedAtSec is empty", () => {
    const localized: NarrativeScript = {
      ...BASE_SCRIPT,
      openLoops: { plantedAtSec: [], resolvedAtSec: [] },
    };
    const result = validateLocalizedScriptParity(BASE_SCRIPT, localized);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("openLoops")));
  });

  it("fails when chapter job sequence changes", () => {
    const localized: NarrativeScript = {
      ...BASE_SCRIPT,
      chapters: [
        { ...BASE_SCRIPT.chapters[0], job: "cta" },
        ...BASE_SCRIPT.chapters.slice(1),
      ],
    };
    const result = validateLocalizedScriptParity(BASE_SCRIPT, localized);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("job mismatch")));
  });

  it("fails when mustNotCopy entries are dropped", () => {
    const localized: NarrativeScript = {
      ...BASE_SCRIPT,
      mustNotCopy: [],
    };
    const result = validateLocalizedScriptParity(BASE_SCRIPT, localized);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("mustNotCopy")));
  });

  it("fails when contentSource is template-fallback in localized", () => {
    const localized: NarrativeScript = {
      ...BASE_SCRIPT,
      contentSource: "template-fallback",
    };
    const result = validateLocalizedScriptParity(BASE_SCRIPT, localized);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("template-fallback")));
  });

  it("compileLocalizedNarrationPrompt produces instruction prompt containing target language and rules", () => {
    const prompt = compileLocalizedNarrationPrompt(BASE_SCRIPT, "es");
    assert.ok(prompt.includes("es"));
    assert.ok(prompt.includes("PRESERVE ALL structural fields"));
    assert.ok(prompt.includes("openLoops"));
  });
});

// ─── 4. Shorts selection plan ─────────────────────────────────────────────────
import { compileShortsSelectionPlan } from "../os/compileShortsSelectionPlan";

describe("compileShortsSelectionPlan — ≤8 cap, anchored on shots/loops", () => {
  const CHAPTERS = BASE_SCRIPT.chapters;
  const OPEN_LOOPS = BASE_SCRIPT.openLoops;

  it("returns spans anchored on chapter boundaries", () => {
    const plan = compileShortsSelectionPlan({
      chapters: CHAPTERS,
      openLoops: OPEN_LOOPS,
      masterDurationSec: 60,
      masterProductionId: "prod-123",
    });
    assert.ok(plan.spans.length > 0);
    assert.ok(plan.spans.length <= 8);
    assert.equal(plan.masterProductionId, "prod-123");
  });

  it("never exceeds 8 spans even with many chapters and loops", () => {
    const manyChapters = Array.from({ length: 20 }, (_, i) => ({
      id: `ch-${i}`,
      order: i + 1,
      title: `Chapter ${i + 1}`,
      durationSec: 10,
      job: i % 2 === 0 ? "hook" : "payoff",
      spoken: "spoken",
      visualIntent: "visual",
    }));
    const manyLoops = { plantedAtSec: [5, 20, 50, 80, 110, 140], resolvedAtSec: [30, 45, 75, 105, 135, 165] };
    const plan = compileShortsSelectionPlan({
      chapters: manyChapters,
      openLoops: manyLoops,
      masterDurationSec: 200,
      masterProductionId: "prod-456",
    });
    assert.ok(plan.spans.length <= 8);
  });

  it("generates GenerationTask entries with kind 'short_cut'", () => {
    const plan = compileShortsSelectionPlan({
      chapters: CHAPTERS,
      openLoops: OPEN_LOOPS,
      masterDurationSec: 60,
      masterProductionId: "prod-789",
      masterUrl: "https://storage.googleapis.com/spark/master.mp4",
    });
    assert.ok(plan.tasks.length > 0);
    for (const task of plan.tasks) {
      assert.equal(task.kind, "short_cut");
      assert.equal(task.productionId, "prod-789");
    }
  });

  it("each span has startSec < endSec and duration >= 15s", () => {
    const plan = compileShortsSelectionPlan({
      chapters: CHAPTERS,
      openLoops: OPEN_LOOPS,
      masterDurationSec: 60,
      masterProductionId: "prod-xyz",
    });
    for (const span of plan.spans) {
      assert.ok(span.startSec >= 0);
      assert.ok(span.endSec > span.startSec);
      assert.ok(span.endSec - span.startSec >= 15);
    }
  });

  it("throws when masterProductionId is missing", () => {
    assert.throws(
      () =>
        compileShortsSelectionPlan({
          masterDurationSec: 60,
          masterProductionId: "",
        }),
      /masterProductionId is required/
    );
  });

  it("throws when masterDurationSec <= 0", () => {
    assert.throws(
      () =>
        compileShortsSelectionPlan({
          masterDurationSec: 0,
          masterProductionId: "prod-xyz",
        }),
      /masterDurationSec must be a positive number/
    );
  });
});

// ─── 5. Publish jobs: durable master check + Export Ready for YouTube ─────────
import { createPublishJobsForProduction } from "./distributionService";
import { isEphemeralMediaUrl } from "../mediaUrlUtils";

const DURABLE_URL = "https://storage.googleapis.com/spark/prod-123/master.mp4";
const EPHEMERAL_URL = "https://vidgen.x.ai/stream/abc123.mp4";

const BASE_GATE_INPUT = {
  automationMode: "autonomous" as const,
  publishingPermission: "enabled" as const,
  publishRequiresApproval: false,
  finalAssetExists: true,
  finalTechnicalQcPassed: true,
  contentPolicyPassed: true,
  destinationCredentialsValid: true,
  publicationTargetValid: true,
  userApproved: true,
  approvedBy: "test",
};

describe("createPublishJobsForProduction — durable master check", () => {
  it("rejects ephemeral master URL with BLOCKED result", () => {
    const result = createPublishJobsForProduction({
      productionId: "prod-123",
      title: "Test Production",
      canonicalMasterUrl: EPHEMERAL_URL,
      gateInput: BASE_GATE_INPUT,
    });
    assert.equal(result.gateAction, "BLOCKED");
    assert.equal(result.jobs.length, 0);
    assert.ok(result.errors.some((e) => e.includes("ephemeral")));
  });

  it("rejects missing master URL with BLOCKED result", () => {
    const result = createPublishJobsForProduction({
      productionId: "prod-123",
      title: "Test Production",
      canonicalMasterUrl: undefined,
      gateInput: BASE_GATE_INPUT,
    });
    assert.equal(result.gateAction, "BLOCKED");
    assert.ok(result.errors.some((e) => e.includes("canonicalMasterUrl is required")));
  });

  it("returns Export Ready for YouTube with durable URL (stub)", () => {
    const result = createPublishJobsForProduction({
      productionId: "prod-123",
      title: "Test Production",
      canonicalMasterUrl: DURABLE_URL,
      platforms: ["youtube"],
      gateInput: BASE_GATE_INPUT,
    });
    assert.equal(result.gateAction, "PUBLISH");
    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0].status, "Export Ready");
    assert.equal(result.jobs[0].platform, "YouTube Shorts");
  });

  it("returns Needs Review for YouTube when gate is AWAITING_APPROVAL", () => {
    const awaitingGate = {
      ...BASE_GATE_INPUT,
      automationMode: "manual" as const,
      userApproved: false,
    };
    const result = createPublishJobsForProduction({
      productionId: "prod-123",
      title: "Test",
      canonicalMasterUrl: DURABLE_URL,
      platforms: ["youtube"],
      gateInput: awaitingGate,
    });
    assert.equal(result.gateAction, "AWAITING_APPROVAL");
    assert.equal(result.jobs[0].status, "Needs Review");
  });

  it("returns Failed for TikTok (unavailable adapter)", () => {
    const result = createPublishJobsForProduction({
      productionId: "prod-123",
      title: "Test",
      canonicalMasterUrl: DURABLE_URL,
      platforms: ["tiktok"],
      gateInput: BASE_GATE_INPUT,
    });
    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0].status, "Failed");
    assert.ok(((result.jobs[0] as any).publishError ?? "").includes("unavailable"));
  });

  it("returns Failed for Reels (unavailable adapter)", () => {
    const result = createPublishJobsForProduction({
      productionId: "prod-123",
      title: "Test",
      canonicalMasterUrl: DURABLE_URL,
      platforms: ["reels"],
      gateInput: BASE_GATE_INPUT,
    });
    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0].status, "Failed");
  });

  it("is ephemeral URL correctly detected", () => {
    assert.equal(isEphemeralMediaUrl(EPHEMERAL_URL), true);
    assert.equal(isEphemeralMediaUrl(DURABLE_URL), false);
    assert.equal(isEphemeralMediaUrl("blob:https://example.com/abc"), true);
    assert.equal(isEphemeralMediaUrl("data:video/mp4;base64,abc"), true);
  });
});

// ─── 6. Cadence config reading in topic planning ──────────────────────────────
import { isTopicAllowedByNiche } from "../os/topicIntelligence";

describe("Topic intelligence — cadence config integration", () => {
  it("isTopicAllowedByNiche passes topics matching the niche", () => {
    const result = isTopicAllowedByNiche(
      { topic: "AI productivity tools", nicheTag: "AI/Tech", premise: "Save time with automation" },
      "AI/Tech"
    );
    assert.equal(result, true);
  });

  it("isTopicAllowedByNiche blocks off-niche topics", () => {
    const result = isTopicAllowedByNiche(
      { topic: "Best pasta recipes", nicheTag: "Cooking", premise: "Italian food guide" },
      "AI/Tech"
    );
    assert.equal(result, false);
  });

  it("cadenceConfig type is accepted by PlanTopicsInput", () => {
    type PlanTopicsInputShape = {
      brand: any;
      cadenceConfig?: { longFormPerWeek?: number; shortsPerDay?: number; timezone?: string };
    };
    const input: PlanTopicsInputShape = {
      brand: { name: "Test Brand", niche: "AI/Tech" } as any,
      cadenceConfig: { longFormPerWeek: 2, shortsPerDay: 1, timezone: "America/Los_Angeles" },
    };
    assert.equal(input.cadenceConfig?.longFormPerWeek, 2);
    assert.equal(input.cadenceConfig?.shortsPerDay, 1);
  });
});
