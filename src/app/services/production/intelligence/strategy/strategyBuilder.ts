/**
 * Assemble canonical CreativeStrategy from intent + context.
 * Provider-neutral executive decisions for the existing orchestrator.
 */

import type { Brand, Character, ViralSpark, MemoryItem } from "../../../../domain/types";
import type { CreatorProfile } from "../../specification/creatorProfile";
import type { CreativeControlMode, ContentGenreId } from "../../specification/productionSpec";
import type { MasterAssetRef } from "../../specification/assetSpec";
import type {
  CreativeStrategy,
  CreativeStrategyAlternative,
  OptimizationProfile,
  CreativePreflightResult,
  CreativePerformanceHints,
} from "./types";
import { understandIntent } from "./intentUnderstanding";
import { buildAudienceProfile } from "./audienceModel";
import { planHook } from "./hookPlanner";
import { selectFormat, planPacing } from "./formatIntelligence";
import { estimateProductionComplexity } from "./complexityEstimator";
import { planMasterReuse } from "./masterReuse";
import {
  extractBrandRequirements,
  resolveOptimizationProfile,
  detailForProductionMode,
} from "./brandIntelligence";
import { recommendCreativeEconomics } from "./creativeEconomics";
import { runCreativePreflight } from "./creativePreflight";
import {
  applyLearningsToStrategy,
  buildAdaptiveAdvice,
  parseLearningHintsFromMemory,
  type CreativeLearning,
} from "../performance";

export interface BuildCreativeStrategyInput {
  idea: string;
  genre: ContentGenreId | string;
  styleTags?: string[];
  tone?: string;
  audienceHint?: string;
  platforms?: string[];
  durationSec?: number;
  aspectRatio?: string;
  productionMode?: string;
  creativeControl?: CreativeControlMode;
  automationMode?: "manual" | "balanced" | "autonomous";
  brand?: Brand;
  character?: Character;
  creatorProfile?: CreatorProfile;
  spark?: ViralSpark;
  memoryItems?: MemoryItem[];
  /** Phase 8 structured creative learnings */
  creativeLearnings?: CreativeLearning[];
  performanceHints?: CreativePerformanceHints;
  accountId?: string;
  existingMasters?: MasterAssetRef[];
  requiresCharacters?: boolean;
  requiresDialogue?: boolean;
  requiresNarration?: boolean;
  requiresMusic?: boolean;
  requiresProduct?: boolean;
  locationCount?: number;
  wardrobeChanges?: number;
  hasVfx?: boolean;
  optimizationProfile?: OptimizationProfile;
  explicitObjective?: string;
}

export interface BuildCreativeStrategyResult {
  strategy: CreativeStrategy;
  preflight: CreativePreflightResult;
  economics: ReturnType<typeof recommendCreativeEconomics>;
}

function newStrategyId(): string {
  return `cstr_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildCreativeStrategy(input: BuildCreativeStrategyInput): BuildCreativeStrategyResult {
  const intent = understandIntent({
    idea: input.idea,
    brand: input.brand,
    character: input.character,
    creatorProfile: input.creatorProfile,
    spark: input.spark,
    platformHints: input.platforms,
    productionMode: input.productionMode,
    explicitObjective: input.explicitObjective,
  });

  const brand = extractBrandRequirements(input.brand);
  const opt = resolveOptimizationProfile({
    productionMode: input.productionMode,
    creatorProfile: input.creatorProfile,
    explicit: input.optimizationProfile,
  });

  const formatSel = selectFormat({
    genre: input.genre,
    styleTags: input.styleTags,
    objective: intent.objective,
    candidates: intent.candidateInterpretations,
  });

  const audience = buildAudienceProfile({
    ideaAudienceHint: input.audienceHint,
    brand: input.brand,
    creatorProfile: input.creatorProfile,
    platforms: input.platforms,
    objective: intent.objective,
    tone: brand.tone || input.tone,
  });

  const hook = planHook({
    objective: intent.objective,
    audience: audience.audience,
    format: formatSel.format,
    tone: brand.tone || input.tone || "unknown",
  });

  const payoff = intent.objective.objective;
  const pacing = planPacing({
    format: formatSel.format,
    durationSec: input.durationSec,
    audience: audience.audience,
    payoff,
  });

  const requiresCharacters =
    input.requiresCharacters ??
    /talking_head|cinematic|narrative|comedy|interview/.test(formatSel.format);

  const complexity = estimateProductionComplexity({
    durationSec: input.durationSec,
    format: formatSel.format,
    requiresCharacters,
    characterCount: requiresCharacters ? (input.character ? 1 : 1) : 0,
    locationCount: input.locationCount ?? 1,
    wardrobeChanges: input.wardrobeChanges ?? 0,
    hasDialogue: Boolean(input.requiresDialogue),
    hasAction: /cinematic|music|sports|action/.test(formatSel.format),
    hasVfx: Boolean(input.hasVfx),
    continuitySensitive: requiresCharacters && (input.locationCount || 1) > 1,
    optimizationProfile: opt.profile,
  });

  const masters = planMasterReuse({
    requiresCharacters,
    requiresLocations: true,
    requiresVoice: Boolean(input.requiresNarration || input.requiresDialogue),
    requiresMusic: Boolean(input.requiresMusic),
    requiresProduct: Boolean(input.requiresProduct) || formatSel.format === "advertisement",
    existingMasters: input.existingMasters,
    character: input.character,
  });

  const economics = recommendCreativeEconomics({
    optimizationProfile: opt.profile,
    complexity: complexity.complexity,
  });

  const alternatives: CreativeStrategyAlternative[] = formatSel.alternatives.slice(0, 2).map((f, i) => ({
    id: `alt_${i + 1}`,
    label: f.replace(/_/g, " "),
    format: f,
    summary: `Credible ${f.replace(/_/g, " ")} approach for the same subject`,
    whyNotPrimary: `Primary format ${formatSel.format} better matches current genre/context`,
  }));

  const detail = detailForProductionMode(input.creativeControl);
  const cta = /advertisement|product|consider using|sign up|convert/i.test(intent.objective.objective)
    ? "End with a clear next step aligned to the objective"
    : undefined;

  let strategy: CreativeStrategy = {
    id: newStrategyId(),
    objective: intent.objective,
    audience: audience.audience,
    platform: input.platforms || [],
    format: formatSel.format,
    contentCategory: String(input.genre),
    emotionalObjective: audience.audience.desiredEmotionalOutcome,
    tone: brand.tone || input.tone || "unknown",
    hook: hook.hook,
    narrativeStrategy: pacing.pacing.model,
    pacing: pacing.pacing,
    visualStrategy: [
      hook.hook.openingVisual,
      economics.preferredStrategies.slice(0, 2).join(" + "),
      complexity.complexity.simplificationApplied ? "simplified coverage" : "full planned coverage",
    ]
      .filter(Boolean)
      .join("; "),
    audioStrategy: [
      input.requiresNarration ? "narration-forward" : null,
      input.requiresDialogue ? "dialogue" : null,
      input.requiresMusic ? "score bed with ducking" : "minimal score",
    ]
      .filter(Boolean)
      .join("; "),
    characterStrategy: requiresCharacters
      ? masters.plan.reuseRefs.length
        ? `Reuse ${masters.plan.reuseRefs.join(", ")}`
        : "Establish primary character master"
      : "No character masters required",
    retentionStrategy: pacing.pacing.tensionPoints.join(" → "),
    payoff,
    callToAction: cta,
    durationTargetSec: input.durationSec,
    aspectRatio: input.aspectRatio,
    complexity: complexity.complexity,
    riskLevel: complexity.complexity.generationRisk,
    originalityRequirements: [
      "Avoid generic stock montage without narrative purpose",
      "Hook must connect to payoff",
    ],
    brandRequirements: brand.requirements,
    optimizationProfile: opt.profile,
    masterReuse: masters.plan,
    rationale: [
      intent.explanation.reasons[0],
      formatSel.explanation.reasons[0],
      complexity.explanation.reasons[0],
      ...economics.rationale.slice(0, 2),
    ].filter(Boolean),
    confidence: Math.min(
      intent.objective.confidence,
      audience.audience.confidence || 0.5,
      formatSel.explanation.confidence,
      hook.hook.confidence
    ),
    explanations: [
      intent.explanation,
      audience.explanation,
      formatSel.explanation,
      hook.explanation,
      pacing.explanation,
      complexity.explanation,
      masters.explanation,
      brand.explanation,
      opt.explanation,
      economics.explanation,
    ],
    alternatives,
    clarificationRequests: intent.clarificationRequests,
    productionModeDetail: detail,
    automationMode: input.automationMode,
    userFacingSummary: intent.ambiguous
      ? "SPARK recommends this approach"
      : "SPARK selected the best production approach",
  };

  // Trim explanations for auto mode
  if (detail === "concise") {
    strategy.explanations = strategy.explanations.slice(0, 4);
    strategy.alternatives = strategy.alternatives.slice(0, 1);
  } else if (detail === "rich") {
    // keep all
  } else {
    strategy.alternatives = strategy.alternatives.slice(0, 2);
  }

  // Phase 8 — adaptive influence from creative learning (never blind override of explicit intent)
  const memoryHints = parseLearningHintsFromMemory(input.memoryItems || []);
  const hintBag = input.performanceHints;
  const learnings = input.creativeLearnings || [];
  const explicitInstructions = [
    ...(hintBag?.explicitUserInstructions || []),
    input.explicitObjective ? `objective:${input.explicitObjective}` : "",
    input.creativeControl === "director" && input.tone ? `tone:${input.tone}` : "",
  ].filter(Boolean);

  // Seed synthetic learnings from memory/hints when structured learnings absent
  const effectiveLearnings = [...learnings];
  if (!effectiveLearnings.length) {
    for (const h of hintBag?.strongHooks || memoryHints.strongHooks) {
      effectiveLearnings.push({
        id: `hint_hook_${h}`,
        kind: "hook_pattern",
        scope: input.accountId ? "account" : "brand",
        scopeKey: input.accountId || input.brand?.name,
        claim: `Hook type "${h}" correlates with stronger audience response in this account scope`,
        recommendation: `Prefer testing "${h}" openings when objectives align`,
        confidence: {
          score: 0.6,
          evidenceCount: 5,
          recency: 0.8,
          consistency: 0.7,
          scope: input.accountId ? "account" : "brand",
        },
        evidenceCount: 5,
        supportingObservationIds: [],
        supportingSnapshotIds: [],
        provenance: {
          evidenceType: "account_specific",
          observationIds: [],
          snapshotIds: [],
          notes: ["from_memory_or_hints"],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    for (const f of hintBag?.strongFormats || memoryHints.strongFormats) {
      effectiveLearnings.push({
        id: `hint_fmt_${f}`,
        kind: "format_pattern",
        scope: input.accountId ? "account" : "brand",
        scopeKey: input.accountId || input.brand?.name,
        claim: `Format "${f}" correlates with stronger outcomes for this account`,
        recommendation: `Weight "${f}" higher among credible formats`,
        confidence: {
          score: 0.58,
          evidenceCount: 4,
          recency: 0.8,
          consistency: 0.65,
          scope: input.accountId ? "account" : "brand",
        },
        evidenceCount: 4,
        supportingObservationIds: [],
        supportingSnapshotIds: [],
        provenance: {
          evidenceType: "account_specific",
          observationIds: [],
          snapshotIds: [],
          notes: ["from_memory_or_hints"],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  if (effectiveLearnings.length) {
    const advice = buildAdaptiveAdvice({
      learnings: effectiveLearnings,
      accountId: input.accountId,
      platform: input.platforms?.[0],
      brandId: input.brand?.name,
      explicitUserInstructions: explicitInstructions,
    });
    strategy = applyLearningsToStrategy(strategy, advice);
  }

  const preflight = runCreativePreflight(strategy);
  if (preflight.status === "improve") {
    strategy.userFacingSummary = "SPARK improved the opening";
  } else if (preflight.status === "clarify") {
    strategy.userFacingSummary = "SPARK recommends this approach";
  }

  return { strategy, preflight, economics };
}
