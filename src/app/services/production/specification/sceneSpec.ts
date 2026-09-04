/**
 * Scene-level canonical specification.
 * Scenes contain shots; shots are the unit of visual generation.
 */

import type { ShotSpec } from "./shotSpec";

export type NarrativeFunction =
  | "hook"
  | "problem"
  | "context"
  | "proof"
  | "example"
  | "myth_bust"
  | "payoff"
  | "cta"
  | "establishing"
  | "confrontation"
  | "resolution"
  | "broll"
  | "interview"
  | "product"
  | "montage"
  | string;

export interface SceneAudioPlan {
  dialogue?: string;
  narration?: string;
  musicCue?: string;
  ambience?: string;
  sfx?: string[];
}

export interface SceneContinuityBridge {
  entranceState: string;
  exitState: string;
  identityLocks: string[];
  wardrobeLocks: string[];
  propLocks: string[];
  lightingLock?: string;
  timeLock?: string;
  spatialNotes?: string;
}

export interface SceneSpec {
  id: string;
  index: number;
  title: string;
  purpose: string;
  narrativeFunction: NarrativeFunction;
  locationId?: string;
  locationName?: string;
  environment: string;
  timeOfDay?: string;
  durationSec: number;
  characterIds: string[];
  wardrobeNotes?: string;
  propIds: string[];
  visualStyleNotes?: string;
  emotionalObjective: string;
  dialogue?: string;
  narration?: string;
  music?: string;
  ambience?: string;
  soundEffects?: string[];
  vfx?: string[];
  continuity: SceneContinuityBridge;
  shots: ShotSpec[];
  transitionIn?: string;
  transitionOut?: string;
  /** Legacy beat/scene compatibility fields mirrored for adapters */
  valueJob?: NarrativeFunction;
  spokenLines?: string;
  onScreenText?: string;
  visualDescription?: string;
  status?: "pending" | "planned" | "generating" | "ready" | "needs_edit" | "approved" | "failed";
}

export type { ShotSpec };
