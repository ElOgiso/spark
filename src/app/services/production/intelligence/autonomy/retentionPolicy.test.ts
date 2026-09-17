/**
 * Phase 11 — Retention Observation & Script Open-Loop Policy Tests.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  learnRetentionPolicy,
  quarantineNoiseAndOutliers,
  calculateObservationWeight,
  MIN_RETENTION_SAMPLE_SIZE,
  DEFAULT_OPEN_LOOP_INTERVAL_SEC,
  type RetentionObservation,
} from "./retentionPolicy";
import { compileNarrativeScriptPrompt } from "../../os/compileNarrativeScript";
import { evaluateScriptForProduction } from "../../os/scriptQualityGates";
import type { Brand, NarrativeScript } from "../../../../domain/types";

const mockBrand: Brand = {
  id: "brand-test-1",
  name: "Apex Engineering",
  niche: "Engineering & Tech",
  archetype: "Expert Guide",
  purpose: "Demystify complex systems",
  contentPillars: [{ label: "Architecture", active: true }],
  tone: [{ label: "Analytical", active: true }],
  audience: {
    primary: "Engineers",
    painPoints: ["Slop"],
    desires: ["Truth"],
  },
  settings: {},
};

describe("Phase 11 Retention Policy — Sample Size Gate", () => {
  it("maintains default interval when observations < 3 (sample size gate)", () => {
    const observations: RetentionObservation[] = [
      {
        brandId: "brand-test-1",
        platform: "YouTube",
        avgViewDurationSec: 25,
        capturedAt: new Date().toISOString(),
        contentSource: "youtube_analytics",
      },
      {
        brandId: "brand-test-1",
        platform: "YouTube",
        avgViewDurationSec: 30,
        capturedAt: new Date().toISOString(),
        contentSource: "youtube_analytics",
      },
    ];

    const result = learnRetentionPolicy(observations, mockBrand);
    assert.equal(result.policy.sampleSize, 2);
    assert.equal(result.policy.targetOpenLoopIntervalSec, DEFAULT_OPEN_LOOP_INTERVAL_SEC);
    assert.ok(result.policy.notes.some((n) => n.includes("below minimum threshold")));
    assert.equal(result.memoryItem, undefined);
  });

  it("adapts interval when valid sample size >= 3", () => {
    const now = new Date().toISOString();
    const observations: RetentionObservation[] = [
      {
        brandId: "brand-test-1",
        platform: "YouTube",
        avgViewDurationSec: 32,
        capturedAt: now,
        contentSource: "youtube_analytics",
      },
      {
        brandId: "brand-test-1",
        platform: "YouTube",
        avgViewDurationSec: 28,
        capturedAt: now,
        contentSource: "youtube_analytics",
      },
      {
        brandId: "brand-test-1",
        platform: "YouTube",
        avgViewDurationSec: 30,
        capturedAt: now,
        contentSource: "youtube_analytics",
      },
    ];

    const result = learnRetentionPolicy(observations, mockBrand);
    assert.equal(result.policy.sampleSize, 3);
    // 30 * 0.75 = 22.5 -> 23s
    assert.equal(result.policy.targetOpenLoopIntervalSec, 23);
    assert.ok(result.policy.notes.some((n) => n.includes("Open loop target interval adjusted to ~23s")));
    assert.ok(result.memoryItem);
    assert.equal(result.memoryItem?.category, "Winning hooks");
    assert.ok(result.memoryItem?.text.includes("first open loop before"));
    assert.ok(result.memoryItem?.fingerprint?.startsWith("fp-retention-"));
  });
});

describe("Phase 11 Retention Policy — Quarantine & Noise Rejection", () => {
  it("quarantines unavailable and negative duration records without failing", () => {
    const now = new Date().toISOString();
    const observations: RetentionObservation[] = [
      {
        brandId: "brand-test-1",
        platform: "YouTube",
        avgViewDurationSec: 30,
        capturedAt: now,
        contentSource: "youtube_analytics",
      },
      {
        brandId: "brand-test-1",
        platform: "YouTube",
        avgViewDurationSec: 0, // invalid zero
        capturedAt: now,
        contentSource: "youtube_analytics",
      },
      {
        brandId: "brand-test-1",
        platform: "YouTube",
        avgViewDurationSec: undefined, // unavailable
        capturedAt: now,
        contentSource: "unavailable",
      },
      {
        brandId: "brand-test-1",
        platform: "YouTube",
        durationSec: 30,
        avgViewDurationSec: 300, // contradictory 10x
        capturedAt: now,
        contentSource: "youtube_analytics",
      },
    ];

    const { valid, quarantined } = quarantineNoiseAndOutliers(observations);
    assert.equal(valid.length, 1);
    assert.equal(quarantined.length, 3);
  });
});

describe("Phase 11 Retention Policy — Decay", () => {
  it("applies exponential half-life decay (90 days) to older observations", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const fresh = "2026-06-01T00:00:00Z";
    const halfLifeOld = "2026-03-03T00:00:00Z"; // ~90 days ago

    const wFresh = calculateObservationWeight(fresh, now);
    const wOld = calculateObservationWeight(halfLifeOld, now);

    assert.equal(wFresh, 1.0);
    assert.ok(Math.abs(wOld - 0.5) < 0.05, `Expected ~0.5 but got ${wOld}`);
  });
});

describe("Phase 11 Retention Policy — Deduplication", () => {
  it("updates existing MemoryItem rule instead of duplicating", () => {
    const now = new Date().toISOString();
    const observations: RetentionObservation[] = [
      { brandId: "brand-test-1", platform: "YouTube", avgViewDurationSec: 40, capturedAt: now },
      { brandId: "brand-test-1", platform: "YouTube", avgViewDurationSec: 40, capturedAt: now },
      { brandId: "brand-test-1", platform: "YouTube", avgViewDurationSec: 40, capturedAt: now },
    ];

    const firstRun = learnRetentionPolicy(observations, mockBrand, []);
    assert.equal(firstRun.updatedMemories.length, 1);
    const firstMem = firstRun.updatedMemories[0];

    const secondRun = learnRetentionPolicy(observations, mockBrand, firstRun.updatedMemories);
    assert.equal(secondRun.updatedMemories.length, 1);
    assert.equal(secondRun.updatedMemories[0].id, firstMem.id);
    assert.equal(secondRun.updatedMemories[0].syncCount, 2);
  });
});

describe("Phase 11 Retention Policy — Compiler Feed & Script Quality Gates", () => {
  it("compileNarrativeScriptPrompt includes open loop pacing hint when policy is attached", () => {
    const prompt = compileNarrativeScriptPrompt({
      brand: mockBrand,
      targetDurationSec: 60,
      productionModeLabel: "narrator",
      retentionPolicy: {
        targetOpenLoopIntervalSec: 25,
        preferHookOnPayoff: true,
        notes: ["Adjusted from 3 observations."],
        sampleSize: 3,
        updatedAt: new Date().toISOString(),
      },
    });

    assert.ok(prompt.includes("RETENTION OPEN-LOOP POLICY (DATA HINT)"));
    assert.ok(prompt.includes("Target open-loop interval: Plant open loops every ~25s"));
    assert.ok(prompt.includes("Do NOT inject spoken lines from memory"));
  });

  it("evaluateScriptForProduction warns when a long script has zero loops and sampleSize >= 3", () => {
    const scriptWithoutLoops: NarrativeScript = {
      title: "How the Jet Engine Changed Aviation",
      logline: "Frank Whittle's turbine breakthrough in 1937.",
      premise: "In 1937, Frank Whittle tested the first working turbojet engine in Rugby, England.",
      targetDurationSec: 60,
      format: "faceless",
      hook: {
        spoken: "In 1937, a British officer built a fire-breathing tube that aviation experts said was impossible.",
        opensOnPayoff: true,
        backstoryDeferred: true,
      },
      chapters: [
        {
          id: "ch-1",
          order: 1,
          title: "The Whittle Turbine",
          durationSec: 30,
          job: "proof",
          spoken: "Whittle's prototype spun at seventeen thousand revolutions per minute in April 1937.",
          visualIntent: "Whittle stands beside the test rig as it ignites.",
        },
        {
          id: "ch-2",
          order: 2,
          title: "The Breakthrough",
          durationSec: 30,
          job: "payoff",
          spoken: "Within four years, the Gloster E.28/39 flew solely under turbojet thrust.",
          visualIntent: "Gloster jet lifts into the sky over Cranwell.",
        },
      ],
      fullSpokenScript: "In 1937, a British officer built a fire-breathing tube that aviation experts said was impossible. Whittle's prototype spun at seventeen thousand revolutions per minute in April 1937. Within four years, the Gloster E.28/39 flew solely under turbojet thrust.",
      openLoops: { plantedAtSec: [], resolvedAtSec: [] }, // ZERO LOOPS
      cta: { spoken: "Follow for more aerospace breakthroughs.", onScreen: "Subscribe" },
      claims: [
        { claim: "Frank Whittle tested the first turbojet in 1937", verified: true, source: "Royal Air Force Museum" },
      ],
    };

    const brandWithPolicy: Brand = {
      ...mockBrand,
      settings: {
        retentionPolicy: {
          targetOpenLoopIntervalSec: 25,
          preferHookOnPayoff: true,
          notes: ["Sample gathered."],
          sampleSize: 3,
          updatedAt: new Date().toISOString(),
        },
      },
    };

    const evalResult = evaluateScriptForProduction(scriptWithoutLoops, null, brandWithPolicy);
    assert.ok(evalResult.warnings && evalResult.warnings.length > 0);
    assert.ok(evalResult.warnings.some((w) => w.includes("Script has no planted open loops despite retention policy")));
  });
});
