/**
 * Concept quality gates — research auto-ready, meta hooks, spoken ensure.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSparkReadyForProduction,
  autoRepairViralSparkDeterministic,
  ensureViralSparkProductionReady,
  isMetaHook,
  isSpokenHook,
  isSparkDraft,
  markSparkReadyIfValid,
} from "./viralSparkGate";
import { evaluateSparkForProduction } from "./productionBriefService";
import type { ViralSpark, Brand } from "../../domain/types";

const brand = { name: "Acme", niche: "AI ops" } as unknown as Brand;

function baseSpark(overrides: Partial<ViralSpark> = {}): ViralSpark {
  return {
    id: "s1",
    title: "AI Ops Shift Nobody Talks About",
    hook: "curiosity opener",
    views: "—",
    velocity: "—",
    platformFit: "Shorts",
    brandFitScore: 92,
    category: "rising",
    timeWindow: "now",
    productionTime: "15m",
    whyNow: "Margins compress and playbooks go stale this quarter",
    angle: "Non-obvious ops contrast",
    audienceEmotion: "Curiosity",
    expectedRetention: "High",
    difficulty: "Medium",
    riskLevel: "Low",
    suggestedFormat: "Vertical 9:16 (Shorts)",
    suggestedProductionMode: "standard",
    status: "draft",
    ...overrides,
  } as ViralSpark;
}

test("isMetaHook catches research first-line curiosity patterns", () => {
  assert.equal(isMetaHook('First-line curiosity opener: "Stop wasting ad spend"'), true);
  assert.equal(isMetaHook("pattern interrupt"), true);
  assert.equal(isMetaHook("High Retention Pattern: AI ops"), true);
  assert.equal(isSpokenHook("90% of AI ops teams still ship without a weekly kill list."), true);
  assert.equal(isMetaHook("90% of AI ops teams still ship without a weekly kill list."), false);
});

test("high brandFit does not make a raw meta research spark already-ready", () => {
  const spark = baseSpark({
    brandFitScore: 99,
    status: "draft",
    hook: 'First-line curiosity opener: "Stop wasting ad spend"',
  });
  const gate = assertSparkReadyForProduction(spark, brand);
  assert.equal(gate.ok, false);
  assert.ok(gate.reasons.some((r) => /meta|draft|spoken/i.test(r)));
});

test("evaluateSparkForProduction auto-prepares drafts (no Strengthen UI)", () => {
  const spark = baseSpark({
    hook: "curiosity opener",
    status: "draft",
    researchContext: { hookPattern: "curiosity opener formula" } as any,
  });
  const res = evaluateSparkForProduction(spark, brand);
  assert.equal(res.ok, true, res.message);
  assert.equal(res.spark?.status, "ready");
  assert.equal(isMetaHook(res.spark?.hook), false);
});

test("ensureViralSparkProductionReady yields spoken hook and ready status", () => {
  const draft = baseSpark({
    hook: "curiosity opener",
    title: "AI",
    status: "draft",
  });
  const ensured = ensureViralSparkProductionReady(draft, brand);
  assert.equal(ensured.ok, true, ensured.message);
  assert.equal(ensured.repaired, true);
  assert.equal(isMetaHook(ensured.spark.hook), false);
  assert.equal(ensured.spark.status, "ready");
  assert.equal(isSparkDraft(ensured.spark), false);
});

test("deterministic repair + mark still works for spoken upgrade", () => {
  const draft = baseSpark({
    hook: "curiosity opener",
    title: "AI",
    status: "draft",
  });
  const repaired = autoRepairViralSparkDeterministic(draft, brand);
  assert.equal(isMetaHook(repaired.hook), false);
  const marked = markSparkReadyIfValid(repaired, brand);
  assert.equal(marked.ok, true);
  assert.equal(marked.spark.status, "ready");
});

test("ready spoken spark passes create gate without repair", () => {
  const spark = baseSpark({
    status: "ready",
    hook: "Here is the non-obvious reality about AI ops that most operators ignore — comment STRATEGY for the playbook.",
    title: "The AI Ops Playbook Shift Leaders Miss",
    researchContext: { ctaStyle: "Comment STRATEGY to get the blueprint", format: "Shorts" } as any,
  });
  const ensured = ensureViralSparkProductionReady(spark, brand);
  assert.equal(ensured.ok, true, ensured.reasons.join("; "));
  assert.equal(ensured.repaired, false);
  const gate = assertSparkReadyForProduction(spark, brand);
  assert.equal(gate.ok, true, gate.reasons.join("; "));
});
