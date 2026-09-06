import { resolveReviewHeroVideoUrl } from "./canonicalProductionMedia";
/**
 * Review presentation helpers — map canonical production/review state into
 * UI-ready view models. Does NOT introduce a second production system.
 */

import type { PublishGateResult } from "./publishing/publishPolicy";
import { evaluatePublishGate } from "./publishing/publishPolicy";

export type ReviewCheckStatus =
  | "pass"
  | "fail"
  | "warn"
  | "not_evaluated"
  | "not_analyzed";

export interface ReviewSceneView {
  id: string;
  index: number;
  title: string;
  status: string;
  shotIds: string[];
}

export interface ReviewCandidateView {
  id: string;
  label: string;
  mediaUrl: string | null;
  selected: boolean;
  scores: Array<{ dimension: string; value: number | null; label: string }>;
  overall: number | null;
}

export interface ReviewIntendedView {
  purpose: string;
  framing: string;
  cameraIntent: string;
  blocking: string;
  action: string;
  lightingIntent: string;
  continuityRequirements: string;
  durationIntent: string;
  transitionIntent: string;
  references: string[];
}

export interface ReviewActualView {
  duration: string;
  framing: string;
  observedMovement: string;
  observedAction: string;
  continuityResult: string;
  technicalResult: string;
  qcResult: string;
}

export interface ReviewNamedCheck {
  id: string;
  label: string;
  status: ReviewCheckStatus;
  detail?: string;
  expected?: string;
  observed?: string;
  recommendedAction?: string;
}

export interface ReviewReferenceView {
  id: string;
  kind: string;
  label: string;
  role: "required" | "supplied" | "used" | "unavailable" | "conflicting";
  url: string | null;
}

export interface ReviewGenerationView {
  provider: string | null;
  model: string | null;
  strategy: string | null;
  duration: string | null;
  resolution: string | null;
  aspectRatio: string | null;
  attemptNumber: number | null;
  selectedCandidateId: string | null;
  referencesUsed: string[];
}

export interface ReviewShotView {
  id: string;
  sceneId: string;
  index: number;
  title: string;
  purpose: string;
  dramaticBeat: string;
  visualObjective: string;
  status: string;
  durationSec: number | null;
  storyboardFrameUrl: string | null;
  generatedResultUrl: string | null;
  generatedStateFrameUrl: string | null;
  selectedCandidateId: string | null;
  candidates: ReviewCandidateView[];
  intended: ReviewIntendedView;
  actual: ReviewActualView;
  qcChecks: ReviewNamedCheck[];
  continuityChecks: ReviewNamedCheck[];
  references: ReviewReferenceView[];
  generation: ReviewGenerationView;
  frameStrategy: string | null;
}

export interface ReviewReadinessItem {
  id: string;
  label: string;
  status: ReviewCheckStatus;
  detail?: string;
}

export interface ReviewProductionView {
  productionId: string;
  name: string;
  format: string;
  durationLabel: string;
  status: string;
  primaryMediaUrl: string | null;
  primaryMediaType: "video" | "image" | "none";
  scenes: ReviewSceneView[];
  shots: ReviewShotView[];
  storyboardSheetUrl: string | null;
  readiness: ReviewReadinessItem[];
  publishGate: PublishGateResult;
  publishActionLabel: string;
  qcSummary: ReviewNamedCheck[];
  brandFitScore: number | null;
  brandFitUnavailableReason: string | null;
}

export const EDIT_REQUEST_CATEGORIES = [
  "Character",
  "Camera",
  "Motion",
  "Lighting",
  "Environment",
  "Continuity",
  "Timing",
  "Story / Action",
  "Other",
] as const;

export type EditRequestCategory = (typeof EDIT_REQUEST_CATEGORIES)[number];

type AnyProd = Record<string, any>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function notAnalyzed(): string {
  return "Not analyzed";
}

function notEvaluated(): string {
  return "Not evaluated";
}

function displayOr(value: unknown, fallback = notAnalyzed()): string {
  const text = asText(value);
  if (text) return text;
  const num = asNumber(value);
  if (num != null) return String(num);
  return fallback;
}

function normalizeCheckStatus(value: unknown): ReviewCheckStatus {
  const raw = String(value ?? "").toLowerCase();
  if (["pass", "passed", "ok", "success", "approved"].includes(raw)) return "pass";
  if (["fail", "failed", "error", "rejected"].includes(raw)) return "fail";
  if (["warn", "warning", "attention", "needs_edit", "needs edit"].includes(raw)) return "warn";
  if (["not_analyzed", "unavailable", "unknown"].includes(raw)) return "not_analyzed";
  if (typeof value === "boolean") return value ? "pass" : "fail";
  return "not_evaluated";
}

function pickMediaUrl(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const text = asText(candidate);
    if (
      text &&
      (text.startsWith("http") ||
        text.startsWith("data:") ||
        text.startsWith("blob:") ||
        text.startsWith("/") ||
        text.startsWith("asset:"))
    ) {
      return text;
    }
  }
  return null;
}

function listScenes(production: AnyProd): unknown[] {
  const fromProductionScenes = asArray(production.productionScenes);
  if (fromProductionScenes.length) return fromProductionScenes;
  const fromScenes = asArray(production.scenes);
  if (fromScenes.length) return fromScenes;
  const brief = asRecord(production.brief);
  const fromBrief = asArray(brief?.storyboard);
  if (fromBrief.length) return fromBrief;
  return [];
}

function listShotsFromScene(scene: Record<string, unknown>): unknown[] {
  const nested = asArray(scene.shots);
  if (nested.length) return nested;
  const panels = asArray(scene.panels);
  if (panels.length) return panels;
  return [scene];
}

function buildIntended(
  shot: Record<string, unknown>,
  scene: Record<string, unknown>,
): ReviewIntendedView {
  const cinematic = asRecord(shot.cinematic) ?? asRecord(shot.shotPlan) ?? {};
  const camera = asRecord(cinematic.camera) ?? asRecord(shot.camera) ?? {};
  const lighting = asRecord(cinematic.lighting) ?? asRecord(shot.lighting) ?? {};
  const continuity = asRecord(shot.continuity) ?? asRecord(scene.continuity) ?? {};
  const refs = [
    ...asArray(shot.references),
    ...asArray(shot.referenceAssets),
    ...asArray(cinematic.references),
  ]
    .map((item) => {
      const rec = asRecord(item);
      return asText(rec?.label) ?? asText(rec?.name) ?? asText(rec?.id) ?? asText(item);
    })
    .filter((value): value is string => Boolean(value));

  return {
    purpose: displayOr(shot.purpose ?? shot.dramaticPurpose ?? cinematic.purpose, "—"),
    framing: displayOr(camera.framing ?? shot.framing ?? cinematic.framing, "—"),
    cameraIntent: displayOr(
      camera.intent ?? camera.move ?? shot.cameraMove ?? cinematic.cameraMove,
      "—",
    ),
    blocking: displayOr(shot.blocking ?? cinematic.blocking, "—"),
    action: displayOr(shot.action ?? shot.description ?? shot.visualDescription ?? cinematic.action, "—"),
    lightingIntent: displayOr(lighting.intent ?? lighting.mood ?? shot.lighting, "—"),
    continuityRequirements: displayOr(
      continuity.requirements ?? continuity.notes ?? shot.continuityNotes,
      "—",
    ),
    durationIntent: displayOr(shot.durationSec ?? shot.duration ?? cinematic.durationSec, "—"),
    transitionIntent: displayOr(shot.transition ?? cinematic.transition, "—"),
    references: refs,
  };
}

function buildActual(
  shot: Record<string, unknown>,
  analysis: Record<string, unknown> | null,
): ReviewActualView {
  const observed =
    asRecord(analysis?.observed) ?? asRecord(shot.observed) ?? asRecord(shot.actual) ?? null;
  const hasAnalysis = Boolean(observed) || Boolean(analysis);
  return {
    duration: hasAnalysis
      ? displayOr(observed?.durationSec ?? observed?.duration ?? shot.actualDurationSec)
      : notAnalyzed(),
    framing: hasAnalysis ? displayOr(observed?.framing ?? analysis?.framing) : notAnalyzed(),
    observedMovement: hasAnalysis
      ? displayOr(observed?.movement ?? analysis?.movement)
      : notAnalyzed(),
    observedAction: hasAnalysis ? displayOr(observed?.action ?? analysis?.action) : notAnalyzed(),
    continuityResult: hasAnalysis
      ? displayOr(analysis?.continuityResult ?? observed?.continuity)
      : notAnalyzed(),
    technicalResult: hasAnalysis
      ? displayOr(analysis?.technicalResult ?? observed?.technical)
      : notAnalyzed(),
    qcResult: hasAnalysis ? displayOr(analysis?.qcResult ?? observed?.qc) : notAnalyzed(),
  };
}

function buildCandidates(
  shot: Record<string, unknown>,
  selectedCandidateId: string | null,
): ReviewCandidateView[] {
  const raw = asArray(shot.candidates ?? shot.generations ?? shot.outputs);
  return raw.map((item, index) => {
    const rec = asRecord(item) ?? {};
    const id = asText(rec.id) ?? `candidate-${index + 1}`;
    const scoresRaw = asRecord(rec.scores) ?? asRecord(rec.qcScores) ?? {};
    const dimensions = ["identity", "continuity", "cinematography", "motion", "technical", "overall"];
    const scores = dimensions
      .filter((dimension) => dimension in scoresRaw || dimension === "overall")
      .map((dimension) => ({
        dimension,
        label: dimension.charAt(0).toUpperCase() + dimension.slice(1),
        value: asNumber(scoresRaw[dimension]),
      }))
      .filter(
        (score) =>
          score.dimension === "overall" || score.value != null || score.dimension in scoresRaw,
      );
    const overall =
      asNumber(rec.overallScore) ?? asNumber(rec.score) ?? asNumber(scoresRaw.overall) ?? null;
    return {
      id,
      label: asText(rec.label) ?? asText(rec.name) ?? `Candidate ${String.fromCharCode(65 + index)}`,
      mediaUrl: pickMediaUrl(rec.url, rec.mediaUrl, rec.videoUrl, rec.imageUrl, rec.previewUrl),
      selected: selectedCandidateId ? selectedCandidateId === id : Boolean(rec.selected) || index === 0,
      scores: scores.length ? scores : [{ dimension: "overall", label: "Overall", value: overall }],
      overall,
    };
  });
}

function buildQcChecks(
  shot: Record<string, unknown>,
  productionQc: unknown,
  reviewQc: unknown,
): ReviewNamedCheck[] {
  const dimensions = [
    "intent",
    "identity",
    "continuity",
    "cinematography",
    "motion",
    "audio",
    "style",
    "technical",
  ];
  const source =
    asRecord(shot.qc) ??
    asRecord(shot.qcResult) ??
    asRecord(reviewQc) ??
    asRecord(productionQc) ??
    null;

  if (!source) {
    return dimensions.map((dimension) => ({
      id: dimension,
      label: dimension.charAt(0).toUpperCase() + dimension.slice(1),
      status: "not_evaluated" as const,
      detail: notEvaluated(),
    }));
  }

  const checksRaw = asArray(source.checks ?? source.dimensions ?? source.results);
  if (checksRaw.length) {
    return checksRaw.map((item, index) => {
      const rec = asRecord(item) ?? {};
      return {
        id: asText(rec.id) ?? asText(rec.dimension) ?? `qc-${index + 1}`,
        label: asText(rec.label) ?? asText(rec.dimension) ?? `Check ${index + 1}`,
        status: normalizeCheckStatus(rec.status ?? rec.result),
        detail: asText(rec.detail) ?? asText(rec.problem) ?? asText(rec.reason) ?? undefined,
        expected: asText(rec.expected) ?? undefined,
        observed: asText(rec.observed) ?? undefined,
        recommendedAction: asText(rec.recommendedAction) ?? asText(rec.action) ?? undefined,
      };
    });
  }

  return dimensions.map((dimension) => {
    const value = source[dimension];
    if (value == null) {
      return {
        id: dimension,
        label: dimension.charAt(0).toUpperCase() + dimension.slice(1),
        status: "not_evaluated" as const,
        detail: notEvaluated(),
      };
    }
    if (typeof value === "boolean") {
      return {
        id: dimension,
        label: dimension.charAt(0).toUpperCase() + dimension.slice(1),
        status: (value ? "pass" : "fail") as ReviewCheckStatus,
      };
    }
    const rec = asRecord(value);
    if (rec) {
      return {
        id: dimension,
        label: dimension.charAt(0).toUpperCase() + dimension.slice(1),
        status: normalizeCheckStatus(rec.status ?? rec.result ?? rec.passed),
        detail: asText(rec.detail) ?? undefined,
        expected: asText(rec.expected) ?? undefined,
        observed: asText(rec.observed) ?? undefined,
        recommendedAction: asText(rec.recommendedAction) ?? undefined,
      };
    }
    return {
      id: dimension,
      label: dimension.charAt(0).toUpperCase() + dimension.slice(1),
      status: normalizeCheckStatus(value),
      detail: asText(value) ?? undefined,
    };
  });
}

function buildContinuityChecks(
  shot: Record<string, unknown>,
  continuityState: unknown,
): ReviewNamedCheck[] {
  const source =
    asRecord(shot.continuityResult) ?? asRecord(continuityState) ?? asRecord(shot.continuity);
  if (!source) {
    return [
      {
        id: "continuity",
        label: "Continuity",
        status: "not_evaluated",
        detail: notEvaluated(),
      },
    ];
  }

  const failures = asArray(source.failures ?? source.issues ?? source.mismatches);
  if (failures.length) {
    return failures.map((item, index) => {
      const rec = asRecord(item) ?? {};
      return {
        id: asText(rec.id) ?? `continuity-fail-${index + 1}`,
        label:
          asText(rec.label) ??
          asText(rec.dimension) ??
          asText(rec.category) ??
          `Issue ${index + 1}`,
        status: "fail" as const,
        detail: asText(rec.detail) ?? asText(rec.problem) ?? asText(rec.message) ?? undefined,
        expected: asText(rec.expected) ?? undefined,
        observed: asText(rec.observed) ?? undefined,
        recommendedAction: asText(rec.recommendedAction) ?? undefined,
      };
    });
  }

  const groups = [
    { id: "identity", label: "Identity", path: ["character", "identity"] },
    { id: "wardrobe", label: "Wardrobe", path: ["character", "wardrobe"] },
    { id: "hair", label: "Hair", path: ["character", "hair"] },
    { id: "position", label: "Position", path: ["character", "position"] },
    { id: "location", label: "Location", path: ["environment", "location"] },
    { id: "lighting", label: "Lighting", path: ["environment", "lighting"] },
    { id: "weather", label: "Weather", path: ["environment", "weather"] },
    { id: "screen_direction", label: "Screen direction", path: ["spatial", "screenDirection"] },
    { id: "eyeline", label: "Eyeline", path: ["spatial", "eyeline"] },
    { id: "axis", label: "Axis", path: ["spatial", "axis"] },
  ];

  const checks: ReviewNamedCheck[] = [];
  for (const group of groups) {
    let cursor: unknown = source;
    for (const key of group.path) cursor = asRecord(cursor)?.[key];
    if (cursor == null) continue;
    if (typeof cursor === "boolean") {
      checks.push({ id: group.id, label: group.label, status: cursor ? "pass" : "fail" });
      continue;
    }
    const rec = asRecord(cursor);
    if (rec && ("status" in rec || "passed" in rec || "result" in rec)) {
      checks.push({
        id: group.id,
        label: group.label,
        status: normalizeCheckStatus(rec.status ?? rec.result ?? rec.passed),
        detail: asText(rec.detail) ?? undefined,
        expected: asText(rec.expected) ?? undefined,
        observed: asText(rec.observed) ?? undefined,
      });
    }
  }

  if (!checks.length) {
    const status = normalizeCheckStatus(source.status ?? source.result ?? source.passed);
    return [
      {
        id: "continuity",
        label: "Continuity",
        status: status === "not_evaluated" ? "not_evaluated" : status,
        detail: status === "not_evaluated" ? notEvaluated() : asText(source.summary) ?? undefined,
      },
    ];
  }
  return checks;
}

function buildReferences(shot: Record<string, unknown>): ReviewReferenceView[] {
  const raw = [
    ...asArray(shot.usedReferences),
    ...asArray(shot.generationReferences),
    ...asArray(shot.references),
    ...asArray(shot.referenceAssets),
  ];
  const seen = new Set<string>();
  const refs: ReviewReferenceView[] = [];
  raw.forEach((item, index) => {
    const rec = asRecord(item) ?? {};
    const id = asText(rec.id) ?? `ref-${index + 1}`;
    if (seen.has(id)) return;
    seen.add(id);
    let role: ReviewReferenceView["role"] = "supplied";
    if (rec.used === true || rec.actuallyUsed === true || rec.role === "used") role = "used";
    else if (rec.required === true || rec.role === "required") role = "required";
    else if (rec.unavailable === true || rec.role === "unavailable") role = "unavailable";
    else if (rec.conflicting === true || rec.role === "conflicting") role = "conflicting";
    refs.push({
      id,
      kind: asText(rec.kind) ?? asText(rec.type) ?? asText(rec.category) ?? "Reference",
      label: asText(rec.label) ?? asText(rec.name) ?? id,
      role,
      url: pickMediaUrl(rec.url, rec.imageUrl, rec.thumbnailUrl, rec.previewUrl),
    });
  });
  return refs;
}

function buildGeneration(
  shot: Record<string, unknown>,
  selectedCandidateId: string | null,
): ReviewGenerationView {
  const generation =
    asRecord(shot.generation) ?? asRecord(shot.generationMeta) ?? asRecord(shot.providerMeta) ?? {};
  const intent = asRecord(shot.generationIntent) ?? asRecord(shot.intent) ?? {};
  return {
    provider: asText(generation.provider) ?? asText(shot.provider) ?? null,
    model: asText(generation.model) ?? asText(shot.model) ?? null,
    strategy:
      asText(generation.strategy) ?? asText(intent.strategy) ?? asText(shot.frameStrategy) ?? null,
    duration:
      asText(generation.duration) ??
      (asNumber(shot.durationSec) != null ? `${asNumber(shot.durationSec)}s` : null),
    resolution: asText(generation.resolution) ?? asText(shot.resolution) ?? null,
    aspectRatio: asText(generation.aspectRatio) ?? asText(shot.aspectRatio) ?? null,
    attemptNumber: asNumber(generation.attemptNumber) ?? asNumber(shot.attemptNumber),
    selectedCandidateId,
    referencesUsed: buildReferences(shot)
      .filter((ref) => ref.role === "used")
      .map((ref) => ref.label),
  };
}

function buildShotView(
  shotRaw: unknown,
  scene: Record<string, unknown>,
  sceneId: string,
  index: number,
  productionQc: unknown,
  reviewItem: Record<string, unknown> | null,
): ReviewShotView {
  const shot = asRecord(shotRaw) ?? {};
  const id = asText(shot.id) ?? asText(shot.shotId) ?? `${sceneId}-shot-${index + 1}`;
  const analysis = asRecord(shot.analysis) ?? asRecord(shot.actualAnalysis) ?? null;
  const selectedCandidateId =
    asText(shot.selectedCandidateId) ??
    asText(shot.selectedOutputId) ??
    asText(asRecord(asArray(shot.candidates)[0])?.id) ??
    null;
  const candidates = buildCandidates(shot, selectedCandidateId);
  const selected = candidates.find((candidate) => candidate.selected) ?? candidates[0] ?? null;

  return {
    id,
    sceneId,
    index,
    title:
      asText(shot.title) ??
      asText(shot.name) ??
      asText(shot.label) ??
      `Shot ${String(index + 1).padStart(2, "0")}`,
    purpose: asText(shot.purpose) ?? asText(shot.dramaticPurpose) ?? asText(shot.description) ?? "—",
    dramaticBeat: asText(shot.dramaticBeat) ?? asText(shot.beat) ?? "—",
    visualObjective: asText(shot.visualObjective) ?? asText(shot.visualGoal) ?? "—",
    status: asText(shot.status) ?? asText(reviewItem?.status) ?? "draft",
    durationSec: asNumber(shot.durationSec) ?? asNumber(shot.duration),
    storyboardFrameUrl: pickMediaUrl(
      shot.storyboardFrameUrl,
      shot.storyboardUrl,
      shot.panelUrl,
      shot.keyframeImageUrl,
      shot.thumbnailUrl,
      shot.imageUrl,
      shot.image,
    ),
    generatedResultUrl: pickMediaUrl(
      selected?.mediaUrl,
      shot.generatedUrl,
      shot.videoUrl,
      shot.mediaUrl,
      shot.outputUrl,
      shot.url,
    ),
    generatedStateFrameUrl: pickMediaUrl(
      shot.generatedStateFrameUrl,
      shot.stateFrameUrl,
      shot.endFrameUrl,
      shot.lastFrameUrl,
    ),
    selectedCandidateId: selected?.id ?? selectedCandidateId,
    candidates,
    intended: buildIntended(shot, scene),
    actual: buildActual(shot, analysis),
    qcChecks: buildQcChecks(
      shot,
      productionQc,
      reviewItem?.qc ?? reviewItem?.qcResult ?? reviewItem?.qualityCheck,
    ),
    continuityChecks: buildContinuityChecks(shot, shot.continuityState ?? reviewItem?.continuity),
    references: buildReferences(shot),
    generation: buildGeneration(shot, selected?.id ?? selectedCandidateId),
    frameStrategy:
      asText(shot.frameStrategy) ?? asText(asRecord(shot.generationIntent)?.frameStrategy) ?? null,
  };
}

function buildScenesAndShots(
  production: AnyProd,
  reviewItems: unknown[],
): { scenes: ReviewSceneView[]; shots: ReviewShotView[] } {
  const productionQc = production.qc ?? production.qcReport;
  const scenesRaw = listScenes(production);
  const scenes: ReviewSceneView[] = [];
  const shots: ReviewShotView[] = [];

  scenesRaw.forEach((sceneRaw, sceneIndex) => {
    const scene = asRecord(sceneRaw) ?? {};
    const sceneId = asText(scene.id) ?? asText(scene.sceneId) ?? `scene-${sceneIndex + 1}`;
    const sceneShots = listShotsFromScene(scene);
    const shotIds: string[] = [];

    sceneShots.forEach((shotRaw, shotIndex) => {
      const shotRec = asRecord(shotRaw) ?? {};
      const shotId =
        asText(shotRec.id) ?? asText(shotRec.shotId) ?? `${sceneId}-shot-${shotIndex + 1}`;
      const reviewItem =
        asRecord(
          reviewItems.find((item) => {
            const rec = asRecord(item);
            return (
              asText(rec?.shotId) === shotId ||
              asText(rec?.id) === shotId ||
              asText(rec?.sceneId) === sceneId ||
              asText(rec?.productionId) === asText(production.id)
            );
          }),
        ) ?? null;
      const view = buildShotView(shotRaw, scene, sceneId, shotIndex, productionQc, reviewItem);
      shotIds.push(view.id);
      shots.push(view);
    });

    scenes.push({
      id: sceneId,
      index: sceneIndex,
      title:
        asText(scene.title) ??
        asText(scene.name) ??
        asText(scene.description)?.slice(0, 48) ??
        `Scene ${String(sceneIndex + 1).padStart(2, "0")}`,
      status: asText(scene.status) ?? "draft",
      shotIds,
    });
  });

  if (!shots.length) {
    asArray(production.shots).forEach((shotRaw, index) => {
      shots.push(buildShotView(shotRaw, {}, "scene-1", index, productionQc, null));
    });
    if (shots.length) {
      scenes.push({
        id: "scene-1",
        index: 0,
        title: "Scene 01",
        status: "draft",
        shotIds: shots.map((shot) => shot.id),
      });
    }
  }

  return { scenes, shots };
}

function buildReadiness(
  production: AnyProd,
  shots: ReviewShotView[],
  publishGate: PublishGateResult,
): ReviewReadinessItem[] {
  const brief = asRecord(production.brief);
  const hasStory = Boolean(
    asText(brief?.logline) || asText(brief?.concept) || asText(production.title) || asText(brief?.title),
  );
  const hasStoryboard =
    shots.some((shot) => Boolean(shot.storyboardFrameUrl)) ||
    Boolean(asText(production.storyboardUrl) || asText(production.storyboardGridUrl));
  const hasGeneration =
    shots.some((shot) => Boolean(shot.generatedResultUrl)) ||
    Boolean(asText(production.videoUrl) || asText(production.thumbnailUrl));
  const continuityKnown = shots.some((shot) =>
    shot.continuityChecks.some(
      (check) => check.status !== "not_evaluated" && check.status !== "not_analyzed",
    ),
  );
  const continuityFail = shots.some((shot) =>
    shot.continuityChecks.some((check) => check.status === "fail"),
  );
  const qcKnown = shots.some((shot) =>
    shot.qcChecks.some(
      (check) => check.status !== "not_evaluated" && check.status !== "not_analyzed",
    ),
  );
  const qcFail = shots.some((shot) => shot.qcChecks.some((check) => check.status === "fail"));
  const editorialReady = [
    "ready",
    "ready for review",
    "approved",
    "published",
    "scheduled",
    "in_review",
    "pending review",
    "completed",
  ].includes(String(production.status || "").toLowerCase());

  return [
    { id: "story", label: "Story", status: hasStory ? "pass" : "fail", detail: hasStory ? undefined : "Story brief incomplete" },
    { id: "storyboard", label: "Storyboard", status: hasStoryboard ? "pass" : "warn", detail: hasStoryboard ? undefined : "No storyboard frames yet" },
    { id: "generation", label: "Generation", status: hasGeneration ? "pass" : "fail", detail: hasGeneration ? undefined : "No generated media yet" },
    {
      id: "continuity",
      label: "Continuity",
      status: !continuityKnown ? "not_evaluated" : continuityFail ? "fail" : "pass",
      detail: !continuityKnown ? notEvaluated() : continuityFail ? "Continuity issues remain" : undefined,
    },
    {
      id: "qc",
      label: "QC",
      status: !qcKnown ? "not_evaluated" : qcFail ? "fail" : "pass",
      detail: !qcKnown ? notEvaluated() : qcFail ? "QC failures remain" : undefined,
    },
    { id: "editorial", label: "Editorial", status: editorialReady ? "pass" : "warn", detail: editorialReady ? undefined : "Editorial not finalized" },
    {
      id: "technical",
      label: "Technical validation",
      status: publishGate.reasons.some((reason) => /technical/i.test(reason))
        ? "fail"
        : hasGeneration
          ? "pass"
          : "not_evaluated",
    },
    {
      id: "publishing_policy",
      label: "Publishing policy",
      status:
        publishGate.action === "PUBLISH"
          ? "pass"
          : publishGate.action === "AWAITING_APPROVAL"
            ? "warn"
            : "fail",
      detail: publishGate.reasons[0],
    },
  ];
}

function publishActionLabel(decision: PublishGateResult, status: string): string {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "published") return "Published";
  if (normalized === "scheduled") return "Scheduled";
  if (decision.action === "PUBLISH") return "Publish";
  if (decision.action === "AWAITING_APPROVAL") return "Approve for Publishing";
  return "Cannot publish";
}

function resolvePrimaryMedia(
  production: AnyProd,
  shots: ReviewShotView[],
): { url: string | null; type: "video" | "image" | "none" } {
  const productionVideo = resolveReviewHeroVideoUrl({
    production,
    brief: production?.brief,
  }) || pickMediaUrl((production as any).canonicalMasterUrl, (production as any).masterUrl);
  if (productionVideo) return { url: productionVideo, type: "video" };
  const selectedGenerated = shots.find((shot) => shot.generatedResultUrl)?.generatedResultUrl ?? null;
  if (selectedGenerated) {
    const isVideo =
      /\.(mp4|webm|mov)(\?|$)/i.test(selectedGenerated) || selectedGenerated.includes("video");
    return { url: selectedGenerated, type: isVideo ? "video" : "image" };
  }
  const thumb = pickMediaUrl(production.thumbnailUrl);
  if (thumb) return { url: thumb, type: "image" };
  return { url: null, type: "none" };
}

export function buildReviewProductionView(
  production: AnyProd,
  options?: {
    reviewItems?: unknown[];
    userApproved?: boolean;
    approvedBy?: string | null;
    destinationCredentialsValid?: boolean;
    publicationTargetValid?: boolean;
    automationMode?: string;
    publishingPermission?: boolean | "enabled" | "disabled" | "inherit";
    publishRequiresApproval?: boolean;
  },
): ReviewProductionView {
  const reviewItems = options?.reviewItems ?? [];
  const { scenes, shots } = buildScenesAndShots(production, reviewItems);
  const primary = resolvePrimaryMedia(production, shots);
  const format =
    asText(production.format) ?? asText(production.type) ?? asText(production.mode) ?? "Video";
  const durationSec =
    asNumber(production.durationSec) ??
    asNumber(production.targetDurationSec) ??
    asNumber(production.duration) ??
    shots.reduce((sum, shot) => sum + (shot.durationSec ?? 0), 0);

  const finalAssetExists = Boolean(primary.url);
  const publishRequiresApproval = Boolean(
    options?.publishRequiresApproval ??
      production.publishRequiresApproval ??
      asRecord(production.publishingPolicy)?.publishRequiresApproval ??
      true,
  );

  const statusKey = String(production.status || "")
    .toLowerCase()
    .replace(/\s+/g, "_");

  const publishGate = evaluatePublishGate({
    automationMode: String(options?.automationMode ?? production.automationMode ?? "manual").toLowerCase(),
    publishingPermission: options?.publishingPermission ?? production.publishingPermission,
    publishRequiresApproval,
    finalAssetExists,
    finalTechnicalQcPassed: !shots.some((shot) =>
      shot.qcChecks.some((check) => check.status === "fail"),
    ),
    contentPolicyPassed: true,
    destinationCredentialsValid: options?.destinationCredentialsValid ?? false,
    publicationTargetValid:
      options?.publicationTargetValid ??
      Boolean(asText(production.platform) || asArray(production.formats).length > 0),
    userApproved:
      options?.userApproved ??
      (["approved", "ready_to_publish", "published", "scheduled"].includes(statusKey) ||
        String(production.status || "").toLowerCase() === "approved"),
    approvedBy: options?.approvedBy ?? undefined,
  });

  const brandFit =
    asNumber(production.brandFitScore) ??
    asNumber(asRecord(production.analytics)?.brandFitScore) ??
    asNumber(asRecord(production.brief)?.brandFitScore) ??
    null;

  return {
    productionId: String(production.id ?? ""),
    name: asText(production.title) ?? "Untitled production",
    format: String(format),
    durationLabel: durationSec != null && durationSec > 0 ? `${Math.round(durationSec)}s` : "—",
    status: asText(production.status) ?? "draft",
    primaryMediaUrl: primary.url,
    primaryMediaType: primary.type,
    scenes,
    shots,
    storyboardSheetUrl: pickMediaUrl(
      production.storyboardUrl,
      production.storyboardSheetUrl,
      production.storyboardGridUrl,
    ),
    readiness: buildReadiness(production, shots, publishGate),
    publishGate,
    publishActionLabel: publishActionLabel(publishGate, String(production.status || "")),
    qcSummary: shots[0]?.qcChecks ?? [],
    brandFitScore: brandFit,
    brandFitUnavailableReason:
      brandFit == null ? "Brand-fit score unavailable for this production" : null,
  };
}

export function formatEditRequestNote(categories: string[], notes: string): string {
  const selected = categories.map((category) => category.trim()).filter(Boolean);
  const note = notes.trim();
  const categoryLine = selected.length ? `Categories: ${selected.join(", ")}` : "Categories: Other";
  return note ? `${categoryLine}\n\n${note}` : categoryLine;
}

export function statusTone(status: ReviewCheckStatus): string {
  switch (status) {
    case "pass":
      return "text-emerald-400";
    case "fail":
      return "text-red-400";
    case "warn":
      return "text-amber-400";
    default:
      return "text-white/45";
  }
}

export function statusLabel(status: ReviewCheckStatus): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "fail":
      return "Fail";
    case "warn":
      return "Needs attention";
    case "not_analyzed":
      return "Not analyzed";
    default:
      return "Not evaluated";
  }
}
