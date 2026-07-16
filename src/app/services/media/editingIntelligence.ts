// ── Editing Intelligence Service ──────────────────────────────────────
// Determines if timeline editing is required based on media evaluation scores.
// Singleton – obtain via EditingIntelligence.getInstance().

import { EvaluationReport } from './mediaEvaluationEngine';

export interface EditingDecision {
  shouldEdit: boolean;
  editLevel: 'None' | 'Minor' | 'Full';
  reasons: string[];
}

export class EditingIntelligence {
  private static instance: EditingIntelligence;

  private constructor() {}

  public static getInstance(): EditingIntelligence {
    if (!EditingIntelligence.instance) {
      EditingIntelligence.instance = new EditingIntelligence();
    }
    return EditingIntelligence.instance;
  }

  /**
   * Evaluates if editing operations are necessary based on overall score thresholds.
   */
  public evaluateDecision(
    evalReport: EvaluationReport,
    aspectRatioOk: boolean,
    audioImbalance: boolean
  ): EditingDecision {
    const reasons: string[] = [];

    if (!aspectRatioOk) {
      reasons.push('Wrong aspect ratio');
    }
    if (audioImbalance) {
      reasons.push('Audio imbalance');
    }

    if (evalReport.overallScore < 70) {
      reasons.push('Low overall score');
      return {
        shouldEdit: true,
        editLevel: 'Full',
        reasons,
      };
    }

    if (evalReport.overallScore >= 70 && evalReport.overallScore <= 90) {
      reasons.push('Poor pacing/Suboptimal quality');
      return {
        shouldEdit: true,
        editLevel: 'Minor',
        reasons,
      };
    }

    // > 90 -> skip editing!
    return {
      shouldEdit: reasons.length > 0,
      editLevel: reasons.length > 0 ? 'Minor' : 'None',
      reasons,
    };
  }
}
