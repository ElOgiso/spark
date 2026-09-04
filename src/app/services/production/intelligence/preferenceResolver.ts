/**
 * Preference hierarchy: PROJECT instructions > Creator defaults > Learned preferences.
 * Memory must never override an explicit project instruction.
 */

import { resolvePreferenceHierarchy } from "../specification/creatorProfile";
import type { CreatorProfile } from "../specification/creatorProfile";
import type { AspectRatioId, CreativeControlMode, PlatformId } from "../specification/productionSpec";

export interface ProjectInstructionOverrides {
  idea?: string;
  targetDurationSec?: number;
  aspectRatio?: AspectRatioId;
  platforms?: PlatformId[];
  creativeControl?: CreativeControlMode;
  productionMode?: string;
  tone?: string;
  visualStyle?: string;
}

export interface LearnedPreferences {
  aspectRatio?: AspectRatioId;
  platforms?: PlatformId[];
  creativeControl?: CreativeControlMode;
  tone?: string;
  visualStyle?: string;
}

export interface ResolvedProductionPreferences {
  targetDurationSec?: number;
  aspectRatio?: AspectRatioId;
  platforms?: PlatformId[];
  creativeControl: CreativeControlMode;
  productionMode?: string;
  tone?: string;
  visualStyle?: string;
  precedenceNotes: string[];
}

export function resolveProductionPreferences(params: {
  project?: ProjectInstructionOverrides;
  creator?: CreatorProfile;
  learned?: LearnedPreferences;
}): ResolvedProductionPreferences {
  const notes: string[] = [];
  const aspect = resolvePreferenceHierarchy({
    projectValue: params.project?.aspectRatio,
    creatorDefault: params.creator?.defaultAspectRatios?.[0],
    learned: params.learned?.aspectRatio,
  });
  if (params.project?.aspectRatio) notes.push("aspectRatio: project instruction wins");
  else if (params.creator?.defaultAspectRatios?.[0]) notes.push("aspectRatio: creator default");
  else if (params.learned?.aspectRatio) notes.push("aspectRatio: learned preference");

  const platforms = resolvePreferenceHierarchy({
    projectValue: params.project?.platforms,
    creatorDefault: params.creator?.defaultPlatforms,
    learned: params.learned?.platforms,
  });
  if (params.project?.platforms?.length) notes.push("platforms: project instruction wins");
  else if (params.creator?.defaultPlatforms?.length) notes.push("platforms: creator default");

  const creativeControl =
    resolvePreferenceHierarchy({
      projectValue: params.project?.creativeControl,
      creatorDefault: params.creator?.creativeControlDefault || params.creator?.preferredWorkflow,
      learned: params.learned?.creativeControl,
    }) || "auto";

  if (params.project?.creativeControl) notes.push("creativeControl: project instruction wins");
  else notes.push(`creativeControl: ${creativeControl}`);

  const tone = resolvePreferenceHierarchy({
    projectValue: params.project?.tone,
    creatorDefault: params.creator?.visualPreferenceNotes,
    learned: params.learned?.tone,
  });

  const visualStyle = resolvePreferenceHierarchy({
    projectValue: params.project?.visualStyle,
    creatorDefault: params.creator?.visualPreferenceNotes,
    learned: params.learned?.visualStyle,
  });

  return {
    targetDurationSec: params.project?.targetDurationSec,
    aspectRatio: aspect,
    platforms,
    creativeControl,
    productionMode: params.project?.productionMode,
    tone,
    visualStyle,
    precedenceNotes: notes,
  };
}
