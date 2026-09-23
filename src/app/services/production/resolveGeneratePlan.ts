import type { ProductionBrief, CreditSettings, GenerationProgressStage } from "../../domain/types";
import { normalizeModeString } from "./resolveProductionMode";

import { resolveChapterAudio } from "./os/chapterAudio";

/** Shared format director decision for canonical and live scene planning. */
export function resolveSceneGeneratePlan(rawMode: string | undefined, scene: {
  audio?: string; dialogue?: string; narration?: string; valueJob?: string; narrativeFunction?: string;
}) {
  const mode = normalizeModeString(rawMode) || "standard";
  const audio = resolveChapterAudio({ mode, chapter: {
    audio: scene.audio || (scene.dialogue ? "talent" : scene.narration ? "vo" : undefined),
    job: scene.valueJob || scene.narrativeFunction,
  } });
  // Older canonical specs used narration over generated B-roll without an audio
  // authority field. Preserve their visual plan until explicit scene routing exists.
  return { audio, stillOnly: mode === "express" || (mode === "standard" && scene.audio === "vo") };
}

export interface GeneratePlan {
  normalizedMode: "express" | "standard" | "deep";
  skipExternalVoice: boolean;
  skipSfx: boolean;
  skipI2V: boolean;
  voiceStageLabel: string;
  sfxStageLabel: string;
  videoStageLabel: string;
  stages: GenerationProgressStage[];
}

export function resolveGeneratePlan(
  rawMode: string | undefined,
  brief?: ProductionBrief,
  creditSettings?: CreditSettings
): GeneratePlan {
  const normalizedMode = normalizeModeString(rawMode) || "standard";

  const beats = brief?.beats || [];
  const sb = brief?.storyboard || [];
  const hasBeats = beats.length > 0;
  const hasSb = sb.length > 0;

  // In hybrid/standard, external voice is skipped ONLY when every beat is talent dialogue
  const hasOnlyTalentBeats =
    (hasBeats && beats.every((b) => b.audio === "talent")) ||
    (!hasBeats && hasSb && sb.every((s) => s.audio === "talent"));

  const skipExternalVoice = normalizedMode === "deep" || (normalizedMode === "standard" && hasOnlyTalentBeats);
  const skipSfx = normalizedMode === "deep";
  const skipI2V = normalizedMode === "express";

  const targetThumbCount =
    typeof creditSettings?.thumbnailCount === "number"
      ? Math.max(0, creditSettings.thumbnailCount)
      : 3;
  const skipThumbnails = targetThumbCount === 0;

  const voiceStageLabel =
    normalizedMode === "deep"
      ? "Voiceover synthesis (skipped — cinematic)"
      : normalizedMode === "standard" && hasOnlyTalentBeats
        ? "Voiceover synthesis (skipped — talent dialogue)"
        : "Voiceover synthesis";

  const sfxStageLabel = skipSfx
    ? "Sound FX (skipped — cinematic)"
    : "Sound FX";

  const videoStageLabel = skipI2V
    ? "Narrator Slideshow Compilation"
    : "Motion synthesis (Image-to-video)";

  const thumbnailStageLabel = skipThumbnails
    ? "Thumbnail variants (skipped — count 0)"
    : "Thumbnail variants";

  const stages: GenerationProgressStage[] = [
    { id: "storyboard", label: `${normalizedMode.toUpperCase()} Storyboard structure`, status: "pending" },
    { id: "voice", label: voiceStageLabel, status: skipExternalVoice ? "skipped" : "pending" },
    { id: "keyframes", label: "Scene stills", status: "pending" },
    { id: "sfx", label: sfxStageLabel, status: skipSfx ? "skipped" : "pending" },
    { id: "video", label: videoStageLabel, status: "pending" },
    { id: "captions", label: normalizedMode === "express" ? "Captions" : "Captions (master assemble)", status: "pending" },
    { id: "thumbnails", label: thumbnailStageLabel, status: skipThumbnails ? "skipped" : "pending" },
    { id: "saving", label: "Finalizing media package", status: "pending" },
  ];

  return {
    normalizedMode,
    skipExternalVoice,
    skipSfx,
    skipI2V,
    voiceStageLabel,
    sfxStageLabel,
    videoStageLabel,
    stages,
  };
}
