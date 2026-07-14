import { Capability } from "../domain/runtime/Capability";
import { ExecutionTask } from "../domain/runtime/ExecutionTask";
import { AgentDefinition } from "../domain/runtime/AgentDefinition";
import { PerformanceHistory, ProviderMetrics } from "./performanceHistory";
import { ExecutionRequirements } from "./capabilityAnalyzer";

export interface ProviderSelection {
  provider: "openai" | "anthropic" | "google";
  model: string;
  confidence: number;
  reasoning: string[];
}

interface ModelProfile {
  provider: "openai" | "anthropic" | "google";
  model: string;
  maxContextWindow: number;
  reasoningQuality: number;
  supportedCapabilities: Capability[];
}

export class ModelRouter {
  private static readonly MODEL_PROFILES: ModelProfile[] = [
    {
      provider: "openai",
      model: "gpt-4o",
      maxContextWindow: 128000,
      reasoningQuality: 92,
      supportedCapabilities: [
        Capability.WEB_SEARCH,
        Capability.LONG_CONTEXT,
        Capability.STRATEGIC_REASONING,
        Capability.WRITING,
        Capability.STYLE_CONSISTENCY,
        Capability.TONE_ADAPTATION,
        Capability.IMAGE_GENERATION,
        Capability.PUBLISHING,
        Capability.ANALYTICS,
        Capability.LEARNING
      ]
    },
    {
      provider: "openai",
      model: "gpt-4o-mini",
      maxContextWindow: 128000,
      reasoningQuality: 78,
      supportedCapabilities: [
        Capability.WRITING,
        Capability.PUBLISHING,
        Capability.ANALYTICS,
        Capability.LEARNING
      ]
    },
    {
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      maxContextWindow: 200000,
      reasoningQuality: 96,
      supportedCapabilities: [
        Capability.WRITING,
        Capability.STYLE_CONSISTENCY,
        Capability.TONE_ADAPTATION,
        Capability.LONG_CONTEXT,
        Capability.STRATEGIC_REASONING,
        Capability.LEARNING
      ]
    },
    {
      provider: "google",
      model: "gemini-1.5-pro",
      maxContextWindow: 1000000,
      reasoningQuality: 94,
      supportedCapabilities: [
        Capability.WEB_SEARCH,
        Capability.LONG_CONTEXT,
        Capability.STRATEGIC_REASONING,
        Capability.WRITING,
        Capability.STYLE_CONSISTENCY,
        Capability.TONE_ADAPTATION,
        Capability.IMAGE_GENERATION,
        Capability.VIDEO_GENERATION,
        Capability.PUBLISHING,
        Capability.ANALYTICS,
        Capability.LEARNING
      ]
    },
    {
      provider: "google",
      model: "gemini-1.5-flash",
      maxContextWindow: 1000000,
      reasoningQuality: 75,
      supportedCapabilities: [
        Capability.WEB_SEARCH,
        Capability.WRITING,
        Capability.PUBLISHING,
        Capability.ANALYTICS
      ]
    }
  ];

  /**
   * Evaluates and routes an ExecutionTask to the optimal provider/model combination.
   * Employs multi-factor scoring based on constraints, cost, latency, and performance history.
   * Employs exploration entropy (random factor) to prevent permanent locking.
   */
  public static route(
    task: ExecutionTask,
    requirements: ExecutionRequirements,
    agent: AgentDefinition
  ): ProviderSelection {
    const history = PerformanceHistory.getInstance();
    let bestProfile: ModelProfile | null = null;
    let maxScore = -1;
    let selectReasoning: string[] = [];

    for (const profile of this.MODEL_PROFILES) {
      // 1. Context window constraint matching
      if (profile.maxContextWindow < requirements.minimumContextWindow) {
        continue;
      }

      // Check current health from performance history
      const metrics = history.getMetricsFor(profile.provider, profile.model);
      if (!metrics || metrics.recentHealth === "unhealthy") {
        continue;
      }

      let score = 0;
      const reasons: string[] = [];

      // 2. Capability matching alignment (weight: 30%)
      const overlap = profile.supportedCapabilities.filter(c => requirements.requiredCapabilities.includes(c));
      const capabilityMatchRate = requirements.requiredCapabilities.length > 0
        ? overlap.length / requirements.requiredCapabilities.length
        : 1.0;
      score += capabilityMatchRate * 30;
      if (capabilityMatchRate === 1.0) {
        reasons.push("Fully supports required capabilities");
      } else if (capabilityMatchRate > 0) {
        reasons.push("Supports necessary capabilities");
      }

      // 3. Reasoning index weighting (weight: 20%)
      const qualityScore = metrics.qualityScore;
      score += (qualityScore / 100) * 20;
      if (qualityScore >= 90) {
        reasons.push(`High reasoning/quality profile (${profile.model})`);
      }

      // 4. Latency boundaries (weight: 15%)
      const avgLatency = metrics.avgLatencyMs;
      let latencyScore = 1.0;
      if (avgLatency > 0) {
        latencyScore = Math.max(0, 1 - avgLatency / 10000);
      }
      if (requirements.latencyPreference === "low") {
        score += latencyScore * 25; // Up-weight latency if requested
        reasons.push("Matches latency limits preference");
      } else {
        score += latencyScore * 15;
      }

      // 5. Cost minimization weighting (weight: 15%)
      const costScore = Math.max(0, 1 - metrics.avgCostUsd / 0.1);
      score += costScore * 15;
      if (metrics.avgCostUsd < 0.005) {
        reasons.push("Provides optimized execution cost bounds");
      }

      // 6. Historical success rate weighting (weight: 15%)
      score += metrics.successRate * 15;

      // 7. Recent health degradation penalty
      if (metrics.recentHealth === "degraded") {
        score -= 20;
        reasons.push("Penalized due to degraded health status");
      }

      // 8. Exploration Entropy (weight: 5%)
      // Introduce minor variance to prevent strict locking onto single models
      const entropy = Math.random() * 5;
      score += entropy;

      if (score > maxScore) {
        maxScore = score;
        bestProfile = profile;
        selectReasoning = reasons;
      }
    }

    // Default fallback
    if (!bestProfile) {
      bestProfile = this.MODEL_PROFILES[3]; // gemini-1.5-pro
      selectReasoning = ["Default fallback profile selected"];
    }

    // Normalize confidence score between 0.1 and 1.0
    const confidence = Math.min(1.0, Math.max(0.1, maxScore / 105));

    return {
      provider: bestProfile.provider,
      model: bestProfile.model,
      confidence: parseFloat(confidence.toFixed(2)),
      reasoning: selectReasoning.slice(0, 3)
    };
  }
}
