/**
 * Production Asset Director — autonomous visual-world planner.
 *
 * Given ProductionSpec inputs (idea, narrative beats, mode, existing masters),
 * determine which characters / locations / props / wardrobe states / style masters
 * the production requires, reuse approved masters first, and compile generation
 * intents + prompts. Does NOT execute media generation.
 *
 * Plugs in after planProductionScenes and before applyVisualPlanningPipeline.
 */

import type { Brand, Character } from "../../../domain/types";
import type {
  CreativeSpec,
  ProductionSpec,
  VisualStyleSpec,
  WorldSpec,
} from "../specification/productionSpec";
import type { SceneSpec } from "../specification/sceneSpec";
import type { NarrativeBeatPlan } from "./narrativePlanner";
import {
  createCharacterMaster,
  createLocationMaster,
  createPropMaster,
  createStyleMaster,
  createWardrobeMaster,
  type CharacterMaster,
  type LocationMaster,
  type MasterAssetRef,
  type ProductionAssetRequirement,
  type PropMaster,
  type StyleMaster,
  type WardrobeMaster,
} from "../specification/assetSpec";
import { normalizeModeString, type ResolvedMode } from "../resolveProductionMode";
import { buildProductionCharacterSheetPrompt } from "../characterSheetPrompt";
import { buildLocationPlatePrompt } from "../locationPlatePrompt";

export interface ProductionAssetDirectorInput {
  productionId: string;
  idea: string;
  creative: CreativeSpec;
  beats: NarrativeBeatPlan[];
  scenes: SceneSpec[];
  characters: CharacterMaster[];
  world: WorldSpec;
  visualStyle: VisualStyleSpec;
  productionMode?: string;
  contentFormat?: string;
  brand?: Brand;
  character?: Character;
  existingMasters?: MasterAssetRef[];
  /** Visual medium hint: realistic | cinematic | anime | wuxia | 3d */
  visualMedium?: string;
}

export interface ProductionAssetDirectorResult {
  requirements: ProductionAssetRequirement[];
  characters: CharacterMaster[];
  assets: MasterAssetRef[];
  world: WorldSpec;
  scenes: SceneSpec[];
  visualStyle: VisualStyleSpec;
  styleMaster?: StyleMaster;
  stats: {
    characterCount: number;
    locationCount: number;
    propCount: number;
    wardrobeCount: number;
    reusedCount: number;
    generateNowCount: number;
    requiredOnlyCount: number;
  };
  notes: string[];
}

function modeBucket(raw?: string): ResolvedMode {
  return normalizeModeString(raw) || "standard";
}

function storyImpliesLead(ideaText: string, creative: CreativeSpec, mode: ResolvedMode): boolean {
  if (creative.requiresCharacters || creative.requiresHost) return true;
  if (
    /\b(founder|hero|host|protagonist|character|creator|rival|competitor|investor|narrator|woman|man|girl|boy)\b/.test(
      ideaText
    )
  ) {
    return true;
  }
  // Cinematic / hybrid productions default to at least one on-screen identity
  return mode === "deep" || mode === "standard";
}

function visualMediumFrom(creative: CreativeSpec, hint?: string, productionMode?: string): string {
  const blob = [
    hint || "",
    creative.genre,
    creative.visualLanguage,
    ...(creative.grammarTags || []),
  ]
    .join(" ")
    .toLowerCase();
  // Prefer explicit medium tokens over generic "cinematic" which often co-occurs
  if (/\bwuxia\b|martial.?art|kung.?fu/.test(blob)) return "wuxia";
  if (/\banime\b/.test(blob)) return "anime";
  if (/\b3d\b|\bcgi\b|\brender\b/.test(blob)) return "3d";
  if (/\bphotoreal|realistic|live.?action\b/.test(blob) && !/\bcinematic\b/.test(blob)) return "realistic";
  if (/\bcinematic\b|filmic/.test(blob)) return "cinematic";
  if (/\bphotoreal|realistic|live.?action\b/.test(blob)) return "realistic";
  // Fall back to production mode economics
  const mode = modeBucket(productionMode);
  if (mode === "deep") return "cinematic";
  return "realistic";
}

function contentFormatOf(creative: CreativeSpec, explicit?: string): string {
  if (explicit) return explicit.toLowerCase();
  const g = creative.genre;
  if (g === "narrative_film" || g === "anime" || g === "animation") return "story";
  if (g === "educational" || g === "news_explainer") return "tutorial";
  if (g === "documentary") return "documentary";
  if (g === "product_demo" || g === "advertisement") return "product";
  return "story";
}

function findExisting(
  existing: MasterAssetRef[] | undefined,
  kind: MasterAssetRef["kind"],
  predicate?: (a: MasterAssetRef) => boolean
): MasterAssetRef | undefined {
  const pool = (existing || []).filter((a) => a.kind === kind && a.status !== "retired");
  if (!pool.length) return undefined;
  if (predicate) {
    // Predicate miss must NOT fall back to an unrelated approved master of the same kind
    return pool.find(predicate);
  }
  return pool.find((a) => a.status === "approved") || pool[0];
}

function ideaBlob(idea: string, creative: CreativeSpec, beats: NarrativeBeatPlan[]): string {
  return [
    idea,
    creative.intent,
    creative.audience,
    ...beats.map((b) => `${b.narrativeFunction} ${b.purpose} ${b.spokenHint}`),
  ]
    .join(" ")
    .toLowerCase();
}

interface InferredCharacterNeed {
  baseId: string;
  name: string;
  role: CharacterMaster["role"];
  narrativePurpose: string;
  sceneIndexes: number[];
}

interface InferredLocationNeed {
  baseId: string;
  name: string;
  environment: string;
  narrativePurpose: string;
  state?: string;
  sceneIndexes: number[];
  needsPlate: boolean;
}

interface InferredPropNeed {
  baseId: string;
  name: string;
  description: string;
  narrativePurpose: string;
  sceneIndexes: number[];
  handheld?: boolean;
  needsMaster: boolean;
}

function inferSupportingCast(params: {
  ideaText: string;
  beats: NarrativeBeatPlan[];
  mode: ResolvedMode;
  hasLead: boolean;
}): InferredCharacterNeed[] {
  const { ideaText, beats, mode, hasLead } = params;
  const needs: InferredCharacterNeed[] = [];
  if (!hasLead) return needs;

  // Mode economics: narrator rarely needs multi-character masters
  if (mode === "express") return needs;

  const confrontationIdx = beats
    .filter((b) =>
      ["confrontation", "conflict", "interview", "proof", "example"].includes(b.narrativeFunction)
    )
    .map((b) => b.index);

  const rival =
    /\b(competitor|rival|opponent|enemy|antagonist|copied|stole|confront)\b/.test(ideaText);
  const meeting =
    /\b(investor|investors|meeting|board|client|clients|partner|partners)\b/.test(ideaText);
  const assistant =
    /\b(assistant|associate|colleague|co-?founder|advisor)\b/.test(ideaText);

  const sceneIdx =
    confrontationIdx.length > 0
      ? confrontationIdx
      : beats.length > 1
        ? [Math.min(beats.length - 1, 2)]
        : [0];

  if (rival) {
    const wuxia = /\bwuxia\b|martial/.test(ideaText);
    needs.push({
      baseId: "character_002",
      name: wuxia
        ? "Rival Martial Artist"
        : /\bcompetitor\b/.test(ideaText)
          ? "Competitor"
          : /\brival\b/.test(ideaText)
            ? "Rival"
            : "Antagonist",
      role: "support",
      narrativePurpose: wuxia
        ? "Wuxia confrontation requires a rival identity lock"
        : "Antagonist required for confrontation / stakes beat",
      sceneIndexes: sceneIdx,
    });
  }

  if (meeting) {
    const plural = /\binvestors\b|\bclients\b|\bpartners\b/.test(ideaText);
    needs.push({
      baseId: "character_003",
      name: plural ? "Investor" : "Business Counterpart",
      role: "support",
      narrativePurpose: "Visible counterparty required for meeting / deal beat",
      sceneIndexes: sceneIdx,
    });
    // Crowd extras — only when plural and cinematic; do not create 20 masters
    if (plural && mode === "deep") {
      needs.push({
        baseId: "character_extra_crowd",
        name: "Background Meeting Extras",
        role: "extra",
        narrativePurpose: "Non-identity crowd presence; no individual master sheet required beyond one extra plate",
        sceneIndexes: sceneIdx,
      });
    }
  }

  if (assistant && mode === "deep") {
    needs.push({
      baseId: "character_004",
      name: "Business Associate",
      role: "support",
      narrativePurpose: "Supporting presence inferred from story relationships",
      sceneIndexes: sceneIdx,
    });
  }

  // Wuxia genre heuristic: rival/master often needed in confrontation
  if (/\bwuxia\b|martial/.test(ideaText) && mode === "deep" && !rival) {
    needs.push({
      baseId: "character_002",
      name: "Rival Martial Artist",
      role: "support",
      narrativePurpose: "Wuxia confrontation requires a rival identity lock",
      sceneIndexes: sceneIdx,
    });
  }

  return needs;
}

function inferLocations(params: {
  ideaText: string;
  beats: NarrativeBeatPlan[];
  scenes: SceneSpec[];
  mode: ResolvedMode;
  creative: CreativeSpec;
}): InferredLocationNeed[] {
  const { ideaText, beats, scenes, mode, creative } = params;
  const needs: InferredLocationNeed[] = [];

  const office =
    /\b(office|workspace|studio|hq|headquarters)\b/.test(ideaText) ||
    creative.requiresHost;
  const restaurant =
    /\b(restaurant|dinner|dining|hotel lounge|lounge|cafe|café)\b/.test(ideaText);
  const street = /\b(street|market|city|alley|road)\b/.test(ideaText);
  const temple = /\b(temple|courtyard|palace|mountain)\b/.test(ideaText);

  const dayNight =
    /\b(night|evening|sunset|dawn|daytime|morning)\b/.test(ideaText) &&
    mode === "deep";

  const pushLoc = (need: InferredLocationNeed) => {
    if (!needs.find((n) => n.baseId === need.baseId && n.state === need.state)) needs.push(need);
  };

  // Primary location — always one continuity-critical world anchor for non-express
  // Narrator: still may need one plate for still-image storytelling
  const primaryScenes = scenes.map((_, i) => i);
  if (office || (!restaurant && !street && !temple)) {
    pushLoc({
      baseId: "location_001",
      name: office ? "Founder Office" : "Primary Production Environment",
      environment: office
        ? "Premium founder office with brand-consistent architecture and controlled daylight"
        : scenes[0]?.environment || "Brand-consistent primary set / location",
      narrativePurpose: "Primary environment continuity lock across opening beats",
      sceneIndexes: primaryScenes.slice(0, Math.max(1, Math.ceil(scenes.length / 2))),
      needsPlate: mode !== "express" || creative.requiresGeneratedEnvironments,
      // Only stamp an explicit state when day/night differentiation is required
      state: dayNight ? "day" : undefined,
    });
    if (dayNight && office) {
      pushLoc({
        baseId: "location_001",
        name: "Founder Office — Night",
        environment: "Same office architecture at night with practical lamps and cooler rim light",
        narrativePurpose: "Distinct lighting state requires separate location plate version",
        sceneIndexes: primaryScenes.slice(Math.ceil(scenes.length / 2)),
        needsPlate: true,
        state: "night",
      });
    }
  }

  if (restaurant && mode !== "express") {
    const confScenes = beats
      .filter((b) => ["confrontation", "payoff", "resolution", "proof"].includes(b.narrativeFunction))
      .map((b) => b.index);
    pushLoc({
      baseId: "location_002",
      name: "Private Business Dining Room",
      environment: "Intimate private restaurant / business dining room, warm practicals, premium materials",
      narrativePurpose: "Confrontation / deal beat requires a distinct geography from the office",
      sceneIndexes: confScenes.length ? confScenes : [Math.max(0, scenes.length - 1)],
      needsPlate: true,
      state: "evening",
    });
  }

  if (street && mode === "deep") {
    pushLoc({
      baseId: "location_003",
      name: "Urban Street Plate",
      environment: "Lived-in urban street matching story geography",
      narrativePurpose: "Exterior beat requires outdoor continuity plate",
      sceneIndexes: [0],
      needsPlate: true,
    });
  }

  if (temple && mode === "deep") {
    pushLoc({
      baseId: "location_wuxia_001",
      name: "Martial Courtyard",
      environment: "Period martial-arts courtyard with architectural landmarks for continuity",
      narrativePurpose: "Wuxia environment required by story geography",
      sceneIndexes: primaryScenes,
      needsPlate: true,
    });
  }

  // Deduplicate: if only one scene and narrator, keep single light world
  if (mode === "express" && needs.length > 1) {
    return needs.slice(0, 1).map((n) => ({ ...n, needsPlate: creative.requiresGeneratedEnvironments }));
  }

  return needs;
}

function inferProps(params: {
  ideaText: string;
  beats: NarrativeBeatPlan[];
  mode: ResolvedMode;
  creative: CreativeSpec;
  /** Prefer raw idea/intent — beat text can be polluted by misclassified genre tags */
  propSourceText?: string;
}): InferredPropNeed[] {
  const { mode, creative } = params;
  const ideaText = (params.propSourceText || params.ideaText).toLowerCase();
  const props: InferredPropNeed[] = [];

  const add = (p: InferredPropNeed) => {
    if (!props.find((x) => x.baseId === p.baseId)) props.push(p);
  };

  // Only continuity-critical / visibly acted-upon props become masters
  if (/\b(laptop|computer|notebook)\b/.test(ideaText)) {
    add({
      baseId: "prop_laptop",
      name: "Laptop",
      description: "Founder laptop used as proof / product reveal object",
      narrativePurpose: "Visible action object in discovery / proof beat",
      sceneIndexes: [0, 1],
      handheld: false,
      needsMaster: mode !== "express",
    });
  }
  if (/\b(phone|mobile|smartphone)\b/.test(ideaText)) {
    add({
      baseId: "prop_phone",
      name: "Phone",
      description: "Handheld phone for notification / confrontation beat",
      narrativePurpose: "Handheld continuity prop",
      sceneIndexes: [0],
      handheld: true,
      needsMaster: mode === "deep",
    });
  }
  if (/\b(product|presentation|deck|demo|wallet|hardware)\b/.test(ideaText)) {
    add({
      baseId: "prop_product",
      name: "Product Presentation",
      description: "Hero product / presentation artifact",
      narrativePurpose: "Product identity must remain consistent across shots",
      sceneIndexes: [1, 2],
      needsMaster: true,
    });
  } else if (
    creative.requiresProductShots &&
    (creative.genre === "product_demo" || creative.genre === "advertisement")
  ) {
    add({
      baseId: "prop_product",
      name: "Product Presentation",
      description: "Hero product / presentation artifact",
      narrativePurpose: "Product identity must remain consistent across shots",
      sceneIndexes: [1, 2],
      needsMaster: true,
    });
  }
  if (/\b(sword|blade|weapon|spear)\b/.test(ideaText)) {
    add({
      baseId: "prop_weapon",
      name: "Martial Weapon",
      description: "Period weapon required by wuxia / action story",
      narrativePurpose: "Identity-critical prop for martial confrontation",
      sceneIndexes: [1, 2],
      handheld: true,
      needsMaster: true,
    });
  }

  // Hybrid/narrator: avoid flooding with masters — scene description may suffice for incidental cups
  if (mode === "express") {
    return props.filter((p) => p.needsMaster && p.baseId === "prop_product");
  }

  return props;
}

function styleLookFor(medium: string, visualStyle: VisualStyleSpec): { look: string; color: string; camera: string } {
  switch (medium) {
    case "anime":
      return {
        look: "Anime character construction, clean linework, anime environment language",
        color: visualStyle.colorLanguage || "controlled anime palette",
        camera: "anime cinematic framing with readable silhouettes",
      };
    case "wuxia":
      return {
        look: "Period martial-arts cinematic world, costume and landscape language",
        color: visualStyle.colorLanguage || "ink-wash inspired cinematic grade",
        camera: "wide geography establishing shots with motivated martial blocking",
      };
    case "3d":
      return {
        look: "3D character construction, CG materials, render lighting",
        color: visualStyle.colorLanguage || "physically based render palette",
        camera: "CG cinematic camera with coherent depth of field",
      };
    case "cinematic":
      return {
        look: "Photoreal live-action cinematic production design",
        color: visualStyle.colorLanguage || "coherent cinematic grade",
        camera: visualStyle.cameraLanguage || "motivated cinema lenses",
      };
    default:
      return {
        look: visualStyle.look || "Photorealistic naturalistic production",
        color: visualStyle.colorLanguage || "naturalistic grade",
        camera: visualStyle.cameraLanguage || "restrained motivated camera",
      };
  }
}

function sceneIdsFor(scenes: SceneSpec[], indexes: number[]): string[] {
  return indexes
    .map((i) => scenes[i]?.id)
    .filter((id): id is string => Boolean(id));
}

/**
 * Autonomous Production Asset Director.
 * Determines the visual production world required to execute the idea.
 */
export function directProductionAssets(
  input: ProductionAssetDirectorInput
): ProductionAssetDirectorResult {
  const mode = modeBucket(input.productionMode);
  const medium = visualMediumFrom(input.creative, input.visualMedium, input.productionMode);
  const contentFormat = contentFormatOf(input.creative, input.contentFormat);
  const ideaText = ideaBlob(input.idea, input.creative, input.beats);
  const notes: string[] = [];
  const requirements: ProductionAssetRequirement[] = [];

  const existing = input.existingMasters || [];
  let reusedCount = 0;

  // ── Style master (one per production) ───────────────────────────────────
  const styleLooks = styleLookFor(medium, input.visualStyle);
  const existingStyle = findExisting(existing, "style");
  let styleMaster: StyleMaster;
  if (existingStyle && existingStyle.kind === "style") {
    styleMaster = existingStyle;
    reusedCount += 1;
    notes.push(`Reusing style master ${existingStyle.identity.ref}`);
  } else {
    styleMaster = createStyleMaster({
      baseId: "style_001",
      name: `${medium} Production Style`,
      description: `Production-wide visual treatment (${medium})`,
      look: styleLooks.look,
      colorLanguage: styleLooks.color,
      cameraLanguage: styleLooks.camera,
    });
    notes.push(`Created style master for medium=${medium}`);
  }
  requirements.push({
    id: "req_style_001",
    kind: "style",
    name: styleMaster.name,
    narrativePurpose: "Single production visual treatment — prevents mixed medium drift",
    required: true,
    existingAssetRef: existingStyle?.identity.ref,
    masterAssetRef: styleMaster.identity.ref,
    sourceSceneIds: input.scenes.map((s) => s.id),
    sourceShotIds: [],
    visualContract: {
      medium,
      look: styleLooks.look,
      colorLanguage: styleLooks.color,
      cameraLanguage: styleLooks.camera,
    },
    generationRequired: !existingStyle,
    generationReason: existingStyle
      ? "Reuse approved style master"
      : "No approved style master — create production visual treatment",
    referenceUrls: styleMaster.approvedReferenceUrls,
    dependencies: [],
    continuityGroup: "style",
    origin: existingStyle ? "system_required" : "ai_inferred",
  });

  // ── Characters ──────────────────────────────────────────────────────────
  const characters: CharacterMaster[] = [...input.characters];
  const needsLead = storyImpliesLead(ideaText, input.creative, mode);
  const leadExisting =
    findExisting(existing, "character", (a) => a.kind === "character" && (a.role === "host" || a.role === "primary")) ||
    findExisting(existing, "character");

  if (characters.length === 0 && needsLead) {
    if (leadExisting && leadExisting.kind === "character") {
      characters.push(leadExisting);
      reusedCount += 1;
      notes.push(`Reusing lead character ${leadExisting.identity.ref}`);
    } else {
      const sheet =
        input.character?.characterSheetUrl ||
        input.character?.imageUrl ||
        input.character?.avatarUrl;
      const leadName =
        input.character?.name ||
        (/\bfounder\b/.test(ideaText)
          ? "Lead Founder"
          : /\bhero\b/.test(ideaText)
            ? "Lead Hero"
            : input.creative.requiresHost
              ? "Lead Host"
              : "Lead Character");
      characters.push(
        createCharacterMaster({
          baseId: "character_001",
          name: leadName,
          description: [input.character?.style, ...(input.character?.traits || [])]
            .filter(Boolean)
            .join(". ") || "Primary on-screen subject",
          role: input.creative.requiresHost ? "host" : "primary",
          referenceUrls: sheet ? [sheet] : [],
        })
      );
      notes.push("Created lead character master from narrative necessity");
    }
  } else if (characters.length > 0 && leadExisting && leadExisting.kind === "character") {
    // Prefer approved existing lead over freshly stubbed master when refs differ but role matches
    const stub = characters[0];
    if (
      stub &&
      stub.identity.baseId === "character_001" &&
      leadExisting.identity.ref !== stub.identity.ref &&
      leadExisting.status === "approved"
    ) {
      characters[0] = leadExisting;
      reusedCount += 1;
      notes.push(`Replaced stub lead with approved master ${leadExisting.identity.ref}`);
    }
  }

  const lead = characters[0];
  if (lead) {
    const sheetPrompt = buildProductionCharacterSheetPrompt({
      creatorName: lead.name,
      role: String(lead.role || "host"),
      brandName: input.brand?.name,
      niche: input.brand?.niche,
      genre: medium === "anime" ? "Anime" : medium === "3d" ? "3D / 3D Render" : medium === "wuxia" ? "Cinematic" : "Realistic",
      personality: lead.performanceNotes || lead.description,
      wardrobe: lead.wardrobeState?.description,
      researchOneLiner: input.idea.slice(0, 160),
    });
    const hasSheet = (lead.approvedReferenceUrls || []).length > 0;
    requirements.push({
      id: `req_${lead.identity.baseId}`,
      kind: "character",
      name: lead.name,
      role: String(lead.role || "primary"),
      narrativePurpose: "Lead identity lock for the production",
      required: true,
      existingAssetRef: leadExisting?.identity.ref,
      masterAssetRef: lead.identity.ref,
      sourceSceneIds: input.scenes.map((s) => s.id),
      sourceShotIds: [],
      visualContract: {
        identity: lead.name,
        role: lead.role,
        silhouette: lead.visualAttributes?.definingCharacteristics || [],
        wardrobe: lead.wardrobeState,
        medium,
      },
      generationRequired: !hasSheet,
      generationReason: hasSheet
        ? "Approved character sheet already locked — do not regenerate"
        : "Lead character sheet required as identity reference",
      prompt: hasSheet ? undefined : sheetPrompt,
      referenceUrls: lead.approvedReferenceUrls || [],
      dependencies: [styleMaster.identity.ref],
      continuityGroup: "character_identity",
      origin: hasSheet ? "system_required" : "ai_inferred",
    });
  }

  const supportNeeds = inferSupportingCast({
    ideaText,
    beats: input.beats,
    mode,
    hasLead: Boolean(lead),
  });

  for (const need of supportNeeds) {
  // Supporting-cast match must be specific — never collapse onto the lead
    const existingSupport = findExisting(
      existing,
      "character",
      (a) =>
        a.kind === "character" &&
        a.identity.baseId !== lead?.identity.baseId &&
        (a.identity.baseId === need.baseId ||
          a.name.toLowerCase() === need.name.toLowerCase() ||
          (need.name.length > 4 && a.name.toLowerCase().includes(need.name.toLowerCase())))
    );
    let master: CharacterMaster;
    if (existingSupport && existingSupport.kind === "character") {
      master = existingSupport;
      reusedCount += 1;
      notes.push(`Reusing supporting character ${existingSupport.identity.ref}`);
    } else {
      master = createCharacterMaster({
        baseId: need.baseId,
        name: need.name,
        description: `${need.narrativePurpose}. Visual treatment: ${medium}.`,
        role: need.role,
      });
      // New supporting masters start as draft until sheet approved
      master = { ...master, status: need.role === "extra" ? "draft" : "draft" };
      notes.push(`Inferred supporting character ${need.name} (${need.baseId})`);
    }
    if (!characters.find((c) => c.identity.baseId === master.identity.baseId)) {
      characters.push(master);
    }

    const isExtra = need.role === "extra";
    const sheetPrompt = isExtra
      ? undefined
      : buildProductionCharacterSheetPrompt({
          creatorName: master.name,
          role: "support",
          brandName: input.brand?.name,
          niche: input.brand?.niche,
          genre: medium === "anime" ? "Anime" : medium === "3d" ? "3D / 3D Render" : medium === "wuxia" ? "Cinematic" : "Realistic",
          personality: need.narrativePurpose,
          purpose: need.narrativePurpose,
          researchOneLiner: input.idea.slice(0, 160),
        });

    requirements.push({
      id: `req_${need.baseId}`,
      kind: "character",
      name: master.name,
      role: String(need.role),
      narrativePurpose: need.narrativePurpose,
      required: true,
      existingAssetRef: existingSupport?.identity.ref,
      masterAssetRef: master.identity.ref,
      sourceSceneIds: sceneIdsFor(input.scenes, need.sceneIndexes),
      sourceShotIds: [],
      visualContract: {
        identity: master.name,
        role: need.role,
        medium,
        distinctFromLead: true,
      },
      generationRequired: !existingSupport && !isExtra,
      generationReason: isExtra
        ? "Extra/crowd — no individual character sheet master required"
        : existingSupport
          ? "Reuse existing supporting master"
          : "Supporting cast required by narrative; no existing master",
      prompt: sheetPrompt,
      referenceUrls: master.approvedReferenceUrls || [],
      dependencies: [styleMaster.identity.ref, lead?.identity.ref].filter(Boolean) as string[],
      continuityGroup: "character_identity",
      origin: "ai_inferred",
    });
  }

  // ── Locations ───────────────────────────────────────────────────────────
  const locationNeeds = inferLocations({
    ideaText,
    beats: input.beats,
    scenes: input.scenes,
    mode,
    creative: input.creative,
  });

  const locationMasters: LocationMaster[] = [];
  for (const need of locationNeeds) {
    const version = need.state === "night" ? 2 : 1;
    const compatibleExisting =
      !need.state || need.state === "day" || need.state === "evening";
    const existingLoc = findExisting(
      existing,
      "location",
      (a) =>
        a.kind === "location" &&
        (a.identity.baseId === need.baseId ||
          a.name.toLowerCase().includes(need.name.toLowerCase().split(" ")[0].toLowerCase()))
    );

    let master: LocationMaster;
    if (existingLoc && existingLoc.kind === "location" && compatibleExisting && need.state !== "night") {
      master = existingLoc;
      reusedCount += 1;
      notes.push(`Reusing location ${existingLoc.identity.ref}`);
    } else {
      master = createLocationMaster({
        baseId: need.baseId,
        version,
        name: need.name,
        description: need.environment,
        environment: need.environment,
      });
      master = {
        ...master,
        status: "draft",
        defaultTimeOfDay: need.state || "day",
        defaultLighting: need.state === "night" ? "practical night lighting" : "controlled daylight",
      };
      notes.push(`Inferred location ${need.name}${need.state ? ` (${need.state})` : ""}`);
    }
    locationMasters.push(master);

    const platePrompt = buildLocationPlatePrompt({
      brandName: input.brand?.name,
      niche: input.brand?.niche,
      genre: styleLooks.look,
      contentFormat,
      environmentDescription: need.environment,
      locationName: need.name,
      geography: input.brand?.country,
      timeOfDay: need.state || master.defaultTimeOfDay,
      lighting: master.defaultLighting,
      weather: need.state === "night" ? undefined : undefined,
      architecture: master.architecture,
      spatialLayout: "camera-readable depth with locked landmarks",
      continuityFeatures: ["architectural landmarks", "material palette", "spatial axes"],
      visualMedium: medium,
      narrativePurpose: need.narrativePurpose,
    });

    const canReusePlate =
      Boolean(existingLoc) &&
      need.state !== "night" &&
      ((existingLoc!.approvedReferenceUrls || []).length > 0);

    requirements.push({
      id: `req_${need.baseId}_v${version}`,
      kind: "location",
      name: master.name,
      narrativePurpose: need.narrativePurpose,
      required: true,
      existingAssetRef: canReusePlate ? existingLoc!.identity.ref : undefined,
      masterAssetRef: master.identity.ref,
      sourceSceneIds: sceneIdsFor(input.scenes, need.sceneIndexes),
      sourceShotIds: [],
      visualContract: {
        place: need.name,
        environment: need.environment,
        timeOfDay: need.state || master.defaultTimeOfDay,
        lighting: master.defaultLighting,
        medium,
        emptySet: true,
      },
      generationRequired: need.needsPlate && !canReusePlate,
      generationReason: canReusePlate
        ? "Reuse approved location plate"
        : need.needsPlate
          ? "Locked location plate required for environment continuity"
          : "Location tracked for scene binding; plate generation deferred",
      prompt: need.needsPlate && !canReusePlate ? platePrompt : undefined,
      referenceUrls: master.approvedReferenceUrls || [],
      dependencies: [styleMaster.identity.ref],
      continuityGroup: `location_${need.baseId}`,
      state: need.state,
      origin: "ai_inferred",
    });
  }

  // ── Props ───────────────────────────────────────────────────────────────
  const propNeeds = inferProps({
    ideaText,
    beats: input.beats,
    mode,
    creative: input.creative,
    propSourceText: [input.idea, input.creative.intent].join(" "),
  });
  const propMasters: PropMaster[] = [];
  for (const need of propNeeds) {
    const existingProp = findExisting(
      existing,
      "prop",
      (a) => a.kind === "prop" && a.identity.baseId === need.baseId
    );
    let master: PropMaster;
    if (existingProp && existingProp.kind === "prop") {
      master = existingProp;
      reusedCount += 1;
      if (!propMasters.find((p) => p.identity.baseId === master.identity.baseId)) {
        propMasters.push(master);
      }
    } else if (need.needsMaster) {
      master = createPropMaster({
        baseId: need.baseId,
        name: need.name,
        description: need.description,
        handheld: need.handheld,
      });
      master = { ...master, status: "draft" };
      propMasters.push(master);
    } else {
      continue;
    }
    requirements.push({
      id: `req_${need.baseId}`,
      kind: "prop",
      name: need.name,
      narrativePurpose: need.narrativePurpose,
      required: need.needsMaster,
      existingAssetRef: existingProp?.identity.ref,
      masterAssetRef: master.identity.ref,
      sourceSceneIds: sceneIdsFor(input.scenes, need.sceneIndexes),
      sourceShotIds: [],
      visualContract: {
        shape: need.name,
        function: need.narrativePurpose,
        handheld: need.handheld,
        medium,
      },
      generationRequired: need.needsMaster && !existingProp,
      generationReason: existingProp
        ? "Reuse existing prop master"
        : need.needsMaster
          ? "Prop is continuity-critical / visibly acted upon"
          : "Incidental prop — scene description only",
      referenceUrls: master.approvedReferenceUrls || [],
      dependencies: [styleMaster.identity.ref],
      continuityGroup: "props",
      origin: "ai_inferred",
    });
  }

  // ── Wardrobe states (cinematic / multi-location only) ───────────────────
  const wardrobeMasters: WardrobeMaster[] = [];
  if (lead && mode === "deep" && locationNeeds.length > 1) {
    const states = locationNeeds.slice(0, 2).map((loc, i) => ({
      baseId: `wardrobe_${lead.identity.baseId}_${i + 1}`,
      name: `${lead.name} — ${loc.state || loc.name} wardrobe`,
      description: `Wardrobe state for ${loc.name}`,
      state: loc.state || loc.name,
      sceneIndexes: loc.sceneIndexes,
    }));
    for (const st of states) {
      const existingW = findExisting(existing, "wardrobe", (a) => a.identity.baseId === st.baseId);
      let master: WardrobeMaster;
      if (existingW && existingW.kind === "wardrobe") {
        master = existingW;
        reusedCount += 1;
      } else {
        master = createWardrobeMaster({
          baseId: st.baseId,
          name: st.name,
          description: st.description,
          characterId: lead.identity.ref,
        });
        notes.push(`Inferred wardrobe state ${st.name}`);
      }
      wardrobeMasters.push(master);
      requirements.push({
        id: `req_${st.baseId}`,
        kind: "wardrobe",
        name: st.name,
        narrativePurpose: `Distinct wardrobe state attached to lead for ${st.state}`,
        required: true,
        existingAssetRef: existingW?.identity.ref,
        masterAssetRef: master.identity.ref,
        sourceSceneIds: sceneIdsFor(input.scenes, st.sceneIndexes),
        sourceShotIds: [],
        visualContract: {
          characterId: lead.identity.ref,
          state: st.state,
          medium,
        },
        generationRequired: !existingW,
        generationReason: existingW
          ? "Reuse wardrobe master"
          : "Multi-location cinematic story requires locked wardrobe states",
        referenceUrls: master.approvedReferenceUrls || [],
        dependencies: [lead.identity.ref, styleMaster.identity.ref],
        continuityGroup: "wardrobe",
        state: st.state,
        origin: "ai_inferred",
      });
    }
  }

  // ── Stamp scenes with character / location / prop refs ──────────────────
  const primaryLocation = locationMasters[0];
  const scenes: SceneSpec[] = input.scenes.map((scene, idx) => {
    const charIds = characters
      .filter((c) => {
        const req = requirements.find(
          (r) => r.kind === "character" && r.masterAssetRef === c.identity.ref
        );
        if (!req) return c.role === "host" || c.role === "primary";
        return req.sourceSceneIds.includes(scene.id) || req.sourceSceneIds.length === 0 || idx === 0;
      })
      .map((c) => c.identity.ref);

    // Always include lead
    if (lead && !charIds.includes(lead.identity.ref)) charIds.unshift(lead.identity.ref);

    const locForScene =
      locationMasters.find((l) => {
        const req = requirements.find(
          (r) => r.kind === "location" && r.masterAssetRef === l.identity.ref
        );
        return req?.sourceSceneIds.includes(scene.id);
      }) || primaryLocation;

    const propIds = propMasters
      .filter((p) => {
        const req = requirements.find((r) => r.kind === "prop" && r.masterAssetRef === p.identity.ref);
        return req?.sourceSceneIds.includes(scene.id);
      })
      .map((p) => p.identity.ref);

    const shots = scene.shots.map((shot) => ({
      ...shot,
      characterIds: charIds,
      propIds,
      assetIds: [...charIds, ...propIds, ...(locForScene ? [locForScene.identity.ref] : [])],
      environment: locForScene?.environment || shot.environment,
      references: {
        ...shot.references,
        characterRefs: charIds,
        locationRefs: locForScene ? [locForScene.identity.ref] : shot.references?.locationRefs || [],
        styleRefs: [styleMaster.identity.ref],
      },
      continuityRequirements: Array.from(
        new Set([...(shot.continuityRequirements || []), "identity", "wardrobe", "set"])
      ),
    }));

    return {
      ...scene,
      characterIds: charIds,
      propIds,
      locationId: locForScene?.identity.ref,
      environment: locForScene?.environment || scene.environment,
      continuity: {
        ...scene.continuity,
        identityLocks: charIds.length ? ["character_identity"] : scene.continuity.identityLocks,
        wardrobeLocks: wardrobeMasters.length ? ["wardrobe_state"] : scene.continuity.wardrobeLocks,
        propLocks: propIds.length ? propIds.map((id) => `prop:${id}`) : scene.continuity.propLocks,
      },
      shots,
    };
  });

  const world: WorldSpec = {
    ...input.world,
    settingSummary: input.visualStyle.look || input.world.settingSummary,
    locations: locationMasters.map((l) => ({
      id: l.identity.ref,
      name: l.name,
      description: l.description,
      timeOfDay: l.defaultTimeOfDay,
      atmosphere: l.defaultLighting,
      masterAssetId: l.identity.ref,
    })),
  };

  const visualStyle: VisualStyleSpec = {
    ...input.visualStyle,
    look: styleLooks.look,
    colorLanguage: styleLooks.color,
    cameraLanguage: styleLooks.camera,
    references: Array.from(
      new Set([...(input.visualStyle.references || []), styleMaster.identity.ref])
    ),
  };

  const assets: MasterAssetRef[] = [
    ...characters,
    ...locationMasters,
    ...propMasters,
    ...wardrobeMasters,
    styleMaster,
  ];

  // Deduplicate by ref
  const seen = new Set<string>();
  const dedupedAssets = assets.filter((a) => {
    if (seen.has(a.identity.ref)) return false;
    seen.add(a.identity.ref);
    return true;
  });

  const generateNowCount = requirements.filter((r) => r.generationRequired).length;
  const requiredOnlyCount = requirements.filter((r) => r.required && !r.generationRequired).length;

  notes.push(
    `Asset Director mode=${mode} medium=${medium} format=${contentFormat}: ${characters.length} characters, ${locationMasters.length} locations, ${propMasters.length} props, ${wardrobeMasters.length} wardrobe states`
  );

  return {
    requirements,
    characters,
    assets: dedupedAssets,
    world,
    scenes,
    visualStyle,
    styleMaster,
    stats: {
      characterCount: characters.length,
      locationCount: locationMasters.length,
      propCount: propMasters.length,
      wardrobeCount: wardrobeMasters.length,
      reusedCount,
      generateNowCount,
      requiredOnlyCount,
    },
    notes,
  };
}

/** Apply director output onto a ProductionSpec (immutable merge). */
export function applyAssetDirectorToSpec(
  spec: ProductionSpec,
  directed: ProductionAssetDirectorResult
): ProductionSpec {
  return {
    ...spec,
    characters: directed.characters,
    assets: directed.assets,
    world: directed.world,
    scenes: directed.scenes,
    visualStyle: directed.visualStyle,
    meta: {
      ...spec.meta,
      assetDirector: {
        requirementCount: directed.requirements.length,
        stats: directed.stats,
        notes: directed.notes.slice(0, 12),
        requirements: directed.requirements,
      },
    },
  };
}
