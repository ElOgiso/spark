// ── Capability Scoring Engine ─────────────────────────────────────────
// Calculates runtime capability scores dynamically using multiple variables.
// Singleton – obtain via CapabilityScoringEngine.getInstance().

import { IntegrationManifest } from './integrationManifest';

export interface ScoreParameters {
  latencyMs: number;
  costUsd: number;
  successRate: number;
  qualityRating: number; // 0 to 100
  healthStatus: 'healthy' | 'degraded' | 'offline' | 'disabled';
  confidenceRating: number; // 0 to 100
}

export class CapabilityScoringEngine {
  private static instance: CapabilityScoringEngine;

  private constructor() {}

  public static getInstance(): CapabilityScoringEngine {
    if (!CapabilityScoringEngine.instance) {
      CapabilityScoringEngine.instance = new CapabilityScoringEngine();
    }
    return CapabilityScoringEngine.instance;
  }

  /**
   * Calculates dynamic execution suitability score (0-100) for a service.
   */
  public calculateScore(manifest: IntegrationManifest, params: ScoreParameters): number {
    if (params.healthStatus === 'disabled' || params.healthStatus === 'offline') {
      return 0;
    }

    // Dynamic scoring formula weights
    const successWeight = 0.3;
    const qualityWeight = 0.25;
    const latencyWeight = 0.15;
    const costWeight = 0.15;
    const healthWeight = 0.15;

    const successScore = params.successRate * 100;
    const qualityScore = params.qualityRating;
    const latencyScore = Math.max(0, 100 - params.latencyMs / 100);
    const costScore = Math.max(0, 100 - params.costUsd * 200);
    
    let healthScore = 100;
    if (params.healthStatus === 'degraded') healthScore = 50;

    const finalScore =
      successScore * successWeight +
      qualityScore * qualityWeight +
      latencyScore * latencyWeight +
      costScore * costWeight +
      healthScore * healthWeight;

    return Math.round(finalScore);
  }
}
