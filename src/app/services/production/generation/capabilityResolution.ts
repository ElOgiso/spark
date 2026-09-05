/**
 * Resolve GenerationIntent against existing provider capability scorecards.
 * Hard constraints are never silently dropped.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { RoutingSpec } from "../specification/routingSpec";
import { scoreProvidersForShot } from "../routing/modelScorer";
import {
  getScorecard,
  strategyToRequiredCapabilities,
} from "../routing/capabilityMatrix";
import { DEFAULT_ROUTING_WEIGHTS } from "../routing/routingWeights";
import type {
  CapabilityResolutionIssue,
  CapabilityResolutionResult,
  GenerationIntent,
} from "./generationIntent";

function norm(label: string): string {
  return label.replace(/-/g, "_").toLowerCase();
}

function providerLacksCapability(providerId: string, capability: string): boolean {
  const card = getScorecard(providerId);
  if (!card) return true;
  const v = card.capabilities[capability as keyof typeof card.capabilities] ?? 0;
  return v <= 0.05;
}

/** Strategy gaps that match Phase 3 critical routing — plus explicit hardConstraints. */
const CRITICAL_CAPS = new Set(
  DEFAULT_ROUTING_WEIGHTS.criticalCapabilities.map((c) => norm(String(c)))
);

function isHardCapability(
  cap: string,
  hardCaps: Set<string>,
  fromStrategyNorm: string[]
): boolean {
  if (hardCaps.has(cap)) return true;
  if (CRITICAL_CAPS.has(cap) && fromStrategyNorm.includes(cap)) return true;
  // Core modality aliases from strategy are hard even if listed via intent.capabilityRequirements
  if (
    fromStrategyNorm.includes(cap) &&
    (cap === "image_to_video" ||
      cap === "text_to_video" ||
      cap === "text_to_image" ||
      cap === "image_to_image" ||
      cap === "multi_reference" ||
      cap === "first_frame_conditioning" ||
      cap === "last_frame_conditioning")
  ) {
    return true;
  }
  return false;
}

export function resolveGenerationCapabilities(params: {
  intent: GenerationIntent;
  shot: ShotSpec;
  routing: RoutingSpec;
  availableProviderIds?: string[];
  preferredProviderId?: string;
}): CapabilityResolutionResult {
  const { intent, shot, routing } = params;
  const fromStrategy = strategyToRequiredCapabilities(shot.generationStrategy, shot).map(String);
  const required = Array.from(
    new Set([...fromStrategy, ...intent.capabilityRequirements.map(norm)])
  );

  const hardCaps = new Set(
    intent.hardConstraints
      .map((c) => c.capability)
      .filter((c): c is string => Boolean(c))
      .map(norm)
  );
  const softCaps = new Set(
    intent.softPreferences
      .map((c) => c.capability)
      .filter((c): c is string => Boolean(c))
      .map(norm)
  );

  if (intent.referenceManifest.conflicts.some((c) => c.severity === "blocking")) {
    return {
      ok: false,
      providerId: null,
      fallbackProviders: [],
      matchedCapabilities: [],
      missingHard: [
        {
          capability: "reference_integrity",
          severity: "hard",
          message: "Blocking REFERENCE_CONFLICT must be resolved before generation",
          constraintId: "hard_reference_conflict",
        },
      ],
      missingSoft: [],
      degradation: {
        action: "block",
        reasons: ["blocking_reference_conflict"],
        droppedSoftPreferences: [],
      },
      score: 0,
    };
  }

  let scores = scoreProvidersForShot(shot, routing.capabilityPolicy, params.availableProviderIds);
  if (intent.candidatePolicy.preferStrongerProvider) {
    scores = [...scores].sort((a, b) => b.score - a.score);
  }
  // Explicit preferred provider wins over score ordering (fallback path still available)
  if (params.preferredProviderId && params.preferredProviderId !== "auto") {
    const preferred = scores.find((s) => s.providerId === params.preferredProviderId);
    if (preferred) {
      scores = [preferred, ...scores.filter((s) => s.providerId !== params.preferredProviderId)];
    }
  }

  const best = scores[0];
  if (!best) {
    return {
      ok: false,
      providerId: null,
      fallbackProviders: [],
      matchedCapabilities: [],
      missingHard: required.map((c) => ({
        capability: c,
        severity: "hard" as const,
        message: `No compatible provider for capability ${c}`,
      })),
      missingSoft: [],
      degradation: {
        action: "block",
        reasons: ["no_compatible_provider"],
        droppedSoftPreferences: [],
      },
      score: 0,
    };
  }

  const missingHard: CapabilityResolutionIssue[] = [];
  const missingSoft: CapabilityResolutionIssue[] = [];
  const matched = best.matchedCapabilities.map(String);
  const missingSet = new Set(best.missingCapabilities.map((c) => norm(String(c))));
  const fromStrategyNorm = fromStrategy.map(norm);

  for (const raw of required) {
    const cap = norm(raw);
    const lacks = missingSet.has(cap) || providerLacksCapability(best.providerId, cap);
    if (!lacks) continue;
    if (isHardCapability(cap, hardCaps, fromStrategyNorm)) {
      // Unmodeled hard capabilities (no scorecard lists them) cannot block every provider —
      // degrade explicitly instead of falsely declaring the shot unsupported.
      const anyoneHas = scores.some((s) => !providerLacksCapability(s.providerId, cap));
      if (!anyoneHas && hardCaps.has(cap) && !CRITICAL_CAPS.has(cap)) {
        missingSoft.push({
          capability: cap,
          severity: "soft",
          message: `Capability ${cap} is required hard but unmodeled in provider registry — explicit degradation`,
          constraintId: intent.hardConstraints.find(
            (c) => c.capability && norm(c.capability) === cap
          )?.id,
        });
      } else {
        missingHard.push({
          capability: cap,
          severity: "hard",
          message: `Provider ${best.providerId} lacks required capability ${cap}`,
        });
      }
    } else if (softCaps.has(cap) || fromStrategyNorm.includes(cap)) {
      missingSoft.push({
        capability: cap,
        severity: "soft",
        message: `Provider ${best.providerId} lacks soft preference ${cap}`,
        constraintId: intent.softPreferences.find(
          (s) => s.capability && norm(s.capability) === cap
        )?.id,
      });
    } else {
      missingSoft.push({
        capability: cap,
        severity: "soft",
        message: `Provider ${best.providerId} lacks capability ${cap}`,
      });
    }
  }

  // Soft preferences are explicit degradation candidates even when not in strategy required set
  for (const soft of intent.softPreferences) {
    if (!soft.capability) continue;
    const cap = norm(soft.capability);
    if (missingSoft.some((m) => m.capability === cap)) continue;
    if (!providerLacksCapability(best.providerId, cap)) continue;
    missingSoft.push({
      capability: cap,
      severity: "soft",
      message: `Provider ${best.providerId} lacks soft preference ${cap}`,
      constraintId: soft.id,
    });
  }

  // Hard constraint capabilities not already covered via required set
  for (const hard of intent.hardConstraints) {
    if (!hard.capability) continue;
    const cap = norm(hard.capability);
    if (missingHard.some((m) => m.capability === cap) || missingSoft.some((m) => m.capability === cap)) {
      continue;
    }
    if (!providerLacksCapability(best.providerId, cap)) continue;
    const anyoneHas = scores.some((s) => !providerLacksCapability(s.providerId, cap));
    if (!anyoneHas && !CRITICAL_CAPS.has(cap)) {
      missingSoft.push({
        capability: cap,
        severity: "soft",
        message: `Capability ${cap} is required hard but unmodeled in provider registry — explicit degradation`,
        constraintId: hard.id,
      });
    } else {
      missingHard.push({
        capability: cap,
        severity: "hard",
        message: `Provider ${best.providerId} lacks required capability ${cap}`,
        constraintId: hard.id,
      });
    }
  }

  const fallbackProviders = scores.slice(1, 4).map((s) => s.providerId);
  const droppedSoft = missingSoft.map((m) => m.constraintId || m.capability);

  if (missingHard.length) {
    for (const alt of scores.slice(1)) {
      const stillHard = missingHard.filter((h) =>
        providerLacksCapability(alt.providerId, h.capability)
      );
      if (stillHard.length === 0) {
        const altSoft: CapabilityResolutionIssue[] = [];
        for (const soft of intent.softPreferences) {
          if (!soft.capability) continue;
          const cap = norm(soft.capability);
          if (!providerLacksCapability(alt.providerId, cap)) continue;
          altSoft.push({
            capability: cap,
            severity: "soft",
            message: `Provider ${alt.providerId} lacks soft preference ${cap}`,
            constraintId: soft.id,
          });
        }
        const altDropped = altSoft.map((m) => m.constraintId || m.capability);
        return {
          ok: true,
          providerId: alt.providerId,
          fallbackProviders: scores
            .filter((s) => s.providerId !== alt.providerId)
            .slice(0, 3)
            .map((s) => s.providerId),
          matchedCapabilities: alt.matchedCapabilities.map(String),
          missingHard: [],
          missingSoft: altSoft,
          degradation: {
            action: "fallback_provider",
            reasons: [
              `preferred_missing_hard:${missingHard.map((m) => m.capability).join(",")}`,
              `using:${alt.providerId}`,
            ],
            droppedSoftPreferences: altDropped,
          },
          score: alt.score,
        };
      }
    }

    return {
      ok: false,
      providerId: best.providerId,
      fallbackProviders,
      matchedCapabilities: matched,
      missingHard,
      missingSoft,
      degradation: {
        action: fallbackProviders.length ? "fallback_provider" : "block",
        reasons: missingHard.map((m) => m.capability),
        droppedSoftPreferences: [],
      },
      score: best.score,
    };
  }

  return {
    ok: true,
    providerId: best.providerId,
    fallbackProviders,
    matchedCapabilities: matched,
    missingHard: [],
    missingSoft,
    degradation: {
      action: missingSoft.length
        ? missingSoft.some((m) => (m.constraintId || "").startsWith("hard_"))
          ? "reduced_capability_mode"
          : "drop_soft_preference"
        : "none",
      reasons: missingSoft.map((m) => m.capability),
      droppedSoftPreferences: droppedSoft,
    },
    score: best.score,
  };
}
