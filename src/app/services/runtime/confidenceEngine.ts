// ── Confidence Engine ────────────────────────────────────────────────
// Evaluates the confidence, risks, and gaps in execution outputs.
// Singleton – obtain via ConfidenceEngine.getInstance().

export interface ConfidenceReport {
  confidence: number; // 0 to 100
  risk: 'Low' | 'Moderate' | 'High';
  uncertainty: string;
  missingInformation: string[];
  recommendedAction: string;
  reviewNeeded: boolean;
}

export class ConfidenceEngine {
  private static instance: ConfidenceEngine;

  private constructor() {}

  public static getInstance(): ConfidenceEngine {
    if (!ConfidenceEngine.instance) {
      ConfidenceEngine.instance = new ConfidenceEngine();
    }
    return ConfidenceEngine.instance;
  }

  /**
   * Generates a confidence report for a specific agent execution result.
   */
  public generateReport(
    department: string,
    outputLength: number,
    hasKeywords: boolean,
    hasCitations: boolean
  ): ConfidenceReport {
    let confidence = 95;
    let risk: ConfidenceReport['risk'] = 'Low';
    let uncertainty = 'None detected';
    const missingInformation: string[] = [];
    let recommendedAction = 'Proceed directly to downstream pipeline';
    let reviewNeeded = false;

    if (outputLength < 20) {
      confidence -= 40;
      risk = 'High';
      uncertainty = 'Extremely brief output';
      missingInformation.push('Substantial script content');
      recommendedAction = 'Request script rewrite';
      reviewNeeded = true;
    } else if (!hasKeywords) {
      confidence -= 15;
      risk = 'Moderate';
      uncertainty = 'Missing brand memory keywords';
      missingInformation.push('Brand visual anchors');
      recommendedAction = 'Run style grading sweep';
      reviewNeeded = true;
    }

    if (department === 'research' && !hasCitations) {
      confidence -= 20;
      risk = 'Moderate';
      uncertainty = 'No reference sources verified';
      missingInformation.push('Source URL index');
      recommendedAction = 'Re-query verified citation channels';
      reviewNeeded = true;
    }

    return {
      confidence,
      risk,
      uncertainty,
      missingInformation,
      recommendedAction,
      reviewNeeded,
    };
  }
}
