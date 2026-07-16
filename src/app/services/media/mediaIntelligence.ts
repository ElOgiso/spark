// ── Media Intelligence Service ────────────────────────────────────────
// Orchestrates Visual, Audio, and Editing Intelligence evaluations.
// Singleton – obtain via MediaIntelligence.getInstance().

import { VisualIntelligence, VisualAnalysis } from './visualIntelligence';
import { AudioIntelligence, AudioAnalysis } from './audioIntelligence';
import { MediaEvaluationEngine, EvaluationReport } from './mediaEvaluationEngine';
import { EditingIntelligence, EditingDecision } from './editingIntelligence';

export interface ComprehensiveMediaAnalysis {
  visuals: VisualAnalysis;
  audio: AudioAnalysis;
  evaluation: EvaluationReport;
  decision: EditingDecision;
  analyzedAt: string;
}

export class MediaIntelligence {
  private static instance: MediaIntelligence;

  private constructor() {}

  public static getInstance(): MediaIntelligence {
    if (!MediaIntelligence.instance) {
      MediaIntelligence.instance = new MediaIntelligence();
    }
    return MediaIntelligence.instance;
  }

  /**
   * Orchestrates frame, frequency, and composition checks to generate a single structured report.
   */
  public analyzeMedia(assets: string[], audioUrl?: string): ComprehensiveMediaAnalysis {
    const visuals = VisualIntelligence.getInstance().analyzeVisuals(assets);
    const audio = AudioIntelligence.getInstance().analyzeAudio(audioUrl);
    const evaluation = MediaEvaluationEngine.getInstance().evaluate(visuals, audio);
    const decision = EditingIntelligence.getInstance().evaluateDecision(
      evaluation,
      visuals.aspectRatioOk,
      audio.audioImbalanceDetected
    );

    return {
      visuals,
      audio,
      evaluation,
      decision,
      analyzedAt: new Date().toISOString(),
    };
  }
}
