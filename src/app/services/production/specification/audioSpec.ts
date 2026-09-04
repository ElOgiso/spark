/**
 * Production audio plan (dialogue, narration, ambience, music, SFX).
 */

export interface AudioTrackPlan {
  id: string;
  kind: "dialogue" | "narration" | "ambience" | "music" | "sfx";
  description: string;
  voiceMasterRef?: string;
  musicMasterRef?: string;
  startSec?: number;
  endSec?: number;
  volume?: number;
  mandatory: boolean;
}

export interface AudioSpec {
  hasNarration: boolean;
  hasDialogue: boolean;
  hasMusic: boolean;
  hasAmbience: boolean;
  hasSfx: boolean;
  narratorVoiceRef?: string;
  musicMood?: string;
  tracks: AudioTrackPlan[];
  mixNotes: string;
  lipSyncRequired: boolean;
}

export function buildDefaultAudioSpec(params: {
  requiresNarration: boolean;
  requiresDialogue: boolean;
  requiresMusic: boolean;
  requiresSoundDesign: boolean;
  narratorVoiceRef?: string;
}): AudioSpec {
  const tracks: AudioTrackPlan[] = [];
  if (params.requiresNarration) {
    tracks.push({
      id: "narration_primary",
      kind: "narration",
      description: "Primary voiceover narration",
      voiceMasterRef: params.narratorVoiceRef,
      mandatory: true,
    });
  }
  if (params.requiresDialogue) {
    tracks.push({
      id: "dialogue_primary",
      kind: "dialogue",
      description: "On-camera or character dialogue",
      mandatory: true,
    });
  }
  if (params.requiresMusic) {
    tracks.push({
      id: "music_bed",
      kind: "music",
      description: "Score / bed matching tone and pacing",
      mandatory: false,
    });
  }
  if (params.requiresSoundDesign) {
    tracks.push({
      id: "ambience",
      kind: "ambience",
      description: "Location ambience",
      mandatory: false,
    });
    tracks.push({
      id: "sfx",
      kind: "sfx",
      description: "Scene-appropriate sound effects",
      mandatory: false,
    });
  }

  return {
    hasNarration: params.requiresNarration,
    hasDialogue: params.requiresDialogue,
    hasMusic: params.requiresMusic,
    hasAmbience: params.requiresSoundDesign,
    hasSfx: params.requiresSoundDesign,
    narratorVoiceRef: params.narratorVoiceRef,
    musicMood: undefined,
    tracks,
    mixNotes: "Narration/dialogue clear; music ducked under speech; ambience supportive.",
    lipSyncRequired: params.requiresDialogue,
  };
}
