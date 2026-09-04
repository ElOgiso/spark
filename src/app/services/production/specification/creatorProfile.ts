/**
 * Soft creator defaults — onboarding stores HOW the creator works.
 * Does not lock genre; project instructions always override.
 * Wired later into BrandGenesis without UI redesign.
 */

import type { AspectRatioId, CreativeControlMode, PlatformId } from "./productionSpec";

export type CreatorPriority =
  | "story"
  | "visual_quality"
  | "consistency"
  | "speed"
  | "editing"
  | "performance"
  | "cost";

export type CreatorTypeHint =
  | "youtube"
  | "shorts"
  | "films"
  | "stories"
  | "documentaries"
  | "ads"
  | "education"
  | "music"
  | "brands"
  | "other";

export interface CreatorProfile {
  id: string;
  brandId?: string;
  creatorTypes: CreatorTypeHint[];
  experienceLevel: "beginner" | "intermediate" | "pro";
  preferredWorkflow: CreativeControlMode;
  creativeControlDefault: CreativeControlMode;
  defaultPlatforms: PlatformId[];
  defaultAspectRatios: AspectRatioId[];
  priorities: CreatorPriority[];
  brandProfileNotes?: string;
  voiceProfileNotes?: string;
  visualPreferenceNotes?: string;
  updatedAt: string;
}

export function createDefaultCreatorProfile(partial?: Partial<CreatorProfile>): CreatorProfile {
  return {
    id: partial?.id || "creator_default",
    brandId: partial?.brandId,
    creatorTypes: partial?.creatorTypes || ["shorts"],
    experienceLevel: partial?.experienceLevel || "beginner",
    preferredWorkflow: partial?.preferredWorkflow || "auto",
    creativeControlDefault: partial?.creativeControlDefault || "auto",
    defaultPlatforms: partial?.defaultPlatforms || ["youtube_shorts"],
    defaultAspectRatios: partial?.defaultAspectRatios || ["9:16"],
    priorities: partial?.priorities || ["consistency", "visual_quality", "story"],
    brandProfileNotes: partial?.brandProfileNotes,
    voiceProfileNotes: partial?.voiceProfileNotes,
    visualPreferenceNotes: partial?.visualPreferenceNotes,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Resolve effective project defaults: PROJECT > CREATOR > LEARNED
 */
export function resolvePreferenceHierarchy<T>(params: {
  projectValue?: T;
  creatorDefault?: T;
  learned?: T;
}): T | undefined {
  if (params.projectValue !== undefined && params.projectValue !== null) return params.projectValue;
  if (params.creatorDefault !== undefined && params.creatorDefault !== null) return params.creatorDefault;
  return params.learned;
}
