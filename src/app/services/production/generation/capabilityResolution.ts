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
  if (params.preferredProviderId && params.preferredProviderId !== "auto") {
    const preferred = scores.find((s) => s.providerId === params.preferredProviderId);
    if (preferred) {
      scores = [preferred, ...scores.filter((s) => s.providerId !== params.preferredProviderId)];
    }
  }
  if (intent.candidatePolicy.preferStrongerProvider) {
    scores = [...scores].sort((a, b) => b.score - a.score);
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
    if (hardCaps.has(cap) || fromStrategyNorm.includes(cap)) {
      missingHard.push({
        capability: cap,
        severity: "hard",
        message: `Provider ${best.providerId} lacks required capability ${cap}`,
      });
    } else if (softCaps.has(cap)) {
      missingSoft.push({
        capability: cap,
        severity: "soft",
        message: `Provider ${best.providerId} lacks soft preference ${cap}`,
        constraintId: intent.softPreferences.find(
          (s) => s.capability && norm(s.capability) === cap
        )?.id,
      });
    } else {
      missingHard.push({
        capability: cap,
        severity: "hard",
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
      action: missingSoft.length ? "drop_soft_preference" : "none",
      reasons: missingSoft.map((m) => m.capability),
      droppedSoftPreferences: droppedSoft,
    },
    score: best.score,
  };
}
