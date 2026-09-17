import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyNarrativeScriptToSparkAndBrief } from "./applyNarrativeScript";
import { compileNarrativeScriptPrompt, compileNarrativeScript } from "./compileNarrativeScript";
import type { NarrativeScript, ViralSpark, Brand } from "../../../domain/types";

const mockBrand: Brand = {
  name: "Apex Engineering",
  niche: "Structural Engineering & Architecture",
  contentFormat: "faceless",
  archetype: "Educator",
  purpose: "Deconstruct engineering marvels",
  contentPillars: [{ label: "Civil Engineering", active: true }],
  audience: { primary: "Engineers and curious thinkers", painPoints: [], desires: [] },
  tone: [{ label: "Authoritative", active: true }],
  formatSettings: {
    aspectMode: "portrait",
    targetDurationSec: 300,
    contentFormat: "faceless",
  },
};

describe("SPARK Script Authority (Remove 60s, 5s fallback, and 50-word defaults)", () => {
  it("Fixture 1: 300s script with 10 chapters x 30s -> brief.targetDurationSec 300, no 60, status ready", () => {
    const chapters = Array.from({ length: 10 }, (_, i) => ({
      id: `ch-${i + 1}`,
      order: i + 1,
      title: `Phase ${i + 1}`,
      durationSec: 30,
      job: i === 0 ? "hook" : i === 9 ? "cta" : "context",
      spoken: `Spoken commentary for chapter ${i + 1} with substantive educational insights.`,
      visualIntent: `Engineering visualization for phase ${i + 1}.`,
    }));

    const script300: NarrativeScript = {
      title: "Massive Bridge Structural Mechanics",
      logline: "How suspension bridges absorb dynamic wind shear forces",
      premise: "Suspension bridge aeromechanics allow sustained harmonic damping during category 5 storms.",
      targetDurationSec: 300,
      format: "faceless",
      hook: { spoken: "Why the world's longest bridge doesn't collapse in a hurricane.", opensOnPayoff: true, backstoryDeferred: true },
      chapters,
      fullSpokenScript: chapters.map((c) => c.spoken).join(" "),
      openLoops: { plantedAtSec: [10, 60], resolvedAtSec: [150, 290] },
      cta: { spoken: "Follow Apex Engineering for deep structural breakdowns." },
      claims: [{ claim: "Suspension bridges use aerofoil decks to reduce vortex shedding", verified: true, source: "Civil Engineering Journal" }],
      contentSource: "ai",
      mustNotCopy: [],
    };

    const spark: ViralSpark = {
      id: "spark-300",
      title: "Massive Bridge Structural Mechanics",
      hook: "Why the world's longest bridge doesn't collapse in a hurricane.",
      status: "draft",
    };

    const { brief, sparkPatch, evaluation } = applyNarrativeScriptToSparkAndBrief(
      script300,
      spark,
      { targetDurationSec: 300, productionMode: "standard" },
      { brand: mockBrand }
    );

    assert.equal(evaluation.ok, true, "Valid 300s script should pass evaluation");
    assert.equal(brief.targetDurationSec, 300, "brief.targetDurationSec must be 300");
    assert.equal(brief.suggestedDuration, "300s", "suggestedDuration must be 300s");
    assert.equal(brief.beats?.length, 10, "Should have 10 beats matching 10 chapters");
    assert.equal(sparkPatch.status, "ready", "Status must be ready when all gates pass");

    // Verify timecodes use running time mm:ss math
    assert.equal(brief.beats?.[0].timecode, "[00:00-00:30]");
    assert.equal(brief.beats?.[1].timecode, "[00:30-01:00]");
    assert.equal(brief.beats?.[9].timecode, "[04:30-05:00]");

    // Verify beats retain real chapter durationSec
    for (const b of brief.beats || []) {
      assert.equal(b.durationSec, 30, "Each beat must preserve durationSec 30");
    }
  });

  it("Fixture 2: missing chapter duration -> evaluation fails, draft, not ready", () => {
    const chapters = [
      {
        id: "ch-1",
        order: 1,
        title: "Hook",
        durationSec: 30,
        job: "hook",
        spoken: "Hook lines for the video.",
        visualIntent: "Opening visual",
      },
      {
        id: "ch-2",
        order: 2,
        title: "Context",
        // durationSec missing!
        job: "context",
        spoken: "Contextual explanation without durationSec.",
        visualIntent: "Diagram",
      } as any,
    ];

    const scriptMissingDur: NarrativeScript = {
      title: "Broken Duration Script",
      logline: "Logline",
      premise: "Valid premise here with substantive words and facts",
      targetDurationSec: 60,
      format: "faceless",
      hook: { spoken: "Hook lines for the video.", opensOnPayoff: true, backstoryDeferred: true },
      chapters,
      fullSpokenScript: "Hook lines for the video. Contextual explanation without durationSec.",
      openLoops: { plantedAtSec: [5], resolvedAtSec: [50] },
      cta: { spoken: "Follow for more" },
      contentSource: "ai",
      mustNotCopy: [],
    };

    const spark: ViralSpark = {
      id: "spark-missing-dur",
      title: "Broken Duration Script",
      status: "draft",
    };

    const { brief, sparkPatch, evaluation } = applyNarrativeScriptToSparkAndBrief(
      scriptMissingDur,
      spark,
      { targetDurationSec: 60 },
      { brand: mockBrand }
    );

    assert.equal(evaluation.ok, false, "Must fail evaluation when chapter duration is missing");
    assert.equal(sparkPatch.status, "draft", "Status must be draft when chapter duration is missing");
    assert.ok(
      evaluation.reasons.some((r) => r.includes("Chapter 2 has no duration from the writer.")),
      "Error must explicitly state: Chapter 2 has no duration from the writer."
    );
    assert.ok(brief.lastError?.includes("Chapter 2 has no duration from the writer."));
  });

  it("Fixture 3: chapter with durationSec <= 0 -> draft, not ready", () => {
    const scriptZeroDur: NarrativeScript = {
      title: "Zero Duration Script",
      logline: "Logline",
      premise: "Premise",
      targetDurationSec: 60,
      format: "faceless",
      hook: { spoken: "Opening line.", opensOnPayoff: true, backstoryDeferred: true },
      chapters: [
        { id: "c1", order: 1, title: "1", durationSec: 0, job: "hook", spoken: "Spoken", visualIntent: "Visual" },
      ],
      fullSpokenScript: "Opening line.",
      openLoops: { plantedAtSec: [], resolvedAtSec: [] },
      cta: { spoken: "CTA" },
      contentSource: "ai",
      mustNotCopy: [],
    };

    const { sparkPatch, evaluation } = applyNarrativeScriptToSparkAndBrief(
      scriptZeroDur,
      { id: "s1", status: "draft" } as any,
      { targetDurationSec: 60 }
    );

    assert.equal(evaluation.ok, false);
    assert.equal(sparkPatch.status, "draft");
    assert.ok(evaluation.reasons.some((r) => r.includes("Chapter 1 has no duration from the writer.")));
  });

  it("Fixture 4: missing targetDurationSec -> evaluation fails with exact prompt reason", () => {
    const scriptNoTarget: NarrativeScript = {
      title: "No Target Duration Script",
      logline: "Logline",
      premise: "Premise",
      format: "faceless",
      hook: { spoken: "Opening line.", opensOnPayoff: true, backstoryDeferred: true },
      chapters: [
        { id: "c1", order: 1, title: "1", durationSec: 30, job: "hook", spoken: "Spoken", visualIntent: "Visual" },
      ],
      fullSpokenScript: "Opening line.",
      openLoops: { plantedAtSec: [], resolvedAtSec: [] },
      cta: { spoken: "CTA" },
      contentSource: "ai",
      mustNotCopy: [],
    };

    const { sparkPatch, evaluation } = applyNarrativeScriptToSparkAndBrief(
      scriptNoTarget,
      { id: "s1", status: "draft" } as any,
      {} // No brief targetDurationSec either!
    );

    assert.equal(evaluation.ok, false);
    assert.equal(sparkPatch.status, "draft");
    assert.ok(
      evaluation.reasons.some((r) => r.includes("No target duration. SPARK will not assume 60 seconds.")),
      "Must fail with exact message: No target duration. SPARK will not assume 60 seconds."
    );
  });

  it("Fixture 5: chapter duration sum deviating >15% from target -> draft, not ready", () => {
    const scriptDivergent: NarrativeScript = {
      title: "Divergent Duration Script",
      logline: "Logline",
      premise: "Valid premise here with substantive words and facts",
      targetDurationSec: 100, // Target 100s
      format: "faceless",
      hook: { spoken: "Opening hook line.", opensOnPayoff: true, backstoryDeferred: true },
      chapters: [
        // Chapters sum to only 70s (30% deviation!)
        { id: "c1", order: 1, title: "1", durationSec: 35, job: "hook", spoken: "Spoken words 1.", visualIntent: "Visual 1" },
        { id: "c2", order: 2, title: "2", durationSec: 35, job: "payoff", spoken: "Spoken words 2.", visualIntent: "Visual 2" },
      ],
      fullSpokenScript: "Opening hook line. Spoken words 1. Spoken words 2.",
      openLoops: { plantedAtSec: [5], resolvedAtSec: [60] },
      cta: { spoken: "Follow us" },
      contentSource: "ai",
      mustNotCopy: [],
    };

    const { sparkPatch, evaluation } = applyNarrativeScriptToSparkAndBrief(
      scriptDivergent,
      { id: "s1", status: "draft" } as any,
      { targetDurationSec: 100 }
    );

    assert.equal(evaluation.ok, false);
    assert.equal(sparkPatch.status, "draft");
    assert.ok(
      evaluation.reasons.some((r) => r.includes("deviates by more than 15% from target duration 100s")),
      "Must report deviation >15% from target duration"
    );
  });

  it("Fixture 6: wordCount >= 50 does NOT grant ready status if quality gates fail", () => {
    const wordyFailingScript: NarrativeScript = {
      title: "Wordy Cloned Story",
      logline: "Logline",
      premise: "Premise",
      targetDurationSec: 60,
      format: "faceless",
      hook: { spoken: "Cloned hook line.", opensOnPayoff: true, backstoryDeferred: true },
      chapters: [
        {
          id: "c1",
          order: 1,
          title: "Chapter 1",
          durationSec: 60,
          job: "hook",
          spoken: "This script has more than fifty words in total so under the old flawed logic it would have automatically flipped to ready status regardless of quality gate failures or claim verification issues. We are ensuring that this loophole is entirely eliminated.",
          visualIntent: "Visual",
        },
      ],
      fullSpokenScript: "This script has more than fifty words in total so under the old flawed logic it would have automatically flipped to ready status regardless of quality gate failures or claim verification issues. We are ensuring that this loophole is entirely eliminated.",
      openLoops: { plantedAtSec: [], resolvedAtSec: [] },
      cta: { spoken: "Subscribe" },
      contentSource: "ai",
      mustNotCopy: ["Wordy Cloned Story"], // Causes reference story overlap!
    };

    const { sparkPatch, evaluation } = applyNarrativeScriptToSparkAndBrief(
      wordyFailingScript,
      { id: "s1", status: "draft" } as any,
      { targetDurationSec: 60 },
      { brand: mockBrand, referenceTitles: ["Wordy Cloned Story"] }
    );

    assert.equal(evaluation.ok, false, "Must fail due to reference overlap");
    assert.equal(sparkPatch.status, "draft", "Status must remain 'draft' even with wordCount >= 50");
    assert.ok(sparkPatch.lastError);
  });

  it("Fixture 7: compileNarrativeScriptPrompt enforces movie structure & duration sum instructions", () => {
    const prompt = compileNarrativeScriptPrompt({
      brand: mockBrand,
      targetDurationSec: 180,
      productionModeLabel: "narrator",
    });

    assert.ok(prompt.includes("Return chapters that SUM to targetDurationSec (180 seconds)."));
    assert.ok(prompt.includes("Each chapter has its own durationSec and spoken (movie structure, not a blob)."));
    assert.ok(prompt.includes("Do not omit durationSec. SPARK will not invent it."));
  });

  it("Fixture 8: compileNarrativeScript throws loud if targetDurationSec is missing or <= 0", async () => {
    await assert.rejects(
      async () => {
        await compileNarrativeScript({
          brand: mockBrand,
          targetDurationSec: 0,
          productionModeLabel: "narrator",
        });
      },
      /No target duration\. SPARK will not assume 60 seconds\./
    );
  });
});
