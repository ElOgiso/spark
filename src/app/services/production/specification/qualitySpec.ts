/**
 * Quality targets and gate configuration for a production.
 */

export type QualityTarget = "social" | "broadcast" | "cinema" | "draft";

export type QcRemediation =
  | "rerender_same_model"
  | "rerender_different_model"
  | "regenerate_keyframe"
  | "modify_prompt"
  | "change_generation_strategy"
  | "replace_asset"
  | "extend_clip"
  | "trim_clip"
  | "change_transition"
  | "remix_audio"
  | "waive";

export interface QualityGateConfig {
  id: string;
  label: string;
  enabled: boolean;
  minScore: number;
}

export interface QualitySpec {
  target: QualityTarget;
  maxRetriesPerShot: number;
  gates: QualityGateConfig[];
  prioritize: Array<
    "story_coherence" | "visual_coherence" | "subject_consistency" | "composition" | "audio_clarity" | "continuity" | "platform_fit" | "speed" | "cost"
  >;
}

export function createDefaultQualitySpec(target: QualityTarget = "cinema"): QualitySpec {
  return {
    target,
    maxRetriesPerShot: 2,
    prioritize: [
      "story_coherence",
      "subject_consistency",
      "continuity",
      "visual_coherence",
      "composition",
      "audio_clarity",
      "platform_fit",
    ],
    gates: [
      { id: "preflight", label: "Preflight", enabled: true, minScore: 70 },
      { id: "shot", label: "Shot quality", enabled: true, minScore: 70 },
      { id: "continuity", label: "Continuity", enabled: true, minScore: 75 },
      { id: "audio", label: "Audio", enabled: true, minScore: 70 },
      { id: "editorial", label: "Editorial", enabled: true, minScore: 70 },
      { id: "final_master", label: "Final master", enabled: true, minScore: 80 },
    ],
  };
}
