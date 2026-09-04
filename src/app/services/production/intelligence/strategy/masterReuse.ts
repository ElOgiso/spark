/**
 * Character / world master reuse — do not duplicate existing masters.
 */

import type { MasterReusePlan, DecisionExplanation } from "./types";
import type { MasterAssetRef } from "../../specification/assetSpec";
import type { Character } from "../../../../domain/types";

export function planMasterReuse(params: {
  requiresCharacters: boolean;
  requiresLocations?: boolean;
  requiresVoice?: boolean;
  requiresMusic?: boolean;
  requiresProduct?: boolean;
  existingMasters?: MasterAssetRef[];
  character?: Character;
}): { plan: MasterReusePlan; explanation: DecisionExplanation } {
  const required: MasterReusePlan["requiredKinds"] = [];
  const reuseRefs: string[] = [];
  const createNew: string[] = [];
  const notes: string[] = [];

  const existing = params.existingMasters || [];

  if (params.requiresCharacters) {
    required.push("character");
    const found = existing.find((a) => a.kind === "character");
    if (found) {
      reuseRefs.push(found.identity.ref);
      notes.push(`Reusing ${found.identity.ref}`);
    } else if (params.character?.characterSheetUrl || params.character?.imageUrl) {
      // Will create character_001 from existing sheet — versioned by createCharacterMaster
      createNew.push("character_001");
      notes.push("Create character master from existing sheet assets");
    } else {
      createNew.push("character_001");
      notes.push("Create new character master");
    }
  }

  if (params.requiresLocations !== false) {
    required.push("location");
    const found = existing.find((a) => a.kind === "location");
    if (found) {
      reuseRefs.push(found.identity.ref);
      notes.push(`Reusing location ${found.identity.ref}`);
    } else {
      createNew.push("location_primary");
    }
  }

  if (params.requiresVoice) {
    required.push("voice");
    const found = existing.find((a) => a.kind === "voice");
    if (found) reuseRefs.push(found.identity.ref);
    else createNew.push("voice_primary");
  }

  if (params.requiresMusic) {
    required.push("music");
    createNew.push("music_bed");
  }

  if (params.requiresProduct) {
    required.push("product");
    const found = existing.find((a) => a.kind === "product");
    if (found) reuseRefs.push(found.identity.ref);
    else createNew.push("product_primary");
  }

  required.push("style");

  const plan: MasterReusePlan = {
    requiredKinds: Array.from(new Set(required)),
    reuseRefs,
    createNew: Array.from(new Set(createNew)),
    notes,
  };

  return {
    plan,
    explanation: {
      decision: "master_reuse",
      reasons: notes.length ? notes : ["No reusable masters found"],
      evidence: reuseRefs,
      confidence: reuseRefs.length ? 0.85 : 0.6,
      alternatives: [],
    },
  };
}
