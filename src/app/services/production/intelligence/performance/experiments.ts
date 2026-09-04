/**
 * Controlled experimentation layer — single-variable by default.
 */

import type {
  Experiment,
  ExperimentVariant,
  ExperimentResult,
  ExperimentConclusion,
  ExperimentVariable,
  LearningScope,
  EvidenceStrength,
  CanonicalMetricKey,
} from "./types";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function defineExperiment(params: {
  hypothesis: string;
  variable: ExperimentVariable;
  controlValue: string;
  variantValue: string;
  targetMetric: CanonicalMetricKey | string;
  scope?: LearningScope;
  scopeKey?: string;
  notes?: string[];
}): Experiment {
  const control: ExperimentVariant = {
    id: newId("ctrl"),
    label: "control",
    variableValue: params.controlValue,
    isControl: true,
  };
  const variant: ExperimentVariant = {
    id: newId("var"),
    label: "variant",
    variableValue: params.variantValue,
  };

  return {
    id: newId("exp"),
    hypothesis: params.hypothesis,
    variable: params.variable,
    control,
    variants: [variant],
    targetMetric: params.targetMetric,
    scope: params.scope || "account",
    scopeKey: params.scopeKey,
    status: "planned",
    createdAt: new Date().toISOString(),
    notes: [
      "Change one variable at a time for causal learning unless multi-variable is explicit",
      ...(params.notes || []),
    ],
  };
}

export function evaluateExperiment(params: {
  experiment: Experiment;
  controlValues: number[];
  variantValues: Record<string, number[]>;
  minSamplesForSignificance?: number;
}): ExperimentConclusion {
  const minN = params.minSamplesForSignificance ?? 8;
  const controlVals = params.controlValues.filter((n) => Number.isFinite(n));
  const baseline =
    controlVals.length > 0 ? controlVals.reduce((a, b) => a + b, 0) / controlVals.length : undefined;

  const variantMeans: Record<string, number | undefined> = {};
  let totalObs = controlVals.length;
  let bestId: string | undefined;
  let bestMean = baseline ?? -Infinity;

  for (const v of params.experiment.variants) {
    const vals = (params.variantValues[v.id] || []).filter((n) => Number.isFinite(n));
    totalObs += vals.length;
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
    variantMeans[v.id] = mean;
    if (mean != null && mean > bestMean) {
      bestMean = mean;
      bestId = v.id;
    }
  }

  const statisticallyJustified = totalObs >= minN && controlVals.length >= Math.ceil(minN / 2);
  let strength: EvidenceStrength = "insufficient_data";
  if (totalObs >= minN && baseline != null && bestId && variantMeans[bestId] != null) {
    const lift = (variantMeans[bestId]! - baseline) / Math.max(Math.abs(baseline), 1e-6);
    if (Math.abs(lift) >= 0.15 && statisticallyJustified) strength = "correlated";
    else if (Math.abs(lift) >= 0.08) strength = "likely";
    else strength = "uncertain";
  } else if (totalObs >= 3) {
    strength = "uncertain";
  }

  const confidence = statisticallyJustified
    ? Math.min(0.85, 0.4 + totalObs / 40)
    : Math.min(0.45, totalObs / 20);

  const result: ExperimentResult = {
    experimentId: params.experiment.id,
    baselineValue: baseline,
    variantValues: variantMeans,
    observations: totalObs,
    confidence,
    statisticallyJustified,
    strength,
  };

  let conclusion: string;
  let nextAction: string;
  if (strength === "insufficient_data") {
    conclusion = "SPARK does not have enough evidence to recommend a change yet.";
    nextAction = "Collect more matched observations before changing the default strategy";
  } else if (!statisticallyJustified) {
    conclusion = "Early directional signal only — not statistically justified.";
    nextAction = "Continue the experiment without declaring a winner";
  } else if (bestId && baseline != null && (variantMeans[bestId] || 0) > baseline) {
    const v = params.experiment.variants.find((x) => x.id === bestId);
    conclusion = `Variant "${v?.variableValue}" outperformed control on ${params.experiment.targetMetric} (correlated, sample=${totalObs}).`;
    nextAction = "Adopt variant cautiously and keep a small exploration budget";
  } else {
    conclusion = "No clear improvement over control under current observations.";
    nextAction = "Keep control; schedule a different single-variable test";
    bestId = undefined;
  }

  return {
    experimentId: params.experiment.id,
    conclusion,
    nextAction,
    winnerVariantId: statisticallyJustified ? bestId : undefined,
    strength,
    result,
  };
}
