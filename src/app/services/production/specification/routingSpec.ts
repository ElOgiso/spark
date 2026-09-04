/**
 * Routing preferences and shot-level provider decisions.
 */

export interface ShotRoutingDecision {
  shotId: string;
  provider: string;
  model?: string;
  strategy: string;
  score: number;
  reasons: string[];
  fallbacks: Array<{ provider: string; model?: string; reason: string }>;
}

export interface RoutingSpec {
  /** Soft production-level preference; shot decisions override */
  preferredVideoProvider?: string;
  preferredImageProvider?: string;
  preferredVoiceProvider?: string;
  allowProviderFallback: boolean;
  shotDecisions: ShotRoutingDecision[];
  capabilityPolicy: {
    preferCharacterConsistency: boolean;
    preferFirstLastFrame: boolean;
    preferNativeAudio: boolean;
    preferSpeed: boolean;
    preferCost: boolean;
  };
}

export function createDefaultRoutingSpec(partial?: Partial<RoutingSpec>): RoutingSpec {
  return {
    preferredVideoProvider: partial?.preferredVideoProvider,
    preferredImageProvider: partial?.preferredImageProvider,
    preferredVoiceProvider: partial?.preferredVoiceProvider,
    allowProviderFallback: partial?.allowProviderFallback ?? true,
    shotDecisions: partial?.shotDecisions ?? [],
    capabilityPolicy: {
      preferCharacterConsistency: true,
      preferFirstLastFrame: true,
      preferNativeAudio: false,
      preferSpeed: false,
      preferCost: false,
      ...(partial?.capabilityPolicy || {}),
    },
  };
}
