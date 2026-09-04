/**
 * QC failure patterns → bounded creative diagnosis / strategy adjustment.
 * Respects existing retry budgets — no infinite loops.
 */

import type { CreativeDiagnosis, FailurePatternSummary, CreativeStrategy } from "./types";

export function aggregateFailurePatterns(
  failures: Array<{ code: string; shotId?: string; at?: string }>
): FailurePatternSummary[] {
  const map = new Map<string, FailurePatternSummary>();
  for (const f of failures) {
    const cur = map.get(f.code) || {
      code: f.code,
      count: 0,
      relatedShotIds: [],
      lastSeenAt: f.at,
    };
    cur.count += 1;
    if (f.shotId && !cur.relatedShotIds.includes(f.shotId)) cur.relatedShotIds.push(f.shotId);
    cur.lastSeenAt = f.at || cur.lastSeenAt;
    map.set(f.code, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function diagnoseCreativeFailures(params: {
  patterns: FailurePatternSummary[];
  strategy?: CreativeStrategy;
  qcRetriesUsed?: number;
  maxQcRetries?: number;
}): CreativeDiagnosis {
  const max = params.maxQcRetries ?? 2;
  const used = params.qcRetriesUsed ?? 0;
  const withinBudget = used < max;
  const adjustments: CreativeDiagnosis["adjustments"] = [];

  for (const p of params.patterns) {
    if (p.count < 2) continue;
    if (/identity|wardrobe/.test(p.code)) {
      adjustments.push({
        kind: "strengthen_references",
        reason: `Repeated ${p.code} (×${p.count}) — strengthen character/wardrobe masters`,
      });
      adjustments.push({
        kind: "simplify_blocking",
        reason: "Reduce pose/motion complexity that amplifies identity drift",
      });
    } else if (/camera|composition|motion/.test(p.code)) {
      adjustments.push({
        kind: "simplify_camera",
        reason: `Repeated ${p.code} — simplify camera move / shot ambition`,
      });
      if (params.strategy && params.strategy.complexity.estimatedShots > params.strategy.complexity.estimatedScenes) {
        adjustments.push({
          kind: "reduce_shot_count",
          reason: "Fewer ambitious angles; rely on editorial coverage",
        });
      }
    } else if (/continuity|location|spatial|screen_direction/.test(p.code)) {
      adjustments.push({
        kind: "simplify_continuity",
        reason: `Repeated ${p.code} — reduce location/wardrobe/time changes`,
      });
    } else if (/duration|aspect|technical/.test(p.code)) {
      adjustments.push({
        kind: "change_generation_strategy",
        reason: `Repeated ${p.code} — change generation strategy / provider routing inputs`,
      });
    }
  }

  if (!adjustments.length) {
    adjustments.push({ kind: "none", reason: "No repeated failure pattern requiring strategy change" });
  }

  // Dedupe by kind
  const seen = new Set<string>();
  const unique = adjustments.filter((a) => {
    if (seen.has(a.kind)) return false;
    seen.add(a.kind);
    return true;
  });

  return {
    patterns: params.patterns,
    adjustments: withinBudget ? unique : [{ kind: "none", reason: "QC repair budget exhausted — stop strategy loop" }],
    withinBudget,
    userFacingMessage: withinBudget
      ? unique.some((a) => a.kind !== "none")
        ? "SPARK improved the production approach"
        : "SPARK is checking this"
      : "SPARK recommends review",
  };
}

/**
 * Apply bounded strategy adjustments — returns a shallow-updated strategy.
 */
export function applyCreativeDiagnosis(
  strategy: CreativeStrategy,
  diagnosis: CreativeDiagnosis
): CreativeStrategy {
  if (!diagnosis.withinBudget) return strategy;
  let next = { ...strategy };
  const notes = [...strategy.rationale];

  for (const adj of diagnosis.adjustments) {
    if (adj.kind === "reduce_shot_count") {
      next = {
        ...next,
        complexity: {
          ...next.complexity,
          estimatedShots: Math.max(next.complexity.estimatedScenes, next.complexity.estimatedShots - 2),
          simplificationApplied: true,
          simplificationNotes: [
            ...next.complexity.simplificationNotes,
            adj.reason,
          ],
        },
      };
      notes.push(adj.reason);
    }
    if (adj.kind === "simplify_continuity") {
      next = {
        ...next,
        complexity: {
          ...next.complexity,
          continuityRisk: next.complexity.continuityRisk === "high" ? "medium" : "low",
          simplificationApplied: true,
          simplificationNotes: [...next.complexity.simplificationNotes, adj.reason],
        },
        characterStrategy: `${next.characterStrategy}; simplify continuity locks`,
      };
      notes.push(adj.reason);
    }
    if (adj.kind === "simplify_camera") {
      next = {
        ...next,
        visualStrategy: `${next.visualStrategy}; prefer simpler camera moves`,
      };
      notes.push(adj.reason);
    }
    if (adj.kind === "strengthen_references") {
      next = {
        ...next,
        characterStrategy: `${next.characterStrategy}; strengthen master references`,
        masterReuse: {
          ...next.masterReuse,
          notes: [...next.masterReuse.notes, "Strengthen reference order / identity lock"],
        },
      };
      notes.push(adj.reason);
    }
    if (adj.kind === "change_generation_strategy") {
      next = {
        ...next,
        visualStrategy: `${next.visualStrategy}; prefer first_last_frame / stronger conditioning`,
      };
      notes.push(adj.reason);
    }
  }

  return {
    ...next,
    rationale: notes,
    userFacingSummary: diagnosis.userFacingMessage,
  };
}
