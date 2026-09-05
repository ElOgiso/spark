/**
 * Character identity anchor — prefer registry canonical/approved refs over URL-only sheets.
 */

import type { Character } from "../../../domain/types";
import { hasValidCharacterSheet } from "../characterSheetValidation";
import type { ProductionAssetRegistry } from "./registry";
import type { ReferenceAuthority, ReferenceRole } from "./types";

const IDENTITY_ROLES: ReferenceRole[] = [
  "canonical_identity",
  "character_sheet",
  "hero_reference",
  "face",
  "full_body",
];

export interface CharacterIdentityAnchorResult {
  valid: boolean;
  reason?: string;
  assetId?: string;
  isWeak?: boolean;
  authority?: ReferenceAuthority;
  sheetUrl?: string;
}

/**
 * Prefer registry canonical/approved character identity/sheet refs when registry provided.
 * Else fall back to hasValidCharacterSheet (URL-based).
 */
export function hasValidCharacterIdentityAnchor(params: {
  character?: Partial<Character> | null;
  registry?: ProductionAssetRegistry;
  productionId?: string;
  entityId?: string;
}): CharacterIdentityAnchorResult {
  const { character, registry, productionId, entityId } = params;

  if (registry && (entityId || character?.id) && productionId) {
    const id = entityId || character!.id!;
    const assets = registry.list({
      productionId,
      entityType: "character",
      entityId: id,
      allowGlobal: true,
    });

    const eligible = assets.filter(
      (a) =>
        a.referenceEligible &&
        a.authority !== "deprecated" &&
        a.authority !== "rejected" &&
        a.lifecycle !== "deprecated" &&
        a.lifecycle !== "rejected" &&
        IDENTITY_ROLES.some((r) => a.roles.includes(r))
    );

    const canonical = eligible.find((a) => a.authority === "canonical");
    if (canonical) {
      return {
        valid: true,
        assetId: canonical.id,
        authority: "canonical",
        isWeak: false,
        sheetUrl: canonical.storage.url,
      };
    }

    const approved = eligible.find(
      (a) => a.authority === "approved" || a.authority === "preferred"
    );
    if (approved) {
      return {
        valid: true,
        assetId: approved.id,
        authority: approved.authority,
        isWeak: false,
        sheetUrl: approved.storage.url,
      };
    }

    const supporting = eligible.find((a) => a.authority === "supporting");
    if (supporting) {
      return {
        valid: true,
        assetId: supporting.id,
        authority: "supporting",
        isWeak: true,
        sheetUrl: supporting.storage.url,
        reason: "Supporting identity reference only — prefer canonical/approved",
      };
    }
  }

  const sheet = hasValidCharacterSheet(character);
  if (sheet.hasSheet) {
    return {
      valid: true,
      isWeak: sheet.isWeak,
      sheetUrl: sheet.sheetUrl,
      reason: sheet.isWeak
        ? "Weak sheet from portrait/avatar URL — prefer registry canonical"
        : "Valid character sheet URL (legacy fallback)",
    };
  }

  return {
    valid: false,
    reason: "No character identity anchor in registry and no valid character sheet URL",
  };
}
