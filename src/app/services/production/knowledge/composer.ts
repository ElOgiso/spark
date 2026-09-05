/**
 * Apply and compose filmmaking skill outputs with conflict detection.
 */

import { KNOWLEDGE_PRIORITY_ORDER } from "./types";
import type {
  ComposedSkillOutput,
  FilmmakingSkill,
  FilmmakingSkillContext,
  KnowledgePriorityLayer,
  SkillApplicationOutput,
  SkillConflict,
  SkillRule,
} from "./types";

function priorityIndex(layer: KnowledgePriorityLayer): number {
  const idx = KNOWLEDGE_PRIORITY_ORDER.indexOf(layer);
  return idx < 0 ? KNOWLEDGE_PRIORITY_ORDER.length : idx;
}

function valuedConstraintKey(topic: string, value: string): string {
  return `${topic}:${value}`;
}

function isCameraTopic(topic: string): boolean {
  return topic === "camera.movement" || topic.startsWith("camera.");
}

export function applySkill(
  skill: FilmmakingSkill,
  _ctx: FilmmakingSkillContext
): SkillApplicationOutput {
  const constraints: string[] = [...(skill.constraints ?? [])];
  const recommendations: string[] = skill.principles.map((p) => p.statement);
  const promptContext: Record<string, string | string[]> = {};
  const generationRequirements: Record<string, string | boolean | string[]> = {};
  const continuityRequirements: string[] = [];
  const qualityCriteria: string[] = [];
  const warnings: string[] = [];
  const rulesApplied: SkillApplicationOutput["rulesApplied"] = [];

  for (const rule of skill.rules) {
    rulesApplied.push({
      ruleId: rule.id,
      topic: rule.topic,
      value: rule.value,
      priorityLayer: rule.priorityLayer,
    });

    if (rule.topic && rule.value !== undefined) {
      const key = valuedConstraintKey(rule.topic, rule.value);
      constraints.push(key);
      generationRequirements[rule.topic] = rule.value;
      if (rule.topic.startsWith("continuity.") || rule.topic.includes("continuity")) {
        continuityRequirements.push(rule.description);
      }
    } else {
      constraints.push(rule.description);
    }
  }

  for (const step of skill.procedure ?? []) {
    recommendations.push(step.action);
  }

  for (const qc of skill.qualityCriteria ?? []) {
    for (const check of qc.checks) {
      qualityCriteria.push(`${qc.dimension}: ${check}`);
    }
  }

  for (const [key, template] of Object.entries(skill.templates ?? {})) {
    promptContext[key] = template;
  }

  for (const key of skill.promptContextKeys ?? []) {
    if (!(key in promptContext)) {
      promptContext[key] = skill.name;
    }
  }

  for (const fm of skill.failureModes ?? []) {
    warnings.push(`${fm.symptom} → ${fm.recovery}`);
  }

  return {
    skillId: skill.id,
    skillVersion: skill.version,
    constraints,
    recommendations,
    promptContext,
    generationRequirements,
    continuityRequirements,
    qualityCriteria,
    warnings,
    rulesApplied,
  };
}

interface ValuedRuleRef {
  skill: FilmmakingSkill;
  rule: SkillRule;
}

function resolveConflict(
  a: ValuedRuleRef,
  b: ValuedRuleRef
): Pick<SkillConflict, "resolution" | "winnerSkillId" | "note"> {
  if (a.rule.optional && !b.rule.optional) {
    return {
      resolution: "optional_ignored",
      winnerSkillId: b.skill.id,
      note: `Optional rule from ${a.skill.id} ignored in favor of required rule from ${b.skill.id}`,
    };
  }
  if (b.rule.optional && !a.rule.optional) {
    return {
      resolution: "optional_ignored",
      winnerSkillId: a.skill.id,
      note: `Optional rule from ${b.skill.id} ignored in favor of required rule from ${a.skill.id}`,
    };
  }

  const pa = priorityIndex(a.rule.priorityLayer);
  const pb = priorityIndex(b.rule.priorityLayer);
  if (pa !== pb) {
    const winner = pa < pb ? a : b;
    const loser = pa < pb ? b : a;
    return {
      resolution: "higher_priority",
      winnerSkillId: winner.skill.id,
      note: `${winner.skill.id} (${winner.rule.priorityLayer}) outranks ${loser.skill.id} (${loser.rule.priorityLayer})`,
    };
  }

  const aProvider =
    a.rule.evidenceLevel === "provider-specific" || a.skill.evidenceLevel === "provider-specific";
  const bProvider =
    b.rule.evidenceLevel === "provider-specific" || b.skill.evidenceLevel === "provider-specific";
  if (aProvider !== bProvider) {
    const winner = aProvider ? a : b;
    const loser = aProvider ? b : a;
    return {
      resolution: "higher_priority",
      winnerSkillId: winner.skill.id,
      note: `Provider-specific evidence from ${winner.skill.id} overrides ${loser.skill.id}`,
    };
  }

  return {
    resolution: "needs_review",
    note: `Conflicting values for ${a.rule.topic}: "${a.rule.value}" vs "${b.rule.value}" require review`,
  };
}

function stripValuedConstraint(
  output: SkillApplicationOutput,
  topic: string,
  value: string
): SkillApplicationOutput {
  const key = valuedConstraintKey(topic, value);
  const constraints = output.constraints.filter((c) => c !== key && c !== `${topic}=${value}`);
  const generationRequirements = { ...output.generationRequirements };
  if (generationRequirements[topic] === value) {
    delete generationRequirements[topic];
  }
  const rulesApplied = output.rulesApplied.filter(
    (r) => !(r.topic === topic && r.value === value)
  );
  return { ...output, constraints, generationRequirements, rulesApplied };
}

export function composeSkillOutputs(
  skills: FilmmakingSkill[],
  ctx: FilmmakingSkillContext
): ComposedSkillOutput {
  const applied = skills.map((skill) => applySkill(skill, ctx));
  const skillById = new Map(skills.map((s) => [s.id, s]));

  const valuedByTopic = new Map<string, ValuedRuleRef[]>();
  for (const skill of skills) {
    for (const rule of skill.rules) {
      if (!rule.topic || rule.value === undefined) continue;
      const list = valuedByTopic.get(rule.topic) ?? [];
      list.push({ skill, rule });
      valuedByTopic.set(rule.topic, list);
    }
  }

  const conflicts: SkillConflict[] = [];
  const strippedKeys = new Set<string>(); // skillId::topic:value

  for (const [topic, refs] of valuedByTopic) {
    const uniqueValues = Array.from(new Set(refs.map((r) => r.rule.value as string)));
    if (uniqueValues.length < 2) continue;

    // Pairwise conflict between differing values (prefer first of each value group)
    const byValue = new Map<string, ValuedRuleRef>();
    for (const ref of refs) {
      if (!byValue.has(ref.rule.value as string)) {
        byValue.set(ref.rule.value as string, ref);
      }
    }
    const representatives = Array.from(byValue.values());

    for (let i = 0; i < representatives.length; i++) {
      for (let j = i + 1; j < representatives.length; j++) {
        const a = representatives[i];
        const b = representatives[j];
        const resolved = resolveConflict(a, b);

        conflicts.push({
          topic,
          skillAId: a.skill.id,
          skillAVersion: a.skill.version,
          valueA: a.rule.value as string,
          skillBId: b.skill.id,
          skillBVersion: b.skill.version,
          valueB: b.rule.value as string,
          resolution: resolved.resolution,
          winnerSkillId: resolved.winnerSkillId,
          note: resolved.note,
        });

        if (
          resolved.resolution === "higher_priority" ||
          resolved.resolution === "optional_ignored"
        ) {
          const winnerId = resolved.winnerSkillId;
          const loser = winnerId === a.skill.id ? b : a;
          strippedKeys.add(
            `${loser.skill.id}::${valuedConstraintKey(topic, loser.rule.value as string)}`
          );
        } else if (resolved.resolution === "needs_review" && isCameraTopic(topic)) {
          // Do not silently concatenate conflicting camera instructions — strip both valued constraints
          strippedKeys.add(
            `${a.skill.id}::${valuedConstraintKey(topic, a.rule.value as string)}`
          );
          strippedKeys.add(
            `${b.skill.id}::${valuedConstraintKey(topic, b.rule.value as string)}`
          );
        }
      }
    }
  }

  let sanitized = applied.map((out) => {
    let next = out;
    for (const key of strippedKeys) {
      const [skillId, rest] = key.split("::");
      if (skillId !== out.skillId) continue;
      const colon = rest.indexOf(":");
      const topic = rest.slice(0, colon);
      const value = rest.slice(colon + 1);
      next = stripValuedConstraint(next, topic, value);
    }
    return next;
  });

  const warnings: string[] = [];
  for (const c of conflicts) {
    if (c.resolution === "needs_review") {
      warnings.push(
        `Conflict needs review on ${c.topic}: ${c.skillAId}="${c.valueA}" vs ${c.skillBId}="${c.valueB}"`
      );
    }
  }

  const skillIds: string[] = [];
  const skillVersions: Record<string, string> = {};
  const constraints: string[] = [];
  const recommendations: string[] = [];
  const promptContext: Record<string, string | string[]> = {};
  const generationRequirements: Record<string, string | boolean | string[]> = {};
  const continuityRequirements: string[] = [];
  const qualityCriteria: string[] = [];

  const constraintSeen = new Set<string>();
  const recSeen = new Set<string>();
  const contSeen = new Set<string>();
  const qcSeen = new Set<string>();

  for (const out of sanitized) {
    skillIds.push(out.skillId);
    skillVersions[out.skillId] = out.skillVersion;
    for (const c of out.constraints) {
      if (constraintSeen.has(c)) continue;
      constraintSeen.add(c);
      constraints.push(c);
    }
    for (const r of out.recommendations) {
      if (recSeen.has(r)) continue;
      recSeen.add(r);
      recommendations.push(r);
    }
    for (const [k, v] of Object.entries(out.promptContext)) {
      const existing = promptContext[k];
      if (existing === undefined) {
        promptContext[k] = v;
      } else if (Array.isArray(existing)) {
        const add = Array.isArray(v) ? v : [v];
        promptContext[k] = Array.from(new Set([...existing, ...add]));
      } else if (typeof v === "string" && existing !== v) {
        promptContext[k] = [existing, v];
      }
    }
    for (const [k, v] of Object.entries(out.generationRequirements)) {
      // Skip camera topics still conflicted without a winner
      const topicConflicts = conflicts.filter((c) => c.topic === k);
      if (topicConflicts.some((c) => c.resolution === "needs_review")) {
        continue;
      }
      const winnerConflict = topicConflicts.find(
        (c) =>
          (c.resolution === "higher_priority" || c.resolution === "optional_ignored") &&
          c.winnerSkillId
      );
      if (winnerConflict) {
        const winnerSkill = skillById.get(winnerConflict.winnerSkillId!);
        const winnerRule = winnerSkill?.rules.find((r) => r.topic === k && r.value !== undefined);
        if (winnerRule?.value !== undefined) {
          generationRequirements[k] = winnerRule.value;
          continue;
        }
      }
      if (!(k in generationRequirements)) {
        generationRequirements[k] = v;
      }
    }
    for (const c of out.continuityRequirements) {
      if (contSeen.has(c)) continue;
      contSeen.add(c);
      continuityRequirements.push(c);
    }
    for (const q of out.qualityCriteria) {
      if (qcSeen.has(q)) continue;
      qcSeen.add(q);
      qualityCriteria.push(q);
    }
    for (const w of out.warnings) {
      warnings.push(w);
    }
  }

  return {
    skillIds,
    skillVersions,
    constraints,
    recommendations,
    promptContext,
    generationRequirements,
    continuityRequirements,
    qualityCriteria,
    warnings,
    conflicts,
    applied: sanitized,
  };
}
