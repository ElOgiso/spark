/**
 * Reference classification, manifest, conflict detection, and budget optimization.
 * Max multimodal slots come from the provider capability registry — never hard-coded here.
 */

import {
  getMaxMultimodalReferences,
  DEFAULT_MAX_MULTIMODAL_REFERENCES,
} from "../../runtime/providerCapabilities";
import type {
  CharacterVisualContract,
  ClassifiedReference,
  LocationVisualContract,
  ProductVisualContract,
  ReferenceBudgetPlan,
  ReferenceConflict,
  ReferenceManifest,
  ReferencePriority,
  ReferenceRole,
  StoryboardPanelSpec,
  VisualTreatment,
} from "./types";

const PRIORITY_RANK: Record<ReferencePriority, number> = {
  mandatory: 100,
  high_value: 75,
  supporting: 50,
  optional: 25,
};

export function classifyUserReference(params: {
  referenceId: string;
  url?: string;
  hint?: string;
  subjectId?: string;
}): ClassifiedReference {
  const hint = (params.hint || "").toLowerCase();
  let role: ReferenceRole = "appearance";
  if (/face|identity|portrait|headshot/.test(hint)) role = "identity";
  else if (/pose|stance|gesture/.test(hint)) role = "pose";
  else if (/wardrobe|outfit|costume|clothes/.test(hint)) role = "wardrobe";
  else if (/style|look|grade|palette/.test(hint)) role = "style";
  else if (/location|set|environment|room|street/.test(hint)) role = "environment";
  else if (/product|packshot|sku|logo/.test(hint)) role = "product";
  else if (/motion|move|walk|run|dance/.test(hint)) role = "motion";
  else if (/camera|lens|framing/.test(hint)) role = "camera";
  else if (/audio|voice|music|sfx/.test(hint)) role = "audio";
  else if (/board|panel|storyboard|composition/.test(hint)) role = "composition";

  return {
    referenceId: params.referenceId,
    referenceRole: role,
    subjectId: params.subjectId,
    subjectKind: "user_upload",
    scope: "production",
    priority: role === "identity" || role === "product" ? "mandatory" : "high_value",
    version: 1,
    provenance: "user_upload",
    url: params.url,
    description: params.hint,
  };
}

export function buildReferenceManifest(params: {
  productionId: string;
  shotId?: string;
  panelId?: string;
  treatment?: VisualTreatment;
  characters?: CharacterVisualContract[];
  locations?: LocationVisualContract[];
  products?: ProductVisualContract[];
  panel?: StoryboardPanelSpec;
  userReferences?: ClassifiedReference[];
  motionReferences?: ClassifiedReference[];
  audioReferences?: ClassifiedReference[];
  priorityOrder?: string[];
}): ReferenceManifest {
  const refs: ClassifiedReference[] = [];

  if (params.treatment) {
    refs.push({
      referenceId: `ref_treatment_${params.treatment.id}`,
      referenceRole: "style",
      subjectId: params.treatment.id,
      subjectKind: "treatment",
      scope: "production",
      priority: "high_value",
      version: params.treatment.version,
      provenance: params.treatment.provenance,
      description: params.treatment.lookLabel,
      attributes: {
        palette: params.treatment.palette,
        lighting: params.treatment.lightingMood,
        camera: params.treatment.cameraLanguage,
      },
    });
  }

  for (const c of params.characters || []) {
    refs.push({
      referenceId: `ref_char_${c.characterId}`,
      referenceRole: "identity",
      subjectId: c.characterId,
      subjectKind: "character",
      scope: "production",
      priority: "mandatory",
      version: c.version,
      provenance: c.provenance,
      url: c.referenceImageUrls[0],
      description: c.identity,
      attributes: {
        wardrobe: c.wardrobe,
        hair: c.hair,
        face: c.face,
      },
    });
  }

  for (const loc of params.locations || []) {
    refs.push({
      referenceId: `ref_loc_${loc.locationId}`,
      referenceRole: "environment",
      subjectId: loc.locationId,
      subjectKind: "location",
      scope: "scene",
      priority: "mandatory",
      version: loc.version,
      provenance: loc.provenance,
      url: loc.approvedReferenceUrls[0],
      description: loc.environmentIdentity,
      attributes: {
        lighting: loc.lighting,
        timeOfDay: loc.timeOfDay,
      },
    });
  }

  for (const p of params.products || []) {
    refs.push({
      referenceId: `ref_prod_${p.productId}`,
      referenceRole: "product",
      subjectId: p.productId,
      subjectKind: "product",
      scope: "shot",
      priority: "mandatory",
      version: p.version,
      provenance: p.provenance,
      url: p.canonicalReferenceUrl || p.approvedReferenceUrls[0],
      description: p.identity,
      attributes: {
        branding: p.branding,
        shape: p.shape,
      },
    });
  }

  if (params.panel) {
    refs.push({
      referenceId: `ref_panel_${params.panel.panelId}`,
      referenceRole: "composition",
      subjectId: params.panel.panelId,
      subjectKind: "panel",
      scope: "panel",
      priority: "high_value",
      version: 1,
      provenance: "storyboard_panel",
      description: params.panel.composition,
      attributes: {
        framing: params.panel.framing,
        camera: params.panel.camera.shotType,
        wardrobeHint: params.panel.blocking,
      },
    });
  }

  refs.push(...(params.userReferences || []));
  refs.push(...(params.motionReferences || []));
  refs.push(...(params.audioReferences || []));

  const conflicts = detectReferenceConflicts(refs);
  const priorityOrder =
    params.priorityOrder ||
    [...refs]
      .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])
      .map((r) => r.referenceId);

  return {
    id: `manifest_${params.productionId}_${params.shotId || params.panelId || "global"}`,
    productionId: params.productionId,
    shotId: params.shotId,
    panelId: params.panelId,
    references: refs,
    priorityOrder,
    conflicts,
    version: 1,
  };
}

export function detectReferenceConflicts(refs: ClassifiedReference[]): ReferenceConflict[] {
  const conflicts: ReferenceConflict[] = [];
  const bySubject = new Map<string, ClassifiedReference[]>();
  for (const r of refs) {
    if (!r.subjectId || !r.attributes) continue;
    const key = `${r.subjectKind || "unknown"}:${r.subjectId}`;
    const list = bySubject.get(key) || [];
    list.push(r);
    bySubject.set(key, list);
  }

  for (const [, list] of bySubject) {
    if (list.length < 2) continue;
    for (const attr of ["wardrobe", "lighting", "palette", "hair", "branding"] as const) {
      const values = list
        .map((r) => r.attributes?.[attr])
        .filter((v): v is string => Boolean(v && v.trim()));
      const unique = Array.from(new Set(values.map((v) => v.toLowerCase())));
      if (unique.length > 1) {
        conflicts.push({
          code: "REFERENCE_CONFLICT",
          conflictingReferenceIds: list.map((r) => r.referenceId),
          conflictingAttributes: [attr],
          recommendedResolution: `Resolve ${attr} using locked visual contract, then update conflicting references`,
          severity: attr === "wardrobe" || attr === "branding" ? "blocking" : "warning",
        });
      }
    }
  }

  const identity = refs.filter((r) => r.referenceRole === "identity" && r.attributes?.wardrobe);
  const boards = refs.filter((r) => r.referenceRole === "composition" && r.attributes?.wardrobeHint);
  for (const idRef of identity) {
    for (const board of boards) {
      const a = (idRef.attributes?.wardrobe || "").toLowerCase();
      const b = (board.attributes?.wardrobeHint || "").toLowerCase();
      if (!a || !b) continue;
      const colorA = a.match(/\b(black|red|blue|green|white|yellow|brown|gray|grey|pink|purple)\b/);
      const colorB = b.match(/\b(black|red|blue|green|white|yellow|brown|gray|grey|pink|purple)\b/);
      if (
        colorA &&
        colorB &&
        colorA[1] !== colorB[1] &&
        /jacket|coat|shirt|dress|wardrobe|outfit/.test(`${a} ${b}`)
      ) {
        conflicts.push({
          code: "REFERENCE_CONFLICT",
          conflictingReferenceIds: [idRef.referenceId, board.referenceId],
          conflictingAttributes: ["wardrobe_color"],
          recommendedResolution:
            "Prefer locked character wardrobe contract; revise storyboard panel wardrobe to match",
          severity: "blocking",
        });
      }
    }
  }

  return conflicts;
}

/**
 * Pack references into the provider's multimodal budget.
 * When maxSlots is omitted, reads getMaxMultimodalReferences(providerId) from the capability registry.
 */
export function optimizeReferenceBudget(params: {
  manifest: ReferenceManifest;
  providerId: string;
  /** Override; defaults to capability registry maxMultimodalReferences */
  maxSlots?: number;
}): ReferenceBudgetPlan {
  const maxSlots =
    typeof params.maxSlots === "number"
      ? Math.max(0, Math.floor(params.maxSlots))
      : getMaxMultimodalReferences(params.providerId) || DEFAULT_MAX_MULTIMODAL_REFERENCES;

  const ranked = [...params.manifest.references].sort((a, b) => {
    const byPriority = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (byPriority !== 0) return byPriority;
    const ai = params.manifest.priorityOrder.indexOf(a.referenceId);
    const bi = params.manifest.priorityOrder.indexOf(b.referenceId);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  const selected: ClassifiedReference[] = [];
  const omitted: ReferenceBudgetPlan["omitted"] = [];

  for (const ref of ranked) {
    if (selected.length < maxSlots) {
      selected.push(ref);
    } else if (ref.priority === "mandatory") {
      const idx = [...selected]
        .map((r, i) => ({ r, i }))
        .filter((x) => x.r.priority !== "mandatory")
        .sort((a, b) => PRIORITY_RANK[a.r.priority] - PRIORITY_RANK[b.r.priority])[0]?.i;
      if (idx != null) {
        omitted.push({ reference: selected[idx], reason: "evicted_for_mandatory" });
        selected.splice(idx, 1, ref);
      } else {
        omitted.push({ reference: ref, reason: "no_slot_for_mandatory_conflict" });
      }
    } else {
      omitted.push({ reference: ref, reason: "over_budget" });
    }
  }

  const mandatoryIds = new Set(
    params.manifest.references.filter((r) => r.priority === "mandatory").map((r) => r.referenceId)
  );
  const preservedMandatory = [...mandatoryIds].every((id) => selected.some((s) => s.referenceId === id));

  return {
    providerId: params.providerId,
    maxSlots,
    selected,
    omitted,
    preservedMandatory,
  };
}

export function defaultReferencePriorityOrder(): string[] {
  return [
    "narrative",
    "storyboard_composition",
    "character_contract",
    "location_contract",
    "product_contract",
    "visual_treatment",
    "style_reference",
  ];
}
