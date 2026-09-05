/**
 * Bidirectional adapters between legacy ProductionBrief/ProductionScene and ProductionSpec.
 * Existing persisted productions keep working; new planning uses ProductionSpec.
 */

import type {
  Production,
  ProductionBrief,
  ProductionBriefBeat,
  ProductionScene,
  ViralSpark,
  Brand,
  Character,
} from "../../../domain/types";
import type { ProductionSpec, CreativeSpec, ProjectSpec, AspectRatioId, PlatformId } from "./productionSpec";
import type { SceneSpec } from "./sceneSpec";
import type { ShotSpec } from "./shotSpec";
import { createCharacterMaster, createLocationMaster, makeAssetRef } from "./assetSpec";
import { buildDefaultAudioSpec } from "./audioSpec";
import { createDefaultRoutingSpec } from "./routingSpec";
import { createDefaultQualitySpec } from "./qualitySpec";
import { emptyContinuityState } from "./continuitySpec";
import { buildResearchRequirement } from "./researchRequirement";

const SPEC_VERSION = "1.0.0";
const COMPILER_VERSION = "1.0.0";

function parseDurationSec(raw?: string, fallback = 5): number {
  if (!raw) return fallback;
  const m = /(\d+(\.\d+)?)/.exec(raw);
  if (!m) return fallback;
  return Math.max(1, Number(m[1]));
}

function inferShotType(camera: string): ShotSpec["camera"]["shotType"] {
  const c = (camera || "").toLowerCase();
  if (c.includes("establish") || c.includes("wide")) return "establishing";
  if (c.includes("insert") || c.includes("detail") || c.includes("macro")) return "insert";
  if (c.includes("close") || c.includes("cu")) return "closeup";
  if (c.includes("ots") || c.includes("over")) return "over_the_shoulder";
  if (c.includes("pov")) return "pov";
  if (c.includes("aerial") || c.includes("drone")) return "aerial";
  if (c.includes("track") || c.includes("dolly")) return "tracking";
  if (c.includes("medium") || c.includes("ms")) return "medium";
  return "medium";
}

function inferCameraMovement(camera: string): ShotSpec["camera"]["cameraMovement"] {
  const c = (camera || "").toLowerCase();
  if (c.includes("static") || c.includes("locked")) return "static";
  if (c.includes("handheld")) return "handheld";
  if (c.includes("dolly")) return "dolly";
  if (c.includes("crane")) return "crane";
  if (c.includes("track")) return "tracking";
  if (c.includes("push")) return "push_in";
  if (c.includes("pull")) return "pull_out";
  if (c.includes("pan")) return "pan";
  if (c.includes("tilt")) return "tilt";
  return "static";
}

function mapPlatforms(platformRecommendation?: string, formats?: string[]): PlatformId[] {
  const blob = `${platformRecommendation || ""} ${(formats || []).join(" ")}`.toLowerCase();
  const out: PlatformId[] = [];
  if (blob.includes("tiktok")) out.push("tiktok");
  if (blob.includes("short")) out.push("youtube_shorts");
  if (blob.includes("instagram") || blob.includes("reels")) out.push("instagram");
  if (blob.includes("linkedin")) out.push("linkedin");
  if (blob.includes("facebook")) out.push("facebook");
  if (blob.includes("youtube") && !out.includes("youtube_shorts")) out.push("youtube");
  if (out.length === 0) out.push("youtube_shorts");
  return out;
}

export function productionSceneToSceneSpec(
  scene: ProductionScene,
  productionId: string,
  opts?: { characterIds?: string[]; aspectRatio?: string }
): SceneSpec {
  const index = scene.index ?? scene.scene ?? 0;
  const durationSec = scene.durationSec ?? parseDurationSec(scene.duration, 5);
  const sceneId = scene.id || `${productionId}_scene_${index}`;
  const cameraRaw = scene.cameraDirection || scene.camera || scene.shotList || "";
  const start = scene.startState || "Scene opens on established subject and set";
  const end = scene.endState || scene.primaryChange || "Scene resolves primary action";
  const action = scene.action || scene.primaryChange || scene.visualDescription || "Primary beat action";

  const shot: ShotSpec = {
    id: `${sceneId}_shot_0`,
    sceneId,
    index: 0,
    purpose: scene.valueJob || "story_beat",
    productionReason: `Deliver ${scene.valueJob || "beat"}: ${scene.visualDescription || action}`.slice(0, 240),
    timingStartSec: 0,
    durationSec,
    camera: {
      shotType: inferShotType(cameraRaw),
      framing: cameraRaw || "medium framing",
      composition: "subject-centered professional composition",
      cameraPosition: "eye-level",
      cameraMovement: inferCameraMovement(cameraRaw),
      lens: "35-50mm prime",
      depthOfField: "natural cinema DOF",
      focus: "primary subject",
    },
    subject: scene.subject || scene.subjectType || "main",
    subjectAction: action,
    blocking: scene.shotList,
    performanceDirection: scene.editNotes,
    dialogue: scene.audio === "talent" ? scene.spokenLines || scene.scriptSnippet : undefined,
    narration: scene.audio !== "talent" ? scene.spokenLines || scene.scriptSnippet : undefined,
    environment: scene.visualDescription || "brand set",
    lighting: { atmosphere: "coherent production lighting", timeOfDay: undefined },
    atmosphere: scene.pacing,
    motion: {
      subjectMovement: action,
      cameraMovementDetail: cameraRaw || "locked-off or subtle motivated move",
      beginState: start,
      endState: end,
      performanceDirection: scene.spokenLines,
    },
    references: {
      characterRefs: [],
      locationRefs: [],
      styleRefs: [],
      firstFrameUrl: scene.keyframeImageUrl || scene.image || scene.mediaUrl,
      lastFrameUrl: scene.lastFrameUrl,
    },
    transitionIn: undefined,
    transitionOut: scene.transitions,
    continuityRequirements: [
      "Preserve subject identity",
      "Preserve wardrobe and set",
      start,
      end,
    ],
    characterIds: opts?.characterIds || [],
    propIds: [],
    assetIds: [],
    generationStrategy: scene.videoUrl ? "image_to_video" : "image_to_video",
    aspectRatio: opts?.aspectRatio,
    generationStatus: scene.status === "ready" || scene.status === "approved" ? "approved" : "planned",
    qcStatus: "pending",
    mediaUrl: scene.videoUrl,
    keyframeUrl: scene.keyframeImageUrl || scene.image,
    lastFrameUrl: scene.lastFrameUrl,
  };

  return {
    id: sceneId,
    index,
    title: `Scene ${index + 1}`,
    purpose: scene.valueJob || "story_beat",
    narrativeFunction: (scene.valueJob as SceneSpec["narrativeFunction"]) || "context",
    environment: scene.visualDescription || "",
    durationSec,
    characterIds: opts?.characterIds || [],
    propIds: [],
    emotionalObjective: scene.pacing || "clear progression",
    dialogue: scene.audio === "talent" ? scene.spokenLines : undefined,
    narration: scene.audio !== "talent" ? scene.spokenLines || scene.scriptSnippet : undefined,
    soundEffects: [],
    continuity: {
      entranceState: start,
      exitState: end,
      identityLocks: ["primary_subject"],
      wardrobeLocks: ["primary_wardrobe"],
      propLocks: [],
    },
    shots: [shot],
    transitionOut: scene.transitions,
    valueJob: scene.valueJob,
    spokenLines: scene.spokenLines || scene.scriptSnippet,
    onScreenText: scene.onScreenText,
    visualDescription: scene.visualDescription,
    status: (scene.status as SceneSpec["status"]) || "planned",
  };
}

export function sceneSpecToProductionScene(scene: SceneSpec): ProductionScene {
  const primary = scene.shots[0];
  return {
    scene: scene.index,
    index: scene.index,
    id: scene.id,
    sceneId: scene.id,
    shotId: primary?.id,
    duration: `${scene.durationSec}s`,
    durationSec: scene.durationSec,
    shotList: primary?.camera.shotType || "medium",
    cameraDirection: [
      primary?.camera.shotType,
      primary?.camera.cameraMovement,
      primary?.camera.framing,
    ]
      .filter(Boolean)
      .join(" / "),
    camera: primary?.camera.framing,
    transitions: scene.transitionOut || primary?.transitionOut || "cut",
    onScreenText: scene.onScreenText || "",
    pacing: scene.emotionalObjective || "measured",
    scriptSnippet: scene.narration || scene.dialogue || scene.spokenLines || "",
    spokenLines: scene.narration || scene.dialogue || scene.spokenLines,
    audio: scene.dialogue ? "talent" : "vo",
    valueJob: scene.narrativeFunction || scene.valueJob,
    visualDescription: scene.visualDescription || scene.environment || primary?.environment || "",
    startState: scene.continuity.entranceState,
    endState: scene.continuity.exitState,
    primaryChange: primary?.subjectAction,
    action: primary?.subjectAction,
    image: primary?.keyframeUrl,
    keyframeImageUrl: primary?.keyframeUrl,
    videoUrl: primary?.mediaUrl,
    lastFrameUrl: primary?.lastFrameUrl,
    subject: (primary?.subject as ProductionScene["subject"]) || "main",
    status:
      scene.status === "ready" || scene.status === "approved" || scene.status === "failed"
        ? scene.status
        : "pending",
  };
}

function beatToScene(beat: ProductionBriefBeat, index: number, productionId: string, durationSec: number): SceneSpec {
  const pseudo: ProductionScene = {
    scene: index,
    index,
    duration: `${durationSec}s`,
    durationSec,
    shotList: beat.cameraDirection || "medium",
    cameraDirection: beat.cameraDirection || "medium",
    transitions: "cut",
    onScreenText: beat.onScreenText,
    pacing: "measured",
    scriptSnippet: beat.spokenLines,
    spokenLines: beat.spokenLines,
    audio: beat.audio || "vo",
    valueJob: beat.valueJob,
    visualDescription: beat.onScreenText || beat.spokenLines,
    startState: beat.startState,
    endState: beat.endState,
    subject: beat.subject || beat.subjectType || "main",
  };
  return productionSceneToSceneSpec(pseudo, productionId);
}

/**
 * Upgrade a legacy Production + Brief into ProductionSpec.
 */
export function legacyProductionToSpec(params: {
  production: Production;
  spark?: ViralSpark;
  brand?: Brand;
  character?: Character;
}): ProductionSpec {
  const { production, spark, brand, character } = params;
  const brief = production.brief;
  const now = new Date().toISOString();
  const targetDurationSec =
    production.targetDurationSec ||
    brief?.targetDurationSec ||
    brand?.formatSettings?.targetDurationSec ||
    60;

  const characters = character
    ? [
        createCharacterMaster({
          baseId: "character_host",
          name: character.name || brand?.name || "Host",
          description: [character.style, ...(character.traits || [])].filter(Boolean).join(". ") || "Brand host",
          role: "host",
          referenceUrls: character.characterSheetUrl
            ? [character.characterSheetUrl]
            : character.imageUrl
              ? [character.imageUrl]
              : [],
          definingCharacteristics: (character.traits?.length
            ? character.traits
            : [character.style || "consistent host identity"]
          ).filter(Boolean),
        }),
      ]
    : [];

  const sceneSource =
    brief?.storyboard?.length
      ? brief.storyboard
      : production.productionScenes?.length
        ? production.productionScenes
        : [];

  let scenes: SceneSpec[];
  if (sceneSource.length > 0) {
    scenes = sceneSource.map((s, i) =>
      productionSceneToSceneSpec(
        { ...s, index: s.index ?? s.scene ?? i },
        production.id,
        {
          characterIds: characters.map((c) => c.identity.ref),
          aspectRatio: production.aspectRatio,
        }
      )
    );
  } else if (brief?.beats?.length) {
    const per = Math.max(3, Math.round(targetDurationSec / brief.beats.length));
    scenes = brief.beats.map((b, i) => beatToScene(b, i, production.id, per));
  } else {
    scenes = [
      productionSceneToSceneSpec(
        {
          scene: 0,
          duration: `${Math.min(8, targetDurationSec)}s`,
          durationSec: Math.min(8, targetDurationSec),
          shotList: "medium",
          cameraDirection: "medium",
          transitions: "cut",
          onScreenText: brief?.hook || production.title,
          pacing: "compressed",
          scriptSnippet: brief?.hook || spark?.hook || production.title,
          spokenLines: brief?.hook || spark?.hook,
          visualDescription: brief?.visualDirection || "Brand visual",
          valueJob: "hook",
          startState: "Open on hook",
          endState: "Transition to body",
        },
        production.id,
        { characterIds: characters.map((c) => c.identity.ref), aspectRatio: production.aspectRatio }
      ),
    ];
  }

  const locations = Array.from(
    new Set(scenes.map((s) => s.environment).filter((e) => e && e.trim().length > 0))
  ).slice(0, 6);

  const locationMasters = locations.map((env, i) =>
    createLocationMaster({
      baseId: `location_${String(i + 1).padStart(3, "0")}`,
      name: `Location ${i + 1}`,
      description: env,
      environment: env,
    })
  );

  const creative: CreativeSpec = {
    intent: spark?.title || brief?.title || production.title,
    genre: "social",
    grammarTags: [String(production.mode || production.productionMode || "standard")],
    tone: spark?.audienceEmotion || "engaging",
    audience: brand?.audience?.primary || "platform audience",
    narrativeStructure: brief?.scriptOutline || "hook → value → payoff → cta",
    visualLanguage:
      brief?.visualDirection ||
      brand?.style?.filter((s) => s.active).map((s) => s.label).join(", ") ||
      "brand cinematic",
    pacing: targetDurationSec <= 60 ? "compressed" : "measured",
    emotionalArc: spark?.audienceEmotion || "curiosity to payoff",
    requiresHost: Boolean(character),
    requiresCharacters: Boolean(character),
    requiresNarration: true,
    requiresDialogue: false,
    requiresAnimation: false,
    requiresProductShots: false,
    requiresDocumentaryTreatment: false,
    requiresResearch: Boolean(brief?.researchContext || spark?.researchContext),
    requiresGeneratedEnvironments: true,
    requiresStockOrUserAssets: false,
    requiresImageGeneration: true,
    requiresVideoGeneration: String(production.mode) !== "express" && String(production.productionMode) !== "express",
    requiresVoiceGeneration: true,
    requiresMusic: true,
    requiresSoundDesign: true,
    requiresEditing: true,
    estimatedSceneCount: scenes.length,
    estimatedShotCount: scenes.reduce((n, s) => n + s.shots.length, 0),
    confidence: 0.7,
    rationale: ["Migrated from legacy ProductionBrief/ProductionScene"],
  };

  const project: ProjectSpec = {
    id: production.id,
    title: production.title,
    brandId: production.brandId || brand?.id,
    sparkId: production.sparkId || spark?.id,
    idea: spark?.hook || brief?.hook || production.title,
    createdAt: production.dateCreated || now,
    updatedAt: now,
    productionMode: production.mode || production.productionMode || "standard",
    creativeControl: "auto",
    targetDurationSec,
    platforms: mapPlatforms(brief?.platformRecommendation, production.formats),
    aspectRatio: (production.aspectRatio as AspectRatioId) || "9:16",
    formats: production.formats || [],
    status: "planning",
  };

  return {
    id: `spec_${production.id}`,
    version: 1,
    project,
    creative,
    world: {
      settingSummary:
        brief?.visualDirection ||
        brand?.style?.filter((s) => s.active).map((s) => s.label).join(", ") ||
        "Brand world",
      locations: locationMasters.map((l) => ({
        id: l.identity.ref,
        name: l.name,
        description: l.description,
        atmosphere: l.environment,
        masterAssetId: l.identity.ref,
      })),
    },
    characters,
    assets: [...characters, ...locationMasters],
    narrative: {
      logline: brief?.whyThisWorks || spark?.angle || production.title,
      hook: brief?.hook || spark?.hook || production.title,
      acts: [
        {
          id: "act_1",
          name: "Primary arc",
          purpose: "Deliver value",
          sceneIds: scenes.map((s) => s.id),
        },
      ],
      scriptOutline: brief?.scriptOutline || "",
      ctaSpoken: brief?.spokenCta,
      ctaOnScreen: brief?.onScreenCta,
      caption: brief?.caption,
      whyThisWorks: brief?.whyThisWorks,
    },
    scenes,
    audio: buildDefaultAudioSpec({
      requiresNarration: creative.requiresNarration,
      requiresDialogue: creative.requiresDialogue,
      requiresMusic: creative.requiresMusic,
      requiresSoundDesign: creative.requiresSoundDesign,
    }),
    visualStyle: {
      look:
        brief?.visualDirection ||
        brand?.style?.filter((s) => s.active).map((s) => s.label).join(", ") ||
        "cinematic brand",
      colorLanguage: "coherent brand grade",
      cameraLanguage: "platform-native coverage",
      lightingLanguage: "consistent key across scenes",
      references: [],
      antiSlopLaws: [
        "No identity drift",
        "No wardrobe/set resets",
        "No burned-in text on stills",
      ],
    },
    continuity: {
      globalLocks: ["host_identity", "wardrobe", "set"],
      identityPackSummary: character?.style || character?.traits?.join(", ") || "locked primary subject",
      shotBridges: [],
      lastFrameChainEnabled: true,
    },
    routing: createDefaultRoutingSpec(),
    quality: createDefaultQualitySpec(targetDurationSec >= 180 ? "cinema" : "social"),
    researchRequirements: buildResearchRequirement({
      idea: project.idea,
      requiresResearch: creative.requiresResearch,
      genre: creative.genre,
      existingResearchPresent: Boolean(brief?.researchContext || spark?.researchContext),
    }),
    researchContext: brief?.researchContext || spark?.researchContext,
    approvalSummary: {
      projectTitle: project.title,
      genreLabel: creative.genre,
      styleLabel: creative.visualLanguage,
      structureLabel: `${scenes.length} scenes / ${creative.estimatedShotCount} shots`,
      characterCount: characters.length,
      locationCount: locationMasters.length,
      sceneCount: scenes.length,
      shotCount: creative.estimatedShotCount,
      audioSummary: "Narrator + ambience + music",
      generationStrategy: creative.requiresVideoGeneration ? "Hybrid image-to-video" : "Narrator slideshow",
      estimatedGenerationTasks: creative.estimatedShotCount + (creative.requiresVoiceGeneration ? 1 : 0),
      qualityTarget: targetDurationSec >= 180 ? "Cinema" : "Social",
    },
    meta: {
      specVersion: SPEC_VERSION,
      compilerVersion: COMPILER_VERSION,
      createdFrom: "legacy_brief",
      legacyProductionId: production.id,
      grammarIds: [creative.genre],
    },
  };
}

/**
 * Project ProductionSpec back onto a ProductionBrief for existing UI/persistence.
 */
export function productionSpecToBrief(spec: ProductionSpec, existing?: ProductionBrief): ProductionBrief {
  const storyboard = spec.scenes.map(sceneSpecToProductionScene);
  const beats: ProductionBriefBeat[] = spec.scenes.map((scene) => ({
    timecode: `0:${String(Math.floor(scene.index * (scene.durationSec || 5))).padStart(2, "0")}`,
    valueJob: scene.narrativeFunction || "context",
    spokenLines: scene.narration || scene.dialogue || scene.spokenLines || "",
    onScreenText: scene.onScreenText || "",
    cameraDirection: scene.shots[0]?.camera.framing,
    startState: scene.continuity.entranceState,
    endState: scene.continuity.exitState,
    audio: scene.dialogue ? "talent" : "vo",
    subject: (scene.shots[0]?.subject as ProductionBriefBeat["subject"]) || "main",
  }));

  return {
    title: spec.project.title,
    productionMode: String(spec.project.productionMode || "standard"),
    hook: spec.narrative.hook,
    scriptOutline: spec.narrative.scriptOutline,
    beats,
    spokenCta: spec.narrative.ctaSpoken,
    onScreenCta: spec.narrative.ctaOnScreen,
    visualDirection: spec.visualStyle.look,
    caption: spec.narrative.caption || existing?.caption || "",
    platformRecommendation: spec.project.platforms.join(", "),
    whyThisWorks: spec.narrative.whyThisWorks || existing?.whyThisWorks || spec.creative.rationale.join("; "),
    researchContext: spec.researchContext || existing?.researchContext,
    contentSource: existing?.contentSource || "ai",
    brandFitScore: existing?.brandFitScore ?? 80,
    suggestedDuration: `${spec.project.targetDurationSec}s`,
    targetDurationSec: spec.project.targetDurationSec,
    formatSettings: existing?.formatSettings,
    storyboard,
    storyboardGridUrl: existing?.storyboardGridUrl,
    takeGrids: existing?.takeGrids,
    audioUrl: existing?.audioUrl,
    videoUrl: existing?.videoUrl,
    thumbnailUrl: existing?.thumbnailUrl,
    lastError: existing?.lastError,
    generationProgress: existing?.generationProgress,
    offerCta: existing?.offerCta,
    generatedAssets: existing?.generatedAssets,
  };
}

export function emptyContinuitySeed(summary: string) {
  return emptyContinuityState(summary);
}

export function ensureAssetRef(baseId: string, version = 1): string {
  return makeAssetRef(baseId, version);
}

export { SPEC_VERSION, COMPILER_VERSION };
