/**
 * Tests for honest spark scoring — structural repair must NOT fabricate a high brand-fit score.
 * Run: tsx --test src/app/services/production/viralSparkGate.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { autoRepairViralSparkDeterministic, isProductionReadySpark } from "./viralSparkGate";
import type { ViralSpark, Brand } from "../../domain/types";

const brand = { name: "Acme", niche: "AI ops" } as unknown as Brand;

function baseSpark(overrides: Partial<ViralSpark>): ViralSpark {
  return {
    id: "s1",
    title: "AI",
    hook: "curiosity opener",
    views: "—",
    velocity: "—",
    platformFit: "Shorts",
    brandFitScore: 0,
    category: "hot",
    timeWindow: "now",
    productionTime: "15m",
    whyNow: "",
    angle: "",
    audienceEmotion: "",
    expectedRetention: "",
    difficulty: "Medium",
    riskLevel: "Low",
    suggestedFormat: "",
    suggestedProductionMode: "standard",
    ...overrides,
  } as ViralSpark;
}

test("repair preserves a real brand-fit score (no fake >=88 floor)", () => {
  const repaired = autoRepairViralSparkDeterministic(baseSpark({ brandFitScore: 74 }), brand);
  assert.equal(repaired.brandFitScore, 74); // previously would have been forced to 88
});

test("repair uses a neutral 60 (not 88) when the score is unknown", () => {
  const repaired = autoRepairViralSparkDeterministic(baseSpark({ brandFitScore: 0 }), brand);
  assert.equal(repaired.brandFitScore, 60);
});

test("repair still fixes structure (meta hook + topic-only title become real)", () => {
  const repaired = autoRepairViralSparkDeterministic(
    baseSpark({ hook: "curiosity opener", title: "AI" }),
    brand
  );
  // Meta hook replaced by a ready-to-speak line; title de-genericized.
  assert.ok(!/curiosity opener/i.test(repaired.hook));
  assert.ok(repaired.hook.length > 12);
  assert.ok(repaired.title.length > 4);
});

test("isProductionReadySpark still flags a genuinely low real fit score", () => {
  const res = isProductionReadySpark(baseSpark({ brandFitScore: 40, hook: "This is a real spoken opening line for the host.", title: "The AI Ops Shift Nobody Talks About", whyNow: "Because margins compress fast", suggestedFormat: "Shorts" }), brand);
  assert.ok(res.reasons.some((r) => /brand fit score/i.test(r)));
});
