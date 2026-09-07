/**
 * Stage 4 — Asset Director / Spec masters → live pixel reference URLs.
 * Planning owns which refs should lock identity/environment; AssetService still executes.
 */

import type { Brand, Character } from "../../domain/types";
import type { ProductionSpec } from "./specification/productionSpec";
import type { CharacterMaster, LocationMaster, MasterAssetRef } from "./specification/assetSpec";
import { normalizeCanonicalContentFormat } from "./contentFormatDirectives";

function isRefUrl(val?: string | null): val is string {
  if (!val || typeof val !== "string") return false;
  const t = val.trim();
  return (
    t.startsWith("http://") ||
    t.startsWith("https://") ||
    t.startsWith("data:image/") ||
    t.startsWith("data:video/") ||
    t.startsWith("blob:")
  );
}

export interface DirectorPixelRefs {
  /** Character identity sheets from Spec masters (lead or support) */
  identityUrls: string[];
  /** Supporting character sheets when subject is support */
  supportUrls: string[];
  /** Preferred location plate / locked-set URL from Spec (else undefined → brand plate) */
  locationPlateUrl?: string;
  /** Optional single prop/product URL for insert beats */
  propUrl?: string;
  /** Debug / logging notes */
  notes: string[];
  source: {
    usedSpecIdentity: boolean;
    usedSpecLocation: boolean;
    usedSpecProp: boolean;
  };
}

function validUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  for (const u of urls) {
    if (typeof u === "string" && isRefUrl(u) && !out.includes(u)) out.push(u);
  }
  return out;
}

function domainCharacterUrls(character?: Character | null): string[] {
  if (!character) return [];
  const out: string[] = [];
  for (const u of [
    character.characterSheetUrl,
    ...(((character as any).sheet_image_urls as string[]) || []),
    character.imageUrl,
    character.avatarUrl,
  ]) {
    if (typeof u === "string" && isRefUrl(u) && !out.includes(u)) out.push(u);
  }
  return out;
}

function resolveSpec(production?: any): ProductionSpec | undefined {
  const spec =
    production?.reasoning?.productionSpec ||
    production?.productionSpec ||
    production?.spec;
  if (spec && Array.isArray(spec.scenes)) return spec as ProductionSpec;
  return undefined;
}

function characterMasters(spec: ProductionSpec): CharacterMaster[] {
  return (spec.characters || []).filter((c): c is CharacterMaster => c?.kind === "character");
}

function locationMasters(spec: ProductionSpec): LocationMaster[] {
  return (spec.assets || []).filter((a): a is LocationMaster => a?.kind === "location");
}

function propMasters(spec: ProductionSpec): MasterAssetRef[] {
  return (spec.assets || []).filter(
    (a) => a?.kind === "prop" || a?.kind === "product"
  );
}

function pickLeadCharacter(chars: CharacterMaster[]): CharacterMaster | undefined {
  return (
    chars.find((c) => c.role === "host" || c.role === "primary") ||
    chars.find((c) => c.role !== "extra" && c.role !== "support") ||
    chars[0]
  );
}

function pickSupportCharacter(chars: CharacterMaster[]): CharacterMaster | undefined {
  return chars.find((c) => c.role === "support") || chars.find((c) => c.role === "extra");
}

function locationForScene(
  spec: ProductionSpec,
  sceneId?: string | null,
  shotId?: string | null
): LocationMaster | undefined {
  const locations = locationMasters(spec);
  if (!locations.length) return undefined;

  const scene = (spec.scenes || []).find((s) => s.id === sceneId);
  const shot = scene?.shots?.find((sh) => sh.id === shotId);
  const locId =
    (shot as any)?.locationId ||
    (scene as any)?.locationId ||
    undefined;

  if (locId) {
    const byId = locations.find(
      (l) =>
        l.identity?.ref === locId ||
        l.identity?.baseId === locId ||
        l.name === locId
    );
    if (byId) return byId;
  }

  // Prefer location with approved plate URLs
  return (
    locations.find((l) => validUrls(l.approvedReferenceUrls).length > 0) ||
    locations[0]
  );
}

/**
 * Resolve Spec Asset Director / Intelligence masters into live pixel ref URLs.
 * Does not invent faces or plates — only surfaces approvedReferenceUrls already on Spec.
 */
export function resolveDirectorPixelRefs(params: {
  production?: any;
  spec?: ProductionSpec | null;
  subjectType?: "main" | "support" | "insert" | "set" | string;
  contentFormat?: string | null;
  sceneId?: string | null;
  shotId?: string | null;
  brand?: Brand | null;
  character?: Character | null;
  supportCharacter?: Character | null;
  /** Runtime durable plate from brand/snapshot — fallback when Spec has none */
  runtimeLocationPlateUrl?: string | null;
}): DirectorPixelRefs {
  const notes: string[] = [];
  const format = normalizeCanonicalContentFormat(params.contentFormat);
  const subject = String(params.subjectType || "main").toLowerCase();
  const spec = params.spec || resolveSpec(params.production);

  const identityUrls: string[] = [];
  const supportUrls: string[] = [];
  let locationPlateUrl: string | undefined;
  let propUrl: string | undefined;
  let usedSpecIdentity = false;
  let usedSpecLocation = false;
  let usedSpecProp = false;

  if (spec) {
    const chars = characterMasters(spec);
    const lead = pickLeadCharacter(chars);
    const support = pickSupportCharacter(chars);

    if (subject === "support") {
      const fromSpec = validUrls(support?.approvedReferenceUrls);
      if (fromSpec.length) {
        supportUrls.push(...fromSpec);
        usedSpecIdentity = true;
        notes.push(`Spec support identity: ${support?.name || support?.identity?.ref}`);
      }
      const fromDomain = domainCharacterUrls(params.supportCharacter);
      for (const u of fromDomain) {
        if (!supportUrls.includes(u)) supportUrls.push(u);
      }
      // Also keep lead available as soft fallback only when support has no URL
      if (!supportUrls.length) {
        const leadUrls = validUrls(lead?.approvedReferenceUrls);
        if (leadUrls.length) {
          identityUrls.push(...leadUrls);
          usedSpecIdentity = true;
          notes.push("Support sheet missing — using Spec lead identity");
        }
      }
    } else if (subject === "main" || subject === "host" || subject === "lead") {
      const fromSpec = validUrls(lead?.approvedReferenceUrls);
      if (fromSpec.length) {
        identityUrls.push(...fromSpec);
        usedSpecIdentity = true;
        notes.push(`Spec lead identity: ${lead?.name || lead?.identity?.ref}`);
      }
    }

    // Domain host sheets fill gaps (gate still uses domain Character)
    if (subject !== "insert" && subject !== "set" && subject !== "product") {
      for (const u of domainCharacterUrls(params.character)) {
        if (!identityUrls.includes(u) && !supportUrls.includes(u)) identityUrls.push(u);
      }
    }

    const loc = locationForScene(spec, params.sceneId, params.shotId);
    const locUrls = validUrls(loc?.approvedReferenceUrls);
    if (locUrls.length) {
      locationPlateUrl = locUrls[0];
      usedSpecLocation = true;
      notes.push(`Spec location plate: ${loc?.name || loc?.identity?.ref}`);
    }

    if (subject === "insert" || subject === "product") {
      const props = propMasters(spec);
      for (const p of props) {
        const urls = validUrls(p.approvedReferenceUrls);
        if (urls.length) {
          propUrl = urls[0];
          usedSpecProp = true;
          notes.push(`Spec prop ref: ${p.name || p.identity?.ref}`);
          break;
        }
      }
    }
  } else {
    notes.push("No ProductionSpec — domain character + brand plate only");
    if (subject === "support") {
      supportUrls.push(...domainCharacterUrls(params.supportCharacter));
    } else if (subject !== "insert" && subject !== "set") {
      identityUrls.push(...domainCharacterUrls(params.character));
    }
  }

  if (!locationPlateUrl && params.runtimeLocationPlateUrl && isRefUrl(params.runtimeLocationPlateUrl)) {
    locationPlateUrl = params.runtimeLocationPlateUrl;
    notes.push("Runtime brand/snapshot location plate");
  }

  // Faceless + insert: never inject host identity unless subject explicitly main
  if (format === "faceless" && subject !== "main" && subject !== "support") {
    if (identityUrls.length || supportUrls.length) {
      notes.push("Faceless non-main beat — clearing identity refs from stack");
    }
    identityUrls.length = 0;
    supportUrls.length = 0;
  }

  return {
    identityUrls,
    supportUrls,
    locationPlateUrl,
    propUrl,
    notes,
    source: { usedSpecIdentity, usedSpecLocation, usedSpecProp },
  };
}

/**
 * Merge Director pixel refs into buildVisualLockRefs-compatible identity lists.
 * Caps identity sheets to avoid multimodal over-stack (provider budgets).
 */
export function mergeDirectorIdentityForLock(params: {
  director: DirectorPixelRefs;
  maxIdentitySheets?: number;
}): { identityUrls: string[]; supportUrls: string[]; locationPlateUrl?: string; propUrl?: string } {
  const max = Math.max(1, params.maxIdentitySheets ?? 2);
  return {
    identityUrls: params.director.identityUrls.slice(0, max),
    supportUrls: params.director.supportUrls.slice(0, max),
    locationPlateUrl: params.director.locationPlateUrl,
    propUrl: params.director.propUrl,
  };
}
