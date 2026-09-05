/**
 * StoryboardBlueprint — visualization + execution-prep around canonical ShotSpecs.
 *
 * Architecture (mandatory):
 *   ShotSpec → StoryboardPanelSpec → Storyboard Visualization
 *
 * Storyboard images are NEVER the canonical source of truth.
 */

import type { ShotSpec } from "../specification/shotSpec";
import type { SceneSpec } from "../specification/sceneSpec";
import type { VisualStyleSpec } from "../specification/productionSpec";
import type {
  CharacterVisualContract,
  ClassifiedReference,
  ContinuityHandoff,
  LocationVisualContract,
  PanelRepairRequest,
  ProductVisualContract,
  StoryboardBlueprint,
  StoryboardLayout,
  StoryboardPanelSpec,
  StoryboardValidationResult,
  StoryboardVersionRecord,
  VisualTreatment,
} from "./types";
import { buildReferenceManifest } from "./referenceManifest";

function hashId(prefix: string, seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}_${(h >>> 0).toString(16)}`;
}

function lightingSummary(shot: ShotSpec): string {
  const parts = [
    shot.lighting.atmosphere,
    shot.lighting.direction,
    shot.lighting.intensity,
    shot.lighting.color,
    shot.lighting.timeOfDay,
  ].filter(Boolean);
  return parts.join("; ") || "motivated lighting";
}

function paceFromDuration(durationSec: number): string {
  if (durationSec <= 2) return "staccato";
  if (durationSec <= 4) return "brisk";
  if (durationSec <= 8) return "measured";
  return "held";
}

export function chooseStoryboardLayout(panelCount: number, aspectRatio: string): StoryboardLayout {
  if (panelCount <= 1) return "single-panel";
  if (panelCount <= 4) return "2x2";
  if (panelCount <= 9) return "3x3";
  if (panelCount <= 12) return "3x4";
  if (panelCount <= 16) return "4x4";
  return aspectRatio.includes("9:16") || aspectRatio === "9:16"
    ? "vertical-sequence"
    : "horizontal-sequence";
}

export function buildStoryboardPanelFromShot(params: {
  shot: ShotSpec;
  sequenceIndex: number;
  visualTreatmentId?: string;
  characterContracts?: CharacterVisualContract[];
  locationContract?: LocationVisualContract | null;
  productContracts?: ProductVisualContract[];
}): StoryboardPanelSpec {
  const { shot, sequenceIndex } = params;
  const panelId = `panel_${String(sequenceIndex + 1).padStart(2, "0")}`;
  const characterIds = shot.characterIds ?? [];
  const productIds = (params.productContracts ?? [])
    .filter(
      (p) =>
        (shot.propIds ?? []).includes(p.productId) || (shot.assetIds ?? []).includes(p.productId)
    )
    .map((p) => p.productId);

  const refs: ClassifiedReference[] = [];
  for (const c of params.characterContracts ?? []) {
    if (!characterIds.includes(c.characterId) && !characterIds.includes(c.assetRef)) continue;
    for (const url of c.referenceImageUrls.slice(0, 2)) {
      refs.push({
        referenceId: hashId("ref", `${c.characterId}:${url}`),
        referenceRole: "identity",
        subjectId: c.characterId,
        subjectKind: "character",
        scope: "shot",
        priority: "mandatory",
        version: c.version,
        provenance: "contract",
        url,
        attributes: { wardrobe: c.wardrobe, hair: c.hair, face: c.face },
      });
    }
  }

  if (params.locationContract?.approvedReferenceUrls[0]) {
    refs.push({
      referenceId: hashId("ref", `loc:${params.locationContract.locationId}`),
      referenceRole: "environment",
      subjectId: params.locationContract.locationId,
      subjectKind: "location",
      scope: "scene",
      priority: "mandatory",
      version: params.locationContract.version,
      provenance: "contract",
      url: params.locationContract.approvedReferenceUrls[0],
      attributes: {
        lighting: params.locationContract.lighting,
        timeOfDay: params.locationContract.timeOfDay,
      },
    });
  }

  const light = lightingSummary(shot);
  const incoming: ContinuityHandoff = {
    wardrobe: characterIds.map((id) => {
      const c = (params.characterContracts ?? []).find(
        (x) => x.characterId === id || x.assetRef === id
      );
      return `${id}:${c?.wardrobe ?? "unknown"}`;
    }),
    propsHeld: shot.propIds ?? [],
    lighting: light,
    locationId: params.locationContract?.locationId,
    subjectPosition: shot.motion.beginState,
    notes: [shot.motion.beginState],
  };
  const outgoing: ContinuityHandoff = {
    ...incoming,
    subjectPosition: shot.motion.endState,
    notes: [shot.motion.endState],
  };

  return {
    panelId,
    shotId: shot.id,
    sequenceIndex,
    purpose: shot.purpose,
    dramaticBeat: shot.purpose,
    visualObjective: shot.subject || shot.productionReason,
    editorialRole: shot.purpose,
    composition: shot.camera.composition,
    framing: shot.camera.framing,
    camera: {
      shotType: shot.camera.shotType,
      position: shot.camera.cameraPosition,
      movement: String(shot.camera.cameraMovement),
      lensIntent: shot.camera.lens || "unspecified",
      depthOfField: shot.camera.depthOfField || "unspecified",
    },
    characters: characterIds,
    locations: params.locationContract ? [params.locationContract.locationId] : [],
    props: shot.propIds ?? [],
    products: productIds,
    blocking: shot.blocking || shot.subjectAction,
    subjectAction: shot.motion.subjectMovement || shot.subjectAction,
    environmentAction: shot.motion.environmentalMovement || shot.environment,
    lightingIntent: light,
    visualTreatmentId: params.visualTreatmentId,
    temporalBeat: {
      startSec: shot.timingStartSec ?? 0,
      endSec: (shot.timingStartSec ?? 0) + shot.durationSec,
      pace: paceFromDuration(shot.durationSec),
    },
    startState: shot.motion.beginState,
    endState: shot.motion.endState,
    incomingState: incoming,
    outgoingState: outgoing,
    referenceRequirements: characterIds.map((id) => `character:${id}:identity`),
    referenceAssignments: refs,
    transitionToNext: shot.transitionOut,
    continuityRequirements: shot.continuityRequirements ?? [],
    generationIntent: {
      appearanceLocked: true,
      compositionFromPanel: true,
      motionFromShotSpec: true,
      mode: "previs",
    },
    rationale: [
      shot.productionReason,
      `Panel ${panelId} maps 1:1 to ShotSpec ${shot.id}.`,
      "Storyboard visualization is non-canonical; ShotSpec remains truth.",
    ],
    confidence: 0.9,
    validationIssues: [],
  };
}

export function buildStoryboardBlueprint(params: {
  productionId: string;
  scene: SceneSpec;
  sequenceId?: string;
  aspectRatio: string;
  visualTreatment?: VisualTreatment | null;
  characterContracts?: CharacterVisualContract[];
  locationContract?: LocationVisualContract | null;
  productContracts?: ProductVisualContract[];
  coveragePlanSummary?: string;
  version?: number;
}): StoryboardBlueprint {
  const panels = params.scene.shots.map((shot, i) =>
    buildStoryboardPanelFromShot({
      shot,
      sequenceIndex: i,
      visualTreatmentId: params.visualTreatment?.id,
      characterContracts: params.characterContracts,
      locationContract: params.locationContract,
      productContracts: params.productContracts,
    })
  );

  const panelToShotMap: Record<string, string> = {};
  for (const p of panels) panelToShotMap[p.panelId] = p.shotId;

  const referenceManifest = buildReferenceManifest({
    productionId: params.productionId,
    shotId: params.scene.shots[0]?.id,
    treatment: params.visualTreatment ?? undefined,
    characters: params.characterContracts,
    locations: params.locationContract ? [params.locationContract] : undefined,
    products: params.productContracts,
    panel: panels[0],
    priorityOrder: [
      "narrative",
      "storyboard_composition",
      "character_contract",
      "location_contract",
      "product_contract",
      "visual_treatment",
      "style_reference",
    ],
  });

  return {
    id: hashId("sb", `${params.productionId}:${params.scene.id}:v${params.version ?? 1}`),
    productionId: params.productionId,
    sceneId: params.scene.id,
    sequenceId: params.sequenceId ?? params.scene.id,
    aspectRatio: params.aspectRatio,
    layout: chooseStoryboardLayout(panels.length, params.aspectRatio),
    visualTreatmentId: params.visualTreatment?.id,
    panels,
    panelToShotMap,
    coveragePlan:
      params.coveragePlanSummary ??
      `Coverage for ${params.scene.shots.length} shots in ${params.scene.id}`,
    continuityState: {
      handoffs: panels.map((p) => ({
        panelId: p.panelId,
        incoming: p.incomingState,
        outgoing: p.outgoingState,
      })),
    },
    referenceManifest,
    validation: { ok: true, issues: [] },
    version: params.version ?? 1,
    status: "draft",
    visualLock: false,
    mode: "previs",
  };
}

/** Compile panel specs into image-model instructions — does NOT replace the blueprint. */
export function compileStoryboardImagePrompt(
  blueprint: StoryboardBlueprint,
  style?: VisualStyleSpec
): string {
  const lines: string[] = [
    `Storyboard layout: ${blueprint.layout} (${blueprint.panels.length} panels).`,
    `Aspect ratio: ${blueprint.aspectRatio}.`,
    "Render panels in reading order. Label each panel as Panel 01, Panel 02, … when possible.",
    "Do not invent shots not listed. Follow composition and action per panel.",
  ];
  if (style?.look) lines.push(`Global look: ${style.look}.`);
  if (style?.colorLanguage) lines.push(`Color language: ${style.colorLanguage}.`);

  for (const p of blueprint.panels) {
    const n = String(p.sequenceIndex + 1).padStart(2, "0");
    lines.push(
      [
        `Panel ${n} (shot ${p.shotId}):`,
        `${p.camera.shotType} / ${p.framing} / ${p.composition}.`,
        `Camera: ${p.camera.position}, ${p.camera.movement}, lens ${p.camera.lensIntent}, DoF ${p.camera.depthOfField}.`,
        `Action: ${p.subjectAction}. Environment: ${p.environmentAction}.`,
        `Lighting: ${p.lightingIntent}. Blocking: ${p.blocking}.`,
        `Characters: ${p.characters.join(", ") || "none"}. Locations: ${p.locations.join(", ") || "none"}.`,
        `Start: ${p.startState}. End: ${p.endState}.`,
      ].join(" ")
    );
  }
  lines.push("Digital mapping is authoritative; do not rely on rendered labels alone.");
  return lines.join("\n");
}

export function validateStoryboardBlueprint(params: {
  blueprint: StoryboardBlueprint;
  shots: ShotSpec[];
}): StoryboardValidationResult {
  const issues: StoryboardValidationResult["issues"] = [];
  const shotIds = new Set(params.shots.map((s) => s.id));
  const panelShotIds = new Set(params.blueprint.panels.map((p) => p.shotId));

  for (const s of params.shots) {
    if (!panelShotIds.has(s.id)) {
      issues.push({
        code: "MISSING_SHOT",
        severity: "error",
        message: `Shot ${s.id} has no storyboard panel.`,
        shotId: s.id,
      });
    }
  }
  for (const p of params.blueprint.panels) {
    if (!shotIds.has(p.shotId)) {
      issues.push({
        code: "ORPHAN_PANEL",
        severity: "error",
        message: `Panel ${p.panelId} references unknown shot ${p.shotId}.`,
        panelId: p.panelId,
        shotId: p.shotId,
      });
    }
  }

  const ordered = [...params.blueprint.panels].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].sequenceIndex !== i) {
      issues.push({
        code: "PANEL_ORDER",
        severity: "error",
        message: `Panel order broken at index ${i}.`,
        panelId: ordered[i].panelId,
      });
      break;
    }
  }

  for (const p of params.blueprint.panels) {
    const shot = params.shots.find((s) => s.id === p.shotId);
    if (!shot) continue;
    if (p.composition !== shot.camera.composition || p.framing !== shot.camera.framing) {
      issues.push({
        code: "COMPOSITION_DRIFT",
        severity: "warning",
        message: `Panel ${p.panelId} composition/framing diverges from ShotSpec.`,
        panelId: p.panelId,
        shotId: p.shotId,
      });
    }
    if (
      p.camera.shotType !== shot.camera.shotType ||
      p.camera.movement !== String(shot.camera.cameraMovement)
    ) {
      issues.push({
        code: "CAMERA_INTENT_LOSS",
        severity: "error",
        message: `Panel ${p.panelId} lost camera intent from ShotSpec.`,
        panelId: p.panelId,
        shotId: p.shotId,
      });
    }
    const expectedAction = shot.motion.subjectMovement || shot.subjectAction;
    if (p.subjectAction !== expectedAction) {
      issues.push({
        code: "ACTION_UNREADABLE",
        severity: "warning",
        message: `Panel ${p.panelId} subject action diverges from ShotSpec motion.`,
        panelId: p.panelId,
        shotId: p.shotId,
      });
    }
  }

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const sameChars = prev.characters.filter((c) => cur.characters.includes(c));
    if (
      sameChars.length > 0 &&
      prev.outgoingState.wardrobe.join("|") !== cur.incomingState.wardrobe.join("|")
    ) {
      issues.push({
        code: "CONTINUITY_BREAK",
        severity: "warning",
        message: `Wardrobe continuity handoff mismatch between ${prev.panelId} and ${cur.panelId}.`,
        panelId: cur.panelId,
      });
    }
  }

  if (params.blueprint.visualTreatmentId) {
    for (const p of params.blueprint.panels) {
      if (p.visualTreatmentId && p.visualTreatmentId !== params.blueprint.visualTreatmentId) {
        issues.push({
          code: "TREATMENT_INCONSISTENT",
          severity: "warning",
          message: `Panel ${p.panelId} visual treatment diverges from blueprint.`,
          panelId: p.panelId,
        });
      }
    }
  }

  if (!params.shots.every((s) => panelShotIds.has(s.id))) {
    issues.push({
      code: "COVERAGE_INCOMPLETE",
      severity: "error",
      message: "Coverage incomplete: not all shots represented in storyboard.",
    });
  }

  return {
    ok: issues.filter((i) => i.severity === "error").length === 0,
    issues,
  };
}

/** Localized repair — regenerate one panel; do not rebuild the whole board. */
export function repairStoryboardPanel(
  blueprint: StoryboardBlueprint,
  request: PanelRepairRequest,
  shot: ShotSpec,
  opts?: {
    characterContracts?: CharacterVisualContract[];
    locationContract?: LocationVisualContract | null;
    productContracts?: ProductVisualContract[];
  }
): StoryboardBlueprint {
  const idx = blueprint.panels.findIndex((p) => p.panelId === request.panelId);
  if (idx < 0) return blueprint;

  const repaired = buildStoryboardPanelFromShot({
    shot,
    sequenceIndex: blueprint.panels[idx].sequenceIndex,
    visualTreatmentId: blueprint.visualTreatmentId,
    characterContracts: opts?.characterContracts,
    locationContract: opts?.locationContract,
    productContracts: opts?.productContracts,
  });
  repaired.rationale = [
    ...repaired.rationale,
    `Localized repair: ${request.repairReason}`,
    ...(request.notes ? [request.notes] : []),
  ];
  repaired.generationIntent = {
    ...repaired.generationIntent,
    mode: blueprint.mode === "final" ? "final" : "previs",
  };

  const panels = [...blueprint.panels];
  panels[idx] = repaired;
  const next: StoryboardBlueprint = {
    ...blueprint,
    panels,
    panelToShotMap: { ...blueprint.panelToShotMap, [repaired.panelId]: repaired.shotId },
    version: blueprint.version + 1,
    status: "revised",
  };
  next.validation = validateStoryboardBlueprint({ blueprint: next, shots: [shot] });
  return next;
}

export function recordStoryboardVersion(
  previous: StoryboardBlueprint,
  next: StoryboardBlueprint,
  reason: string
): StoryboardVersionRecord {
  const prevIds = new Set(previous.panels.map((p) => p.panelId));
  const nextIds = new Set(next.panels.map((p) => p.panelId));
  const changedPanels = [
    ...[...nextIds].filter((id) => !prevIds.has(id)),
    ...next.panels
      .filter((p) => {
        const old = previous.panels.find((x) => x.panelId === p.panelId);
        return old && JSON.stringify(old) !== JSON.stringify(p);
      })
      .map((p) => p.panelId),
  ];
  return {
    version: next.version,
    previousVersion: previous.version,
    changedPanels: [...new Set(changedPanels)],
    changedShotIds: [
      ...new Set(changedPanels.map((id) => next.panelToShotMap[id]).filter(Boolean) as string[]),
    ],
    changedReferences: next.referenceManifest.references
      .map((e) => e.referenceId)
      .filter((id) => !previous.referenceManifest.references.some((e) => e.referenceId === id)),
    reason,
    approved: next.status === "approved" || next.status === "locked",
    createdAt: new Date(0).toISOString(),
  };
}

export function promoteStoryboardToFinal(blueprint: StoryboardBlueprint): StoryboardBlueprint {
  return {
    ...blueprint,
    mode: "final",
    status: blueprint.status === "draft" ? "revised" : blueprint.status,
    panels: blueprint.panels.map((p) => ({
      ...p,
      generationIntent: { ...p.generationIntent, mode: "final" as const },
    })),
  };
}
