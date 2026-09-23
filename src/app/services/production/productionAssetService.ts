import { isEphemeralMediaUrl, isSparkStorageUrl, isPersistableSparkMediaUrl, extractSparkStoragePath } from "./mediaUrlUtils";
import { buildProductionLookLaw, ProductionLookLaw } from "./productionLookLaw";
// LOOKLAW_IMPORT_MARKER
export { isEphemeralMediaUrl, isSparkStorageUrl, isPersistableSparkMediaUrl, extractSparkStoragePath };
import type { Production, ProductionBrief, ProductionScene, Brand, Character, ProductionAsset, ProductionFormatSettings, GenerationCreditSettings } from "../../domain/types";
import { getEffectiveFormatSettings, getEffectiveCreditSettings } from "../../domain/types";
import { ModelRouter } from "../runtime/modelRouter";
import { resolveGeneratePlan, resolveSceneGeneratePlan } from "./resolveGeneratePlan";
import { applyLongFormVisualPlanning, assertVisualPlanExecutable } from "./generation/strategyResolver";
import { normalizeModeString } from "./resolveProductionMode";
import { CapabilityRegistry } from "../capabilityRegistry";
import { ProductionGenerationGuard } from "./ProductionGenerationGuard";
import { isProductionTombstoned } from "./productionTombstone";
import { productionWriteHalted } from "./productionPersistGuard";
import { brandProductionStoragePath } from "./brandProductionStoragePath";
import { getProductionPromptPack } from "./productionPromptPacks";
import { resolveActiveVideoProvider, PROVIDER_CAPABILITY_MAP, snapToAllowedDuration, isServerProviderAvailable } from "../runtime/providerCapabilities";
import { resolveProviderKey } from "../runtime/AIProviderOrchestrator";
import { resolveDurationPolicy } from "./durationPolicy";
import { extractVideoLastFrame } from "./videoFrameExtractor";
import { canStartAssetGeneration, getEffectiveContentFormat } from "./characterSheetGate";
import { evaluateScriptForProduction } from "./os/scriptQualityGates";
import {
  buildScenesFromNarrativeChapters,
  calculateSubclipDurations,
  formatChapterClipLog,
} from "./os/chapterToClip";
import { collectMustNotCopyTitles } from "./os/topicIntelligence";
import { resolveLiveBeatSubject } from "./contentFormatDirectives";
import { resolveLiveVisualGenre, visualGenreDirective } from "./visualGenreDirectives";
import { isPhotorealVisualGenre } from "../../domain/visualGenre";
import {
  mergeDirectorIdentityForLock,
  resolveDirectorPixelRefs,
} from "./resolveLiveDirectorRefs";
import { evaluateVisualContinuity } from "./visualContinuityGate";
import { isI2vApiProvider, requestProductionVideoClip } from "./productionVideoRequest";
import { routeMediaCapability } from "./capability";
import { resolveOfficialI2vClipFrames } from "./officialI2vFrames";
import {
  buildProductionElementPack,
  resolveElementsForShot,
  type ProductionElement,
} from "./elements/productionElements";
import {
  planAssetBibleFromBrief,
  inferNeededTagsFromScene,
  listMissingAssetBibleEntries,
  type AssetBibleEntry,
} from "./preproduction/assetBibleFromBrief";
import { ensureAssetBibleAssets } from "./preproduction/ensureAssetBibleAssets";
import { resolveDirectorSceneScript } from "./directorScriptAuthority";
import { collectSparkShotClipUrls, isSparkShotClipUrl } from "./sparkShotClips";
import { resolveProductionMode } from "./resolveProductionMode";
import {
  resolveGenerationSettings,
  isCinematicMode,
  readProductionSettingsSnapshot,
} from "./productionSettingsSnapshot";
import { compileLiveStillPrompt, buildStillSubjectLine } from "./compileLiveStillPrompt";
import { compileLiveMotionPrompt } from "./compileLiveMotionPrompt";
import { compileThumbnailPrompt } from "./compileThumbnailPrompt";
import { compileStoryboardPlanPrompt, shouldReuseExistingStoryboard } from "./compileStoryboardPlanPrompt";
import {
  compileLiveStoryboardSheetPrompt,
  isRealStoryboardSheetUrl,
} from "./compileLiveStoryboardSheetPrompt";
import {
  extractStoryboardSheetPanelsDetailed,
  storyboardLayoutToGrid,
} from "./extractStoryboardSheetPanels";
import {
  createProductionFrameLock,
  chooseNativePanelStoryboardLayout,
  type ProductionFrameLock,
} from "./frameLock";
import {
  resolveLiveSceneContinuity,
  stampSceneGeneratedStateFrame,
  collectSceneCaptionLines,
  assembleMasterFromClips,
} from "./liveContinuityBridge";
import { attachSceneMotionLock, bindMotionLockStillUrl } from "./sceneMotionLock";
import { findReusableStill, syncProductionMediaStores } from "./productionMediaLineage";
import {
  needsLocationPlateStorageUpload,
  resolveLocationPlateUrl,
  shouldReuseLocationPlateAsStill,
} from "./locationPlatePersistence";
import { GenerationExecutionEngine, executeGenerationTask } from "./execution/executionEngine";
import { createRuntimeAdapterPorts } from "./execution/runtimePorts";
import { resolveGenerationTasks, attachGenerationTasksToSpec } from "./generation/generationPlanner";
import { resolveProductionSpec } from "./execution/productionExecutionBridge";
import type { GenerationTask } from "./specification/generationTask";
import type { ProductionSpec } from "./specification/productionSpec";
import type { AdapterPorts } from "./execution/adapters/types";

/**
 * ProductionAssetService — EXECUTOR only.
 * Creative text comes from OS compilers (compileLiveStill/Motion/Thumbnail/StoryboardPlan).
 * This class: provider calls, Storage upload, credits, abort, media sync.
 */

export const SPARK_STORAGE_BUCKET = "Spark";

export interface ProductionAssetGenerationResult {
  brief: ProductionBrief;
  scenes: { scene: number; description: string; duration: string; image?: string; videoUrl?: string }[];
  productionScenes?: ProductionScene[];
  audioUrl?: string;
  videoUrl?: string;
  audioAssetId?: string;
  videoAssetId?: string;
  playablePreviewUrl?: string;
  canonicalMasterUrl?: string;
  assemblyStatus?: "assembly_pending" | "assembly_complete" | "assembly_failed";
  assemblyError?: string;
  /** Spec + reasoning after syncProductionMediaStores projection */
  reasoning?: any;
}

export interface LockedIdentityPack {
  characterReferenceImageUrl?: string;
  identityBlock: string;
  setBlock: string;
  styleBlock: string;
  aspectRatio: string;
  mode: "express" | "standard" | "deep";
  combinedPromptPrefix: string;
  environmentString: string;
}

export function buildCompleteVoiceScript(brief: ProductionBrief, targetDurationSec: number = 60): string {
  const clean = (str: string) =>
    str
      .replace(/[*_#`~\[\]()]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const hook = typeof brief.hook === "string" ? clean(brief.hook) : "";
  const beats = brief.beats || [];
  let cta = typeof brief.spokenCta === "string" ? clean(brief.spokenCta) : "";
  if (!cta && typeof brief.caption === "string" && brief.caption.trim()) {
    const firstSentence = clean(brief.caption.split(/[.!?\n]/)[0] || "");
    if (firstSentence && firstSentence.length > 5 && firstSentence.length < 120) {
      cta = firstSentence;
    }
  }
  if (!cta && brief.storyboard && brief.storyboard.length > 0) {
    const lastScene = brief.storyboard[brief.storyboard.length - 1];
    cta = clean(lastScene?.spokenLines || lastScene?.scriptSnippet || lastScene?.onScreenText || "");
  }
  if (!cta) {
    cta = "Follow for more strategies.";
  }

  const lines: string[] = [];
  if (beats.length > 0) {
    const firstBeatSpoken = clean(beats[0].spokenLines || "");
    const hookAlreadyInFirstBeat = hook && firstBeatSpoken.toLowerCase().includes(hook.toLowerCase().slice(0, 20));

    if (hook && !hookAlreadyInFirstBeat && beats[0].valueJob !== "hook") {
      lines.push(hook);
    }

    for (let i = 0; i < beats.length; i++) {
      const beatSpoken = clean(beats[i].spokenLines || "");
      if (beatSpoken) {
        lines.push(beatSpoken);
      }
    }

    const lastBeatSpoken = clean(beats[beats.length - 1].spokenLines || "");
    const ctaAlreadyInLastBeat = cta && lastBeatSpoken.toLowerCase().includes(cta.toLowerCase().slice(0, 20));

    if (cta && !ctaAlreadyInLastBeat && beats[beats.length - 1].valueJob !== "cta") {
      lines.push(cta);
    }
  } else {
    if (hook) lines.push(hook);
    if (brief.scriptOutline) lines.push(clean(brief.scriptOutline));
    if (cta) lines.push(cta);
  }

  const fullScript = lines.join(" ").replace(/\.\s*\./g, ".").replace(/\s+/g, " ").trim();
  const maxCharBudget = Math.max(1000, targetDurationSec * 25);
  return fullScript.slice(0, maxCharBudget);
}

/**
 * PART 1 & 4 — Locked Identity Pack Helper
 * Enforces reference-led identity consistency, locked wardrobe, set continuity,
 * and format discipline by Production Mode across every visual call.
 */
export function buildLockedIdentityPack(params: {
  brand: Brand;
  character?: Character;
  brief: ProductionBrief;
  production: Production;
}): LockedIdentityPack {
  const { brand, character, brief, production } = params;
  const characterReferenceImageUrl =
    character?.characterSheetUrl || character?.imageUrl || character?.avatarUrl || undefined;

  // Snapshot wins when present — live brand/brief must not silently rebind cinematic→narrator.
  const generationSettings = resolveGenerationSettings({ production, brief, brand });
  const mode: "express" | "standard" | "deep" =
    generationSettings.source === "snapshot"
      ? generationSettings.productionMode
      : resolveProductionMode({ production, brief, brand });

  const formatSettings =
    generationSettings.source === "snapshot"
      ? generationSettings.formatSettings
      : getEffectiveFormatSettings({
          formatSettings:
            (production as any)?.formatSettings ||
            (brief as any)?.formatSettings ||
            (params as any).formatSettings,
          brand,
        });
  const aspectMode = formatSettings?.aspectMode || "portrait";

  let aspectRatio = aspectMode === "landscape" ? "16:9" : "9:16";
  if (aspectMode === "dynamic") {
    const briefAny = brief as any;
    const productionAspect = (production as any)?.aspectRatio;
    if (productionAspect === "16:9" || productionAspect === "9:16") {
      aspectRatio = productionAspect;
    } else if (briefAny.aspectRatio === "16:9" || briefAny.aspectRatio === "9:16") {
      aspectRatio = briefAny.aspectRatio;
    }
  }

  const environmentString = brief.visualDirection || "a high-end executive studio with refined architectural lighting";
  const plateUrl = brand.locationPlateUrl || (brand as any).settings?.locationPlateUrl || (brand as any).settings?.location_plate_url;

  const identityBlock = `CHARACTER (LOCKED IDENTITY): Primary subject is "${character?.name || "Host"}" (Style: ${character?.style || "Executive Presenter"}, Traits: ${(character?.traits || ["Visionary", "Authoritative", "Magnetic"]).join(", ")}).
IDENTITY CONTINUITY LAW: Must be the exact same person in every panel. Consistent facial structure, hair, and wardrobe styling across every single scene. Absolutely no character drifting, no face morphing, no outfit changes.${characterReferenceImageUrl ? ` Reference Sheet: ${characterReferenceImageUrl}` : ""}`;

  const effectiveFormat = getEffectiveContentFormat({
    brand,
    production,
    brief,
    character,
    formatSettings,
  });
  const isSingleLocation =
    effectiveFormat === "host" &&
    formatSettings?.singleLocation !== false &&
    (production as any)?.formatSettings?.singleLocation !== false;

  const setBlock = isSingleLocation
    ? `ENVIRONMENT (LOCKED SET): Location is "${environmentString}".${plateUrl ? ` Locked Set Reference: ${plateUrl}` : ""}
SET CONTINUITY LAW: Same physical set, backdrop, architectural details, and lighting atmosphere across all panels. Do not change set location mid-board unless brief explicitly changes scene location. Lighting aligned with ${brand.name || "Brand"}.`
    : `ENVIRONMENT (SCENE-DIRECTED): Visual world and aesthetic aligned with "${environmentString}".${plateUrl ? ` Brand Aesthetic Reference: ${plateUrl}` : ""}
SET CONTINUITY LAW: Honor each scene's distinct location, architecture, and lighting atmosphere as defined in its storyboard panel. Maintain coherent world aesthetic aligned with ${brand.name || "Brand"} without forcing unrelated scenes into a single set.`;

  const visualGenre = resolveLiveVisualGenre({
    formatSettings: formatSettings,
    contentFormat: formatSettings.contentFormat,
    production,
    brief,
  });
  const photoreal = isPhotorealVisualGenre(visualGenre);
  const genreOptics = visualGenreDirective({
    visualGenre,
    cinematicCraft: formatSettings.cinematicCraft !== false,
  });
  const styleBlock = photoreal
    ? `LOOK DISCIPLINE: Format ${aspectRatio}. ${genreOptics} Coherent grade, natural depth of field, zero extra limbs.`
    : `LOOK DISCIPLINE: Format ${aspectRatio}. ${genreOptics} Do NOT apply photoreal 8K skin/live-action optics.`;

  const combinedPromptPrefix = `${identityBlock}\n${setBlock}\n${styleBlock}`;

  return {
    characterReferenceImageUrl,
    identityBlock,
    setBlock,
    styleBlock,
    aspectRatio,
    mode,
    combinedPromptPrefix,
    environmentString,
  };
}

export interface VisualLockRefsResult {
  imageUrls: string[];
  primaryRefUrl?: string;
  charSheetUrls: string[];
  refPromptHeader: string;
  labelLines?: string[];
  tagLines?: string[];
  elements?: ProductionElement[];
}

export function isPlayableVideoUrl(val?: string | null): val is string {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (trimmed.length < 10) return false;
  if (trimmed.includes("pending") || trimmed.includes("failed") || trimmed.includes("error")) return false;
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:video/")
  );
}



/** Playable identity we are allowed to write onto production.videoUrl / scene.videoUrl. */

export function sanitizePersistedMediaUrl(
  incoming?: string | null,
  existing?: string | null
): string | undefined {
  if (incoming && isPersistableSparkMediaUrl(incoming)) return incoming;
  if (existing && isPersistableSparkMediaUrl(existing)) return existing;
  if (incoming && !isEphemeralMediaUrl(incoming) && isSparkStorageUrl(incoming)) return incoming;
  return undefined;
}


export function isSignedUrlExpiredOrExpiringSoon(url?: string | null, thresholdSec = 60): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get("token");
    if (!token) {
      // Public URL without token: does not expire via JWT token
      return false;
    }
    const parts = token.split(".");
    if (parts.length >= 2) {
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonStr = typeof atob === "function"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("utf-8");
      const payload = JSON.parse(jsonStr);
      if (typeof payload.exp === "number") {
        return payload.exp * 1000 <= Date.now() + thresholdSec * 1000;
      }
    }
  } catch {}
  return false;
}

export function isStorageVerifiedVideoUrl(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!isPlayableVideoUrl(trimmed)) return false;
  return !isEphemeralMediaUrl(trimmed);
}

export function isDurableMasterVideoReady(val?: string | null): boolean {
  return isPlayableVideoUrl(val) && isStorageVerifiedVideoUrl(val);
}

/** Emergency narrator slideshow written after I2V failure — not a cinematic master. */
export function isEmergencySlideshowFallbackUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("master-fallback.") ||
    lower.includes("/video/master-fallback") ||
    lower.includes("master-fallback/")
  );
}

export function isValidMediaData(val?: string | null): val is string {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  return (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("data:video/") ||
    trimmed.startsWith("data:audio/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  );
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
  signal?: AbortSignal
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout (${Math.round(timeoutMs / 1000)}s): ${errorMessage}`));
    }, timeoutMs);
  });

  const abortPromise = new Promise<T>((_, reject) => {
    if (signal?.aborted) {
      reject(new Error("Operation aborted"));
    } else {
      signal?.addEventListener("abort", () => reject(new Error("Operation aborted")), { once: true });
    }
  });

  try {
    return await Promise.race([promise, timeoutPromise, abortPromise]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Builds a deterministic, positional visual reference list for image/video models:
 * 1. Character Sheet URL(s) (always top priority) — Spec Director masters preferred when provided
 * 2. Master Storyboard Grid Reference Map
 * 3. Current Scene Keyframe Still
 * 4. Preceding Scene End-State Continuity Reference
 * 5. Location plate / optional prop from Asset Director
 */
export function buildVisualLockRefs(params: {
  character?: Character;
  supportCharacter?: Character;
  storyboardGridUrl?: string;
  sceneKeyframeUrl?: string;
  previousLastFrameUrl?: string;
  locationPlateUrl?: string;
  subjectType?: "main" | "support" | "set" | "insert" | string;
  contentFormat?: string;
  /** Spec Asset Director / master identity URLs (preferred over domain when present) */
  directorIdentityUrls?: string[];
  directorSupportUrls?: string[];
  /** Optional prop/product master URL for insert beats */
  directorPropUrl?: string;
  /** Optional preproduction Asset Bible */
  assetBible?: AssetBibleEntry[];
}): VisualLockRefsResult {
  const {
    character,
    supportCharacter,
    storyboardGridUrl,
    sceneKeyframeUrl,
    previousLastFrameUrl,
    locationPlateUrl,
    subjectType = "main",
    contentFormat,
    directorIdentityUrls,
    directorSupportUrls,
    directorPropUrl,
  } = params;

  const isFaceless = contentFormat === "faceless";
  const isSetSubject =
    subjectType === "set" || subjectType === "establishing" || subjectType === "environment";
  // Trust stamped subject — faceless defaults to insert only when subject is not explicit main/support/set
  const isSupport =
    !isSetSubject && (subjectType === "support" || subjectType === "supporting");
  const isInsertSubject =
    subjectType === "insert" ||
    subjectType === "product" ||
    subjectType === "b-roll" ||
    (isFaceless && subjectType !== "main" && subjectType !== "support" && subjectType !== "supporting" && !isSetSubject);

  const validPlate = locationPlateUrl && isValidMediaData(locationPlateUrl) ? locationPlateUrl : undefined;
  const validGrid = storyboardGridUrl && isValidMediaData(storyboardGridUrl) ? storyboardGridUrl : undefined;
  const orderedRefs: string[] = [];
  const labelLines: string[] = [];
  const charSheetUrls: string[] = [];
  let refCounter = 1;

  const pushGridRef = () => {
    if (validGrid && !orderedRefs.includes(validGrid)) {
      orderedRefs.push(validGrid);
      labelLines.push(`INPUT REF [${refCounter}]: Master Storyboard Grid Reference Map`);
      refCounter++;
    }
  };

  const pushUnique = (url: string | undefined, label: string) => {
    if (!url || !isValidMediaData(url) || orderedRefs.includes(url)) return;
    orderedRefs.push(url);
    labelLines.push(`INPUT REF [${refCounter}]: ${label}`);
    refCounter++;
  };

  if (isInsertSubject) {
    // INSERT / B-ROLL / FACELESS (non-main): No host face required.
    pushGridRef();
    if (previousLastFrameUrl && isValidMediaData(previousLastFrameUrl) && !orderedRefs.includes(previousLastFrameUrl)) {
      orderedRefs.push(previousLastFrameUrl);
      labelLines.push(`INPUT REF [${refCounter}]: Preceding Scene Continuity Reference`);
      refCounter++;
    }
    if (directorPropUrl) {
      pushUnique(directorPropUrl, "Asset Director Prop / Product Reference");
    }
    if (validPlate && !orderedRefs.includes(validPlate)) {
      orderedRefs.push(validPlate);
      labelLines.push(`INPUT REF [${refCounter}]: Contextual Studio Environment Reference`);
      refCounter++;
    }
  } else if (isSetSubject) {
    // SET: Empty or wide set. Location only.
    if (validPlate) {
      orderedRefs.push(validPlate);
      labelLines.push(`INPUT REF [${refCounter}]: Locked Set / Location Plate Reference`);
      refCounter++;
    }
    pushGridRef();
    if (previousLastFrameUrl && isValidMediaData(previousLastFrameUrl) && !orderedRefs.includes(previousLastFrameUrl)) {
      orderedRefs.push(previousLastFrameUrl);
      labelLines.push(`INPUT REF [${refCounter}]: Preceding Set Continuity Reference`);
      refCounter++;
    }
  } else {
    // MAIN / SUPPORT (Host / Story / Anime / faceless explicit main):
    // Prefer Spec Director master sheets, then domain Character sheets.
    if (isSupport) {
      for (const url of directorSupportUrls || []) {
        if (url && isValidMediaData(url) && !charSheetUrls.includes(url)) charSheetUrls.push(url);
      }
      const supportSheet = supportCharacter?.characterSheetUrl || supportCharacter?.imageUrl;
      if (supportSheet && isValidMediaData(supportSheet) && !charSheetUrls.includes(supportSheet)) {
        charSheetUrls.push(supportSheet);
      }
      // Soft fallback: lead Spec / domain if support has no sheet
      if (!charSheetUrls.length) {
        for (const url of directorIdentityUrls || []) {
          if (url && isValidMediaData(url) && !charSheetUrls.includes(url)) charSheetUrls.push(url);
        }
      }
    }

    if (!isSupport || !charSheetUrls.length) {
      for (const url of directorIdentityUrls || []) {
        if (url && isValidMediaData(url) && !charSheetUrls.includes(url)) charSheetUrls.push(url);
      }
    }

    const targetChar =
      isSupport && (supportCharacter?.characterSheetUrl || supportCharacter?.imageUrl)
        ? supportCharacter
        : character;
    if (targetChar && !charSheetUrls.length) {
      const directSheet = targetChar.characterSheetUrl;
      if (directSheet && isValidMediaData(directSheet)) charSheetUrls.push(directSheet);

      const sheetList = (targetChar as any).sheet_image_urls;
      if (Array.isArray(sheetList)) {
        for (const url of sheetList) {
          if (url && isValidMediaData(url) && !charSheetUrls.includes(url)) {
            charSheetUrls.push(url);
          }
        }
      }

      const imgUrl = targetChar.imageUrl || targetChar.avatarUrl;
      if (imgUrl && isValidMediaData(imgUrl) && !charSheetUrls.includes(imgUrl)) {
        charSheetUrls.push(imgUrl);
      }
    } else if (targetChar) {
      // Fill remaining slots from domain after Spec masters (cap later)
      const directSheet = targetChar.characterSheetUrl;
      if (directSheet && isValidMediaData(directSheet) && !charSheetUrls.includes(directSheet)) {
        charSheetUrls.push(directSheet);
      }
    }

    const charLabel = isSupport
      ? `Supporting Character Reference Sheet (${targetChar?.name || supportCharacter?.name || "Support Character"})`
      : `Character Reference Sheet (${targetChar?.name || character?.name || "Host"})`;

    // Cap identity sheets to avoid multimodal over-stack
    for (const sheetUrl of charSheetUrls.slice(0, 2)) {
      orderedRefs.push(sheetUrl);
      labelLines.push(`INPUT REF [${refCounter}]: ${charLabel}`);
      refCounter++;
    }

    pushGridRef();

    if (previousLastFrameUrl && isValidMediaData(previousLastFrameUrl) && !orderedRefs.includes(previousLastFrameUrl)) {
      orderedRefs.push(previousLastFrameUrl);
      labelLines.push(`INPUT REF [${refCounter}]: Preceding Scene Continuity Reference`);
      refCounter++;
    }

    if (
      sceneKeyframeUrl &&
      isValidMediaData(sceneKeyframeUrl) &&
      !orderedRefs.includes(sceneKeyframeUrl)
    ) {
      orderedRefs.push(sceneKeyframeUrl);
      labelLines.push(`INPUT REF [${refCounter}]: Current Scene Keyframe Still`);
      refCounter++;
    }

    if (validPlate && !orderedRefs.includes(validPlate)) {
      orderedRefs.push(validPlate);
      labelLines.push(`INPUT REF [${refCounter}]: Locked Set / Studio Location Plate`);
      refCounter++;
    }
  }

  const elementPack = buildProductionElementPack({
    character,
    supportCharacter,
    locationPlateUrl: validPlate,
    directorIdentityUrls,
    directorSupportUrls,
    directorPropUrl,
    propUrls: Object.entries((params as any)?.brief?.generatedAssets?.propSheets || {}).map(([tag, url]) => ({ tag, url: url as string })),
    assetBible: params.assetBible,
  });

  const elements: ProductionElement[] = [];
  const tagLines: string[] = [];
  for (let i = 0; i < orderedRefs.length; i++) {
    const url = orderedRefs[i];
    const el = elementPack.find((e) => e.url === url);
    if (el) {
      elements.push(el);
      tagLines.push(`ELEMENT ${el.tag} → ${labelLines[i]}`);
    } else {
      tagLines.push(labelLines[i]);
    }
  }

  const refPromptHeader = labelLines.length > 0
    ? `${labelLines.join("\n")}\nVISUAL LOCK LAW: The physical identity, face, outfit, and studio set look strictly lives in the reference images above. Text describes physical action and camera motion only.\n`
    : "";

  return {
    imageUrls: orderedRefs,
    primaryRefUrl: orderedRefs[0],
    charSheetUrls: (isInsertSubject || isSetSubject) ? [] : (charSheetUrls || []).slice(0, 2),
    refPromptHeader,
    labelLines,
    tagLines,
    elements,
  };
}

/** Spec Asset Director masters → buildVisualLockRefs (one media spine). */
export function buildVisualLockRefsFromDirector(params: {
  production?: any;
  brand?: Brand;
  character?: Character;
  supportCharacter?: Character;
  storyboardGridUrl?: string;
  sceneKeyframeUrl?: string;
  previousLastFrameUrl?: string;
  locationPlateUrl?: string;
  subjectType?: "main" | "support" | "set" | "insert" | string;
  contentFormat?: string;
  sceneId?: string | null;
  shotId?: string | null;
  assetBible?: AssetBibleEntry[];
}): VisualLockRefsResult & { directorNotes: string[] } {
  const director = resolveDirectorPixelRefs({
    production: params.production,
    subjectType: params.subjectType,
    contentFormat: params.contentFormat,
    sceneId: params.sceneId,
    shotId: params.shotId,
    brand: params.brand,
    character: params.character,
    supportCharacter: params.supportCharacter,
    runtimeLocationPlateUrl: params.locationPlateUrl,
  });
  const merged = mergeDirectorIdentityForLock({ director });
  const assetBible =
    params.assetBible ||
    params.production?.assetBible ||
    params.production?.brief?.assetBible;
  const lock = buildVisualLockRefs({
    character: params.character,
    supportCharacter: params.supportCharacter,
    storyboardGridUrl: params.storyboardGridUrl,
    sceneKeyframeUrl: params.sceneKeyframeUrl,
    previousLastFrameUrl: params.previousLastFrameUrl,
    locationPlateUrl: merged.locationPlateUrl || params.locationPlateUrl,
    subjectType: params.subjectType,
    contentFormat: params.contentFormat,
    directorIdentityUrls: merged.identityUrls,
    directorSupportUrls: merged.supportUrls,
    directorPropUrl: merged.propUrl,
    assetBible,
  });
  return { ...lock, directorNotes: director.notes };
}

/**
 * Normalizes on-screen text for in-picture burn-in (canvas lower-third or keyframe typography overlay).
 * Enforces concise length (<=8 words / <=60 chars) and excludes long spoken scripts or platform captions.
 */
export function formatBurnedOnScreenText(text?: string): string {
  if (!text) return "";
  const cleaned = text.replace(/["\r\n\t]+/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 8 && cleaned.length <= 60) return cleaned;
  return words.slice(0, 8).join(" ");
}

export class ProductionAssetService {
  /**
   * Refetches existing video mp4 objects from Supabase Storage if UI state is missing playable URLs.
   */
  static async refetchVideoFromStorage(params: {
    productionId: string;
    brandId?: string;
  }): Promise<{ videoUrl?: string; sceneClips?: string[] }> {
    try {
      const { getSupabaseClient } = await import("../../backend/supabaseClient");
      const supabase = getSupabaseClient();
      if (!supabase) return {};

      const { brandId = "default-brand", productionId } = params;
      const folderPaths = [
        `brands/${brandId}/${productionId}/video`,
        `${productionId}/video`,
      ];

      for (const folderPath of folderPaths) {
        const { data: files, error } = await supabase.storage.from(SPARK_STORAGE_BUCKET).list(folderPath, {
          limit: 20,
          sortBy: { column: "created_at", order: "asc" },
        });

        if (!error && files && files.length > 0) {
          const mp4Files = files.filter((f) => f.name && f.name.endsWith(".mp4"));
          if (mp4Files.length > 0) {
            const sceneClips: string[] = [];
            for (const mp4 of mp4Files) {
              const filePath = `${folderPath}/${mp4.name}`;
              const { data: signedData } = await supabase.storage.from(SPARK_STORAGE_BUCKET).createSignedUrl(filePath, 60 * 60 * 24 * 7);
              const clipUrl = signedData?.signedUrl || supabase.storage.from(SPARK_STORAGE_BUCKET).getPublicUrl(filePath).data?.publicUrl;
              if (clipUrl && isPlayableVideoUrl(clipUrl)) {
                sceneClips.push(clipUrl);
              }
            }
            if (sceneClips.length > 0) {
              return { videoUrl: sceneClips[0], sceneClips };
            }
          }
        }
      }
    } catch (err) {
      console.warn("[ProductionAssetService] Storage refetch notice:", err);
    }
    return {};
  }

  /**
   * Complete Media Asset Pipeline:
   * 1. Working storage upload to verified Supabase bucket "Spark"
   * 2. Resolves usable signed URLs for private bucket playback (7 days TTL)
   * 3. Saves metadata in media_assets table
   * 4. Optional parallel / preferred path: Google Drive folder (if user connected Drive)
   * 5. Lifecycle management: supports deleting working storage objects after 7 days
   */
  static async uploadAssetToStorage(params: {
    productionId: string;
    brandId?: string;
    assetType: "image" | "frame" | "storyboard" | "video" | "audio" | "thumbnail";
    storagePath: string;
    dataUrlOrBlob: string | Blob;
    mimeType: string;
    prompt?: string;
    provider?: string;
    sceneId?: string;
    shotId?: string;
    taskId?: string;
  }): Promise<{ publicUrl: string; storagePath: string; assetId: string; driveFileId?: string; driveWebViewLink?: string; uploadSuccess: boolean }> {
    const { productionId, brandId = "default-brand", assetType, storagePath, dataUrlOrBlob, mimeType, prompt, provider, sceneId, shotId, taskId } = params;
    const assetId = `pa-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    let finalPublicUrl = typeof dataUrlOrBlob === "string" ? dataUrlOrBlob : `blob:${assetId}`;
    let driveFileId: string | undefined = undefined;
    let driveWebViewLink: string | undefined = undefined;
    let uploadSuccess = false;

    let uploadBlob: Blob | null = null;
    if (dataUrlOrBlob instanceof Blob) {
      uploadBlob = dataUrlOrBlob;
    } else if (typeof dataUrlOrBlob === "string" && dataUrlOrBlob.startsWith("data:")) {
      try {
        if (typeof fetch !== "undefined") {
          const fetched = await fetch(dataUrlOrBlob);
          if (fetched.ok) {
            uploadBlob = await fetched.blob();
          }
        }
      } catch {
        // Fallback to manual base64 decoding
      }
      if (!uploadBlob) {
        try {
          const match = dataUrlOrBlob.match(/^data:([^;]+);base64,(.*)$/s);
          const rawMime = match ? match[1] : mimeType;
          const b64 = (match ? match[2] : dataUrlOrBlob.split(",")[1] || "").replace(/\s+/g, "");
          if (b64) {
            if (typeof Buffer !== "undefined") {
              const buf = Buffer.from(b64, "base64");
              uploadBlob = new Blob([buf], { type: rawMime || mimeType });
            } else {
              const byteCharacters = atob(b64);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              uploadBlob = new Blob([byteArray], { type: rawMime || mimeType });
            }
          }
        } catch (b64Err) {
          console.warn("[ProductionAssetService] Notice decoding base64 data URI:", b64Err);
        }
      }
    } else if (dataUrlOrBlob.startsWith("http://") || dataUrlOrBlob.startsWith("https://")) {
      if (isPersistableSparkMediaUrl(dataUrlOrBlob) && extractSparkStoragePath(dataUrlOrBlob) === storagePath) {
        return {
          publicUrl: dataUrlOrBlob,
          storagePath,
          assetId,
          driveFileId,
          driveWebViewLink,
          uploadSuccess: true,
        };
      }
      try {
        const fetched = await fetch(dataUrlOrBlob);
        if (fetched.ok) {
          uploadBlob = await fetched.blob();
        }
      } catch (fetchErr) {
        console.warn("[ProductionAssetService] Remote URL fetch for storage upload notice:", fetchErr);
      }
      if (!uploadBlob) {
        try {
          const { ingestRemoteMediaToSpark } = await import("./ingestMediaToSpark");
          const ingested = await ingestRemoteMediaToSpark({
            url: dataUrlOrBlob,
            brandId,
            productionId,
            assetType,
            storagePath,
            mimeType,
          });
          if (ingested?.publicUrl && !isEphemeralMediaUrl(ingested.publicUrl)) {
            uploadSuccess = true;
            finalPublicUrl = ingested.publicUrl;
          }
        } catch (ingestErr) {
          console.warn("[ProductionAssetService] Server ingest fallback notice:", ingestErr);
        }
      }
    }

    // 1. Working Storage Upload to Supabase bucket "Spark"
    try {
      const { getSupabaseClient } = await import("../../backend/supabaseClient");
      const supabase = getSupabaseClient();

      if (supabase && uploadBlob) {
        const { data, error } = await supabase.storage.from(SPARK_STORAGE_BUCKET).upload(storagePath, uploadBlob, {
          contentType: mimeType || uploadBlob.type || "image/png",
          upsert: true,
        });

        if (!error && data) {
          uploadSuccess = true;
          console.log(`[ProductionAssetService] Uploaded binary to bucket "${SPARK_STORAGE_BUCKET}": ${storagePath} (${uploadBlob.size} bytes)`);

          // Bucket "Spark" is PUBLIC — prefer a permanent public URL so generated media never
          // expires. (Previously this stored 7-day signed URLs, so media vanished after a week
          // and had to be re-signed on login.) Signed URL remains a fallback.
          const { data: pubData } = supabase.storage.from(SPARK_STORAGE_BUCKET).getPublicUrl(storagePath);
          if (pubData?.publicUrl) {
            finalPublicUrl = pubData.publicUrl;
          } else {
            const { data: signedData, error: signedError } = await supabase.storage
              .from(SPARK_STORAGE_BUCKET)
              .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
            if (!signedError && signedData?.signedUrl) {
              finalPublicUrl = signedData.signedUrl;
            }
          }
        } else if (error) {
          uploadSuccess = false;
          console.error(`[ProductionAssetService] Supabase Storage upload to bucket "${SPARK_STORAGE_BUCKET}" failed:`, error);
        }
      } else if (!uploadBlob && !uploadSuccess) {
        console.warn(`[ProductionAssetService] No binary blob available for upload to "${storagePath}"`);
      }
    } catch (err) {
      uploadSuccess = false;
      console.error("[ProductionAssetService] Working storage upload error:", err);
    }

    // 2. Optional Parallel / Preferred Path: Google Drive Upload (if user connected Drive)
    try {
      const { uploadToUserGoogleDriveIfConnected } = await import("../googleDriveService");
      if (uploadBlob) {
        const driveResult = await uploadToUserGoogleDriveIfConnected({
          blob: uploadBlob,
          filename: storagePath.split("/").pop() || `${assetId}.png`,
          mimeType: mimeType || uploadBlob.type,
          productionId,
        });
        if (driveResult) {
          driveFileId = driveResult.fileId;
          driveWebViewLink = driveResult.webViewLink;
        }
      }
    } catch (driveErr) {
      console.log("[ProductionAssetService] Google Drive upload notice (optional path):", driveErr);
    }

    // 3. Save metadata in media_assets table
    const prodAsset: ProductionAsset = {
      id: assetId,
      brandId,
      productionId,
      sceneId,
      shotId,
      taskId,
      assetType,
      provider: provider || "AIProviderOrchestrator",
      storageBucket: SPARK_STORAGE_BUCKET,
      storagePath,
      publicUrl: finalPublicUrl,
      driveFileId,
      driveWebViewLink,
      expiresAt,
      mimeType: mimeType || uploadBlob?.type || "application/octet-stream",
      generationPrompt: prompt,
      status: uploadSuccess ? "completed" : "failed",
      createdAt: new Date().toISOString(),
    };

    try {
      if (uploadSuccess) {
        const { persistProductionAssetCreate } = await import("../../backend/workspaceSync");
        await persistProductionAssetCreate(brandId, prodAsset);
      }
    } catch (dbErr) {
      console.warn("[ProductionAssetService] Media asset record persist notice:", dbErr);
    }

    if (uploadSuccess && (isEphemeralMediaUrl(finalPublicUrl) || !isSparkStorageUrl(finalPublicUrl))) {
      uploadSuccess = false;
      finalPublicUrl = "";
    }

    if (!uploadSuccess) {
      return { publicUrl: "", storagePath, assetId, driveFileId, driveWebViewLink, uploadSuccess: false };
    }

    return { publicUrl: finalPublicUrl, storagePath, assetId, driveFileId, driveWebViewLink, uploadSuccess };
  }

  /**
   * Helper to resolve fresh signed URL from private "Spark" bucket for playback
   */
  static async resolveSignedUrl(storagePath: string, expiresIn = 604800): Promise<string | null> {
    if (!storagePath) return null;
    try {
      const { getSupabaseClient } = await import("../../backend/supabaseClient");
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data: pubData } = supabase.storage.from(SPARK_STORAGE_BUCKET).getPublicUrl(storagePath);
      if (pubData?.publicUrl) {
        return pubData.publicUrl;
      }
      const { data, error } = await supabase.storage
        .from(SPARK_STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresIn);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
      return null;
    } catch (err) {
      console.warn("[ProductionAssetService] resolveSignedUrl error:", err);
      return null;
    }
  }

  /**
   * Generates storyboards, scene keyframes, voiceovers, thumbnails, and video clips
   * via Capability Registry -> Model Router -> Provider Adapters.
   */
  static async generateAssets(params: {
    production: Production;
    brief: ProductionBrief;
    brand: Brand;
    character?: Character;
    characters?: Character[];
    memoryItems?: import("../../domain/types").MemoryItem[];
    creditSettings?: import("../../domain/types").GenerationCreditSettings;
    onProgress?: (progress: import("../../domain/types").GenerationProgress) => void;
    forceRegenerate?: boolean;
    signal?: AbortSignal;
    spec?: ProductionSpec;
    tasks?: GenerationTask[];
    engine?: GenerationExecutionEngine;
    ports?: AdapterPorts;
    dryRun?: boolean;
  }): Promise<ProductionAssetGenerationResult> {
    const { production, brief, brand, character, characters, memoryItems = [], creditSettings, onProgress, forceRegenerate, signal } = params;
    const brandIdForGuard = (brand as any)?.id;
    ProductionGenerationGuard.assertEnabled("ProductionAssetService.generateAssets", brandIdForGuard);

    const checkAborted = () => {
      if (signal?.aborted || isProductionTombstoned(production.id) || !ProductionGenerationGuard.isEnabled(brandIdForGuard)) {
        const err = new Error("Generation cancelled by executive");
        err.name = "AbortError";
        throw err;
      }
    };

    // Canonical Execution Context (A-05b single task execution boundary)
    const rawSpec: ProductionSpec | undefined =
      params.spec ||
      (production?.reasoning as any)?.productionSpec ||
      (production && brand ? resolveProductionSpec(production, brand, character) : undefined);
    const spec = rawSpec ? applyLongFormVisualPlanning(rawSpec) : undefined;
    if (spec) assertVisualPlanExecutable(spec);
    const resolvedTaskSet = spec ? resolveGenerationTasks(spec, true).tasks : [];
    const tasks: GenerationTask[] = params.tasks || resolvedTaskSet;
    const engine: GenerationExecutionEngine | undefined =
      spec && tasks.length > 0
        ? params.engine ||
          new GenerationExecutionEngine({
            brandId: brandIdForGuard,
            ports: params.ports || createRuntimeAdapterPorts(),
            dryRun: params.dryRun,
            creditService: (params as any).creditService,
            userId: (params as any).userId || (brand as any)?.owner_id,
          })
        : undefined;
    const priorOutputs: Record<string, string> = {};

    const generationSettings = resolveGenerationSettings({
      production,
      brief,
      brand,
      creditSettings,
    });
    const activeFormatSettings = generationSettings.formatSettings;
    const activeCreditSettings = generationSettings.creditSettings;
    const preferredVideoModel = generationSettings.preferredVideoModel;
    const preferredVideoProvider = generationSettings.preferredVideoProvider;
    if (generationSettings.source === "snapshot") {
      console.log(
        `[SPARK Pipeline] Using immutable production settings snapshot (mode=${generationSettings.productionMode}, format=${activeFormatSettings.contentFormat}, provider=${preferredVideoProvider || "auto"}, model=${preferredVideoModel || "default"})`
      );
    }

    const scriptToEval = brief.narrativeScript || (production as any).narrativeScriptObj || (production as any).narrativeScript;
    if (!scriptToEval || !Array.isArray(scriptToEval.chapters) || scriptToEval.chapters.length === 0) {
      const errMsg = "No writer chapters. SPARK will not invent clips.";
      console.error(`[ProductionAssetService] ${errMsg}`);
      return {
        brief: {
          ...brief,
          lastError: errMsg,
        },
        scenes: [],
        productionScenes: [],
        audioUrl: brief.audioUrl,
        videoUrl: brief.videoUrl,
      };
    }
    if (scriptToEval) {
      const refTitles = collectMustNotCopyTitles(brand?.researchSources || (brand as any)?.sources || []);
      const scriptEval = evaluateScriptForProduction(scriptToEval, (production as any).spark, brand, refTitles);
      if (!scriptEval.ok) {
        const reason = scriptEval.reasons[0] || "Script quality gate failed.";
        console.warn(`[ProductionAssetService] Asset generation gated by script quality check: ${reason}`);
        return {
          brief: {
            ...brief,
            lastError: reason,
          },
          scenes: (brief.storyboard || production.scenes || []).map((s: any, idx: number) => ({
            scene: s.scene || idx + 1,
            description: s.description || s.visualDescription || `Scene ${s.scene || idx + 1}`,
            duration: s.duration || "0-10s",
            image: s.image,
            videoUrl: s.videoUrl,
          })),
          productionScenes: brief.storyboard || (production.productionScenes as any) || [],
          audioUrl: brief.audioUrl,
          videoUrl: brief.videoUrl,
        };
      }
    }

    console.log(`[SPARK Pipeline] START Asset Generation for Production "${production.id}" (${brief.title})`);

    const gate = canStartAssetGeneration({
      production,
      brief,
      brand,
      character,
      formatSettings: activeFormatSettings,
    });

    if (!gate.allowed) {
      console.warn(`[ProductionAssetService] Asset generation gated (${gate.contentFormat}): ${gate.reason}`);
      const gatedScenes = (brief.storyboard || production.scenes || []).map((s: any, idx: number) => ({
        scene: s.scene || idx + 1,
        description: s.description || s.visualDescription || `Scene ${s.scene || idx + 1}`,
        duration: s.duration || "0-10s",
        image: s.image,
        videoUrl: s.videoUrl,
      }));
      return {
        brief: {
          ...brief,
          lastError: gate.reason,
        },
        scenes: gatedScenes,
        productionScenes: brief.storyboard || (production.productionScenes as any) || [],
        audioUrl: brief.audioUrl,
        videoUrl: brief.videoUrl,
      };
    }

    checkAborted();

    // Preproduction Asset Bible preflight — ensures @tags/sheet kinds are planned for element packs & downstream stills

    const identityPack = buildLockedIdentityPack({ brand, character, brief, production });
    // Authoritative mode from snapshot (when present) — never let live re-resolution drift the pipeline.
    const rawPipelineMode = generationSettings.productionMode || identityPack.mode;
    const mode: "express" | "standard" | "deep" = normalizeModeString(rawPipelineMode) || "standard";
    const aspectRatio = identityPack.aspectRatio;
    if (generationSettings.source === "snapshot" && identityPack.mode !== mode) {
      console.warn(
        `[SPARK Pipeline] Identity pack mode (${identityPack.mode}) overridden by immutable snapshot mode (${mode})`
      );
    }
    // FRAME LOCK — before storyboard / sheet / stills (geometry spine)
    const frameLock: ProductionFrameLock = createProductionFrameLock({
      aspectRatio,
      aspectMode: activeFormatSettings.aspectMode,
      contentFormat: getEffectiveContentFormat({ brand, formatSettings: activeFormatSettings, production, brief }),
      platformFit: (brief as any).platformFit || (production as any).platformFit,
      account: (brief as any).account,
    });
    (production as any).frameLock = frameLock;
    (brief as any).frameLock = frameLock;
    const lookLaw = buildProductionLookLaw({ production, brief, formatSettings: activeFormatSettings, brand });
    const effectiveContentFormat = lookLaw.contentFormat;
    const effectiveVisualGenre = resolveLiveVisualGenre({
      formatSettings: activeFormatSettings,
      contentFormat: effectiveContentFormat,
      production,
      brief,
    });
    (brief as any).visualGenre = effectiveVisualGenre;
    (production as any).visualGenre = effectiveVisualGenre;

      // --- RESOLVE IMAGE PREFERENCE ---
      const globalImageRouting = ModelRouter.getUserRoutingConfig?.()?.storyboardImages || "auto";
      const globalImageModel = ModelRouter.getUserModelSelectionConfig?.()?.storyboardImages || "";
      const aiSettings = (production as any)?.settingsSnapshot?.aiSettings || (brief as any)?.aiSettings || (brand as any)?.settings?.aiSettings || (brand as any)?.aiSettings;
      const preferredImageProviderRaw = aiSettings?.routing?.storyboardImages || globalImageRouting;
      const resolvedImageProvider = preferredImageProviderRaw === "auto" ? undefined : preferredImageProviderRaw;
      const resolvedImageModel = aiSettings?.models?.storyboardImages || globalImageModel || undefined;

      if (resolvedImageProvider) {
        console.log(`[SPARK Pipeline] Image preference: provider=${resolvedImageProvider} model=${resolvedImageModel || 'default'}`);
      }

    console.log(
      `[SPARK Pipeline] Frame Lock: ${frameLock.frameLockId} ${frameLock.aspectRatio} ${frameLock.targetWidth}×${frameLock.targetHeight} (${frameLock.platformHint})`
    );
    console.log(
      `[SPARK Pipeline] Visual genre: ${effectiveVisualGenre} (format=${effectiveContentFormat}, cinematicCraft=${activeFormatSettings.cinematicCraft !== false})`
    );
    // Viral concept directive is injected by OS motion/still compilers — not here.
    (production as any).aspectRatio = frameLock.aspectRatio;
    (production as any).mode = mode;
    (production as any).productionMode = mode;
    brief.formatSettings = {
      ...activeFormatSettings,
      aspectMode:
        frameLock.orientation === "landscape"
          ? "landscape"
          : frameLock.orientation === "portrait"
            ? "portrait"
            : activeFormatSettings.aspectMode,
    };
    (brief as any).productionMode = mode;
    const compileWidth = frameLock.targetWidth;
    const compileHeight = frameLock.targetHeight;
    const promptPack = getProductionPromptPack({
      brand,
      character,
      brief,
      production,
      aspectRatio: frameLock.aspectRatio,
      characterRefUrl: identityPack.characterReferenceImageUrl,
      memoryItems,
    });

    const generatePlan = resolveGeneratePlan(mode, brief, activeCreditSettings);
    const skipExternalVoice = generatePlan.skipExternalVoice;
    const skipSfx = generatePlan.skipSfx;
    const skipI2V = generatePlan.skipI2V;
    const skipThumbnails = generatePlan.stages.find((s) => s.id === "thumbnails")?.status === "skipped";

    const stages: import("../../domain/types").GenerationProgressStage[] = generatePlan.stages.map((s, idx) => ({
      ...s,
      status: idx === 0 ? "active" : s.status,
    }));

    const markStage = (id: string, status: import("../../domain/types").GenerationProgressStage["status"]) => {
      const stage = stages.find((s) => s.id === id);
      if (stage) stage.status = status;
    };

    let currentStoryboard: ProductionScene[] = [];
    let currentThumbnails: { id: string; variant: string; concept: string; image?: string; url?: string }[] = [];
    let realGridUrl: string | undefined = brief.storyboardGridUrl || brief.generatedAssets?.storyboardGridUrl;
    let realVoiceUrl: string | undefined = undefined;
    let realVideoUrl: string | undefined = undefined;
    let realSfxUrl: string | undefined = undefined;
    let lastError: string | undefined = undefined;

    const bId = (brand as any)?.id || "default-brand";
    const getStoragePath = (sub: string) => brandProductionStoragePath(bId, production.id, sub);

    let latestProgressSnapshot: import("../../domain/types").GenerationProgress | undefined = undefined;

    const emitProgress = (
      percent: number,
      stage: string,
      message?: string,
      partialOverride?: {
        storyboard?: ProductionScene[];
        thumbnails?: { id: string; variant: string; concept: string; image?: string; url?: string }[];
        voiceUrl?: string;
        videoUrl?: string;
        lastError?: string;
      }
    ) => {
      if (productionWriteHalted({ productionId: production.id, brandId: brandIdForGuard, signal })) return;
      latestProgressSnapshot = {
        percent: Math.min(100, Math.max(0, percent)),
        stage,
        stages: stages.map((s) => ({ ...s })),
        message,
        updatedAt: new Date().toISOString(),
        partialAssets: {
          storyboard: partialOverride?.storyboard ?? (currentStoryboard.length > 0 ? currentStoryboard : undefined),
          thumbnails: partialOverride?.thumbnails ?? (currentThumbnails.length > 0 ? currentThumbnails.map((t) => ({ ...t })) : undefined),
          voiceUrl: partialOverride?.voiceUrl ?? realVoiceUrl,
          videoUrl: partialOverride?.videoUrl ?? realVideoUrl,
          lastError: partialOverride?.lastError ?? lastError,
        },
      };
      if (onProgress) {
        onProgress(latestProgressSnapshot);
      }
    };

    // Seed Stage UI immediately — before any provider / LLM work — so Review never shows
    // "Synthesizing" without a Stage while media credits are already burning.
    emitProgress(1, "Initializing", `Initializing ${mode.toUpperCase()} production pipeline (single spine)...`);

    const persistCurrentStage = async (stageName: string) => {
      if (productionWriteHalted({ productionId: production.id, brandId: brandIdForGuard, signal })) return;
      try {
        const { persistProductionUpdate, mergeProductionBrief } = await import("../../backend/workspaceSync");
        const stageBrief: ProductionBrief = mergeProductionBrief(brief, {
          storyboard: currentStoryboard.length > 0 ? currentStoryboard : brief.storyboard,
          storyboardGridUrl: realGridUrl,
          generationProgress: latestProgressSnapshot,
          generatedAssets: {
            ...brief.generatedAssets,
            storyboardGridUrl: realGridUrl,
            thumbnails: currentThumbnails,
            voiceoverUrl: realVoiceUrl,
            generatedFrames: currentStoryboard.map((s) => s.image).filter(Boolean) as string[],
            generatedVideos: realVideoUrl ? [realVideoUrl] : undefined,
            generationProgress: latestProgressSnapshot,
          },
          audioUrl: realVoiceUrl,
          videoUrl: realVideoUrl,
          video_storage_path: extractSparkStoragePath(realVideoUrl) || production.videoStoragePath || brief.video_storage_path,
        })!;
        await persistProductionUpdate(production.id, {
          brief: stageBrief,
          audioUrl: realVoiceUrl,
          videoUrl: realVideoUrl,
          videoStoragePath: extractSparkStoragePath(realVideoUrl) || production.videoStoragePath,
          generationProgress: latestProgressSnapshot,
          isGeneratingAssets: latestProgressSnapshot ? (latestProgressSnapshot.stage !== "Complete" && latestProgressSnapshot.stage !== "Failed" && latestProgressSnapshot.percent < 100) : false,
          scenes: stageBrief.storyboard?.map((s) => ({
            scene: s.scene,
            description: s.shotList || s.visualDescription || `Scene ${s.scene}`,
            duration: s.duration,
            image: s.image,
            videoUrl: s.videoUrl,
          })),
        });
        console.log(`[SPARK Pipeline] Persistent stage saved to Supabase -> ${stageName} (prod ${production.id}, ${latestProgressSnapshot?.percent ?? 0}%)`);
      } catch (stageSyncErr) {
        console.warn(`[SPARK Pipeline] Stage ${stageName} cloud sync notice:`, stageSyncErr);
      }
    };

    let heartbeatTimer: any = null;
    const startHeartbeat = (stageLabel: string) => {
      stopHeartbeat();
      heartbeatTimer = setInterval(() => {
        if (productionWriteHalted({ productionId: production.id, brandId: brandIdForGuard, signal })) {
          stopHeartbeat();
          return;
        }
        if (
          latestProgressSnapshot &&
          latestProgressSnapshot.stage !== "Complete" &&
          latestProgressSnapshot.stage !== "Failed" &&
          latestProgressSnapshot.stage !== "Cancelled" &&
          latestProgressSnapshot.percent < 100
        ) {
          emitProgress(
            latestProgressSnapshot.percent,
            latestProgressSnapshot.stage,
            `Working on ${stageLabel || latestProgressSnapshot.stage}...`
          );
        }
      }, 4000);
    };

    const stopHeartbeat = () => {
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    };

    emitProgress(5, "Storyboard", `Synthesizing ${mode.toUpperCase()} (${aspectRatio}) continuous storyboard...`);
    void persistCurrentStage("Storyboard");
    startHeartbeat("Storyboard");

    try {
      // PART 2 — Shot list = writer narrative chapters (SPARK provider script authority)
      const chapterScenes = buildScenesFromNarrativeChapters(scriptToEval, mode);
      const existingStoryboard = brief.storyboard || [];
      const storyboard: ProductionScene[] = chapterScenes.map((cs, idx) => {
        const ex = existingStoryboard[idx];
        if (ex) {
          return {
            ...cs,
            image: ex.image || cs.image,
            videoUrl: ex.videoUrl || cs.videoUrl,
            lastFrameUrl: ex.lastFrameUrl || cs.lastFrameUrl,
          };
        }
        return cs;
      });

      const sumDuration = storyboard.reduce((acc, s) => acc + (s.durationSec || 0), 0);
      if (scriptToEval.targetDurationSec && Math.abs(sumDuration - scriptToEval.targetDurationSec) > 5) {
        const warnMsg = `Warning: Sum of chapter durations (${sumDuration}s) diverges from script.targetDurationSec (${scriptToEval.targetDurationSec}s). Using chapter durations, no rescaling to 60.`;
        console.warn(`[SPARK Pipeline] ${warnMsg}`);
        if (!lastError) {
          lastError = warnMsg;
        }
      }

      currentStoryboard = storyboard;
      let thumbnails: any[] = Array.isArray((brief as any).thumbnails) ? (brief as any).thumbnails : [];
      currentThumbnails = thumbnails.length > 0
      ? thumbnails.map((t: any, idx: number) => ({
          id: t.id || `t${idx + 1}`,
          variant: t.variant || ["A", "B", "C"][idx] || "A",
          concept: t.concept || `Variant ${t.variant || "A"}`,
        }))
      : [
          { id: "t1", variant: "A", concept: "High-contrast hook framing with brand authority" },
          { id: "t2", variant: "B", concept: "Core value delivery and insight breakdown" },
          { id: "t3", variant: "C", concept: "Resolving call-to-action with clear next step" },
        ];

    const isValidMediaData = (val?: string | null): val is string => {
      if (!val || typeof val !== "string") return false;
      const trimmed = val.trim();
      return (
        trimmed.startsWith("data:image/") ||
        trimmed.startsWith("data:video/") ||
        trimmed.startsWith("data:audio/") ||
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://")
      );
    };

      markStage("storyboard", "done");

      const isExpressMode = mode === "express";
      const scenesNeedVo = (sb: typeof currentStoryboard) => {
        if (!sb || sb.length === 0) return false;
        return sb.some((s) => s.audio === "vo");
      };

      const shouldSynthesizeExternalVoice =
        !skipExternalVoice &&
        (mode === "express" || (mode === "standard" && scenesNeedVo(currentStoryboard)));

      const voiceTask = tasks.find((t) => t.kind === "voice");
      if (!shouldSynthesizeExternalVoice) {
        console.log(`[SPARK Pipeline] Mode is "${mode}" (cinematic / talent-only dialogue). Skipping separate ElevenLabs voiceover bed (speech delivered via video clips/talent).`);
        realVoiceUrl = undefined;
        if (voiceTask) voiceTask.status = "skipped";
        markStage("voice", "skipped");
        emitProgress(12, "Voice", `Skipped external VO bed for ${mode} (dialogue expected inside motion clips)`);
      } else if (!forceRegenerate && isValidMediaData(production.audioUrl || brief.audioUrl)) {
        markStage("voice", "active");
        realVoiceUrl = production.audioUrl || brief.audioUrl;
        if (voiceTask) {
          voiceTask.status = "succeeded";
          if (realVoiceUrl) priorOutputs[voiceTask.id] = realVoiceUrl;
        }
        console.log(`[SPARK Pipeline] Reusing existing voiceover audio -> ${realVoiceUrl}`);
        markStage("voice", "done");
      } else if (engine && voiceTask && spec) {
        markStage("voice", "active");
        emitProgress(12, "Voice", "Synthesizing voiceover narration (Hook + Core + CTA)...");
        void persistCurrentStage("Voice");
        startHeartbeat("Voice");
        checkAborted();
        try {
          const res = await engine.executeTask({ spec, task: voiceTask, priorOutputs });
          checkAborted();
          if (res.task.status === "succeeded") {
            const outUrl = res.asset?.publicUrl || (res.execution.outputAssets[0]?.sourceUrl as string);
            realVoiceUrl = outUrl;
            voiceTask.status = "succeeded";
            voiceTask.productionAssetId = res.asset?.id;
            priorOutputs[voiceTask.id] = outUrl;
          } else {
            voiceTask.status = "failed";
            voiceTask.lastError = res.task.lastError || "Voice task execution failed";
            if (!lastError) lastError = `Voice: ${voiceTask.lastError}`;
          }
        } catch (vErr: any) {
          if (vErr?.name === "AbortError" || signal?.aborted) throw vErr;
          voiceTask.status = "failed";
          voiceTask.lastError = vErr?.message || String(vErr);
          if (!lastError) lastError = `Voice: ${voiceTask.lastError}`;
        }
        markStage("voice", realVoiceUrl ? "done" : "failed");
      } else {
        markStage("voice", "active");
        emitProgress(12, "Voice", "Synthesizing voiceover narration (Hook + Core + CTA)...");
        void persistCurrentStage("Voice");
        startHeartbeat("Voice");
        checkAborted();
        try {
          let voiceScript = promptPack.voiceScript;
          if (mode === "standard") {
            const voScenes = currentStoryboard.filter((s) => s.audio === "vo");
            if (voScenes.length > 0) {
              const voLines = voScenes
                .map((s) => (s as any).spokenLines || (s as any).scriptSnippet || "")
                .filter(Boolean)
                .join(" ");
              if (voLines.trim()) {
                voiceScript = voLines.trim();
              }
            }
          }
          const snapshotVoiceId = generationSettings.snapshot?.voice?.voiceId;
          const targetVoiceId = snapshotVoiceId || character?.voice?.voiceId || (brand as any)?.voice?.voiceId;
          const { generateElevenLabsVoice } = await import("../runtime/providers/elevenLabsTTS");
          const elevenVoice = await withTimeout(
            generateElevenLabsVoice(voiceScript, targetVoiceId, undefined, signal),
            45000,
            "ElevenLabs voice synthesis timed out after 45s",
            signal
          );
          checkAborted();
          if (isValidMediaData(elevenVoice)) {
            let voiceResult = elevenVoice;
            try {
              const storedAudio = await this.uploadAssetToStorage({
                productionId: production.id,
                brandId: (brand as any).id,
                assetType: "audio",
                storagePath: getStoragePath("audio/voice.mp3"),
                dataUrlOrBlob: elevenVoice,
                mimeType: "audio/mpeg",
                prompt: voiceScript,
                provider: "ElevenLabs",
              });
              if (storedAudio?.publicUrl) voiceResult = storedAudio.publicUrl;
            } catch (storageErr) {
              console.warn("[ProductionAssetService] Supabase audio upload failed, retaining provider audio URL:", storageErr);
            }
            realVoiceUrl = voiceResult;
          } else {
            checkAborted();
            const { generateSuperSparkVoice } = await import("../geminiService");
            const synthesizedVoice = await withTimeout(
              generateSuperSparkVoice(voiceScript),
              45000,
              "SuperSpark voice synthesis timed out after 45s",
              signal
            );
            checkAborted();
            if (isValidMediaData(synthesizedVoice)) {
              let voiceResult = synthesizedVoice;
              try {
                const storedAudio = await this.uploadAssetToStorage({
                  productionId: production.id,
                  brandId: (brand as any).id,
                  assetType: "audio",
                  storagePath: getStoragePath("audio/voice.mp3"),
                  dataUrlOrBlob: synthesizedVoice,
                  mimeType: "audio/wav",
                  prompt: voiceScript,
                  provider: "Google Gemini TTS",
                });
                if (storedAudio?.publicUrl) voiceResult = storedAudio.publicUrl;
              } catch (storageErr) {
                console.warn("[ProductionAssetService] Supabase audio upload failed, retaining provider audio URL:", storageErr);
              }
              realVoiceUrl = voiceResult;
            }
          }
        } catch (voiceErr: any) {
          if (voiceErr?.name === "AbortError" || signal?.aborted) throw voiceErr;
          console.warn("[ProductionAssetService] Real voice synthesis notice:", voiceErr);
          if (!lastError) lastError = `Voice: ${voiceErr?.message || String(voiceErr)}`;
        }
        markStage("voice", realVoiceUrl ? "done" : "failed");
      }

      await persistCurrentStage("Voice");
      markStage("keyframes", "active");
      emitProgress(20, "Keyframes", `Rendering ${aspectRatio} scene keyframes (Target Hero Frames)...`);
      void persistCurrentStage("Keyframes");
      startHeartbeat("Keyframes");

      // PART 1 — Official Shot Method: 1 Full-Bleed Keyframe Still Per Scene (All Modes)
      // FOR EACH scene: Generate 1 clean single-frame hero still conditioned on Character Sheet
      const sceneImages: string[] = [];
      const renderStartedAt = new Date().toISOString();

      // Durable location plate once per run — ephemeral fal/data URLs are re-hosted to Spark Storage
      let durableLocationPlateUrl = resolveLocationPlateUrl({
        snapshotPlateUrl: generationSettings.snapshot?.character?.locationPlateUrl,
        brandPlateUrl: brand.locationPlateUrl,
        brandSettings: (brand as any).settings,
      });
      if (durableLocationPlateUrl && needsLocationPlateStorageUpload(durableLocationPlateUrl)) {
        try {
          const brandIdForPlate = (brand as any)?.id;
          if (brandIdForPlate) {
            const { uploadLocationPlateToStorage } = await import("../../backend/workspaceSync");
            durableLocationPlateUrl = await uploadLocationPlateToStorage(brandIdForPlate, durableLocationPlateUrl);
            console.log(`[SPARK Pipeline] Location plate re-hosted to Storage -> ${durableLocationPlateUrl}`);
          }
        } catch (plateErr) {
          console.warn("[SPARK Pipeline] Location plate Storage upload notice:", plateErr);
        }
      }

      // PART 0 — Multi-panel storyboard SHEET; panels ARE scene stills (crop → scene.image)
      let hasRealStoryboardSheet = isRealStoryboardSheetUrl({
        storyboardGridUrl: realGridUrl,
        firstStillUrl: brief.generatedAssets?.generatedFrames?.[0],
      });
      /** Panel crops from the locked sheet — skip ModelRouter still regen when set. */
      const sheetPanelSceneUrls: (string | undefined)[] = new Array(currentStoryboard.length);

      const renderStoryboardSheetOnce = async (label: string): Promise<boolean> => {
        if (currentStoryboard.length === 0) return false;
        try {
          checkAborted();
          emitProgress(18, "Keyframes", `Rendering multi-panel storyboard sheet (${currentStoryboard.length} panels, ${label})...`);
          const sheetCompiled = compileLiveStoryboardSheetPrompt({ lookLaw, scenes: currentStoryboard,
            aspectRatio: identityPack.aspectRatio,
            productionId: production.id,
            brandName: brand?.name,
            environment: identityPack.environmentString || durableLocationPlateUrl,
            styleLook: brief.visualDirection || brand?.niche,
            contentFormat: effectiveContentFormat,
            formatSettings: activeFormatSettings,
            brief,
            frameLock,
            preferNativePanelGeometry: true,
          });
          const sheetFormat = getEffectiveContentFormat({ brand, formatSettings: activeFormatSettings, production, brief });
          const sheetLock = buildVisualLockRefsFromDirector({
            production,
            brand,
            character,
            locationPlateUrl: durableLocationPlateUrl,
            subjectType: sheetFormat === "faceless" ? "insert" : "main",
            contentFormat: sheetFormat,
          });
          if (sheetLock.directorNotes.length) {
            console.log(`[SPARK Pipeline] Director refs (sheet): ${sheetLock.directorNotes.join("; ")}`);
          }
          console.log(
            `[SPARK Pipeline] Provider Request: Storyboard SHEET (${sheetCompiled.layout}, ${sheetCompiled.panelCount} panels, ${label}) via ModelRouter ("storyboardImages")...`
          );
          const { ModelRouter: SheetRouter } = await import("../runtime/modelRouter");
          const sheetImgUrl = await withTimeout(
            SheetRouter.executeCategoryRequest("storyboardImages", {
              prompt: sheetCompiled.prompt,
              referenceImageUrl: sheetLock.primaryRefUrl,
              referenceImageUrls: sheetLock.imageUrls,
              aspectRatio: identityPack.aspectRatio,
                  preferredProvider: resolvedImageProvider,
                  model: resolvedImageModel,
            }),
            90000,
            "Storyboard sheet generation timed out after 90s",
            signal
          );
          checkAborted();
          if (isValidMediaData(sheetImgUrl)) {
            let finalSheet = sheetImgUrl;
            try {
              const storedSheet = await this.uploadAssetToStorage({
                productionId: production.id,
                brandId: (brand as any).id,
                assetType: "storyboard",
                storagePath: getStoragePath("storyboard/sheet-01.png"),
                dataUrlOrBlob: sheetImgUrl,
                mimeType: "image/png",
                prompt: sheetCompiled.prompt,
                provider: "ModelRouter",
              });
              if (storedSheet?.publicUrl) finalSheet = storedSheet.publicUrl;
              console.log(`[SPARK Pipeline] Storage Upload: Storyboard sheet -> ${finalSheet}`);
            } catch (sheetStoreErr) {
              console.warn("[SPARK Pipeline] Storyboard sheet upload notice:", sheetStoreErr);
            }
            realGridUrl = finalSheet;
            brief.storyboardGridUrl = finalSheet;
            if (!brief.generatedAssets) brief.generatedAssets = {};
            brief.generatedAssets.storyboardGridUrl = finalSheet;
            (brief.generatedAssets as any).storyboardSheetLayout = sheetCompiled.layout;
            (brief.generatedAssets as any).storyboardSheetPanelCount = sheetCompiled.panelCount;
            (brief.generatedAssets as any).frameLockId = frameLock.frameLockId;
            hasRealStoryboardSheet = true;
            emitProgress(20, "Keyframes", `Storyboard sheet locked (${sheetCompiled.sheetLabel}, ${frameLock.aspectRatio}). Validating panel geometry...`);
            void persistCurrentStage("Storyboard-Sheet");
            return true;
          }
          console.warn("[SPARK Pipeline] Storyboard sheet returned empty/invalid image — no parallel still pipeline");
          return hasRealStoryboardSheet;
        } catch (sheetErr: any) {
          if (sheetErr?.name === "AbortError" || signal?.aborted) throw sheetErr;
          console.warn("[SPARK Pipeline] Storyboard sheet generation notice:", sheetErr);
          if (!lastError) lastError = `Storyboard Sheet: ${sheetErr?.message || String(sheetErr)}`;
          return hasRealStoryboardSheet;
        }
      };

      if ((!hasRealStoryboardSheet || forceRegenerate) && currentStoryboard.length > 0) {
        await renderStoryboardSheetOnce(forceRegenerate ? "forceRegenerate" : "initial");
      }

      // PART 0b — Crop sheet panels → scene.image. Geometry miss: retry THE SHEET once, keep best crop.
      if (hasRealStoryboardSheet && realGridUrl && currentStoryboard.length > 0) {
        try {
          checkAborted();
          const layoutFromMeta = (brief.generatedAssets as any)?.storyboardSheetLayout as string | undefined;
          const panelCountForSheet = Math.min(
            currentStoryboard.length,
            Number((brief.generatedAssets as any)?.storyboardSheetPanelCount) || currentStoryboard.length
          );
          const sheetLayout =
            layoutFromMeta ||
            chooseNativePanelStoryboardLayout(Math.max(panelCountForSheet, 1));
          const grid = storyboardLayoutToGrid(sheetLayout, panelCountForSheet);
          emitProgress(
            21,
            "Keyframes",
            `Extracting ${panelCountForSheet} scene panels (${sheetLayout} ${grid.cols}×${grid.rows}, lock ${frameLock.aspectRatio})...`
          );
          const runExtract = () =>
            extractStoryboardSheetPanelsDetailed({
              sheetUrl: realGridUrl as string,
              layout: sheetLayout,
              panelCount: panelCountForSheet,
              frameLock,
            });
          let extracted = await runExtract();
          if (!extracted.geometryOk) {
            console.warn(
              `[SPARK Pipeline] Panel geometry gate FAILED — ${extracted.geometryReason}. Regenerating THE SHEET once (not native stills).`
            );
            await renderStoryboardSheetOnce("geometry-retry");
            extracted = await runExtract();
          }
          const sourceStill = extracted.geometryOk ? "storyboard_panel" : "storyboard_panel_needs_fix";
          if (!brief.generatedAssets) brief.generatedAssets = {};
          (brief.generatedAssets as any).storyboardPanelGeometry = {
            ok: extracted.geometryOk,
            reason: extracted.geometryReason,
            frameLockId: frameLock.frameLockId,
            sourceStill,
            panelCount: extracted.panels.length,
          };
          if (extracted.panels.length > 0) {
            console.log(
              `[SPARK Pipeline] Extracted ${extracted.panels.length}/${panelCountForSheet} sheet panels (${sourceStill}, ${frameLock.aspectRatio}) — using as scene stills`
            );
            for (let pIdx = 0; pIdx < extracted.panels.length && pIdx < currentStoryboard.length; pIdx++) {
              checkAborted();
              const globalSceneNum = currentStoryboard[pIdx].scene || pIdx + 1;
              let finalStill = extracted.panels[pIdx];
              let panelAssetId: string | undefined;
              try {
                const storedStill = await this.uploadAssetToStorage({
                  productionId: production.id,
                  brandId: (brand as any).id,
                  assetType: "image",
                  storagePath: getStoragePath(`scenes/scene-0${globalSceneNum}.png`),
                  dataUrlOrBlob: finalStill,
                  mimeType: "image/jpeg",
                  prompt: `Storyboard panel ${pIdx + 1} (${sheetLayout}, ${frameLock.aspectRatio}, ${sourceStill})`,
                  provider: "storyboardPanelExtract",
                  sceneId: currentStoryboard[pIdx]?.sceneId,
                  shotId: currentStoryboard[pIdx]?.shotId,
                  taskId: currentStoryboard[pIdx]?.generationTaskId,
                });
                if (storedStill?.assetId) {
                  panelAssetId = storedStill.assetId;
                }
                if (storedStill?.publicUrl && isPersistableSparkMediaUrl(storedStill.publicUrl)) {
                  finalStill = storedStill.publicUrl;
                } else if (isEphemeralMediaUrl(finalStill)) {
                  try {
                    const { ingestRemoteMediaToSpark } = await import("./ingestMediaToSpark");
                    const ingested = await ingestRemoteMediaToSpark({
                      url: finalStill,
                      brandId: (brand as any).id,
                      productionId: production.id,
                      assetType: "image",
                      storagePath: getStoragePath(`scenes/scene-0${globalSceneNum}.png`),
                      mimeType: "image/jpeg",
                    });
                    if (ingested?.publicUrl && isPersistableSparkMediaUrl(ingested.publicUrl)) {
                      finalStill = ingested.publicUrl;
                    }
                  } catch (ingestErr) {
                    console.warn(`[SPARK Pipeline] Fallback ingest notice for scene ${globalSceneNum} panel crop:`, ingestErr);
                  }
                }
                if (isEphemeralMediaUrl(finalStill)) {
                  throw new Error(`Scene ${globalSceneNum} panel crop could not be persisted to durable storage. Refusing to leak ephemeral media URL.`);
                }
                console.log(`[SPARK Pipeline] Storage Upload: Scene ${globalSceneNum} panel crop -> ${finalStill}`);
              } catch (storageErr) {
                console.warn(`[SPARK Pipeline] Scene ${globalSceneNum} panel crop upload notice:`, storageErr);
                if (isEphemeralMediaUrl(finalStill)) {
                  throw storageErr;
                }
              }
              sheetPanelSceneUrls[pIdx] = finalStill;
              const s = currentStoryboard[pIdx];
              s.image = finalStill;
              s.keyframeImageUrl = finalStill;
              (s as any).sourceStill = sourceStill;
              if (panelAssetId) {
                s.sourceImageAssetId = panelAssetId;
                s.stillAssetId = panelAssetId;
                s.assetIds = Array.from(new Set([...(s.assetIds || []), panelAssetId]));
              }
              attachSceneMotionLock(s, {
                environment: identityPack.environmentString,
                contentFormat: effectiveContentFormat,
                visualGenre: effectiveVisualGenre,
                cinematicCraft: activeFormatSettings.cinematicCraft !== false,
                sceneIndexZeroBased: pIdx,
                sourceStill,
                stillUrl: finalStill,
                beat: brief?.beats?.[pIdx],
              });
              currentStoryboard[pIdx] = {
                ...s,
                image: finalStill,
                keyframeImageUrl: finalStill,
                sourceImageAssetId: s.sourceImageAssetId,
                stillAssetId: s.stillAssetId,
                assetIds: s.assetIds,
                motionLock: (s as any).motionLock,
                physicalAction: (s as any).physicalAction,
              };
            }
            (brief.generatedAssets as any).storyboardPanelsExtracted = extracted.panels.length;
            emitProgress(
              22,
              "Keyframes",
              extracted.geometryOk
                ? `Locked ${extracted.panels.length} native ${frameLock.aspectRatio} panels (skipping still regen)...`
                : `Kept ${extracted.panels.length} best sheet crops after geometry miss (no invented stills)...`
            );
            void persistCurrentStage("Storyboard-Panels");
          } else {
            console.warn(
              "[SPARK Pipeline] Panel extract returned empty after sheet retry — not inventing full-bleed stills"
            );
          }
        } catch (panelErr: any) {
          if (panelErr?.name === "AbortError" || signal?.aborted) throw panelErr;
          console.warn("[SPARK Pipeline] Storyboard panel extract notice:", panelErr);
          if (!lastError) lastError = `Storyboard Panels: ${panelErr?.message || String(panelErr)}`;
        }
      }

      try {
        const { ModelRouter } = await import("../runtime/modelRouter");

        const needStillRegen =
          !hasRealStoryboardSheet &&
          currentStoryboard.some((_, i) => !isValidMediaData(sheetPanelSceneUrls[i]));
        if (hasRealStoryboardSheet) {
          emitProgress(23, "Keyframes", `Sheet exists — scene stills are board crops only (no still regen)...`);
        } else if (needStillRegen) {
          emitProgress(
            23,
            "Keyframes",
            `No storyboard sheet — rendering full-bleed scene stills (${aspectRatio})...`
          );
        } else {
          emitProgress(23, "Keyframes", `All scene stills sourced from storyboard panels — skipping still regen...`);
        }

        for (let sIdx = 0; sIdx < currentStoryboard.length; sIdx++) {
          checkAborted();
          const s = currentStoryboard[sIdx];
          const globalSceneNum = s.scene || sIdx + 1;

          // Panels on the sheet ARE the scene images — never re-generate when crop succeeded
          const panelStill = sheetPanelSceneUrls[sIdx];
          if (isValidMediaData(panelStill)) {
            console.log(`[SPARK Pipeline] Scene ${globalSceneNum} still = storyboard panel crop -> ${panelStill}`);
            sceneImages.push(panelStill as string);
            s.image = panelStill as string;
            s.keyframeImageUrl = panelStill as string;
            // Creative spine must already be frozen at panel extract; re-attach only if missing
            if (!(s as any).motionLock) {
              attachSceneMotionLock(s, {
                environment: identityPack.environmentString,
                contentFormat: effectiveContentFormat,
                visualGenre: effectiveVisualGenre,
                cinematicCraft: activeFormatSettings.cinematicCraft !== false,
                sceneIndexZeroBased: sIdx,
                sourceStill:
                  (s as any).sourceStill === "storyboard_panel_needs_fix"
                    ? "storyboard_panel_needs_fix"
                    : "storyboard_panel",
                stillUrl: panelStill as string,
                beat: brief?.beats?.[sIdx],
              });
            }
            currentStoryboard[sIdx] = {
              ...s,
              image: panelStill as string,
              keyframeImageUrl: panelStill as string,
              motionLock: (s as any).motionLock,
              physicalAction: (s as any).physicalAction,
            };
            const currentPctPanel = 20 + Math.round(((sIdx + 1) / currentStoryboard.length) * 35);
            emitProgress(
              currentPctPanel,
              "Keyframes",
              `Scene ${globalSceneNum} of ${currentStoryboard.length} locked from storyboard panel...`
            );
            void persistCurrentStage(`Scene-Still-${globalSceneNum}`);
            continue;
          }

          if (hasRealStoryboardSheet) {
            console.warn(
              `[SPARK Pipeline] Scene ${globalSceneNum}: sheet exists but no panel crop — not inventing a full-bleed still`
            );
            continue;
          }

          // Reuse only when bound to same shotId / scene number — never by array index alone
          const existingStill = findReusableStill({
            shotId: s.shotId || s.id,
            scene: globalSceneNum,
            storyboard: currentStoryboard,
            productionScenes: production.productionScenes,
            generatedFrames: brief.generatedAssets?.generatedFrames,
          });
          if (!forceRegenerate && isValidMediaData(existingStill)) {
            console.log(`[SPARK Pipeline] Reusing shot-bound Scene ${globalSceneNum} Still -> ${existingStill}`);
            sceneImages.push(existingStill);
            s.image = existingStill;
            s.keyframeImageUrl = existingStill;
            if (!(s as any).motionLock) {
              attachSceneMotionLock(s, {
                environment: identityPack.environmentString,
                contentFormat: effectiveContentFormat,
                visualGenre: effectiveVisualGenre,
                cinematicCraft: activeFormatSettings.cinematicCraft !== false,
                sceneIndexZeroBased: sIdx,
                sourceStill: "scene_still",
                stillUrl: existingStill,
                beat: brief?.beats?.[sIdx],
              });
            }
            currentStoryboard[sIdx] = {
              ...s,
              image: existingStill,
              keyframeImageUrl: existingStill,
              motionLock: (s as any).motionLock,
              physicalAction: (s as any).physicalAction,
            };
            continue;
          }

          // 1. Read contentFormat & beat subject (honor stamped subjects — no blanket faceless override)
          const contentFormat = getEffectiveContentFormat({ brand, formatSettings: activeFormatSettings, production, brief });
          const rawSubject = ((s as any).subject || (s as any).subjectType || brief.beats?.[sIdx]?.subject || "").toLowerCase();
          const resolvedSubject = resolveLiveBeatSubject({
            contentFormat,
            rawSubject,
            cameraDirection: s.cameraDirection,
            visualDescription: s.visualDescription || (s as any).description,
          });

          // Snapshot / durable plate is law — no live-brand improvisation mid-run
          const plateUrl = durableLocationPlateUrl;

          // SET shots: reuse locked plate as the still (do not invent a new empty room)
          if (shouldReuseLocationPlateAsStill({ resolvedSubject, locationPlateUrl: plateUrl })) {
            let finalStill = plateUrl as string;
            let plateAssetId: string | undefined;
            try {
              const storedStill = await this.uploadAssetToStorage({
                productionId: production.id,
                brandId: (brand as any).id,
                assetType: "image",
                storagePath: getStoragePath(`scenes/scene-0${globalSceneNum}.png`),
                dataUrlOrBlob: finalStill,
                mimeType: "image/png",
                prompt: "Locked set plate reuse (subject=set)",
                provider: "locationPlate",
                sceneId: s.sceneId,
                shotId: s.shotId,
                taskId: s.generationTaskId,
              });
              if (storedStill?.assetId) {
                plateAssetId = storedStill.assetId;
              }
              if (storedStill?.publicUrl && isPersistableSparkMediaUrl(storedStill.publicUrl)) {
                finalStill = storedStill.publicUrl;
              } else if (isEphemeralMediaUrl(finalStill)) {
                try {
                  const { ingestRemoteMediaToSpark } = await import("./ingestMediaToSpark");
                  const ingested = await ingestRemoteMediaToSpark({
                    url: finalStill,
                    brandId: (brand as any).id,
                    productionId: production.id,
                    assetType: "image",
                    storagePath: getStoragePath(`scenes/scene-0${globalSceneNum}.png`),
                    mimeType: "image/png",
                  });
                  if (ingested?.publicUrl && isPersistableSparkMediaUrl(ingested.publicUrl)) {
                    finalStill = ingested.publicUrl;
                  }
                } catch (ingestErr) {
                  console.warn(`[SPARK Pipeline] Fallback ingest notice for scene ${globalSceneNum} set plate:`, ingestErr);
                }
              }
              if (isEphemeralMediaUrl(finalStill)) {
                throw new Error(`Scene ${globalSceneNum} set plate could not be persisted to durable storage.`);
              }
              console.log(`[SPARK Pipeline] Set still reuses location plate Scene ${globalSceneNum} -> ${finalStill}`);
            } catch (storageErr) {
              console.warn(`[SPARK Pipeline] Scene ${globalSceneNum} set-plate copy notice:`, storageErr);
              if (isEphemeralMediaUrl(finalStill)) {
                throw storageErr;
              }
            }
            sceneImages.push(finalStill);
            if (sIdx === 0 && !hasRealStoryboardSheet) realGridUrl = finalStill;
            s.image = finalStill;
            s.keyframeImageUrl = finalStill;
            (s as any).subject = "set";
            (s as any).sourceStill = "scene_still";
            if (plateAssetId) {
              s.sourceImageAssetId = plateAssetId;
              s.stillAssetId = plateAssetId;
              s.assetIds = Array.from(new Set([...(s.assetIds || []), plateAssetId]));
            }
            attachSceneMotionLock(s, {
              environment: identityPack.environmentString,
              contentFormat: contentFormat,
              visualGenre: effectiveVisualGenre,
              cinematicCraft: activeFormatSettings.cinematicCraft !== false,
              sceneIndexZeroBased: sIdx,
              sourceStill: "scene_still",
              stillUrl: finalStill,
              beat: brief?.beats?.[sIdx],
            });
            currentStoryboard[sIdx] = {
              ...s,
              image: finalStill,
              keyframeImageUrl: finalStill,
              sourceImageAssetId: s.sourceImageAssetId,
              stillAssetId: s.stillAssetId,
              assetIds: s.assetIds,
              subject: "set",
              motionLock: (s as any).motionLock,
              physicalAction: (s as any).physicalAction,
            };
            const currentPctSet = 20 + Math.round(((sIdx + 1) / currentStoryboard.length) * 35);
            emitProgress(currentPctSet, "Keyframes", `Locked set plate for Scene ${globalSceneNum} of ${currentStoryboard.length}...`);
            void persistCurrentStage(`Scene-Still-${globalSceneNum}`);
            continue;
          }

          // 2. Resolve target character (if support has no sheet, fallback to main - no invented face!)
          const supportChar = (characters || []).find((c) => c.role === "support" || c.id !== character?.id) || (characters || [])[1];
          const hasSupportSheet = Boolean(supportChar?.characterSheetUrl || supportChar?.imageUrl);
          const activeChar = (resolvedSubject === "support" && hasSupportSheet) ? supportChar : character;

          // 3. Continuity Chaining: previous still URL as continuity ref when subject stays the same (chain)
          const prevSceneSubject = sIdx > 0 ? ((currentStoryboard[sIdx - 1] as any)?.subject || (brief.beats?.[sIdx - 1]?.subject)) : undefined;
          const isSameSubjectChain = sIdx > 0 && prevSceneSubject === resolvedSubject;
          const prevStillUrl = (isSameSubjectChain && sceneImages[sIdx - 1]) ? sceneImages[sIdx - 1] : undefined;

          const stillVisualLock = buildVisualLockRefsFromDirector({
            production,
            brand,
            character,
            supportCharacter: hasSupportSheet ? supportChar : undefined,
            storyboardGridUrl: realGridUrl,
            previousLastFrameUrl: prevStillUrl,
            locationPlateUrl: plateUrl,
            subjectType: resolvedSubject,
            contentFormat,
            sceneId: (s as any).sceneId || (s as any).id,
            shotId: (s as any).shotId || (s as any).id,
          });
          if (stillVisualLock.directorNotes.length && sIdx === 0) {
            console.log(`[SPARK Pipeline] Director refs (stills): ${stillVisualLock.directorNotes.join("; ")}`);
          }

          // Creative compile ONCE here (storyboard still time) — motion will follow this lock
          attachSceneMotionLock(s, {
            environment: identityPack.environmentString,
            contentFormat,
            visualGenre: effectiveVisualGenre,
            cinematicCraft: activeFormatSettings.cinematicCraft !== false,
            sceneIndexZeroBased: sIdx,
            sourceStill: "scene_still",
            beat: brief?.beats?.[sIdx],
          });

          // OS spine still prompt — subject line + Spec/frame compiler (AssetService does not invent creative text)
          const stillSubjectLine = buildStillSubjectLine({
            resolvedSubject,
            character,
            activeChar,
            contentFormat,
            visualGenre: effectiveVisualGenre,
          });
          const compiledStill = compileLiveStillPrompt({ lookLaw, scene: s,
            sceneIndexZeroBased: sIdx,
            aspectRatio: identityPack.aspectRatio,
            production,
            brief,
            memoryItems,
            refPromptHeader: stillVisualLock.refPromptHeader,
            subjectLine: stillSubjectLine,
            contentFormat,
          });
          const stillPrompt = compiledStill.prompt;
          if (compiledStill.shotId && !s.shotId) {
            (s as any).shotId = compiledStill.shotId;
          }

          const targetShotId = (s as any).shotId || s.id;
          const kfTask = tasks.find((t) => (t.shotId === targetShotId || t.id === `${targetShotId}_keyframe`) && t.kind === "keyframe");

          try {
            checkAborted();
            let stillImgUrl: string | undefined;
            if (engine && kfTask && spec) {
              console.log(`[SPARK Pipeline] Provider Request: Scene ${globalSceneNum} of ${currentStoryboard.length} still frame via canonical ExecutionEngine (${kfTask.id})...`);
              const res = await engine.executeTask({ spec, task: kfTask, priorOutputs });
              checkAborted();
              if (res.task.status === "succeeded") {
                stillImgUrl = res.asset?.publicUrl || (res.execution.outputAssets[0]?.sourceUrl as string);
                kfTask.status = "succeeded";
                kfTask.productionAssetId = res.asset?.id;
                if (stillImgUrl) priorOutputs[kfTask.id] = stillImgUrl;
              } else {
                kfTask.status = "failed";
                kfTask.lastError = res.task.lastError || "Keyframe generation failed";
                (s as any).lastError = kfTask.lastError;
                if (!lastError) lastError = `Scene ${globalSceneNum} Still: ${kfTask.lastError}`;
              }
            } else {
              console.log(`[SPARK Pipeline] Provider Request: Scene ${globalSceneNum} of ${currentStoryboard.length} still frame via ModelRouter ("storyboardImages") [Refs: ${stillVisualLock.imageUrls.length}, Subject: ${resolvedSubject}, Format: ${contentFormat}, Plate: ${plateUrl ? "yes" : "no"}]...`);
              stillImgUrl = await withTimeout(
                ModelRouter.executeCategoryRequest("storyboardImages", {
                  prompt: stillPrompt,
                  referenceImageUrl: stillVisualLock.primaryRefUrl,
                  referenceImageUrls: stillVisualLock.imageUrls,
                  aspectRatio: identityPack.aspectRatio,
                  preferredProvider: resolvedImageProvider,
                  model: resolvedImageModel,
                }),
                60000,
                `Scene ${globalSceneNum} still generation timed out after 60s`,
                signal
              );
            }
            checkAborted();

            if (isValidMediaData(stillImgUrl)) {
              let finalStill = stillImgUrl;
              let stillAssetId: string | undefined;
              try {
                const storedStill = await this.uploadAssetToStorage({
                  productionId: production.id,
                  brandId: (brand as any).id,
                  assetType: "image",
                  storagePath: getStoragePath(`scenes/scene-0${globalSceneNum}.png`),
                  dataUrlOrBlob: stillImgUrl,
                  mimeType: "image/png",
                  prompt: stillPrompt,
                  provider: "ModelRouter",
                  sceneId: s.sceneId,
                  shotId: s.shotId,
                  taskId: s.generationTaskId,
                });
                if (storedStill?.assetId) {
                  stillAssetId = storedStill.assetId;
                }
                if (storedStill?.publicUrl && isPersistableSparkMediaUrl(storedStill.publicUrl)) {
                  finalStill = storedStill.publicUrl;
                } else if (isEphemeralMediaUrl(finalStill)) {
                  try {
                    const { ingestRemoteMediaToSpark } = await import("./ingestMediaToSpark");
                    const ingested = await ingestRemoteMediaToSpark({
                      url: finalStill,
                      brandId: (brand as any).id,
                      productionId: production.id,
                      assetType: "image",
                      storagePath: getStoragePath(`scenes/scene-0${globalSceneNum}.png`),
                      mimeType: "image/png",
                    });
                    if (ingested?.publicUrl && isPersistableSparkMediaUrl(ingested.publicUrl)) {
                      finalStill = ingested.publicUrl;
                    }
                  } catch (ingestErr) {
                    console.warn(`[SPARK Pipeline] Fallback ingest notice for scene ${globalSceneNum} still:`, ingestErr);
                  }
                }
                if (isEphemeralMediaUrl(finalStill)) {
                  throw new Error(`Scene ${globalSceneNum} still could not be persisted to durable storage. Refusing to leak ephemeral provider URL.`);
                }
                console.log(`[SPARK Pipeline] Storage Upload: Scene ${globalSceneNum} Still -> ${finalStill}`);
              } catch (storageErr) {
                console.warn(`[SPARK Pipeline] Scene ${globalSceneNum} Still upload notice:`, storageErr);
                if (isEphemeralMediaUrl(finalStill)) {
                  throw storageErr;
                }
              }

              sceneImages.push(finalStill);
              if (sIdx === 0 && !hasRealStoryboardSheet) realGridUrl = finalStill;
              s.image = finalStill;
              s.keyframeImageUrl = finalStill;
              (s as any).subject = resolvedSubject;
              (s as any).sourceStill = "scene_still";
              if (stillAssetId) {
                s.sourceImageAssetId = stillAssetId;
                s.stillAssetId = stillAssetId;
                s.assetIds = Array.from(new Set([...(s.assetIds || []), stillAssetId]));
              }
              bindMotionLockStillUrl(s, finalStill);
              currentStoryboard[sIdx] = {
                ...s,
                image: finalStill,
                keyframeImageUrl: finalStill,
                sourceImageAssetId: s.sourceImageAssetId,
                stillAssetId: s.stillAssetId,
                assetIds: s.assetIds,
                subject: resolvedSubject,
                motionLock: (s as any).motionLock,
                physicalAction: (s as any).physicalAction,
              };
            } else {
              console.warn(`[SPARK Pipeline] Scene ${globalSceneNum} returned empty/invalid image data:`, String(stillImgUrl || "").slice(0, 100));
              if (!lastError) lastError = `Scene ${globalSceneNum} Still: No image bytes returned by provider`;
            }
          } catch (sceneErr: any) {
            if (sceneErr?.name === "AbortError" || signal?.aborted) throw sceneErr;
            console.error(`[SPARK Pipeline] Scene ${globalSceneNum} still generation failed:`, sceneErr);
            if (!lastError) lastError = `Scene ${globalSceneNum} Still: ${sceneErr?.message || String(sceneErr)}`;
          }

          const currentPct = 20 + Math.round(((sIdx + 1) / currentStoryboard.length) * 35);
          emitProgress(currentPct, "Keyframes", `Rendered Scene ${globalSceneNum} of ${currentStoryboard.length} still frame...`);
          void persistCurrentStage(`Scene-Still-${globalSceneNum}`);
        }
      } catch (imgErr: any) {
        if (imgErr?.name === "AbortError" || signal?.aborted) throw imgErr;
        console.error("[SPARK Pipeline] Visuals generation notice:", imgErr);
        if (!lastError) lastError = `Visuals Stage: ${imgErr?.message || String(imgErr)}`;
      }

      markStage("keyframes", sceneImages.length > 0 ? "done" : "failed");
      await persistCurrentStage("Keyframes");

      if (sceneImages.length > 0) {
        // Keep real multi-panel sheet URL — do not overwrite with first still
        if (!hasRealStoryboardSheet) {
          brief.storyboardGridUrl = sceneImages[0];
          if (!brief.generatedAssets) brief.generatedAssets = {};
          brief.generatedAssets.storyboardGridUrl = sceneImages[0];
        } else if (realGridUrl) {
          brief.storyboardGridUrl = realGridUrl;
          if (!brief.generatedAssets) brief.generatedAssets = {};
          brief.generatedAssets.storyboardGridUrl = realGridUrl;
        }
        if (!brief.generatedAssets) brief.generatedAssets = {};
        brief.generatedAssets.generatedFrames = sceneImages;
        // One-write mirror: keep brief + productionScenes + Spec shelves aligned after stills
        const stillSynced = syncProductionMediaStores({
          production: { ...production, brief, productionScenes: currentStoryboard },
          scenes: currentStoryboard.map((s, idx) => ({
            ...s,
            scene: s.scene || idx + 1,
            shotId: (s as any).shotId || (s as any).id,
            image: s.image || sceneImages[idx],
            keyframeImageUrl: s.keyframeImageUrl || s.image || sceneImages[idx],
          })),
        });
        Object.assign(brief, stillSynced.brief);
        currentStoryboard = stillSynced.productionScenes || currentStoryboard;
        if (stillSynced.reasoning) {
          (production as any).reasoning = stillSynced.reasoning;
        }
      }

      markStage("sfx", "active");
      emitProgress(55, "Sound FX", "Generating transition sound effects...");
      void persistCurrentStage("Sound FX");
      startHeartbeat("Sound FX");
      try {
        if (mode === "express" || mode === "standard") {
          const { generateElevenLabsSoundEffect } = await import("../runtime/providers/elevenLabsTTS");
          const sfxResult = await withTimeout(
            generateElevenLabsSoundEffect("short cinematic whoosh transition hit for slide change, clean studio, no music, no voice", 1.5, signal),
            30000,
            "Sound FX generation timed out after 30s",
            signal
          );
          if (isValidMediaData(sfxResult)) {
            try {
              const storedSfx = await this.uploadAssetToStorage({
                productionId: production.id,
                brandId: (brand as any).id,
                assetType: "audio",
                storagePath: getStoragePath("audio/sfx.mp3"),
                dataUrlOrBlob: sfxResult,
                mimeType: "audio/mpeg",
                prompt: "Narrator slide transition whoosh",
                provider: "ElevenLabs",
              });
              realSfxUrl = storedSfx?.publicUrl || sfxResult;
            } catch {
              realSfxUrl = sfxResult;
            }
            console.log(`[SPARK Pipeline] Sound FX ready -> ${realSfxUrl}`);
          }
        }
        markStage("sfx", realSfxUrl ? "done" : "done");
      } catch (sfxErr: any) {
        if (sfxErr?.name === "AbortError" || signal?.aborted) throw sfxErr;
        console.warn("[SPARK Pipeline] Sound FX notice:", sfxErr);
        markStage("sfx", "done");
      }
      await persistCurrentStage("Sound FX");

      markStage("video", "active");
      emitProgress(60, "Video", `Synthesizing ${mode.toUpperCase()} motion conditioned on single-scene keyframes...`);
      void persistCurrentStage("Video");
      startHeartbeat("Video");

      // PART 2 — Stills Drive Motion: 1 Video Generation Call Per Scene (Standard & Deep)
      const sceneClips: string[] = [];

      checkAborted();

      // Stored production generation fingerprint comparison
      const prevProdDuration =
        (production as any)?.formatSettings?.targetDurationSec ??
        (production as any)?.targetDurationSec ??
        brief?.targetDurationSec ??
        (brief as any)?.formatSettings?.targetDurationSec;

      const prevProdMode = (production as any)?.productionMode || (brief as any)?.productionMode;
      const prevProdProvider = (production as any)?.formatSettings?.preferredVideoProvider || (brief as any)?.formatSettings?.preferredVideoProvider;
      const prevProdAspect = (production as any)?.formatSettings?.aspectMode || (brief as any)?.formatSettings?.aspectMode;

      const currentDuration = activeFormatSettings?.targetDurationSec || 60;
      const currentMode = mode;
      const currentProvider = activeFormatSettings?.preferredVideoProvider || "auto";
      const currentAspect = activeFormatSettings?.aspectMode || "portrait";

      const durationMatches = typeof prevProdDuration === "number" && prevProdDuration === currentDuration;
      const modeMatches = typeof prevProdMode === "string" && prevProdMode === currentMode;
      const providerMatches = typeof prevProdProvider === "string" && prevProdProvider === currentProvider;
      const aspectMatches = typeof prevProdAspect === "string" && prevProdAspect === currentAspect;

      const canReuseExistingVideo = !forceRegenerate && durationMatches && modeMatches && providerMatches && aspectMatches;

      let existingVideoCandidate = canReuseExistingVideo
        ? [
            production.videoUrl,
            brief.videoUrl,
            brief.generatedAssets?.generatedVideos?.[0],
            ...(brief.storyboard?.map((s) => s.videoUrl) || []),
          ].find((u) => isPersistableSparkMediaUrl(u))
        : undefined;

      if (canReuseExistingVideo && existingVideoCandidate) {
        realVideoUrl = existingVideoCandidate;
        console.log(`[SPARK Pipeline] Reusing existing verified durable master video (${currentDuration}s ${currentMode}) -> ${realVideoUrl}`);
      } else if (canReuseExistingVideo) {
        console.log("[SPARK Pipeline] No verified durable video in memory/brief. Attempting Storage refetch before AI video generation...");
        const refetched = await ProductionAssetService.refetchVideoFromStorage({
          productionId: production.id,
          brandId: (brand as any).id,
        });
        if (refetched.videoUrl && isDurableMasterVideoReady(refetched.videoUrl)) {
          realVideoUrl = refetched.videoUrl;
          if (refetched.sceneClips?.length) {
            sceneClips.push(...refetched.sceneClips);
          }
          console.log(`[SPARK Pipeline] Refetched existing verified durable video from Storage -> ${realVideoUrl}`);
          if (currentStoryboard.length > 0 && refetched.sceneClips?.length) {
            currentStoryboard.forEach((s, idx) => {
              s.videoUrl = refetched.sceneClips?.[idx] || undefined;
            });
          }
        }
      } else if (!forceRegenerate) {
        console.log(`[SPARK Pipeline] Generation parameters changed (target: ${currentDuration}s ${currentMode} [${currentProvider} · ${currentAspect}], prev: ${prevProdDuration}s ${prevProdMode} [${prevProdProvider} · ${prevProdAspect}]). Skipping stale video reuse and synthesizing fresh video.`);
      }

      if (!realVideoUrl) {
        try {
          const isExpressNarrator = skipI2V;

          if (isExpressNarrator) {
            // NARRATOR PIPELINE (express): Compile stills + voiceover into video without calling videoGeneration provider
            console.log(`[SPARK Pipeline] Mode is "${mode}" (Narrator). Compiling ordered stills + voiceover narration into master MP4 (0 AI video credits burned).`);
            emitProgress(70, "Compile", "Compiling Narrator slideshow video from single-scene stills & voiceover...");

            try {
              const targetImages = sceneImages.length > 0 ? sceneImages : (currentStoryboard.map((s) => s.image).filter(Boolean) as string[]);

              if (targetImages.length === 0) {
                throw new Error("Narrator compilation requires generated keyframe still images (0 stills available).");
              }
              if (!realVoiceUrl) {
                throw new Error("Narrator compilation requires a generated voice audio track (realVoiceUrl missing).");
              }

              const { compileNarratorSlideshowVideo } = await import("./narratorVideoCompiler");
              const compileResult = await withTimeout(
                compileNarratorSlideshowVideo({
                  imageUrls: targetImages,
                  audioUrl: realVoiceUrl,
                  sfxUrl: realSfxUrl,
                  totalDurationSec: activeFormatSettings?.targetDurationSec || 60,
                  width: compileWidth,
                  height: compileHeight,
                }),
                Math.max(60000, (activeFormatSettings?.targetDurationSec || 60) * 1000 + 60000),
                "Narrator slideshow compilation exceeded its duration budget",
                signal
              );

              if (compileResult && compileResult.blob && compileResult.blob.size > 0) {
                const ext = compileResult.extension || (compileResult.mimeType.includes("mp4") ? "mp4" : "webm");
                const storedCompiledVid = await this.uploadAssetToStorage({
                  productionId: production.id,
                  brandId: (brand as any).id,
                  assetType: "video",
                  storagePath: getStoragePath(`video/master.${ext}`),
                  dataUrlOrBlob: compileResult.blob,
                  mimeType: compileResult.mimeType || `video/${ext}`,
                  prompt: "Narrator compiled slideshow video with voiceover muxing",
                  provider: "NarratorSlideshowCompiler",
                });
                if (storedCompiledVid?.publicUrl) {
                  realVideoUrl = storedCompiledVid.publicUrl;
                  production.videoUrl = realVideoUrl;
                  (production as any).playablePreviewUrl = realVideoUrl;
                  (production as any).videoStoragePath = storedCompiledVid.storagePath;
                  sceneClips.length = 0;
                  // In Narrator mode: production.videoUrl = master, scenes stay still-only (scene.videoUrl undefined)
                  currentStoryboard.forEach((s) => {
                    s.videoUrl = undefined;
                  });
                  console.log(`[SPARK Pipeline] Storage Upload: Narrator Compiled Video (${compileResult.mimeType}, ${Math.round(compileResult.durationSec)}s) -> ${realVideoUrl}`);

                  if (!isSparkStorageUrl(realVideoUrl)) {
                    void import("./ingestMediaToSpark").then(({ scheduleAutoIngestMedia }) => {
                      scheduleAutoIngestMedia({
                        url: realVideoUrl!,
                        brandId: (brand as any).id,
                        productionId: production.id,
                        assetType: "video",
                        storagePath: getStoragePath(`video/master.${ext}`),
                        onSuccess: (sparkUrl) => {
                          production.videoUrl = sparkUrl;
                          (production as any).playablePreviewUrl = sparkUrl;
                        },
                      });
                    });
                  }
                } else {
                  throw new Error("Narrator compiled video upload failed to return a verified video URL.");
                }
              } else {
                throw new Error("Narrator slideshow compiler produced an empty video blob.");
              }
            } catch (compilerErr: any) {
              console.warn("[SPARK Pipeline] Narrator video compiler exception:", compilerErr);
              lastError = `Narrator video compiler error: ${compilerErr.message || String(compilerErr)}`;
              realVideoUrl = undefined;
            }
          } else {
            // HYBRID (standard) & CINEMATIC (deep): Official Shot Method — 1 videoGeneration call per scene conditioned on THAT scene's still
            const { ModelRouter } = await import("../runtime/modelRouter");
            const activeVideo = resolveActiveVideoProvider({
              preferredVideoProvider: (preferredVideoProvider || activeFormatSettings?.preferredVideoProvider) as any,
            });
            const { resolveMaxNativeClipSec, resolveAllowedDurationsSec } = await import("../runtime/providerCapabilities");
            const nativeMaxClipSec = resolveMaxNativeClipSec(activeVideo.providerId, preferredVideoModel);
            const allowedDurationsSec = resolveAllowedDurationsSec(activeVideo.providerId, preferredVideoModel);
            const charSheetUrl = character?.characterSheetUrl || character?.imageUrl || character?.avatarUrl;

            for (let sIdx = 0; sIdx < currentStoryboard.length; sIdx++) {
              checkAborted();
              const s = currentStoryboard[sIdx];
              const globalSceneNum = s.scene || sIdx + 1;

              const plannedVisual = spec?.scenes.flatMap(scene => scene.shots).find(shot => shot.id === (s.shotId || s.id))?.visualPlan;
              if (plannedVisual?.kind === "IMAGE") {
                s.videoUrl = undefined;
                continue;
              }

              if (skipI2V) {
                console.log(
                  `[SPARK Pipeline] Mode Gate: Scene ${globalSceneNum} skipI2V is active — still + VO path only; no video model.`
                );
                s.videoUrl = undefined;
                continue;
              }

              // HYBRID (standard) mode: respect beat audio ("vo" | "talent")
              // "talent beat: still → i2v from THAT still as firstFrame, NO ElevenLabs on that beat. vo beat: still stays still, ElevenLabs only for those lines."
              if (mode === "standard" && resolveSceneGeneratePlan(mode, s).stillOnly && plannedVisual?.kind !== "VIDEO") {
                console.log(
                  `[SPARK Pipeline] Hybrid Mode: Scene ${globalSceneNum} audio is "vo" — still stays still (no motion synthesis).`
                );
                s.videoUrl = undefined;
                continue;
              }

              const chapterDur = s.durationSec;
              if (typeof chapterDur !== "number" || chapterDur <= 0 || isNaN(chapterDur)) {
                throw new Error(`Chapter ${globalSceneNum} missing required durationSec.`);
              }

              const subclipDurations = calculateSubclipDurations(chapterDur, nativeMaxClipSec, allowedDurationsSec);
              const subclipCount = subclipDurations.length;
              const spokenChars = (s.spokenLines || "").length;

              console.log(
                formatChapterClipLog({
                  chapterIndex: globalSceneNum,
                  chapterDur,
                  maxNativeSec: nativeMaxClipSec,
                  subclipCount,
                  spokenChars,
                  fullScriptLength: (scriptToEval?.fullSpokenScript || "").length,
                })
              );

              const prevScene = sIdx > 0 ? currentStoryboard[sIdx - 1] : undefined;
              const shotIdForScene = (s as any).shotId || (s as any).id || `shot_${globalSceneNum}`;
              const prevShotId =
                (prevScene as any)?.shotId || (prevScene as any)?.id || (sIdx > 0 ? `shot_${sIdx}` : undefined);

              // Check if existing durable clip exists for this scene
              if (!forceRegenerate && isValidMediaData(s.videoUrl) && isDurableMasterVideoReady(s.videoUrl)) {
                console.log(`[SPARK Pipeline] Reusing existing Scene ${globalSceneNum} video clip -> ${s.videoUrl}`);
                sceneClips.push(s.videoUrl);
                if (sIdx === 0 && !realVideoUrl) realVideoUrl = s.videoUrl;

                // Ensure last frame is extracted for clip N+1 continuity if missing
                if (!s.lastFrameUrl) {
                  try {
                    const extracted = await extractVideoLastFrame(s.videoUrl);
                    if (extracted?.blob) {
                      const storedLast = await this.uploadAssetToStorage({
                        productionId: production.id,
                        brandId: (brand as any).id,
                        assetType: "image",
                        storagePath: getStoragePath(`scenes/scene-0${globalSceneNum}-last.jpg`),
                        dataUrlOrBlob: extracted.blob,
                        mimeType: "image/jpeg",
                        prompt: `Last frame of Scene ${globalSceneNum}`,
                        provider: "VideoFrameExtractor",
                      });
                      if (storedLast?.publicUrl) {
                        s.lastFrameUrl = storedLast.publicUrl;
                        const gsf = stampSceneGeneratedStateFrame({
                          productionId: production.id,
                          shotId: shotIdForScene,
                          videoUrl: s.videoUrl,
                          lastFrameUrl: storedLast.publicUrl,
                          sceneIndexZeroBased: sIdx,
                        });
                        (s as any).generatedStateFrame = gsf;
                        currentStoryboard[sIdx] = { ...s, lastFrameUrl: storedLast.publicUrl };
                        console.log(`[SPARK Pipeline] Storage Upload: Scene ${globalSceneNum} Last Frame (reused) -> ${s.lastFrameUrl}`);
                      }
                    }
                  } catch (extErr) {
                    console.warn(`[SPARK Pipeline] Notice extracting last frame for existing Scene ${globalSceneNum}:`, extErr);
                  }
                }
                continue;
              }

              // Ensure prev last frame exists before CONTINUATION (extract from prev clip if needed)
              if (sIdx > 0 && prevScene?.videoUrl && !isValidMediaData(prevScene.lastFrameUrl)) {
                try {
                  const extractedPrev = await extractVideoLastFrame(prevScene.videoUrl);
                  if (extractedPrev?.blob) {
                    const storedPrevLast = await this.uploadAssetToStorage({
                      productionId: production.id,
                      brandId: (brand as any).id,
                      assetType: "image",
                      storagePath: getStoragePath(`scenes/scene-0${sIdx}-last.jpg`),
                      dataUrlOrBlob: extractedPrev.blob,
                      mimeType: "image/jpeg",
                      prompt: `Last frame of Scene ${sIdx} (pre-continuation extract)`,
                      provider: "VideoFrameExtractor",
                    });
                    if (storedPrevLast?.publicUrl) {
                      prevScene.lastFrameUrl = storedPrevLast.publicUrl;
                      currentStoryboard[sIdx - 1] = { ...prevScene, lastFrameUrl: storedPrevLast.publicUrl };
                      console.log(
                        `[SPARK Pipeline] Pre-continuation extract: Scene ${sIdx} LAST -> ${storedPrevLast.publicUrl}`
                      );
                    }
                  }
                } catch (preExtErr) {
                  console.warn(`[SPARK Pipeline] Pre-continuation last-frame extract notice Scene ${sIdx}:`, preExtErr);
                }
              }

              const nextScene = currentStoryboard[sIdx + 1];
              const continuityPlan = resolveLiveSceneContinuity({
                productionId: production.id,
                sceneIndexZeroBased: sIdx,
                shotId: shotIdForScene,
                sceneStillUrl: s.image || sceneImages[sIdx],
                previousLastFrameUrl: prevScene?.lastFrameUrl,
                previousShotId: prevShotId,
                nextSceneStillUrl: nextScene?.image || sceneImages[sIdx + 1],
                nextShotId: (nextScene as any)?.shotId || (nextScene as any)?.id,
                preferContinuation: sIdx > 0,
              });
              const officialI2v = resolveOfficialI2vClipFrames({
                sceneImage: s.image,
                keyframeUrl: (s as any).keyframeImageUrl || (s as any).keyframe,
                generatedFrameUrl: sceneImages[sIdx],
                previousLastFrameUrl: prevScene?.lastFrameUrl,
                plannedEndUrl: nextScene?.image || sceneImages[sIdx + 1] || continuityPlan.endFrameUrl,
                forbidden: {
                  gridUrl: realGridUrl,
                  sheetUrls: [
                    character?.characterSheetUrl,
                    character?.imageUrl,
                    character?.avatarUrl,
                    ...Object.values(brief.generatedAssets?.propSheets || {}).filter(u => typeof u === "string" && isPersistableSparkMediaUrl(u)),
                    ...Object.values(brief.generatedAssets?.wardrobeSheets || {}).filter(u => typeof u === "string" && isPersistableSparkMediaUrl(u)),
                  ],
                  plateUrl: durableLocationPlateUrl,
                },
                sceneLabel: `Scene ${globalSceneNum}`,
              });
              let sceneFirstFrame = officialI2v.firstFrameUrl;
              const sceneEndFrame = officialI2v.endFrameUrl;
              const sceneLastFrame = officialI2v.lastFrameUrl;
              if (continuityPlan.continuityGap) {
                console.warn(
                  `[SPARK Pipeline] Continuity GAP Scene ${globalSceneNum}: ${continuityPlan.gapReason}`
                );
              }
              console.log(
                `[SPARK Pipeline] Official I2V Scene ${globalSceneNum}: frame1=panel/shot still lastFrame=${Boolean(sceneLastFrame)} nextPanel=${Boolean(nextScene?.image || sceneImages[sIdx + 1])} (continuityPlan mode=${continuityPlan.mode})`
              );

              // Consistency Gate: scene image must exist
              if (!sceneFirstFrame || !isValidMediaData(sceneFirstFrame)) {
                const errMsg = "Still required before motion.";
                console.error(`[SPARK Pipeline] ${errMsg} Scene ${globalSceneNum} still frame is missing or invalid.`);
                s.status = "failed";
                s.lastError = errMsg;
                currentStoryboard[sIdx] = { ...s, status: "failed", lastError: errMsg };
                continue;
              }

              // 1. Resolve content format & subject rules (honor stamped beat subjects)
              const effectiveContentFormat = getEffectiveContentFormat({ brand, formatSettings: activeFormatSettings });
              const rawSubject = ((s as any).subject || (s as any).subjectType || "").toLowerCase();
              const resolvedMotionSubject = resolveLiveBeatSubject({
                contentFormat: effectiveContentFormat,
                rawSubject,
                cameraDirection: s.cameraDirection,
                visualDescription: s.visualDescription || (s as any).description,
              });
              const isInsertOrSet =
                resolvedMotionSubject === "insert" || resolvedMotionSubject === "set";
              const isSupportSubject = resolvedMotionSubject === "support";

              // 2. Resolve character sheet reference (never used for insert/set)
              const supportChar = !isInsertOrSet && isSupportSubject
                ? (characters || []).find((c) => c.role === "support" || c.id !== character?.id) || (characters || [])[1]
                : undefined;
              const activeChar = isSupportSubject
                ? ((supportChar?.characterSheetUrl || supportChar?.imageUrl) ? supportChar : character)
                : (!isInsertOrSet ? character : undefined);

              // 3. Asset Director Spec masters → pixel refs (identity + location)
              const motionDirector = resolveDirectorPixelRefs({
                production,
                subjectType: resolvedMotionSubject,
                contentFormat: effectiveContentFormat,
                sceneId: (s as any).sceneId || (s as any).id,
                shotId: (s as any).shotId || (s as any).id,
                brand,
                character,
                supportCharacter: supportChar,
                runtimeLocationPlateUrl:
                  durableLocationPlateUrl ||
                  brand.locationPlateUrl ||
                  (brand as any).settings?.locationPlateUrl ||
                  (brand as any).settings?.location_plate_url,
              });
              const motionMerged = mergeDirectorIdentityForLock({ director: motionDirector });
              const sceneCharSheetUrl =
                (isSupportSubject
                  ? motionMerged.supportUrls[0] || motionMerged.identityUrls[0]
                  : motionMerged.identityUrls[0]) ||
                activeChar?.characterSheetUrl ||
                activeChar?.imageUrl ||
                activeChar?.avatarUrl;
              const validPlate =
                motionMerged.locationPlateUrl && isValidMediaData(motionMerged.locationPlateUrl)
                  ? motionMerged.locationPlateUrl
                  : undefined;

              const propSheetUrls = Object.values(brief.generatedAssets?.propSheets || {});
              if (
                (sceneCharSheetUrl && sceneFirstFrame === sceneCharSheetUrl) ||
                (validPlate && sceneFirstFrame === validPlate) ||
                propSheetUrls.includes(sceneFirstFrame)
              ) {
                throw new Error(
                  `I2V Scene ${globalSceneNum}: start frame must be this shot's still, not a character sheet, location plate, or prop sheet.`
                );
              }


              // 4. Resolve Production Elements & Shot-level needed tags
              const productionElementPack = buildProductionElementPack({
                character: activeChar || character,
                supportCharacter: supportChar,
                characters,
                brand,
                locationPlateUrl: durableLocationPlateUrl || validPlate,
                directorIdentityUrls: motionMerged.identityUrls,
                directorSupportUrls: motionMerged.supportUrls,
                directorPropUrl: motionMerged.propUrl,
                propUrls: [
                  ...(motionMerged.propUrl ? [{ url: motionMerged.propUrl }] : []),
                  ...Object.entries(brief.generatedAssets?.propSheets || {}).filter(([, url]) => typeof url === "string" && isPersistableSparkMediaUrl(url)).map(([tag, url]) => ({ tag, url })),
                ],
                assetBible: brief.assetBible,
              });
              const explicitTags = (s as any).elementTags || (s as any).neededTags || (s as any).tags;
              const neededTags = explicitTags || inferNeededTagsFromScene(s, brief.assetBible);
              const shotElements = resolveElementsForShot(
                productionElementPack,
                neededTags,
                resolvedMotionSubject
              ).filter((e) => e.url !== sceneFirstFrame && e.url !== sceneEndFrame);

              const identityRefs: string[] = [];
              const addIdentityRef = (url?: string | null) => {
                if (!url || !isValidMediaData(url)) return;
                const trimmed = url.trim();
                if (trimmed === sceneFirstFrame || trimmed === sceneEndFrame) return;
                if (!identityRefs.includes(trimmed)) {
                  identityRefs.push(trimmed);
                }
              };

              // Step 1: Fixed order for I2V:
              // 1. characterSheetUrl (brand/character sheet — identity lock)
              addIdentityRef(sceneCharSheetUrl);
              if (supportChar) {
                const supportSheetUrl =
                  motionMerged.supportUrls[0] ||
                  supportChar.characterSheetUrl ||
                  supportChar.imageUrl ||
                  supportChar.avatarUrl;
                addIdentityRef(supportSheetUrl);
              }

              // 4. optional location plate
              addIdentityRef(validPlate);

              // 5. Shot elements (props, wardrobe, etc.)
              for (const el of shotElements) {
                addIdentityRef(el.url);
              }

              const continuity = evaluateVisualContinuity({
                sceneIndex: sIdx,
                firstFrameUrl: sceneFirstFrame,
                previousLastFrameUrl: prevScene?.lastFrameUrl,
                identityRefUrls: identityRefs,
              });
              if (!continuity.ok || continuityPlan.continuityGap) {
                console.warn(
                  `[SPARK Pipeline] Visual continuity notice Scene ${globalSceneNum}:`,
                  [...continuity.reasons, continuityPlan.gapReason].filter(Boolean).join("; ")
                );
              }

              let subclipStartFrame = sceneFirstFrame;
              let currentChapterLastFrame: string | undefined = undefined;
              const chapterSubclips: string[] = [];

              for (let k = 0; k < subclipCount; k++) {
                checkAborted();
                const subclipDur = subclipDurations[k];
                const isFirstSubclip = k === 0;
                const isLastSubclip = k === subclipCount - 1;
                const subclipLabel = subclipCount > 1 ? ` (part ${k + 1}/${subclipCount})` : "";
                const subclipIndexNum = subclipCount > 1 ? `${globalSceneNum}-${k + 1}` : `${globalSceneNum}`;

                const subclipPrevLast = isFirstSubclip
                  ? (sIdx > 0 ? prevScene?.lastFrameUrl : undefined)
                  : currentChapterLastFrame;
                const subclipPlannedEnd = isLastSubclip
                  ? (sceneEndFrame || sceneLastFrame)
                  : undefined;

                const isChainingLastFrame = Boolean(subclipPlannedEnd || subclipPrevLast);
                const subclipRefLabels: string[] = [
                  `INPUT REF [1]: First Frame Keyframe (Scene ${globalSceneNum}${subclipLabel} shot still)`,
                ];
                if (isChainingLastFrame) {
                  subclipRefLabels.push(`INPUT REF [lastFrame]: Next panel crop (or previous last-frame extract as fallback)`);
                }
                for (const el of shotElements) {
                  subclipRefLabels.push(`ELEMENT ${el.tag} → ${el.label} (${el.description || el.role})`);
                }

                const sceneMotionCompiled = compileLiveMotionPrompt({
                  lookLaw,
                  mode,
                  aspectRatio: identityPack.aspectRatio,
                  sceneIndex: globalSceneNum,
                  totalScenes: currentStoryboard.length,
                  durationSec: subclipDur,
                  scene: s,
                  refLabels: subclipRefLabels,
                  isInsertOrSet,
                  characterName: activeChar?.name,
                  characterStyle: activeChar?.style,
                  environment: identityPack.environmentString,
                  brief,
                  contentFormat: effectiveContentFormat,
                  followStoryboardStill: true,
                  elements: shotElements,
                  shotDirection: (s as any).shotDirection,
                });
                const sceneMotionPrompt = sceneMotionCompiled.prompt;
                (s as any).shotDirection = sceneMotionCompiled.shotDirection;
                if (s.motionLock) {
                  (s.motionLock as any).shotDirection = sceneMotionCompiled.shotDirection;
                }

                const videoTimeoutMs = isI2vApiProvider(activeVideo.providerId) ? 20 * 60 * 1000 : 360000;
                const hasStill = Boolean(subclipStartFrame);
                const hasSheet = Boolean(sceneCharSheetUrl || identityRefs.length > 0);
                const hasLastFrame = Boolean(subclipPrevLast);
                const spokenLength = (s.spokenLines || "").length;
                console.log(
                  `[SPARK Pipeline] Motion Submit: provider=${activeVideo.providerId} hasStill=${hasStill} hasSheet=${hasSheet} hasLastFrame=${hasLastFrame} duration=${subclipDur} spokenLength=${spokenLength}`
                );
                console.log(
                  `[SPARK Pipeline] Provider Request: Scene ${globalSceneNum}${subclipLabel} of ${currentStoryboard.length} I2V (${mode.toUpperCase()}) via ${activeVideo.providerId} [still=${Boolean(subclipStartFrame)}, lastFrame=${Boolean(subclipPrevLast)}, Dur: ${subclipDur}s, Refs: ${identityRefs.length}]...`
                );

                try {
                  checkAborted();
                  const generateSubclip = async (): Promise<{ url: string; lastFrameDataUrl?: string; provider: string; assetId?: string }> => {
                    const allI2vCandidates = [
                      "grok",
                      "kling",
                      "seedance",
                      "ark",
                      ...(resolveProviderKey("higgsfield") || isServerProviderAvailable("higgsfield") ? ["higgsfield"] : []),
                    ];
                    const i2vFallbacks = allI2vCandidates.filter(
                      (p) => p !== String(activeVideo.providerId || "").toLowerCase()
                    );

                    // Durable first frame & refs before I2V
                    if (subclipStartFrame && (subclipStartFrame.startsWith("data:") || isEphemeralMediaUrl(subclipStartFrame))) {
                      try {
                        const ingested = await ProductionAssetService.uploadAssetToStorage({
                          productionId: production.id,
                          brandId: (brand as any)?.id,
                          assetType: "image",
                          storagePath: `tmp-ingest-firstframe-${Date.now()}-${Math.floor(Math.random() * 1000)}.png`,
                          dataUrlOrBlob: subclipStartFrame,
                          mimeType: "image/png",
                          prompt: sceneMotionPrompt,
                          provider: "PipelineIngest",
                        });
                        if (ingested?.publicUrl && isPersistableSparkMediaUrl(ingested.publicUrl)) {
                          subclipStartFrame = ingested.publicUrl;
                        } else {
                          throw new Error("Ingest succeeded but returned non-persistable URL.");
                        }
                      } catch (err: any) {
                        throw new Error(`Consistency Gate: Failed to persist ephemeral first frame for Scene ${globalSceneNum}. I2V requires durable HTTPS. (${err.message})`);
                      }
                    }

                    if (identityRefs && identityRefs.length > 0) {
                      const upgradedRefs = await Promise.all(identityRefs.map(async (ref) => {
                        if (!ref) return null;
                        if (ref.startsWith("data:") || isEphemeralMediaUrl(ref)) {
                          try {
                            const ingested = await ProductionAssetService.uploadAssetToStorage({
                              productionId: production.id,
                              brandId: (brand as any)?.id,
                              assetType: "image",
                              storagePath: `tmp-ingest-ref-${Date.now()}-${Math.floor(Math.random() * 1000)}.png`,
                              dataUrlOrBlob: ref,
                              mimeType: "image/png",
                              prompt: "Visual Lock Ref",
                              provider: "PipelineIngest",
                            });
                            return (ingested?.publicUrl && isPersistableSparkMediaUrl(ingested.publicUrl)) ? ingested.publicUrl : null;
                          } catch {
                            return null;
                          }
                        }
                        return ref;
                      }));
                      identityRefs.length = 0;
                      identityRefs.push(...(upgradedRefs.filter(Boolean) as string[]));
                    }

                    // Skip submit if durable video already exists for this scene and !forceRegenerate
                    if (!forceRegenerate && isValidMediaData(s.videoUrl) && isDurableMasterVideoReady(s.videoUrl)) {
                      console.log(`[SPARK Pipeline] Skipping I2V submit: Scene ${globalSceneNum} already has durable videoUrl.`);
                      return { url: s.videoUrl, provider: (s as any).videoProvider || activeVideo.providerId };
                    }

                    const targetShotId = shotIdForScene || (s as any).shotId || s.id;
                    const videoTask = tasks.find((t) => (t.shotId === targetShotId || t.id === `${targetShotId}_video`) && t.kind === "video");

                    if (engine && videoTask && spec) {
                      console.log(`[SPARK Pipeline] Provider Request: Scene ${globalSceneNum}${subclipLabel} video task via canonical ExecutionEngine (${videoTask.id})...`);
                      const res = await engine.executeTask({ spec, task: videoTask, priorOutputs });
                      if (res.task.status === "succeeded") {
                        const clipUrl = res.asset?.publicUrl || (res.execution.outputAssets[0]?.sourceUrl as string);
                        videoTask.status = "succeeded";
                        videoTask.productionAssetId = res.asset?.id;
                        if (clipUrl) priorOutputs[videoTask.id] = clipUrl;
                        return { url: clipUrl, provider: res.execution.provider || activeVideo.providerId, assetId: res.asset?.id };
                      } else {
                        videoTask.status = res.task.status;
                        videoTask.lastError = res.task.lastError || "Video task execution failed";
                        (s as any).lastError = videoTask.lastError;
                        throw new Error(videoTask.lastError);
                      }
                    }

                    const tryI2v = async (providerId: string) => {
                      const normP = providerId.toLowerCase();
                      const isHf = normP === "higgsfield" || normP === "higgsfield-seedance";
                      const effectiveRefs =
                        normP === "grok"
                          ? identityRefs.slice(0, 7)
                          : identityRefs;

                      const prefersPureI2v =
                        (s as any).videoMode === "i2v" ||
                        preferredVideoModel?.toLowerCase().includes("image-to-video") ||
                        preferredVideoModel?.toLowerCase().includes("i2v");

                      // When preferred provider is higgsfield and identityRefs.length > 0,
                      // set mode toward R2V consistently or document still-baked path (no silent drop).
                      const hfMode = isHf && identityRefs.length > 0 && !prefersPureI2v
                        ? "reference-to-video"
                        : undefined;

                      if (isHf && identityRefs.length > 0) {
                        if (hfMode === "reference-to-video") {
                          console.info(
                            `[HF Contract Routing] Scene ${globalSceneNum}${subclipLabel}: Routing to Higgsfield Seedance R2V (reference-to-video) with ${identityRefs.length} reference image(s) + shot still.`
                          );
                        } else {
                          console.info(
                            `[HF I2V Honesty] Scene ${globalSceneNum}${subclipLabel}: Higgsfield Seedance I2V selected (still-baked path). Identity is carried by the shot still; ${identityRefs.length} reference image(s) are baked into the still and not sent in the HF I2V API body.`
                          );
                        }
                      }

                      let effectiveVideoModel = preferredVideoModel;
                      if (!effectiveVideoModel) {
                        const routed = routeMediaCapability({
                          modality: "video",
                          generationMode: (hfMode === "reference-to-video" || (s as any).videoMode === "reference-to-video") ? "video_to_video" : "image_to_video",
                          references: effectiveRefs.length ? { types: ["image"], minimumCount: effectiveRefs.length } : undefined,
                          temporal: {
                            requiresStartFrame: true,
                            requiresEndFrame: Boolean(subclipPlannedEnd),
                          },
                          output: {
                            durationSeconds: subclipDur,
                            aspectRatio: identityPack.aspectRatio,
                          },
                          preferences: {
                            preferredProviderId: providerId,
                            productionMode: generationSettings.productionMode as any,
                            priority: (s as any).isHero ? "hero" : "supporting",
                          },
                        });
                        effectiveVideoModel = routed.selected?.modelId;
                      }

                      const apiClip = await requestProductionVideoClip({
                        provider: providerId,
                        prompt: sceneMotionPrompt,
                        firstFrameUrl: subclipStartFrame,
                        sourceImageAssetId: s.sourceImageAssetId || s.stillAssetId,
                        lastFrameUrl: subclipPrevLast,
                        endFrameUrl: subclipPlannedEnd,
                        characterSheetUrl: sceneCharSheetUrl || undefined,
                        referenceImageUrls: effectiveRefs,
                        aspectRatio: identityPack.aspectRatio,
                        durationSec: subclipDur,
                        model: effectiveVideoModel,
                        mode: hfMode || (s as any).videoMode,
                        productionId: production.id,
                        brandId: (brand as any).id,
                        shotIndex: globalSceneNum,
                        subclipIndex: k + 1,
                      });

                      const billableReqId = apiClip.requestId || "req_completed";
                      console.log(
                        `[I2V BILLABLE] provider=${providerId} model=${effectiveVideoModel || "default"} durationSec=${subclipDur} scene=${globalSceneNum} subclipIndex=${k + 1} request_id=${billableReqId}`
                      );

                      return {
                        url: apiClip.videoUrl,
                        lastFrameDataUrl: apiClip.lastFrameDataUrl,
                        provider: apiClip.provider,
                      };
                    };

                    if (isI2vApiProvider(activeVideo.providerId)) {
                      try {
                        return await tryI2v(activeVideo.providerId);
                      } catch (primaryI2vErr: any) {
                        console.warn(
                          `[SPARK Pipeline] Primary I2V provider ${activeVideo.providerId} notice Scene ${globalSceneNum}${subclipLabel}:`,
                          primaryI2vErr
                        );
                        const errStr = String(primaryI2vErr?.message || primaryI2vErr);
                        const isTimeoutAfterSubmit =
                          /poll timed out|timeout exceeded|timed out/i.test(errStr) &&
                          !/create task failed|image2video failed|video\.generate failed/i.test(errStr);
                        if (isTimeoutAfterSubmit) {
                          console.warn(
                            `[SPARK Pipeline] Primary I2V provider ${activeVideo.providerId} timed out after submit. Aborting failover to avoid double-billing.`
                          );
                          throw primaryI2vErr;
                        }

                        for (const fallbackProvider of i2vFallbacks) {
                          try {
                            console.log(
                              `[SPARK Pipeline] Attempting I2V fallback to ${fallbackProvider} for Scene ${globalSceneNum}${subclipLabel}...`
                            );
                            return await tryI2v(fallbackProvider);
                          } catch (fallbackErr: any) {
                            console.warn(
                              `[SPARK Pipeline] Fallback I2V provider ${fallbackProvider} notice Scene ${globalSceneNum}${subclipLabel}:`,
                              fallbackErr
                            );
                          }
                        }
                      }
                    }

                    const routed = await ModelRouter.executeCategoryRequest("videoGeneration", {
                      prompt: sceneMotionPrompt,
                      aspectRatio: identityPack.aspectRatio,
                      firstFrameUrl: subclipStartFrame,
                      characterSheetUrl: sceneCharSheetUrl || undefined,
                      referenceImageUrls: identityRefs,
                      durationSec: subclipDur,
                      lastFrameUrl: subclipPrevLast,
                      endFrameUrl: subclipPlannedEnd,
                      preferredProvider: activeVideo.providerId,
                      model: preferredVideoModel,
                      productionId: production.id,
                      brandId: (brand as any).id,
                      shotIndex: globalSceneNum,
                    });
                    return { url: routed, provider: activeVideo.providerId };
                  };

                  const generated = await withTimeout(
                    generateSubclip(),
                    videoTimeoutMs,
                    `Scene ${globalSceneNum}${subclipLabel} video generation timed out after ${Math.round(videoTimeoutMs / 1000)}s`,
                    signal
                  );
                  checkAborted();

                  if (isValidMediaData(generated.url)) {
                    let finalClip = "";
                    let clipAssetId: string | undefined;
                    try {
                      const storedClip = await this.uploadAssetToStorage({
                        productionId: production.id,
                        brandId: (brand as any).id,
                        assetType: "video",
                        storagePath: getStoragePath(`video/shot-${subclipIndexNum}.mp4`),
                        dataUrlOrBlob: generated.url,
                        mimeType: "video/mp4",
                        prompt: sceneMotionPrompt,
                        provider: generated.provider || "ModelRouter",
                        sceneId: s.sceneId,
                        shotId: shotIdForScene,
                        taskId: s.generationTaskId,
                      });
                      if (storedClip?.assetId) {
                        clipAssetId = storedClip.assetId;
                      }
                      if (
                        storedClip?.uploadSuccess &&
                        storedClip.publicUrl &&
                        isPersistableSparkMediaUrl(storedClip.publicUrl)
                      ) {
                        finalClip = storedClip.publicUrl;
                      }
                      console.log(`[SPARK Pipeline] Storage Upload: Scene ${globalSceneNum}${subclipLabel} Video -> ${finalClip || "(persist failed)"}`);
                    } catch (storageErr: any) {
                      console.warn(`[SPARK Pipeline] Scene ${globalSceneNum}${subclipLabel} video upload notice:`, storageErr);
                    }
                    if (!finalClip && isPersistableSparkMediaUrl(generated.url)) {
                      finalClip = generated.url;
                    }
                    if (!finalClip && isPlayableVideoUrl(generated.url)) {
                      finalClip = generated.url;
                    }
                    if (!finalClip) {
                      throw new Error(`Scene ${globalSceneNum}${subclipLabel} Video: no playable video URL returned`);
                    }

                    chapterSubclips.push(finalClip);
                    sceneClips.push(finalClip);
                    if (sIdx === 0 && k === 0 && !realVideoUrl) {
                      realVideoUrl = finalClip;
                    }

                    // Always ingest non-Spark URLs to bucket "Spark"
                    if (!isSparkStorageUrl(finalClip)) {
                      void import("./ingestMediaToSpark").then(({ scheduleAutoIngestMedia }) => {
                        scheduleAutoIngestMedia({
                          url: finalClip,
                          brandId: (brand as any).id,
                          productionId: production.id,
                          assetType: "video",
                          storagePath: getStoragePath(`video/shot-${subclipIndexNum}.mp4`),
                          shotIndex: globalSceneNum,
                          onSuccess: (sparkUrl) => {
                            const idxInScene = sceneClips.indexOf(finalClip);
                            if (idxInScene >= 0) sceneClips[idxInScene] = sparkUrl;
                            const idxInChap = chapterSubclips.indexOf(finalClip);
                            if (idxInChap >= 0) chapterSubclips[idxInChap] = sparkUrl;
                            if (s.videoUrl === finalClip) s.videoUrl = sparkUrl;
                            if (currentStoryboard[sIdx]?.videoUrl === finalClip) {
                              currentStoryboard[sIdx].videoUrl = sparkUrl;
                            }
                          },
                        });
                      });
                    }

                    // Extract last frame for continuity to next subclip or next scene
                    try {
                      let lastFrameBlob: Blob | string | undefined;
                      const browserExtract = await extractVideoLastFrame(finalClip);
                      if (browserExtract?.blob) {
                        lastFrameBlob = browserExtract.blob;
                      } else if (generated.lastFrameDataUrl && isValidMediaData(generated.lastFrameDataUrl)) {
                        lastFrameBlob = generated.lastFrameDataUrl;
                      }
                      if (lastFrameBlob) {
                        const suffix = subclipCount > 1 ? `-part${k + 1}` : "";
                        const storedLastFrame = await this.uploadAssetToStorage({
                          productionId: production.id,
                          brandId: (brand as any).id,
                          assetType: "image",
                          storagePath: getStoragePath(`scenes/scene-0${globalSceneNum}${suffix}-last.jpg`),
                          dataUrlOrBlob: lastFrameBlob,
                          mimeType: "image/jpeg",
                          prompt: `Last frame of Scene ${globalSceneNum}${subclipLabel}`,
                          provider: "VideoFrameExtractor",
                          sceneId: s.sceneId,
                          shotId: shotIdForScene,
                        });
                        if (storedLastFrame?.publicUrl) {
                          currentChapterLastFrame = storedLastFrame.publicUrl;
                          subclipStartFrame = storedLastFrame.publicUrl; // Chains to next subclip!
                          if (isLastSubclip) {
                            s.lastFrameUrl = storedLastFrame.publicUrl;
                            const gsf = stampSceneGeneratedStateFrame({
                              productionId: production.id,
                              shotId: shotIdForScene,
                              videoUrl: finalClip,
                              lastFrameUrl: storedLastFrame.publicUrl,
                              sceneIndexZeroBased: sIdx,
                            });
                            (s as any).generatedStateFrame = gsf;
                            (s as any).generatedStateFrameId = gsf.id;
                            if (!brief.generatedAssets) brief.generatedAssets = {};
                            const registry = ((brief.generatedAssets as any).generatedStateFrames ||
                              {}) as Record<string, unknown>;
                            registry[gsf.id] = gsf;
                            (brief.generatedAssets as any).generatedStateFrames = registry;
                            console.log(`[SPARK Pipeline] Storage Upload: Scene ${globalSceneNum} Last Frame -> ${s.lastFrameUrl} (${gsf.id})`);
                          }
                        }
                      }
                    } catch (extractErr) {
                      console.warn(`[SPARK Pipeline] Scene ${globalSceneNum}${subclipLabel} last frame extract notice:`, extractErr);
                    }
                  } else {
                    console.warn(`[SPARK Pipeline] Scene ${globalSceneNum}${subclipLabel} video generation returned empty/invalid video:`, String(generated.url || "").slice(0, 100));
                    const errMsg = `Scene ${globalSceneNum}${subclipLabel} Video: Provider returned empty data`;
                    if (!lastError) lastError = errMsg;
                    s.lastError = errMsg;
                    currentStoryboard[sIdx] = { ...s, lastError: errMsg };
                    break;
                  }
                } catch (subclipErr: any) {
                  if (subclipErr?.name === "AbortError" || signal?.aborted) throw subclipErr;
                  console.warn(`[SPARK Pipeline] Scene ${globalSceneNum}${subclipLabel} video generation notice:`, subclipErr);
                  const errMsg = `Scene ${globalSceneNum}${subclipLabel} Video: ${subclipErr?.message || String(subclipErr)}`;
                  if (!lastError) lastError = errMsg;
                  s.lastError = errMsg;
                  currentStoryboard[sIdx] = { ...s, lastError: errMsg };
                  break;
                }
              }

              if (chapterSubclips.length > 0) {
                s.videoUrl = chapterSubclips[0];
                (s as any).playablePreviewUrl = chapterSubclips[0];
                currentStoryboard[sIdx] = {
                  ...s,
                  videoUrl: chapterSubclips[0],
                  lastFrameUrl: s.lastFrameUrl,
                };
              }

              const currentPct = 60 + Math.round(((sIdx + 1) / currentStoryboard.length) * 20);
              emitProgress(currentPct, "Video", `Rendered Scene ${globalSceneNum} of ${currentStoryboard.length} video clip...`, {
                storyboard: currentStoryboard,
                videoUrl: sIdx === 0 ? s.videoUrl : undefined,
              });
              void persistCurrentStage(`Scene-Video-${globalSceneNum}`);
            }

            if (mode === "standard" && sceneClips.length === 1 && currentStoryboard.length > 1) {
              // HYBRID MUX: Hook video (scene 1) + remaining narrator stills (scenes 2..N) + full VO narration
              emitProgress(82, "Merge", `Compiling Hybrid master MP4 (Hook video + ${currentStoryboard.length - 1} narrator stills + voiceover)...`);
              try {
                const remainingImages = currentStoryboard.slice(1).map((s, idx) => s.image || sceneImages[idx + 1]).filter(Boolean) as string[];
                const targetMergeTexts = currentStoryboard.map((s, idx) => {
                  const primaryOnScreen = s.onScreenText;
                  if (primaryOnScreen) return formatBurnedOnScreenText(primaryOnScreen);
                  const beatOnScreen = brief.beats?.[idx]?.onScreenText;
                  if (beatOnScreen) return formatBurnedOnScreenText(beatOnScreen);
                  if (idx === 0 && brief.hook) return formatBurnedOnScreenText(brief.hook);
                  return "";
                });

                const { compileHybridVideo } = await import("./narratorVideoCompiler");
                const hybridResult = await withTimeout(
                  compileHybridVideo({
                    hookVideoUrl: sceneClips[0],
                    remainingImageUrls: remainingImages,
                    audioUrl: realVoiceUrl,
                    onScreenTexts: targetMergeTexts,
                    totalDurationSec: activeFormatSettings?.targetDurationSec || 60,
                    width: compileWidth,
                    height: compileHeight,
                  }),
                  Math.max(60000, (activeFormatSettings?.targetDurationSec || 60) * 1000 + 60000),
                  "Hybrid compilation exceeded its duration budget",
                  signal
                );

                if (hybridResult && hybridResult.blob && hybridResult.blob.size > 0) {
                  const ext = hybridResult.extension || "mp4";
                  const storedHybrid = await this.uploadAssetToStorage({
                    productionId: production.id,
                    brandId: (brand as any).id,
                    assetType: "video",
                    storagePath: getStoragePath(`video/master.${ext}`),
                    dataUrlOrBlob: hybridResult.blob,
                    mimeType: hybridResult.mimeType || `video/${ext}`,
                    prompt: `Merged Hybrid master video (Hook clip + ${remainingImages.length} narrator stills)`,
                    provider: "HybridVideoCompiler",
                  });
                  if (storedHybrid?.publicUrl && isDurableMasterVideoReady(storedHybrid.publicUrl)) {
                    realVideoUrl = storedHybrid.publicUrl;
                    (brief as any).canonicalMasterUrl = storedHybrid.publicUrl;
                    (production as any).canonicalMasterUrl = storedHybrid.publicUrl;
                    console.log(`[SPARK Pipeline] Storage Upload: Hybrid Master Video -> ${realVideoUrl}`);
                  }
                }
              } catch (hybridErr: any) {
                console.warn("[SPARK Pipeline] Hybrid compile notice:", hybridErr);
              }
            } else if (sceneClips.length > 1) {
              emitProgress(82, "Merge", `Merging ${sceneClips.length} scene videos into master MP4...`);
              const mergeTask = tasks.find((t) => t.kind === "merge");
              if (engine && mergeTask && spec) {
                try {
                  console.log(`[SPARK Pipeline] Master merge task via canonical ExecutionEngine (${mergeTask.id})...`);
                  const res = await engine.executeTask({ spec, task: mergeTask, priorOutputs });
                  if (res.task.status === "succeeded") {
                    const mergedUrl = res.asset?.publicUrl || (res.execution.outputAssets[0]?.sourceUrl as string);
                    realVideoUrl = mergedUrl;
                    (brief as any).canonicalMasterUrl = mergedUrl;
                    (production as any).canonicalMasterUrl = mergedUrl;
                    (brief as any).assemblyStatus = "assembly_complete";
                    (production as any).assemblyStatus = "assembly_complete";
                    mergeTask.status = "succeeded";
                    mergeTask.productionAssetId = res.asset?.id;
                    if (mergedUrl) priorOutputs[mergeTask.id] = mergedUrl;
                    console.log(`[SPARK Pipeline] Canonical Merged Master Video -> ${realVideoUrl}`);
                  } else {
                    mergeTask.status = "skipped";
                    mergeTask.lastError = res.task.lastError || "FFMPEG concatenation unavailable on serverless image; retaining individual scene clips.";
                    (brief as any).assemblyStatus = "assembly_pending";
                    (production as any).assemblyStatus = "assembly_pending";
                    (brief as any).assemblyError = mergeTask.lastError;
                  }
                } catch (mErr: any) {
                  mergeTask.status = "skipped";
                  mergeTask.lastError = mErr?.message || "FFMPEG concatenation unavailable on serverless image; retaining individual scene clips.";
                  (brief as any).assemblyStatus = "assembly_pending";
                  (production as any).assemblyStatus = "assembly_pending";
                  (brief as any).assemblyError = mergeTask.lastError;
                }
              } else {
                try {
                  const hasVoScenes = currentStoryboard.length > 0 && currentStoryboard.some((s) => s.audio === "vo");
                  const mergeAudioUrl = (mode === "standard" && hasVoScenes) ? realVoiceUrl : undefined;
                  const targetMergeTexts = collectSceneCaptionLines(
                    currentStoryboard,
                    brief.beats,
                    brief.hook,
                    formatBurnedOnScreenText
                  );

                  const mergeResult = await withTimeout(
                    assembleMasterFromClips({
                      productionId: production.id,
                      brandId: (brand as any)?.id,
                      videoUrls: sceneClips,
                      audioUrl: mergeAudioUrl,
                      sfxUrl: realSfxUrl,
                      onScreenTexts: targetMergeTexts,
                      width: compileWidth,
                      height: compileHeight,
                      timeoutMs: 120000,
                    }),
                    120000,
                    "Scene video merge timed out after 120s",
                    signal
                  );

                  if (mergeResult?.publicUrl && isDurableMasterVideoReady(mergeResult.publicUrl)) {
                    realVideoUrl = mergeResult.publicUrl;
                    (brief as any).canonicalMasterUrl = mergeResult.publicUrl;
                    (production as any).canonicalMasterUrl = mergeResult.publicUrl;
                    (brief as any).assemblyStatus = "assembly_complete";
                    (production as any).assemblyStatus = "assembly_complete";
                    if (mergeTask) {
                      mergeTask.status = "succeeded";
                      priorOutputs[mergeTask.id] = realVideoUrl;
                    }
                    console.log(`[SPARK Pipeline] Merged Master Video (${sceneClips.length} scenes) -> ${realVideoUrl}`);
                  } else {
                    console.warn(
                      "[SPARK Pipeline] Scene merge did not produce a server ffmpeg master"
                    );
                    (brief as any).assemblyStatus = "assembly_pending";
                    (production as any).assemblyStatus = "assembly_pending";
                    (brief as any).assemblyError = "FFMPEG concatenation unavailable on serverless image; retaining individual scene clips.";
                    if (mergeTask) {
                      mergeTask.status = "skipped";
                      mergeTask.lastError = (brief as any).assemblyError;
                    }
                  }
                } catch (mergeErr: any) {
                  console.warn("[SPARK Pipeline] Scene merge notice:", mergeErr);
                  (brief as any).assemblyStatus = "assembly_pending";
                  (production as any).assemblyStatus = "assembly_pending";
                  (brief as any).assemblyError = mergeErr?.message || String(mergeErr);
                  if (mergeTask) {
                    mergeTask.status = "skipped";
                    mergeTask.lastError = (brief as any).assemblyError;
                  }
                }
              }
              // CRITICAL: NEVER DESTROY VALID GENERATED MEDIA
              // If merge was unavailable or pending, all individual scene clips remain valid and accessible.
              (production as any).playablePreviewUrl = sceneClips[0];
              (brief as any).playablePreviewUrl = sceneClips[0];
              console.log(`[SPARK Pipeline] Multi-scene: Retaining ${sceneClips.length} distinct scene video clip(s) with assemblyStatus: ${(brief as any).assemblyStatus}.`);
            } else if (
              sceneClips.length === 1 &&
              currentStoryboard.length <= 1 &&
              isPlayableVideoUrl(sceneClips[0])
            ) {
              // True one-take production: the single clip IS the master.
              realVideoUrl = sceneClips[0];
              const mergeTask = tasks.find((t) => t.kind === "merge");
              if (mergeTask) {
                mergeTask.status = "succeeded";
                mergeTask.productionAssetId = currentStoryboard[0]?.videoAssetId;
              }
              (brief as any).playablePreviewUrl = sceneClips[0];
              (production as any).playablePreviewUrl = sceneClips[0];
              (brief as any).assemblyStatus = "assembly_complete";
              (production as any).assemblyStatus = "assembly_complete";
              if (isDurableMasterVideoReady(sceneClips[0])) {
                (brief as any).canonicalMasterUrl = sceneClips[0];
                (production as any).canonicalMasterUrl = sceneClips[0];
              }
            } else if (sceneClips.length > 0) {
              if (realVideoUrl && sceneClips.includes(realVideoUrl) && currentStoryboard.length > 1) {
                realVideoUrl = undefined as any;
              }
              (production as any).playablePreviewUrl = sceneClips[0];
              (brief as any).playablePreviewUrl = sceneClips[0];
              if (!(brief as any).assemblyStatus) {
                (brief as any).assemblyStatus = "assembly_pending";
                (production as any).assemblyStatus = "assembly_pending";
              }
              console.log(`[SPARK Pipeline] Review: Retaining ${sceneClips.length} distinct scene video clip(s).`);
            }
          }
        } catch (vidErr: any) {
          if (vidErr?.name === "AbortError" || signal?.aborted) throw vidErr;
          console.error("[SPARK Pipeline] Video generation failed:", vidErr);
          if (!lastError) lastError = `Video Generation: ${vidErr?.message || String(vidErr)}`;
        }
      }

      checkAborted();
      let isVideoSuccess = mode === "express"
        ? Boolean(realVideoUrl && isPlayableVideoUrl(realVideoUrl))
        : mode === "standard"
        ? (sceneClips.length > 0 && isPlayableVideoUrl(sceneClips[0])) || Boolean(realVideoUrl && isPlayableVideoUrl(realVideoUrl))
        : (sceneClips.length > 0 && sceneClips.every((c) => isPlayableVideoUrl(c))) || Boolean(realVideoUrl && isPlayableVideoUrl(realVideoUrl));

      // Provider I2V total failure handling.
      // Express/narrator may compile a slideshow master from stills + VO.
      // Cinematic/deep/standard must NOT burn emergency VO or narrator slideshow credits —
      // those assets are unused (quarantined) and must not be generated.
      if (mode === "deep") {
        console.log(`[SPARK Pipeline] Cinematic mode: emergency VO and slideshow fallback are strictly disabled.`);
      } else if (!isVideoSuccess && sceneImages.length > 0 && mode === "express") {
        try {
          if (!realVoiceUrl) {
            console.warn(
              `[SPARK Pipeline] No voice bed present (common in deep/cinematic). Synthesizing emergency VO for slideshow fallback.`
            );
            try {
              const voiceScript = promptPack.voiceScript;
              const snapshotVoiceId = generationSettings.snapshot?.voice?.voiceId;
              const targetVoiceId = snapshotVoiceId || character?.voice?.voiceId || (brand as any)?.voice?.voiceId;
              const { generateElevenLabsVoice } = await import("../runtime/providers/elevenLabsTTS");
              const emergencyVoice = await withTimeout(
                generateElevenLabsVoice(voiceScript, targetVoiceId, undefined, signal),
                45000,
                "Emergency VO for motion-failure fallback timed out after 45s",
                signal
              );
              if (isValidMediaData(emergencyVoice)) {
                try {
                  const storedAudio = await this.uploadAssetToStorage({
                    productionId: production.id,
                    brandId: (brand as any).id,
                    assetType: "audio",
                    storagePath: getStoragePath("audio/voice-fallback.mp3"),
                    dataUrlOrBlob: emergencyVoice,
                    mimeType: "audio/mpeg",
                    prompt: voiceScript,
                    provider: "ElevenLabs",
                  });
                  realVoiceUrl = storedAudio?.publicUrl || emergencyVoice;
                } catch {
                  realVoiceUrl = emergencyVoice;
                }
              }
            } catch (voErr: any) {
              console.warn("[SPARK Pipeline] Emergency VO synthesis failed:", voErr?.message || voErr);
            }
          }

          if (realVoiceUrl) {
            console.warn(
              `[SPARK Pipeline] Motion synthesis produced no clips — falling back to narrator slideshow (${sceneImages.length} stills + voice). Original error: ${lastError || "unknown"}`
            );
            const { compileNarratorSlideshowVideo } = await import("./narratorVideoCompiler");
            const fallback = await withTimeout(
              compileNarratorSlideshowVideo({
                imageUrls: sceneImages,
                audioUrl: realVoiceUrl,
                sfxUrl: realSfxUrl,
                totalDurationSec: activeFormatSettings?.targetDurationSec || 60,
                width: compileWidth,
                height: compileHeight,
              }),
              90000,
              "Motion-failure slideshow fallback timed out after 90s",
              signal
            );
            if (fallback?.blob && fallback.blob.size > 0) {
              const ext = fallback.extension || "mp4";
              const storedFallback = await this.uploadAssetToStorage({
                productionId: production.id,
                brandId: (brand as any).id,
                assetType: "video",
                storagePath: getStoragePath(`video/master-fallback.${ext}`),
                dataUrlOrBlob: fallback.blob,
                mimeType: fallback.mimeType || `video/${ext}`,
                prompt: "Slideshow fallback after I2V provider failure",
                provider: "NarratorSlideshowCompiler",
              });
              if (storedFallback?.publicUrl && isDurableMasterVideoReady(storedFallback.publicUrl)) {
                if (mode === "express") {
                  realVideoUrl = storedFallback.publicUrl;
                  isVideoSuccess = true;
                  lastError = `${lastError || "Motion synthesis failed"} — delivered slideshow fallback master (stills + voice).`;
                  console.log(`[SPARK Pipeline] Express slideshow master ready -> ${realVideoUrl}`);
                } else {
                  // Cinematic/deep/standard: quarantine only — never promote as canonical master/Review hero.
                  (brief as any).emergencyFallbackVideoUrl = storedFallback.publicUrl;
                  if (!(brief as any).generatedAssets) (brief as any).generatedAssets = {};
                  ((brief as any).generatedAssets as any).emergencyFallbackVideoUrl = storedFallback.publicUrl;
                  lastError = `${lastError || "Motion synthesis failed"} — cinematic clips missing; narrator slideshow quarantined (not promoted to Review hero).`;
                  console.warn(
                    `[SPARK Pipeline] Quarantined narrator slideshow for ${mode} mode (not canonical) -> ${storedFallback.publicUrl}`
                  );
                }
              }
            }
          } else {
            console.warn(
              "[SPARK Pipeline] Cannot run slideshow fallback: stills exist but no voice bed could be synthesized."
            );
          }
        } catch (fallbackErr: any) {
          if (fallbackErr?.name === "AbortError" || signal?.aborted) throw fallbackErr;
          console.warn("[SPARK Pipeline] Slideshow fallback after motion failure also failed:", fallbackErr);
        }
      }

      if (!isVideoSuccess && mode !== "express") {
        lastError =
          lastError ||
          `Cinematic/hybrid motion synthesis failed — refusing narrator slideshow fallback (unused for ${mode}).`;
        console.warn(
          `[SPARK Pipeline] Skipping narrator slideshow fallback for mode=${mode} (do not generate unused assets). Original error: ${lastError}`
        );
      }

      if (!isVideoSuccess && !lastError) {
        lastError = mode === "express"
          ? "Narrator video synthesis completed but did not produce a verified durable video in Storage."
          : "Scene video synthesis completed but did not produce verified scene clips in Storage.";
      }

      markStage("video", isVideoSuccess ? "done" : "failed");
      await persistCurrentStage("Video");

      const captionLines = collectSceneCaptionLines(
        currentStoryboard,
        brief.beats,
        brief.hook,
        formatBurnedOnScreenText
      );

      if (!isVideoSuccess) {
        markStage("captions", "skipped");
        emitProgress(84, "Captions", "Skipped captions overlay (video generation was not successful)");
      } else {
        markStage("captions", "active");
        emitProgress(84, "Captions", "Applying captions overlay on compiled video...");
        void persistCurrentStage("Captions");
        startHeartbeat("Captions");
        const hasCaptions = captionLines.some((t) => t && t.trim().length > 0);
        if (mode === "express" && hasCaptions && realVoiceUrl) {
          try {
            const captionImages = sceneImages.length > 0 ? sceneImages : (currentStoryboard.map((s) => s.image).filter(Boolean) as string[]);
            const { compileNarratorSlideshowVideo } = await import("./narratorVideoCompiler");
            const captioned = await withTimeout(
              compileNarratorSlideshowVideo({
                imageUrls: captionImages,
                audioUrl: realVoiceUrl,
                sfxUrl: realSfxUrl,
                onScreenTexts: captionLines,
                totalDurationSec: activeFormatSettings?.targetDurationSec || 60,
                width: compileWidth,
                height: compileHeight,
              }),
              60000,
              "Caption overlay compile timed out after 60s",
              signal
            );
            if (captioned?.blob && captioned.blob.size > 0) {
              const ext = captioned.extension || "mp4";
              const storedCaptioned = await this.uploadAssetToStorage({
                productionId: production.id,
                brandId: (brand as any).id,
                assetType: "video",
                storagePath: getStoragePath(`video/master.${ext}`),
                dataUrlOrBlob: captioned.blob,
                mimeType: captioned.mimeType || `video/${ext}`,
                prompt: "Narrator master with caption overlay",
                provider: "NarratorSlideshowCompiler",
              });
              if (storedCaptioned?.publicUrl && isDurableMasterVideoReady(storedCaptioned.publicUrl)) {
                realVideoUrl = storedCaptioned.publicUrl;
              }
            }
            markStage("captions", "done");
          } catch (capErr: any) {
            if (capErr?.name === "AbortError" || signal?.aborted) throw capErr;
            console.warn("[SPARK Pipeline] Caption overlay notice:", capErr);
            markStage("captions", "done");
          }
        } else if ((mode === "standard" || mode === "deep") && hasCaptions) {
          // Cinematic/hybrid: captions burned at assembleMaster (onScreenTexts). Record lineage.
          if (!brief.generatedAssets) brief.generatedAssets = {};
          (brief.generatedAssets as any).captionsAppliedAt = realVideoUrl ? "master_assemble" : "pending_merge";
          (brief.generatedAssets as any).captionMode = "on_screen_burn";
          console.log(
            `[SPARK Pipeline] Captions for ${mode}: ${
              realVideoUrl
                ? "applied via master assemble onScreenTexts"
                : "queued for Approve & merge (same assembleMaster spine)"
            }`
          );
          markStage("captions", "done");
        } else {
          markStage("captions", "done");
        }
      }
      if (!brief.generatedAssets) brief.generatedAssets = {};
      (brief.generatedAssets as any).captionLines = captionLines;
      (brief.generatedAssets as any).sfxUrl = realSfxUrl;
      await persistCurrentStage("Captions");

      // Stage 4 — Proposed Thumbnail Variants (Runs AFTER Master Video / Slideshow Compile)
      markStage("thumbnails", "active");
      emitProgress(88, "Thumbnails", "Generating Proposed Thumbnail Variants with Locked Identity...");
      void persistCurrentStage("Thumbnails");
      startHeartbeat("Thumbnails");

      const targetThumbCount = typeof activeCreditSettings.thumbnailCount === "number" ? Math.max(0, activeCreditSettings.thumbnailCount) : 3;
      const enrichedThumbnails: { id: string; variant: string; concept: string; image?: string; url?: string }[] = [];

      if (targetThumbCount === 0) {
        console.log("[SPARK Pipeline] Thumbnail count is 0 in credit controls. Skipping thumbnail generation loop.");
        markStage("thumbnails", "done");
        await persistCurrentStage("Thumbnails");
      } else {
        try {
          const { ModelRouter } = await import("../runtime/modelRouter");
          const effectiveThumbnails = thumbnails.slice(0, targetThumbCount);
          const totalThumbs = effectiveThumbnails.length || targetThumbCount;
          for (let tIdx = 0; tIdx < effectiveThumbnails.length; tIdx++) {
            checkAborted();
            const thumb = effectiveThumbnails[tIdx];
            const variantLetter = thumb.variant || ["A", "B", "C"][tIdx] || "A";
            if (!forceRegenerate && isValidMediaData(thumb.image || thumb.url)) {
              const existingThumbUrl = thumb.image || thumb.url;
              console.log(`[SPARK Pipeline] Reusing existing Thumbnail Variant ${variantLetter} -> ${existingThumbUrl}`);
              enrichedThumbnails.push({
                id: thumb.id || `t${tIdx + 1}`,
                variant: variantLetter,
                concept: thumb.concept,
                image: existingThumbUrl,
                url: existingThumbUrl,
              });
              currentThumbnails = [...enrichedThumbnails];
              continue;
            }

            const shortHookText = (typeof brief.hook === "string" ? brief.hook : brief.title || "VIRAL INSIGHT")
              .replace(/[^\w\s]/gi, "")
              .split(" ")
              .filter(Boolean)
              .slice(0, 4)
              .join(" ")
              .toUpperCase();

            const thumbFormat = getEffectiveContentFormat({
              brand,
              formatSettings: activeFormatSettings,
              production,
              brief,
            });
            const thumbVisualLock = buildVisualLockRefsFromDirector({
              production,
              brand,
              character,
              storyboardGridUrl: realGridUrl || sceneImages[0],
              subjectType: thumbFormat === "faceless" ? "insert" : "main",
              contentFormat: thumbFormat,
              locationPlateUrl: durableLocationPlateUrl,
            });

            const thumbPrompt = compileThumbnailPrompt({
              variantLetter,
              concept: thumb.concept,
              shortHookText,
              aspectRatio: identityPack.aspectRatio,
              characterName: character?.name,
              characterStyle: character?.style,
              brandName: brand.name,
              identityPrefix: identityPack.combinedPromptPrefix,
              refPromptHeader: thumbVisualLock.refPromptHeader,
              contentFormat: thumbFormat,
            }).prompt;

            let thumbUrl: string | undefined = undefined;

            try {
              checkAborted();
              console.log(`[SPARK Pipeline] Provider Request: Thumbnail Variant ${variantLetter} image via ModelRouter ("storyboardImages") [Refs: ${thumbVisualLock.imageUrls.length}]...`);
              const thumbImgData = await withTimeout(
                ModelRouter.executeCategoryRequest("storyboardImages", {
                  prompt: thumbPrompt,
                  referenceImageUrl: thumbVisualLock.primaryRefUrl,
                  referenceImageUrls: thumbVisualLock.imageUrls,
                  aspectRatio: identityPack.aspectRatio,
                  preferredProvider: resolvedImageProvider,
                  model: resolvedImageModel,
                }),
                45000,
                `Thumbnail variant ${variantLetter} generation timed out after 45s`,
                signal
              );
              checkAborted();

              if (isValidMediaData(thumbImgData)) {
                let finalThumb = thumbImgData;
                try {
                  const storedThumb = await this.uploadAssetToStorage({
                    productionId: production.id,
                    brandId: (brand as any).id,
                    assetType: "thumbnail",
                    storagePath: getStoragePath(`thumbnails/variant-${variantLetter.toLowerCase()}.png`),
                    dataUrlOrBlob: thumbImgData,
                    mimeType: "image/png",
                    prompt: thumbPrompt,
                    provider: "ModelRouter",
                  });
                  if (storedThumb?.publicUrl) finalThumb = storedThumb.publicUrl;
                  console.log(`[SPARK Pipeline] Storage Upload: Thumbnail Variant ${variantLetter} -> ${finalThumb}`);
                } catch (storageErr) {
                  console.warn(`[SPARK Pipeline] Thumbnail ${variantLetter} upload failed, retaining provider URL:`, storageErr);
                }
                thumbUrl = finalThumb;
              } else {
                console.warn(`[SPARK Pipeline] Thumbnail Variant ${variantLetter} returned non-image data`);
                if (!lastError) lastError = `Thumbnail Variant ${variantLetter}: No image bytes returned`;
              }
            } catch (thumbErr: any) {
              if (thumbErr?.name === "AbortError" || signal?.aborted) throw thumbErr;
              console.error(`[SPARK Pipeline] Thumbnail Variant ${variantLetter} image generation failed:`, thumbErr);
              if (!lastError) lastError = `Thumbnail Variant ${variantLetter}: ${thumbErr?.message || String(thumbErr)}`;
            }

            if (thumbUrl) {
              const thumbEntry = {
                id: thumb.id || `t${tIdx + 1}`,
                variant: variantLetter,
                concept: thumb.concept,
                image: thumbUrl,
                url: thumbUrl,
              };
              enrichedThumbnails.push(thumbEntry);
              currentThumbnails = [...enrichedThumbnails];
            }

            const currentPct = 88 + Math.round(((tIdx + 1) / totalThumbs) * 8);
            emitProgress(currentPct, "Thumbnails", `Synthesized thumbnail variant ${variantLetter}...`);
            void persistCurrentStage("Thumbnails");
          }
        } catch (tLoopErr: any) {
          if (tLoopErr?.name === "AbortError" || signal?.aborted) throw tLoopErr;
          console.error("[SPARK Pipeline] Thumbnail generation loop failed:", tLoopErr);
          if (!lastError) lastError = `Thumbnail Stage: ${tLoopErr?.message || String(tLoopErr)}`;
        }

        markStage("thumbnails", enrichedThumbnails.some((t) => isValidMediaData(t.image)) ? "done" : "failed");
        await persistCurrentStage("Thumbnails");
      }

      // Stage 5 — Finalizing Media Package
      markStage("saving", "active");
      emitProgress(98, "Saving", "Finalizing verified media assets package...");
      void persistCurrentStage("Saving");

      // Hero hygiene: never leave a quarantined narrator slideshow or a multi-scene
      // scene clip on deep/standard hero fields. Canonical master is explicit.
      if (
        (mode === "deep" || mode === "standard") &&
        realVideoUrl &&
        isEmergencySlideshowFallbackUrl(realVideoUrl)
      ) {
        (brief as any).emergencyFallbackVideoUrl = realVideoUrl;
        if (!(brief as any).generatedAssets) (brief as any).generatedAssets = {};
        (brief as any).generatedAssets.emergencyFallbackVideoUrl = realVideoUrl;
        realVideoUrl = undefined as any;
      }
      if (
        (mode === "deep" || mode === "standard") &&
        realVideoUrl &&
        sceneClips.length > 1 &&
        sceneClips.includes(realVideoUrl)
      ) {
        console.warn(
          `[SPARK Pipeline] Refusing to promote scene clip to canonical master (${sceneClips.length} scene clips present).`
        );
        realVideoUrl = undefined as any;
      }
      if (realVideoUrl && isDurableMasterVideoReady(realVideoUrl) && !isEmergencySlideshowFallbackUrl(realVideoUrl)) {
        if (!(sceneClips.length > 1 && sceneClips.includes(realVideoUrl))) {
          (brief as any).canonicalMasterUrl = realVideoUrl;
          (production as any).canonicalMasterUrl = realVideoUrl;
        }
      }

      brief.videoUrl = realVideoUrl;
      brief.audioUrl = realVoiceUrl;
      if (!brief.generatedAssets) brief.generatedAssets = {};
      brief.generatedAssets.generatedVideos =
        sceneClips.length > 0
          ? sceneClips
          : realVideoUrl && !isEmergencySlideshowFallbackUrl(realVideoUrl)
            ? [realVideoUrl]
            : undefined;
      if ((brief as any).emergencyFallbackVideoUrl) {
        (brief.generatedAssets as any).emergencyFallbackVideoUrl = (brief as any).emergencyFallbackVideoUrl;
      }
      if ((brief as any).canonicalMasterUrl) {
        (brief.generatedAssets as any).canonicalMasterUrl = (brief as any).canonicalMasterUrl;
      }
      brief.generatedAssets.voiceoverUrl = realVoiceUrl;
      brief.generatedAssets.generatedFrames = sceneImages.length > 0 ? sceneImages : brief.generatedAssets.generatedFrames;
      brief.generatedAssets.generatedAudio = [realVoiceUrl, realSfxUrl].filter(Boolean) as string[];
      brief.generatedAssets.thumbnails = enrichedThumbnails.length > 0 ? enrichedThumbnails : thumbnails;
      (brief.generatedAssets as any).sfxUrl = realSfxUrl;

      const isExpressNarrator = mode === "express";
      const isAutonomous = (brand as any)?.automation_mode === "autonomous" && (brand as any)?.review_required === false;
      if (isExpressNarrator) {
        if (!realVoiceUrl) {
          lastError = lastError || "Voiceover generation failed or audio was missing for Narrator mode.";
        }
        if (!realVideoUrl) {
          lastError = lastError || "Narrator slideshow compilation failed to produce a verified durable video in Storage.";
        }
      } else {
        if (sceneClips.length === 0 && !realVideoUrl) {
          lastError = lastError || "Video generation failed to produce verified scene video clips in permanent Storage.";
        }
      }

      const hasDurableSceneClips = mode === "standard"
        ? (sceneClips.length > 0 && isDurableMasterVideoReady(sceneClips[0]))
        : (sceneClips.length > 0 && sceneClips.every((c) => isDurableMasterVideoReady(c)));
      const hasDurableMaster = Boolean(realVideoUrl && isDurableMasterVideoReady(realVideoUrl));

      const isOverallSuccess = Boolean(
        isExpressNarrator
          ? (hasDurableMaster && realVoiceUrl && isValidMediaData(realVoiceUrl))
          : (hasDurableSceneClips || hasDurableMaster)
      );
      const finalStatus = isOverallSuccess
        ? (isExpressNarrator || isAutonomous ? "Completed" : "Ready for Review")
        : "Failed";
      if (!isOverallSuccess && !lastError) {
        lastError = isExpressNarrator
          ? "Narrator slideshow compilation failed to produce a verified durable video in Storage."
          : "Video generation failed to produce verified scene video clips in permanent Storage.";
      }
      const finalMsg = isOverallSuccess
        ? (isExpressNarrator || isAutonomous
            ? `${mode === "standard" ? "HYBRID" : mode.toUpperCase()} media assets synthesized and ready for executive review.`
            : mode === "standard"
            ? `HYBRID assets synthesized (Hook video + ${Math.max(0, currentStoryboard.length - 1)} narrator stills + voiceover). Ready for shot review and executive merge.`
            : `${mode.toUpperCase()} ${sceneClips.length} scene clips synthesized. Ready for shot review and executive merge.`)
        : lastError;

      markStage("saving", isOverallSuccess ? "done" : "failed");
      await persistCurrentStage(isOverallSuccess ? "Complete" : "Failed");

      const renderCompletedAt = new Date().toISOString();

      const finalProgress: import("../../domain/types").GenerationProgress = {
        percent: isOverallSuccess ? 100 : 85,
        stage: isOverallSuccess ? "Complete" : "Failed",
        stages: stages.map((s) => ({
          ...s,
          status: s.status === "active" ? (isOverallSuccess ? "done" : "failed") : s.status,
        })),
        message: finalMsg,
        updatedAt: renderCompletedAt,
        partialAssets: {
          storyboard: currentStoryboard,
          thumbnails: enrichedThumbnails.length > 0 ? enrichedThumbnails : thumbnails,
          voiceUrl: realVoiceUrl,
          videoUrl: realVideoUrl,
          lastError: isOverallSuccess ? undefined : (lastError || "Video stage failed to produce a valid video URL."),
        },
      };

      const updatedBrief: ProductionBrief = {
        ...brief,
        targetDurationSec: currentDuration,
        productionMode: mode,
        formatSettings: { ...activeFormatSettings, targetDurationSec: currentDuration },
        storyboard: currentStoryboard.length > 0 ? currentStoryboard : [
          {
            scene: 1,
            duration: mode === "deep" ? "0-8s" : "0-5s",
            shotList: `${aspectRatio} host framing`,
            cameraDirection: "Push-in zoom",
            transitions: "Continuous flow",
            startState: "Subject established in framing with clear eye-line",
            primaryChange: "Subject performs a clear continuous physical action toward camera",
            physicalAction: "Subject performs a clear continuous physical action toward camera",
            endState: "Subject holds a readable end pose",
            onScreenText: "",
            pacing: "Fast",
            scriptSnippet: brief.hook,
            spokenLines: brief.hook,
            visualDescription: brief.visualDirection || "Locked production environment",
          },
        ],
        storyboardGridUrl: realGridUrl || brief.storyboardGridUrl,
        generatedAssets: {
          storyboardGridUrl: realGridUrl || brief.storyboardGridUrl,
          sceneClips: sceneClips.length > 0 ? sceneClips : (realVideoUrl ? [realVideoUrl] : undefined),
          thumbnails: enrichedThumbnails.length > 0 ? enrichedThumbnails : thumbnails,
          voiceoverUrl: realVoiceUrl,
          generatedFrames: sceneImages.length > 0 ? sceneImages : undefined,
          generatedVideos: sceneClips.length > 0 ? sceneClips : (realVideoUrl ? [realVideoUrl] : undefined),
          generatedAudio: realVoiceUrl ? [realVoiceUrl] : undefined,
          generationProgress: finalProgress,
          generationMetadata: {
            renderStartedAt,
            renderCompletedAt,
            providerUsed: "AIProviderOrchestrator",
            generationStatus: finalStatus,
            lastError,
          },
        },
        audioUrl: realVoiceUrl,
        videoUrl: realVideoUrl,
        video_storage_path: extractSparkStoragePath(realVideoUrl) || production.videoStoragePath,
      };

      const updatedScenes = updatedBrief.storyboard!.map((s) => ({
        scene: s.scene,
        description: s.startState && s.endState
          ? `[${s.duration}] ${s.shotList} — Action: ${s.primaryChange || s.visualDescription} (End: ${s.endState})`
          : `[${s.duration}] ${s.shotList} — Text: "${s.onScreenText}"`,
        duration: s.duration,
        image: s.image,
        videoUrl: s.videoUrl,
      }));

      const fullProductionScenes: ProductionScene[] = (updatedBrief.storyboard || []).map((sb, idx) => {
        const sceneStillUrl = sb.image || sceneImages[idx] || undefined;
        const sceneClipUrl = sb.videoUrl || (mode === "deep" ? sceneClips[idx] : mode === "standard" && idx === 0 ? sceneClips[0] : undefined);
        return {
          scene: sb.scene || idx + 1,
          index: sb.scene || idx + 1,
          id: `scene-${production.id}-${sb.scene || idx + 1}`,
          shotId: (sb as any).shotId || (sb as any).id,
          productionId: production.id,
          brandId: (brand as any)?.id,
          duration: sb.duration || `${sb.durationSec || 0}s`,
          durationSec: sb.durationSec || parseInt(sb.duration),
          shotList: sb.shotList || `Scene ${idx + 1} framing`,
          cameraDirection: sb.cameraDirection || "Medium shot",
          camera: sb.cameraDirection || "Medium shot",
          transitions: sb.transitions || "Seamless flow",
          onScreenText: sb.onScreenText || `SCENE ${idx + 1}`,
          pacing: sb.pacing || "Balanced",
          scriptSnippet: sb.scriptSnippet || sb.spokenLines || "",
          spokenLines: sb.spokenLines || sb.scriptSnippet || "",
          audio: sb.audio || (mode === "express" ? "vo" : mode === "deep" ? "talent" : "talent"),
          scriptBeat: sb.spokenLines || sb.scriptSnippet || "",
          visualDescription: sb.visualDescription || sb.startState || `Scene ${idx + 1}`,
          action: sb.primaryChange || sb.visualDescription || `Scene ${idx + 1} action`,
          startState: sb.startState || `Scene ${idx + 1} start`,
          endState: sb.endState || `Scene ${idx + 1} end`,
          primaryChange: sb.primaryChange || sb.visualDescription,
          image: sceneStillUrl,
          keyframeImageUrl: sceneStillUrl,
          lastFrameUrl: sb.lastFrameUrl || currentStoryboard[idx]?.lastFrameUrl,
          videoUrl: sceneClipUrl,
          status: sceneClipUrl ? "ready" : sceneStillUrl ? "ready" : "pending",
          createdAt: renderStartedAt,
          updatedAt: renderCompletedAt,
        };
      });

      emitProgress(isOverallSuccess ? 100 : 50, isOverallSuccess ? "Complete" : "Failed", finalMsg);

      const specWithTasks = spec ? attachGenerationTasksToSpec(spec, tasks) : undefined;
      const initialReasoning = {
        ...production.reasoning,
        ...(specWithTasks ? { productionSpec: specWithTasks } : {}),
      };

      const synced = syncProductionMediaStores({
        production: {
          ...production,
          brief: updatedBrief,
          productionScenes: fullProductionScenes,
          scenes: updatedScenes,
          status: finalStatus as any,
          reasoning: initialReasoning,
        },
        scenes: fullProductionScenes,
        masterVideoUrl: realVideoUrl,
        audioUrl: realVoiceUrl,
      });

      if (specWithTasks && synced.reasoning?.productionSpec) {
        synced.reasoning.productionSpec = attachGenerationTasksToSpec(synced.reasoning.productionSpec, tasks);
      }

      return {
        brief: synced.brief,
        scenes: synced.scenes || updatedScenes,
        productionScenes: synced.productionScenes || fullProductionScenes,
        audioUrl: realVoiceUrl,
        videoUrl: realVideoUrl,
        playablePreviewUrl:
          (production as any).playablePreviewUrl ||
          (brief as any).playablePreviewUrl ||
          synced.brief?.playablePreviewUrl ||
          sceneClips[0],
        canonicalMasterUrl:
          (production as any).canonicalMasterUrl ||
          (brief as any).canonicalMasterUrl ||
          synced.brief?.canonicalMasterUrl,
        assemblyStatus:
          (production as any).assemblyStatus ||
          (brief as any).assemblyStatus ||
          synced.brief?.assemblyStatus ||
          (realVideoUrl ? "assembly_complete" : sceneClips.length > 1 ? "assembly_pending" : undefined),
        assemblyError: (brief as any).assemblyError || synced.brief?.assemblyError,
        reasoning: synced.reasoning,
      };
    } catch (err: any) {
      if (err?.name === "AbortError" || signal?.aborted) {
        console.log(`[SPARK Pipeline] Asset Generation ABORTED for Production "${production.id}"`);
        throw err;
      }
      const errMsg = err?.message || String(err);
      console.error("[ProductionAssetService] Asset generation failed:", errMsg);
      return {
        brief: {
          ...brief,
          lastError: errMsg,
        },
        scenes: currentStoryboard.map((s) => ({
          scene: s.scene,
          description: s.visualDescription || `Scene ${s.scene}`,
          duration: s.duration,
          image: s.image,
          videoUrl: s.videoUrl,
        })),
        productionScenes: currentStoryboard,
        audioUrl: realVoiceUrl,
        videoUrl: realVideoUrl,
      };
    } finally {
      stopHeartbeat();
    }
  }

  /**
   * Plan sequential production scenes based on targetDurationSec vs provider max clip length
   */
  public static planProductionScenes(params: {
    production: Production;
    brief: ProductionBrief;
    brand: Brand;
    formatSettings?: ProductionFormatSettings;
    creditSettings?: GenerationCreditSettings;
  }): ProductionScene[] {
    const { production, brief, brand, formatSettings, creditSettings } = params;
    const rawMode = (production.mode || brief.productionMode || "standard").toLowerCase();
    const mode = rawMode === "deep" || rawMode === "cinematic" ? "deep" : rawMode === "express" || rawMode === "narrator" ? "express" : "standard";

    const script = brief.narrativeScript || (production as any).narrativeScript || (brief as any).narrativeScriptObj;
    if (script && Array.isArray(script.chapters) && script.chapters.length > 0) {
      return buildScenesFromNarrativeChapters(script, mode);
    }
    if (Array.isArray(brief.storyboard) && brief.storyboard.length > 0) {
      return brief.storyboard;
    }

    // Dynamic Video Provider Physics: Read real single-shot native peak quality limit and legal durations
    const activeVideo = resolveActiveVideoProvider({
      preferredVideoProvider: formatSettings?.preferredVideoProvider,
    });
    const nativeMaxClipSec = activeVideo.maxVideoDurationSec || 8;

    // Canonical duration policy: format total + credit clip prefs + clip budget
    const durationPolicy = resolveDurationPolicy({
      formatSettings: {
        ...formatSettings,
        targetDurationSec:
          formatSettings?.targetDurationSec ||
          (production as any)?.targetDurationSec ||
          (production as any)?.formatSettings?.targetDurationSec ||
          (brief as any)?.targetDurationSec ||
          (brand as any)?.formatSettings?.targetDurationSec ||
          60,
      },
      creditSettings,
      productionMode: mode === "deep" ? "cinematic" : mode === "express" ? "shorts" : "standard",
      contentFormat: formatSettings?.contentFormat,
      providerMaxClipSec: nativeMaxClipSec,
    });
    const targetSec = durationPolicy.totalTargetDurationSec;
    const providerMaxClipSec = durationPolicy.maxClipDurationSec;
    const isOneTake = targetSec <= providerMaxClipSec;
    const briefBeats = brief.beats || [];

    // Calculate total scenes count: enforce scene segmentation when target exceeds engine max clip
    const minScenesForDuration = Math.ceil(targetSec / providerMaxClipSec);
    const plannedScenesCount = briefBeats.length > 0
      ? briefBeats.length
      : Math.max(minScenesForDuration, (brief.storyboard as any[])?.length || 1);
    // Honor Credit Control max video clip / keyframe budget via duration policy
    const totalScenesCount = Math.min(
      plannedScenesCount,
      Math.max(1, durationPolicy.maxClips)
    );

    // Prefer credit clip duration, then snap to provider capability map (e.g. Veo: 4|6|8s)
    const rawPerSceneSec = Math.max(
      1,
      Math.min(providerMaxClipSec, Math.ceil(targetSec / totalScenesCount), durationPolicy.preferredClipDurationSec)
    );
    const perSceneSec = snapToAllowedDuration(rawPerSceneSec, activeVideo.providerId);

    console.log(
      `[SPARK Scene Planner] Active Provider: "${activeVideo.providerId}" (Native Max: ${nativeMaxClipSec}s, Policy Max Clip: ${providerMaxClipSec}s, Mode: ${durationPolicy.mode}) -> Sized ${totalScenesCount} scenes (${perSceneSec}s each) for ${targetSec}s target. ${durationPolicy.rationale.join("; ")}`
    );

    const storyboard: any[] = (brief.storyboard as any[]) || [];
    const scenesList: ProductionScene[] = [];
    let cumulativeSec = 0;

    for (let i = 0; i < totalScenesCount; i++) {
      const idx = i + 1;
      const sbItem: any = storyboard[i] || storyboard[storyboard.length - 1];
      const beatItem = briefBeats[i] || briefBeats[briefBeats.length - 1];
      const clipUrl = brief.generatedAssets?.generatedVideos?.[i] || (i === 0 ? production.videoUrl || brief.videoUrl : undefined);

      const sceneStartSec = cumulativeSec;
      const sceneEndSec = sceneStartSec + perSceneSec;
      cumulativeSec = sceneEndSec;

      const formatTime = (s: number) => {
        const mins = Math.floor(s / 60);
        const secs = s % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
      };
      const continuousTimecode = `[${formatTime(sceneStartSec)}-${formatTime(sceneEndSec)}]`;

      const resolvedSpoken = beatItem?.spokenLines || sbItem?.scriptSnippet || (idx === 1 ? brief.hook : brief.spokenCta || "");
      const resolvedOnScreen = beatItem?.onScreenText || sbItem?.onScreenText || (idx === 1 ? "HOOK" : `SCENE ${idx}`);
      const resolvedCamera = beatItem?.cameraDirection || sbItem?.cameraDirection || (mode === "deep" ? "Tracking shot" : "Medium shot");
      const job = (beatItem?.valueJob as string) || "";
      let resolvedAudio: "vo" | "talent";
      if (sbItem?.audio) {
        resolvedAudio = sbItem.audio;
      } else if (mode === "express") {
        resolvedAudio = "vo";
      } else if (mode === "deep") {
        resolvedAudio = "talent";
      } else {
        // Hybrid (standard) mode: on-camera presentation for hook/proof/payoff/cta, VO for problem/context/example/b-roll
        if (job === "hook" || job === "proof" || job === "payoff" || job === "cta") {
          resolvedAudio = "talent";
        } else if (job === "problem" || job === "context" || job === "example" || job === "myth_bust" || job === "slide" || job === "still" || job === "b-roll") {
          resolvedAudio = "vo";
        } else {
          resolvedAudio = i % 2 === 0 ? "talent" : "vo";
        }
      }

      const dirScript = resolveDirectorSceneScript({
        scene: sbItem,
        beat: beatItem,
        environment: brief.visualDirection,
        sceneIndexZeroBased: i,
      });
      const resolvedPhysicalAction = sbItem?.physicalAction || dirScript.physicalAction;

      scenesList.push({
        scene: idx,
        duration: `${perSceneSec}s`,
        shotList: sbItem?.shotList || `${continuousTimecode} Scene ${idx} framing (${beatItem?.valueJob || "content"})`,
        cameraDirection: resolvedCamera,
        transitions: sbItem?.transitions || "Seamless flow",
        onScreenText: resolvedOnScreen,
        pacing: sbItem?.pacing || "Balanced",
        scriptSnippet: resolvedSpoken,
        spokenLines: resolvedSpoken,
        audio: resolvedAudio,
        physicalAction: resolvedPhysicalAction,
        visualDescription: sbItem?.visualDescription && !sbItem.visualDescription.startsWith("[")
          ? sbItem.visualDescription
          : resolvedPhysicalAction,
        startState: sbItem?.startState || `Scene ${idx} start state (${formatTime(sceneStartSec)})`,
        endState: sbItem?.endState || `Scene ${idx} end state (${formatTime(sceneEndSec)})`,
        primaryChange: resolvedPhysicalAction,
        image: sbItem?.image || undefined,
        videoUrl: clipUrl,
        id: `scene-${production.id}-${idx}`,
        productionId: production.id,
        brandId: (brand as any).id,
        index: idx,
        durationSec: perSceneSec,
        action: resolvedPhysicalAction,
        camera: resolvedCamera,
        scriptBeat: resolvedSpoken,
        keyframeImageUrl: sbItem?.image || undefined,
        status: clipUrl ? "ready" : "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return scenesList;
  }

  /**
   * Fix / regenerate a specific scene index with editNotes without touching neighboring scenes
   */
  public static async fixProductionScene(params: {
    productionId: string;
    sceneIndex: number;
    editNotes: string;
    brand: Brand;
    character?: Character;
    production: Production;
    memoryItems?: import("../../domain/types").MemoryItem[];
  }): Promise<ProductionScene | null> {
    const { productionId, sceneIndex, editNotes, brand, character, production, memoryItems = [] } = params;
    ProductionGenerationGuard.assertEnabled("ProductionAssetService.fixProductionScene", brand?.id);

    const brief = production.brief || ({} as ProductionBrief);
    const generationSettings = resolveGenerationSettings({ production, brief, brand });

      // --- RESOLVE IMAGE PREFERENCE ---
      const globalImageRouting = ModelRouter.getUserRoutingConfig?.()?.storyboardImages || "auto";
      const globalImageModel = ModelRouter.getUserModelSelectionConfig?.()?.storyboardImages || "";
      const aiSettings = (production as any)?.settingsSnapshot?.aiSettings || (brief as any)?.aiSettings || (brand as any)?.settings?.aiSettings || (brand as any)?.aiSettings;
      const preferredImageProviderRaw = aiSettings?.routing?.storyboardImages || globalImageRouting;
      const resolvedImageProvider = preferredImageProviderRaw === "auto" ? undefined : preferredImageProviderRaw;
      const resolvedImageModel = aiSettings?.models?.storyboardImages || globalImageModel || undefined;

      if (resolvedImageProvider) {
        console.log(`[SPARK Pipeline] Image preference: provider=${resolvedImageProvider} model=${resolvedImageModel || 'default'}`);
      }

    const existingScenes = production.productionScenes || ProductionAssetService.planProductionScenes({
      production,
      brief,
      brand,
      formatSettings: getEffectiveFormatSettings({
        formatSettings: (production as any)?.formatSettings || (brief as any)?.formatSettings,
        brand,
      }),
      creditSettings: getEffectiveCreditSettings({
        creditSettings: (production as any)?.creditSettings,
        brand,
      }),
    });
    // Bind by 1-based scene number / shotId — never by raw array index alone
    let targetSceneIdx = existingScenes.findIndex(
      (s) => Number(s.index || s.scene) === sceneIndex
    );
    if (targetSceneIdx < 0 && sceneIndex >= 1 && sceneIndex <= existingScenes.length) {
      targetSceneIdx = sceneIndex - 1;
    }

    if (targetSceneIdx < 0) return null;
    const sceneToFix = { ...existingScenes[targetSceneIdx] };
    sceneToFix.status = "generating";
    sceneToFix.editNotes = editNotes;
    const shotId = (sceneToFix as any).shotId || (sceneToFix as any).id;

    try {
      const { ModelRouter } = await import("../runtime/modelRouter");
      const identityPack = buildLockedIdentityPack({ brand, character, brief, production });
      const mode: "express" | "standard" | "deep" =
        generationSettings.productionMode || identityPack.mode;

      const prevScene = existingScenes[targetSceneIdx - 1];
      const isImgUrl = (u?: string) =>
        typeof u === "string" &&
        isValidMediaData(u) &&
        !u.endsWith(".mp4") &&
        !u.endsWith(".webm") &&
        !u.includes("video/");
      // Temporal CONTINUATION only from observed LAST — not prev still (still is narrative, not seam)
      let prevLastForContinuation = isImgUrl(prevScene?.lastFrameUrl) ? prevScene!.lastFrameUrl : undefined;
      if (!prevLastForContinuation && prevScene?.videoUrl && isPlayableVideoUrl(prevScene.videoUrl)) {
        try {
          const extractedPrev = await extractVideoLastFrame(prevScene.videoUrl);
          if (extractedPrev?.blob) {
            const storedPrevLast = await ProductionAssetService.uploadAssetToStorage({
              productionId,
              brandId: (brand as any).id,
              assetType: "image",
              storagePath: brandProductionStoragePath((brand as any)?.id, productionId, `scenes/scene-0${targetSceneIdx}-last.jpg`),
              dataUrlOrBlob: extractedPrev.blob,
              mimeType: "image/jpeg",
              prompt: `Last frame of Scene ${targetSceneIdx} (fix-path pre-continuation)`,
              provider: "VideoFrameExtractor",
            });
            if (storedPrevLast?.publicUrl) {
              prevLastForContinuation = storedPrevLast.publicUrl;
              existingScenes[targetSceneIdx - 1] = {
                ...prevScene,
                lastFrameUrl: storedPrevLast.publicUrl,
              };
            }
          }
        } catch (fixPrevExt) {
          console.warn("[fixProductionScene] Prev last-frame extract notice:", fixPrevExt);
        }
      }
      const prevFrameCandidate = [
        prevLastForContinuation,
        prevScene?.keyframeImageUrl,
        prevScene?.image,
      ].find((u) => isImgUrl(u));

      const contentFormat = getEffectiveContentFormat({ brand, production, brief });
      const effectiveVisualGenre = resolveLiveVisualGenre({
        formatSettings: generationSettings.formatSettings,
        contentFormat,
        production,
        brief,
      });
      let plateUrl = resolveLocationPlateUrl({
        snapshotPlateUrl: generationSettings.snapshot?.character?.locationPlateUrl,
        brandPlateUrl: brand.locationPlateUrl,
        brandSettings: (brand as any).settings,
      });
      if (plateUrl && needsLocationPlateStorageUpload(plateUrl) && (brand as any)?.id) {
        try {
          const { uploadLocationPlateToStorage } = await import("../../backend/workspaceSync");
          plateUrl = await uploadLocationPlateToStorage((brand as any).id, plateUrl);
        } catch (plateErr) {
          console.warn("[fixProductionScene] Location plate Storage notice:", plateErr);
        }
      }
      const rawFixSubject = ((sceneToFix as any).subject || (sceneToFix as any).subjectType || "").toLowerCase();
      const resolvedFixSubject = resolveLiveBeatSubject({
        contentFormat,
        rawSubject: rawFixSubject,
        cameraDirection: (sceneToFix as any).cameraDirection,
        visualDescription: sceneToFix.visualDescription || (sceneToFix as any).description,
      });
      const isFixInsert = resolvedFixSubject === "insert";
      const isFixSet = resolvedFixSubject === "set";

      // Scene still is the I2V first frame — never the character sheet
      let sceneStill =
        [sceneToFix.image, sceneToFix.keyframeImageUrl].find((u) => isImgUrl(u)) ||
        findReusableStill({
          shotId,
          scene: sceneIndex,
          storyboard: brief.storyboard,
          productionScenes: existingScenes,
          generatedFrames: brief.generatedAssets?.generatedFrames,
        });

      // Set subjects: reuse locked plate as the still when regenerating
      if (shouldReuseLocationPlateAsStill({ resolvedSubject: resolvedFixSubject, locationPlateUrl: plateUrl })) {
        sceneStill = plateUrl;
      }

      const fixVisualLock = buildVisualLockRefsFromDirector({
        production,
        brand,
        character,
        previousLastFrameUrl: prevFrameCandidate,
        locationPlateUrl: plateUrl,
        subjectType: resolvedFixSubject,
        contentFormat,
        sceneKeyframeUrl: sceneStill,
        sceneId: (sceneToFix as any).sceneId,
        shotId,
      });

      const revisedScene = {
        ...sceneToFix,
        shotId,
        visualDescription: `${sceneToFix.visualDescription || sceneToFix.action || ""} [REVISION: ${editNotes}]`,
        primaryChange: `${sceneToFix.primaryChange || sceneToFix.action || sceneToFix.visualDescription || ""} — apply: ${editNotes}`,
      };

      const compiledStill = compileLiveStillPrompt({  scene: revisedScene,
        sceneIndexZeroBased: targetSceneIdx,
        aspectRatio: identityPack.aspectRatio,
        production,
        brief,
        memoryItems,
        refPromptHeader: fixVisualLock.refPromptHeader,
        subjectLine: `EXECUTIVE REVISION: ${editNotes}. Maintain locked identity and set continuity.`,
        contentFormat,
      });
      if (compiledStill.shotId && !(sceneToFix as any).shotId) {
        (sceneToFix as any).shotId = compiledStill.shotId;
      }

      // Always refresh the still for the fix so motion starts from the revised beat
      {
        const generatedStill = await withTimeout(
          ModelRouter.executeCategoryRequest("storyboardImages", {
            prompt: compiledStill.prompt,
            referenceImageUrl: fixVisualLock.primaryRefUrl,
            referenceImageUrls: fixVisualLock.imageUrls,
            aspectRatio: identityPack.aspectRatio,
                  preferredProvider: resolvedImageProvider,
                  model: resolvedImageModel,
          }),
          60000,
          `Scene ${sceneIndex} still regeneration timed out after 60s`
        );
        if (isValidMediaData(generatedStill)) {
          let finalStill = generatedStill;
          try {
            const storedStill = await ProductionAssetService.uploadAssetToStorage({
              productionId,
              brandId: (brand as any).id,
              assetType: "image",
              storagePath: brandProductionStoragePath((brand as any)?.id, productionId, `scenes/scene-0${sceneIndex}.png`),
              dataUrlOrBlob: generatedStill,
              mimeType: "image/png",
              prompt: compiledStill.prompt,
              provider: "ModelRouter",
              sceneId: (sceneToFix as any).sceneId,
              shotId: (sceneToFix as any).shotId || shotId,
              taskId: (sceneToFix as any).generationTaskId,
            });
            if (storedStill?.assetId) {
              sceneToFix.sourceImageAssetId = storedStill.assetId;
              sceneToFix.stillAssetId = storedStill.assetId;
              sceneToFix.assetIds = Array.from(new Set([...(sceneToFix.assetIds || []), storedStill.assetId]));
            }
            if (storedStill?.publicUrl) finalStill = storedStill.publicUrl;
          } catch {}
          sceneToFix.image = finalStill;
          sceneToFix.keyframeImageUrl = finalStill;
          sceneStill = finalStill;
          (sceneToFix as any).sourceStill = "revised_still";
          // Re-freeze creative spine from the revised still (force overwrite old lock)
          delete (sceneToFix as any).motionLock;
          attachSceneMotionLock(sceneToFix, {
            scene: revisedScene,
            environment: identityPack.environmentString,
            contentFormat,
            visualGenre: effectiveVisualGenre,
            cinematicCraft: generationSettings.formatSettings?.cinematicCraft !== false,
            sceneIndexZeroBased: targetSceneIdx,
            sourceStill: "revised_still",
            stillUrl: finalStill,
            beat: brief?.beats?.[targetSceneIdx],
          });
          revisedScene.image = finalStill;
          revisedScene.keyframeImageUrl = finalStill;
          (revisedScene as any).motionLock = (sceneToFix as any).motionLock;
          (revisedScene as any).physicalAction = (sceneToFix as any).physicalAction;
          (revisedScene as any).sourceStill = "revised_still";
        } else if (mode === "express") {
          sceneToFix.status = "needs_edit";
          sceneToFix.lastError = "Still regeneration returned no image.";
          return sceneToFix;
        }
      }

      if (mode === "express") {
        sceneToFix.status = "ready";
        sceneToFix.updatedAt = new Date().toISOString();
        return sceneToFix;
      }

      if (!sceneStill || !isImgUrl(sceneStill)) {
        sceneToFix.status = "needs_edit";
        sceneToFix.lastError =
          "Consistency Gate: Scene still missing — cannot I2V without this shot's still as first frame.";
        return sceneToFix;
      }

      const activeVideo = resolveActiveVideoProvider({
        preferredVideoProvider: generationSettings.preferredVideoProvider as any,
      });
      const nativeMaxClipSec = activeVideo.maxVideoDurationSec || 8;
      const rawFixDur = sceneToFix.durationSec || parseInt(String(sceneToFix.duration)) || 8;
      const fixTargetDuration =
        snapToAllowedDuration(Math.min(rawFixDur, nativeMaxClipSec), activeVideo.providerId) ||
        Math.min(rawFixDur, 8);

      const nextFixScene = existingScenes[targetSceneIdx + 1];
      const fixContinuity = resolveLiveSceneContinuity({
        productionId,
        sceneIndexZeroBased: targetSceneIdx,
        shotId,
        sceneStillUrl: sceneStill,
        previousLastFrameUrl: prevLastForContinuation,
        previousShotId: (prevScene as any)?.shotId || (prevScene as any)?.id,
        nextSceneStillUrl: nextFixScene?.image || nextFixScene?.keyframeImageUrl,
        nextShotId: (nextFixScene as any)?.shotId || (nextFixScene as any)?.id,
        preferContinuation: targetSceneIdx > 0,
      });
      const officialFix = resolveOfficialI2vClipFrames({
        sceneImage: sceneStill,
        keyframeUrl: sceneToFix.keyframeImageUrl || (sceneToFix as any).keyframe,
        previousLastFrameUrl: prevLastForContinuation,
        plannedEndUrl: nextFixScene?.image || nextFixScene?.keyframeImageUrl || fixContinuity.endFrameUrl,
        forbidden: {
          gridUrl: brief?.storyboardGridUrl || brief?.generatedAssets?.storyboardGridUrl,
          sheetUrls: [character?.characterSheetUrl, character?.imageUrl, character?.avatarUrl],
          plateUrl,
        },
        sceneLabel: `Scene ${sceneIndex} fix`,
      });
      const fixFirstFrame = officialFix.firstFrameUrl;
      const fixEndFrame = officialFix.endFrameUrl;
      const fixLastFrame = officialFix.lastFrameUrl;
      const veoLikeFix = /^(gemini|veo|google)$/i.test(String(activeVideo.providerId || ""));
      const fixI2vDuration = veoLikeFix && fixLastFrame ? 8 : fixTargetDuration;
      if (fixContinuity.continuityGap) {
        console.warn(`[fixProductionScene] Continuity GAP: ${fixContinuity.gapReason}`);
      }
      console.log(
        `[fixProductionScene] Official I2V: frame1=shot still lastFrame=${Boolean(fixLastFrame)}`
      );

      const charSheetUrl =
        character?.characterSheetUrl || character?.imageUrl || character?.avatarUrl;
      const fixRefLabels = [
        `INPUT REF [1]: First Frame Keyframe (Scene ${sceneIndex} shot still)`,
        fixLastFrame ? "INPUT REF [lastFrame]: Previous shot extracted last frame" : "",
        charSheetUrl && isImgUrl(charSheetUrl)
          ? `Character sheet logged for Review (not i2v start): ${character?.name || "Host"}`
          : "",
      ].filter(Boolean) as string[];

      // Ensure lock exists even if still regen was skipped (reuse path)
      if (!(sceneToFix as any).motionLock) {
        attachSceneMotionLock(sceneToFix, {
          scene: revisedScene,
          environment: identityPack.environmentString,
          contentFormat,
          visualGenre: effectiveVisualGenre,
          cinematicCraft: generationSettings.formatSettings?.cinematicCraft !== false,
          sceneIndexZeroBased: targetSceneIdx,
          sourceStill: "revised_still",
          stillUrl: sceneStill,
          beat: brief?.beats?.[targetSceneIdx],
        });
        (revisedScene as any).motionLock = (sceneToFix as any).motionLock;
        (revisedScene as any).physicalAction = (sceneToFix as any).physicalAction;
      }

      const motionPrompt = compileLiveMotionPrompt({  mode,
        aspectRatio: identityPack.aspectRatio,
        sceneIndex,
        totalScenes: existingScenes.length,
        durationSec: fixI2vDuration,
        scene: { ...revisedScene, motionLock: (sceneToFix as any).motionLock },
        refLabels: fixRefLabels,
        isInsertOrSet: isFixInsert || isFixSet,
        characterName: character?.name,
        characterStyle: character?.style,
        environment: identityPack.environmentString,
        brief,
        revisionNotes: editNotes,
        contentFormat,
        followStoryboardStill: true,
      }).prompt;

      const fixTimeoutMs = isI2vApiProvider(activeVideo.providerId) ? 20 * 60 * 1000 : 360000;

      let fixPreferredModel =
        (generationSettings as any)?.preferredVideoModel ||
        (sceneToFix as any)?.videoModel;

      if (!fixPreferredModel) {
        const repairDecision = routeMediaCapability({
          modality: "video",
          generationMode: "image_to_video",
          temporal: {
            requiresStartFrame: true,
            requiresEndFrame: Boolean(fixEndFrame),
          },
          output: {
            durationSeconds: fixI2vDuration,
            aspectRatio: identityPack.aspectRatio,
          },
          preferences: {
            preferredProviderId: activeVideo.providerId,
          },
        });
        fixPreferredModel = repairDecision.selected?.modelId;
      }

      let generatedClip = "";
      let generatedLastFrameDataUrl: string | undefined;
      if (isI2vApiProvider(activeVideo.providerId) && fixFirstFrame) {
        const apiClip = await withTimeout(
          requestProductionVideoClip({
            provider: activeVideo.providerId,
            prompt: motionPrompt,
            firstFrameUrl: fixFirstFrame,
            endFrameUrl: fixEndFrame,
            referenceImageUrls: [],
            aspectRatio: identityPack.aspectRatio,
            durationSec: fixI2vDuration,
            model: fixPreferredModel,
            productionId,
            brandId: (brand as any).id,
            shotIndex: sceneIndex,
          }),
          fixTimeoutMs,
          `Scene ${sceneIndex} video regeneration timed out after ${Math.round(fixTimeoutMs / 1000)}s`
        );
        generatedClip = apiClip.videoUrl;
        generatedLastFrameDataUrl = apiClip.lastFrameDataUrl;
      } else {
        generatedClip = await withTimeout(
          ModelRouter.executeCategoryRequest("videoGeneration", {
            prompt: motionPrompt,
            firstFrameUrl: fixFirstFrame,
            referenceImageUrl: fixFirstFrame,
            referenceImageUrls: [],
            aspectRatio: identityPack.aspectRatio,
            durationSec: fixI2vDuration,
            lastFrameUrl: fixLastFrame,
            endFrameUrl: fixEndFrame,
            preferredProvider: activeVideo.providerId,
            productionId,
            brandId: (brand as any).id,
            shotIndex: sceneIndex,
          }),
          fixTimeoutMs,
          `Scene ${sceneIndex} video regeneration timed out after ${Math.round(fixTimeoutMs / 1000)}s`
        );
      }

      let finalClipUrl = generatedClip;
      if (isPlayableVideoUrl(generatedClip)) {
        let fixClipAssetId: string | undefined;
        try {
          const storedAsset = await ProductionAssetService.uploadAssetToStorage({
            productionId,
            brandId: (brand as any).id,
            assetType: "video",
            storagePath: brandProductionStoragePath((brand as any)?.id, productionId, `video/shot-${sceneIndex}.mp4`),
            dataUrlOrBlob: generatedClip,
            mimeType: "video/mp4",
            prompt: motionPrompt,
            provider: "ModelRouter",
            sceneId: (sceneToFix as any).sceneId,
            shotId: (sceneToFix as any).shotId || shotId,
            taskId: (sceneToFix as any).generationTaskId,
          });
          if (storedAsset?.assetId) {
            fixClipAssetId = storedAsset.assetId;
          }
          if (storedAsset?.publicUrl && isPersistableSparkMediaUrl(storedAsset.publicUrl)) {
            finalClipUrl = storedAsset.publicUrl;
          } else if (!isPersistableSparkMediaUrl(generatedClip)) {
            throw new Error(`Scene ${sceneIndex} Video: persist to Spark failed`);
          }
        } catch (persistErr) {
          if (String((persistErr as Error)?.message || "").includes("persist to Spark")) throw persistErr;
          throw new Error(`Scene ${sceneIndex} Video: persist to Spark failed`);
        }

        try {
          const lastExtract = await extractVideoLastFrame(finalClipUrl);
          const lastPayload = lastExtract?.blob || generatedLastFrameDataUrl;
          if (lastPayload) {
            const storedRevLast = await ProductionAssetService.uploadAssetToStorage({
              productionId,
              brandId: (brand as any).id,
              assetType: "image",
              storagePath: brandProductionStoragePath((brand as any)?.id, productionId, `scenes/scene-0${sceneIndex}-last.jpg`),
              dataUrlOrBlob: lastPayload,
              mimeType: "image/jpeg",
              prompt: `Revised last frame of Scene ${sceneIndex}`,
              provider: "VideoFrameExtractor",
              sceneId: (sceneToFix as any).sceneId,
              shotId: (sceneToFix as any).shotId || shotId,
            });
            if (storedRevLast?.publicUrl) {
              sceneToFix.lastFrameUrl = storedRevLast.publicUrl;
              const gsf = stampSceneGeneratedStateFrame({
                productionId,
                shotId,
                videoUrl: finalClipUrl,
                lastFrameUrl: storedRevLast.publicUrl,
                sceneIndexZeroBased: targetSceneIdx,
              });
              (sceneToFix as any).generatedStateFrame = gsf;
              (sceneToFix as any).generatedStateFrameId = gsf.id;
            }
          }
        } catch (revLastErr) {
          console.warn("[ProductionAssetService] Revised scene last frame extract notice:", revLastErr);
        }

        if (fixClipAssetId) {
          sceneToFix.videoAssetId = fixClipAssetId;
          sceneToFix.assetIds = Array.from(new Set([...(sceneToFix.assetIds || []), fixClipAssetId]));
        }
      }

      sceneToFix.videoUrl = finalClipUrl;
      sceneToFix.status = isPlayableVideoUrl(finalClipUrl) ? "ready" : "needs_edit";
      sceneToFix.updatedAt = new Date().toISOString();

      return sceneToFix;
    } catch (err: any) {
      sceneToFix.status = "needs_edit";
      sceneToFix.lastError = err?.message || String(err);
      return sceneToFix;
    }
  }

  /**
   * Concatenate ready scene video clips in index order into one master video
   */
  public static async mergeProductionScenes(params: {
    productionId: string;
    production: Production;
    brand: Brand;
  }): Promise<string | null> {
    const { productionId, production, brand } = params;
    ProductionGenerationGuard.assertEnabled("ProductionAssetService.mergeProductionScenes", brand?.id);
    const brief = production.brief || ({} as ProductionBrief);
    const scenes = (production.productionScenes && production.productionScenes.length > 0)
      ? production.productionScenes
      : (brief.storyboard || []).map((sb, idx) => ({
          scene: sb.scene || idx + 1,
          index: sb.scene || idx + 1,
          id: `scene-${productionId}-${sb.scene || idx + 1}`,
          productionId,
          duration: sb.duration || `${sb.durationSec || 0}s`,
          durationSec: sb.durationSec || parseInt(sb.duration),
          onScreenText: sb.onScreenText,
          audio: sb.audio,
          videoUrl: sb.videoUrl,
          status: sb.videoUrl ? "ready" : "pending",
        })) as any[];

    const mode = String(production.productionMode || production.mode || brief.productionMode || "").toLowerCase();
    const isNarrator = mode === "express" || mode === "narrator";

    // Narrator: if production.videoUrl is already a durable compile master, no-op success
    if (isNarrator && isDurableMasterVideoReady(production.videoUrl)) {
      console.log(`[ProductionAssetService] Narrator mode with durable master already present -> no-op success: ${production.videoUrl}`);
      return production.videoUrl || null;
    }

    const orderedScenes = [...scenes].sort((a, b) => (a.index || a.scene) - (b.index || b.scene));
    // Ingest any ephemeral / provider CDN scene clips to durable Spark storage before collecting shot clips
    for (let i = 0; i < orderedScenes.length; i++) {
      const s = orderedScenes[i];
      const sceneIdx = s.index || s.scene || (i + 1);
      if (s.videoUrl && (isEphemeralMediaUrl(s.videoUrl) || !isSparkShotClipUrl(s.videoUrl))) {
        console.log(
          `[ProductionAssetService] Pre-ingesting ephemeral scene ${sceneIdx} clip to durable Spark storage before merge: ${s.videoUrl}`
        );
        try {
          const { ingestRemoteMediaToSpark } = await import("./ingestMediaToSpark");
          const targetPath = brandProductionStoragePath((brand as any)?.id, productionId, `video/shot-${sceneIdx}.mp4`);
          const ingested = await ingestRemoteMediaToSpark({
            url: s.videoUrl,
            brandId: (brand as any)?.id,
            productionId,
            assetType: "video",
            storagePath: targetPath,
          });
          if (ingested?.publicUrl) {
            s.videoUrl = ingested.publicUrl;
            if (brief.storyboard) {
              const sbScene = brief.storyboard.find((item: any) => (item.scene || item.index) === sceneIdx);
              if (sbScene) sbScene.videoUrl = ingested.publicUrl;
            }
          }
        } catch (ingestErr) {
          console.warn(`[ProductionAssetService] Pre-merge ingest for scene ${sceneIdx} notice:`, ingestErr);
        }
      }
    }

    const clipCandidates = [
      ...orderedScenes.map((s) => s.videoUrl),
      ...((brief.generatedAssets?.generatedVideos || []) as Array<string | undefined>),
    ];
    const readyClips = collectSparkShotClipUrls(clipCandidates);

    const isCinematic = mode === "deep" || mode === "cinematic";
    const hasVoScenes = !isCinematic && scenes.length > 0 && scenes.some((s) => s.audio === "vo");
    const mergeAudioUrl = (isNarrator || hasVoScenes) ? (brief.audioUrl || production.audioUrl) : undefined;

    const failMerge = (message: string) => {
      production.status = "Failed";
      production.lastError = message;
      production.generationProgress = {
        stage: "Failed",
        percent: 0,
        message,
        stages: production.generationProgress?.stages || [],
      };
      return null;
    };

    if (readyClips.length < 1) {
      const hasAnyClips = orderedScenes.some((s) => s.videoUrl);
      const msg = hasAnyClips
        ? "Approve & merge needs at least one durable Spark clip at brands/{brandId}/{productionId}/video/shot-N.mp4. Scene clips are provider CDN URLs and could not be ingested to Spark storage. Please retry ingest or regenerate shots."
        : "Approve & merge needs at least one durable Spark clip at brands/{brandId}/{productionId}/video/shot-N.mp4. Missing shots were skipped; none remained.";
      return failMerge(msg);
    }

    try {
      const mergeResult = await assembleMasterFromClips({
        productionId,
        brandId: (brand as any)?.id,
        videoUrls: readyClips,
        audioUrl: mergeAudioUrl,
        timeoutMs: 120000,
      });

      if (mergeResult?.publicUrl && isDurableMasterVideoReady(mergeResult.publicUrl)) {
        const masterUrl = mergeResult.publicUrl;
        const storagePath =
          mergeResult.storagePath || extractSparkStoragePath(masterUrl) || production.videoStoragePath;
        production.videoUrl = masterUrl;
        production.videoStoragePath = storagePath;
        production.canonicalMasterUrl = masterUrl;
        (production as any).masterVideoUrl = masterUrl;
        (production as any).assemblyStatus = "assembled";

        brief.videoUrl = masterUrl;
        brief.playablePreviewUrl = masterUrl;
        brief.video_storage_path = storagePath;
        (brief as any).canonicalMasterUrl = masterUrl;
        (brief as any).masterVideoUrl = masterUrl;
        (brief as any).assemblyStatus = "assembled";

        if (!brief.generatedAssets) brief.generatedAssets = {};
        (brief.generatedAssets as any).canonicalMasterUrl = masterUrl;
        brief.generatedAssets.generatedVideos = [masterUrl];

        production.status = "Ready for Review";
        production.generationProgress = {
          stage: "Complete",
          percent: 100,
          message: "Master film compiled and saved to Spark storage",
          stages: production.generationProgress?.stages || [],
        };
        return masterUrl;
      }

      if (
        mergeResult?.assemblyStatus === "assembly_pending" ||
        mergeResult?.ffmpegAvailable === false ||
        String(mergeResult?.error || "").includes("FFMPEG_UNAVAILABLE")
      ) {
        const pendingMsg =
          mergeResult?.error ||
          "Master video assembly pending: FFmpeg is not available on this serverless image. Scene clips remain playable.";
        production.assemblyStatus = "assembly_pending";
        (production as any).assemblyError = pendingMsg;
        (brief as any).assemblyStatus = "assembly_pending";
        (brief as any).assemblyError = pendingMsg;
        production.generationProgress = {
          stage: "Ready for Review",
          percent: 100,
          message: pendingMsg,
          stages: production.generationProgress?.stages || [],
        };
        if (production.status !== "Approved") {
          production.status = "Ready for Review";
        }
        return null;
      }

      return failMerge(
        mergeResult?.error ||
          "Server ffmpeg merge did not write video/master.mp4. Canvas/MediaRecorder is not a master."
      );
    } catch (err: any) {
      console.error("[ProductionAssetService] Merge execution notice:", err);
      const errStr = String(err?.message || err);
      if (errStr.includes("FFMPEG_UNAVAILABLE") || /ffmpeg is not available/i.test(errStr)) {
        const pendingMsg =
          "Master video assembly pending: FFmpeg is not available on this serverless image. Scene clips remain playable.";
        production.assemblyStatus = "assembly_pending";
        (production as any).assemblyError = pendingMsg;
        (brief as any).assemblyStatus = "assembly_pending";
        (brief as any).assemblyError = pendingMsg;
        production.generationProgress = {
          stage: "Ready for Review",
          percent: 100,
          message: pendingMsg,
          stages: production.generationProgress?.stages || [],
        };
        if (production.status !== "Approved") {
          production.status = "Ready for Review";
        }
        return null;
      }
      return failMerge(
        err?.message || "Server ffmpeg merge failed. Canvas/MediaRecorder is not a master."
      );
    }
  }
}

/**
 * Resolves a fresh playable/viewable signed URL for any media asset in bucket "Spark".
 * - If url is a non-expired Spark signed or public URL, returns it as-is.
 * - If url is an expired Spark signed URL, extracts the storage_path and mints a fresh 7-day signed URL.
 * - If url is ephemeral, checks known storagePath or queries media_assets for matching storage_path.
 * - If storage_path is found, mints a fresh 7-day signed URL.
 * - If url is ephemeral and NO storage path exists, returns null (do not invent or fabricate).
 */
export async function resolveFreshPlayableUrl(params: {
  url?: string | null;
  storagePath?: string | null;
  productionId?: string;
  brandId?: string;
  assetType?: "video" | "audio" | "image";
  mediaAssets?: import("../../backend/database.types").MediaAssetRow[];
}): Promise<{ url?: string; storagePath?: string; resigned: boolean; isEphemeralWithoutStorage: boolean }> {
  const { url, productionId, brandId, assetType, mediaAssets = [] } = params;
  let targetPath = params.storagePath || null;

  if (url) {
    const extracted = extractSparkStoragePath(url);
    if (extracted) {
      targetPath = extracted;
      const isExpired = isSignedUrlExpiredOrExpiringSoon(url);
      if (!isExpired) {
        return { url, storagePath: extracted, resigned: false, isEphemeralWithoutStorage: false };
      }
    }
  }

  // If no targetPath yet, search in mediaAssets table records
  if (!targetPath && (productionId || brandId)) {
    const matchedAsset = mediaAssets.find((m) => {
      if (!m.storage_path) return false;
      const matchesProd = productionId ? m.storage_path.includes(productionId) : true;
      const matchesType = assetType
        ? (m.file_type === assetType ||
           (assetType === "video" && m.storage_path.endsWith(".mp4")) ||
           (assetType === "audio" && (m.storage_path.endsWith(".mp3") || m.storage_path.endsWith(".wav"))))
        : true;
      return matchesProd && matchesType;
    });
    if (matchedAsset?.storage_path) {
      targetPath = matchedAsset.storage_path;
    }
  }

  // If targetPath is known, re-sign from Supabase storage bucket "Spark"
  if (targetPath) {
    const freshSignedUrl = await ProductionAssetService.resolveSignedUrl(targetPath, 60 * 60 * 24 * 7);
    if (freshSignedUrl) {
      return { url: freshSignedUrl, storagePath: targetPath, resigned: true, isEphemeralWithoutStorage: false };
    }
    return { url: undefined, storagePath: targetPath, resigned: false, isEphemeralWithoutStorage: false };
  }

  // If URL is ephemeral and we found no storage path yet (pre-ingest or ingest in-flight):
  // Do NOT wipe the only playable URL pre-ingest; keep provider URL for immediate playback.
  if (url && isEphemeralMediaUrl(url)) {
    return { url, storagePath: undefined, resigned: false, isEphemeralWithoutStorage: true };
  }

  // Otherwise return whatever valid non-ephemeral URL we had
  return { url: url || undefined, storagePath: targetPath || undefined, resigned: false, isEphemeralWithoutStorage: false };
}

/**
 * Iterates through all media fields on a production and resigns expired or storage-backed URLs.
 * Never alters production status (resigning is for playback/preview only).
 */
export async function refreshProductionMediaAssets(
  production: Production,
  mediaAssets: import("../../backend/database.types").MediaAssetRow[] = []
): Promise<{ production: Production; didResign: boolean }> {
  let didResign = false;

  const brief = production.brief ? { ...production.brief } : undefined;
  const genAssets = brief?.generatedAssets ? { ...brief.generatedAssets } : undefined;
  let updatedVideoUrl = production.videoUrl || brief?.videoUrl;
  let updatedAudioUrl = production.audioUrl || brief?.audioUrl || genAssets?.voiceoverUrl;
  let updatedGridUrl = production.storyboardGridUrl || brief?.storyboardGridUrl || genAssets?.storyboardGridUrl;
  let updatedThumbUrl = production.thumbnailUrl || brief?.thumbnailUrl;
  let updatedLastError = production.lastError || brief?.lastError;

  // 1. Video URL
  const knownVideoStoragePath =
    production.videoStoragePath ||
    (brief as any)?.video_storage_path ||
    (brief as any)?.generatedAssets?.video_storage_path ||
    extractSparkStoragePath(updatedVideoUrl);

  if (updatedVideoUrl) {
    const res = await resolveFreshPlayableUrl({
      url: updatedVideoUrl,
      storagePath: knownVideoStoragePath,
      productionId: production.id,
      brandId: production.brandId,
      assetType: "video",
      mediaAssets,
    });
    if (res.resigned) didResign = true;
    if (res.url) {
      updatedVideoUrl = res.url;
    } else if (res.isEphemeralWithoutStorage) {
      updatedVideoUrl = undefined;
      updatedLastError = "Asset not in Spark storage";
    }
  } else {
    const res = await resolveFreshPlayableUrl({
      storagePath: knownVideoStoragePath,
      productionId: production.id,
      brandId: production.brandId,
      assetType: "video",
      mediaAssets,
    });
    if (res.url) {
      updatedVideoUrl = res.url;
      didResign = true;
    }
  }

  // 2. Audio URL
  if (updatedAudioUrl) {
    const res = await resolveFreshPlayableUrl({
      url: updatedAudioUrl,
      productionId: production.id,
      brandId: production.brandId,
      assetType: "audio",
      mediaAssets,
    });
    if (res.resigned) didResign = true;
    if (res.url) {
      updatedAudioUrl = res.url;
    } else if (res.isEphemeralWithoutStorage) {
      updatedAudioUrl = undefined;
    }
  } else {
    const res = await resolveFreshPlayableUrl({
      productionId: production.id,
      brandId: production.brandId,
      assetType: "audio",
      mediaAssets,
    });
    if (res.url) {
      updatedAudioUrl = res.url;
      didResign = true;
    }
  }

  // 3. Storyboard Grid / Take Grids
  if (updatedGridUrl) {
    const res = await resolveFreshPlayableUrl({
      url: updatedGridUrl,
      productionId: production.id,
      brandId: production.brandId,
      assetType: "image",
      mediaAssets,
    });
    if (res.resigned) didResign = true;
    if (res.url) {
      updatedGridUrl = res.url;
    } else if (res.isEphemeralWithoutStorage) {
      updatedGridUrl = undefined;
    }
  }

  // Take grids array
  if (genAssets?.takeGrids && Array.isArray(genAssets.takeGrids)) {
    const refreshedGrids: string[] = [];
    for (const gridUrl of genAssets.takeGrids) {
      const res = await resolveFreshPlayableUrl({
        url: gridUrl,
        productionId: production.id,
        brandId: production.brandId,
        assetType: "image",
        mediaAssets,
      });
      if (res.resigned) didResign = true;
      if (res.url) refreshedGrids.push(res.url);
    }
    if (refreshedGrids.length > 0) {
      genAssets.takeGrids = refreshedGrids;
    }
  }

  // 4. Thumbnail URL
  if (updatedThumbUrl) {
    const res = await resolveFreshPlayableUrl({
      url: updatedThumbUrl,
      productionId: production.id,
      brandId: production.brandId,
      assetType: "image",
      mediaAssets,
    });
    if (res.resigned) didResign = true;
    if (res.url) {
      updatedThumbUrl = res.url;
    } else if (res.isEphemeralWithoutStorage) {
      updatedThumbUrl = undefined;
    }
  }

  // Generated videos array
  if (genAssets?.generatedVideos && Array.isArray(genAssets.generatedVideos)) {
    const refreshedClips: string[] = [];
    for (const clipUrl of genAssets.generatedVideos) {
      const res = await resolveFreshPlayableUrl({
        url: clipUrl,
        productionId: production.id,
        brandId: production.brandId,
        assetType: "video",
        mediaAssets,
      });
      if (res.resigned) didResign = true;
      if (res.url) refreshedClips.push(res.url);
    }
    if (refreshedClips.length > 0) {
      genAssets.generatedVideos = refreshedClips;
    }
  }

  const resolvedVideoStoragePath =
    extractSparkStoragePath(updatedVideoUrl) || knownVideoStoragePath || undefined;

  if (brief?.storyboard && Array.isArray(brief.storyboard)) {
    const nextStoryboard: ProductionScene[] = [];
    for (const scene of brief.storyboard) {
      if (!scene?.videoUrl) {
        nextStoryboard.push(scene);
        continue;
      }
      const res = await resolveFreshPlayableUrl({
        url: scene.videoUrl,
        storagePath: extractSparkStoragePath(scene.videoUrl),
        productionId: production.id,
        brandId: production.brandId,
        assetType: "video",
        mediaAssets,
      });
      if (res.resigned) didResign = true;
      if (res.url) nextStoryboard.push({ ...scene, videoUrl: res.url });
      else if (res.isEphemeralWithoutStorage) nextStoryboard.push({ ...scene, videoUrl: undefined });
      else nextStoryboard.push(scene);
    }
    if (brief) brief.storyboard = nextStoryboard;
  }

  // Re-assemble brief
  let updatedBrief = brief;
  if (updatedBrief) {
    if (genAssets) {
      genAssets.storyboardGridUrl = updatedGridUrl;
      genAssets.voiceoverUrl = updatedAudioUrl;
      if (updatedThumbUrl && genAssets.thumbnailUrls) {
        genAssets.thumbnailUrls = [updatedThumbUrl, ...(genAssets.thumbnailUrls.slice(1))];
      }
      updatedBrief.generatedAssets = genAssets;
    }
    updatedBrief.videoUrl = updatedVideoUrl;
    updatedBrief.audioUrl = updatedAudioUrl;
    updatedBrief.storyboardGridUrl = updatedGridUrl;
    updatedBrief.thumbnailUrl = updatedThumbUrl;
    updatedBrief.video_storage_path = resolvedVideoStoragePath;
    if (updatedLastError) updatedBrief.lastError = updatedLastError;
  }

  const updatedProduction: Production = {
    ...production,
    videoUrl: updatedVideoUrl,
    videoStoragePath: resolvedVideoStoragePath,
    audioUrl: updatedAudioUrl,
    storyboardGridUrl: updatedGridUrl,
    thumbnailUrl: updatedThumbUrl,
    lastError: updatedLastError,
    brief: updatedBrief,
  };

  return { production: updatedProduction, didResign };
}

/**
 * Resigns character sheet / avatar / image URLs if stored in bucket "Spark"
 */
export async function refreshCharacterMediaAssets(
  character: Character,
  mediaAssets: import("../../backend/database.types").MediaAssetRow[] = []
): Promise<{ character: Character; didResign: boolean }> {
  let didResign = false;
  let updatedSheet = character.characterSheetUrl;
  let updatedAvatar = character.avatarUrl;
  let updatedImage = character.imageUrl;

  if (updatedSheet) {
    const res = await resolveFreshPlayableUrl({
      url: updatedSheet,
      brandId: character.brandId,
      assetType: "image",
      mediaAssets,
    });
    if (res.resigned) didResign = true;
    if (res.url) updatedSheet = res.url;
  }

  if (updatedAvatar) {
    const res = await resolveFreshPlayableUrl({
      url: updatedAvatar,
      brandId: character.brandId,
      assetType: "image",
      mediaAssets,
    });
    if (res.resigned) didResign = true;
    if (res.url) updatedAvatar = res.url;
  }

  if (updatedImage) {
    const res = await resolveFreshPlayableUrl({
      url: updatedImage,
      brandId: character.brandId,
      assetType: "image",
      mediaAssets,
    });
    if (res.resigned) didResign = true;
    if (res.url) updatedImage = res.url;
  }

  const updatedCharacter: Character = {
    ...character,
    characterSheetUrl: updatedSheet,
    avatarUrl: updatedAvatar,
    imageUrl: updatedImage || updatedAvatar || updatedSheet,
  };

  return { character: updatedCharacter, didResign };
}
