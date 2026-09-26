/**
 * Spark production skills.
 *
 * Higgsfield's skill pack is a set of agent playbooks that call the Higgsfield CLI.
 * Spark does not install or run that pack. These skills are the same jobs, owned by
 * Spark and executed only through systems Spark already has.
 *
 * SPARK OWNS MEANING. PROVIDERS OWN EXECUTION.
 * A skill chooses the job and the order. It does not choose a provider, write a
 * hidden prompt template, or spend credits by itself.
 */

export const SPARK_SKILL_IDS = [
  "generate",
  "character_identity",
  "narrated_explainer",
  "product_still",
  "brand_lock",
  "cover_frame",
] as const;

export type SparkSkillId = (typeof SPARK_SKILL_IDS)[number];

export interface SparkSkill {
  id: SparkSkillId;
  /** Higgsfield playbooks this replaces. Empty when Spark already owned the job. */
  replaces: string[];
  when: string;
  notWhen: string;
  /** Existing Spark systems. Not new engines. */
  uses: string[];
  /** Order the existing spine must follow. */
  sequence: string[];
  forbids: string[];
}

export interface UpstreamSkillAudit {
  id: string;
  needed: boolean;
  sparkSkill: SparkSkillId | null;
  reason: string;
}

/**
 * Every playbook in ElOgiso/skills v0.12.0 (commit d071406).
 * higgsfield-game-generation is named in that README and is not a folder.
 * Its pages live under higgsfield-websites and are rejected with it.
 */
export const UPSTREAM_SKILL_AUDIT: UpstreamSkillAudit[] = [
  {
    id: "higgsfield-generate",
    needed: true,
    sparkSkill: "generate",
    reason: "Generation stays on Spark's planner, router, compiler, credits, and QC.",
  },
  {
    id: "higgsfield-soul-id",
    needed: true,
    sparkSkill: "character_identity",
    reason: "A reusable person is a Spark character and reference graph, not a Soul training CLI.",
  },
  {
    id: "higgsfield-video-explainer",
    needed: true,
    sparkSkill: "narrated_explainer",
    reason: "A narrated film is narrator planning plus the audio lane and one master.",
  },
  {
    id: "higgsfield-product-photoshoot",
    needed: true,
    sparkSkill: "product_still",
    reason: "Product stills are craft purposes on the existing image path.",
  },
  {
    id: "higgsfield-brandkit",
    needed: true,
    sparkSkill: "brand_lock",
    reason: "Official logo, palette, and type already lock through the Style Bible.",
  },
  {
    id: "higgsfield-youtube-thumbnail",
    needed: true,
    sparkSkill: "cover_frame",
    reason: "A cover is one truthful image task after the film exists.",
  },
  {
    id: "higgsfield-marketplace-cards",
    needed: false,
    sparkSkill: null,
    reason: "Spark does not make marketplace listing cards.",
  },
  {
    id: "higgsfield-websites",
    needed: false,
    sparkSkill: null,
    reason: "Spark is not a Higgsfield website or game builder.",
  },
  {
    id: "higgsfield-game-generation",
    needed: false,
    sparkSkill: null,
    reason: "Advertised in the README, absent as a folder, and not a Spark job.",
  },
];

const CLI = "higgsfield CLI";

export const SPARK_SKILLS: Record<SparkSkillId, SparkSkill> = {
  generate: {
    id: "generate",
    replaces: ["higgsfield-generate"],
    when: "Any film, still, or sound Spark is asked to make, when no narrower skill applies.",
    notWhen: "A character lock, narrated explainer, product still, brand lock, or cover is the actual job.",
    uses: [
      "ProductionSpec",
      "Craft planner",
      "Reference graph",
      "Style Bible",
      "Capability router",
      "Cost engine",
      "Credit reservation",
      "Payload compiler",
      "Execution engine",
      "QC",
    ],
    sequence: [
      "intent",
      "shot",
      "craft",
      "references",
      "style",
      "capability",
      "route",
      "cost",
      "reserve",
      "compile",
      "execute",
      "qc",
    ],
    forbids: [CLI, "hard-coded model", "copied provider prompt template", "second generate path"],
  },
  character_identity: {
    id: "character_identity",
    replaces: ["higgsfield-soul-id"],
    when: "The same person must appear across films. Spark already has their character, or the user is adding that character's approved photos.",
    notWhen: "A one-off face swap, a fictional character with no approved photos, or a request to train a provider identity model.",
    uses: ["Character identity", "Character sheets", "Reference graph"],
    sequence: [
      "approved photos or existing sheets",
      "character identity node",
      "stills use that identity",
      "video uses the still",
    ],
    forbids: [CLI, "invented soul reference id", "unmetered identity training", "face swap as a second generator"],
  },
  narrated_explainer: {
    id: "narrated_explainer",
    replaces: ["higgsfield-video-explainer"],
    when: "The user wants a narrated explainer or faceless story told by one voice.",
    notWhen: "A cinematic scene, a presenter ad, UGC, or a photoreal talking head.",
    uses: ["Narrator planning", "Shot narration", "AudioSpec narration lane", "Master assembly"],
    sequence: [
      "lock one style",
      "pair each spoken line with its picture",
      "generate every voice take before any picture",
      "assemble once",
    ],
    forbids: [CLI, "provider explainer assembler", "copied block prompts", "invented facts"],
  },
  product_still: {
    id: "product_still",
    replaces: ["higgsfield-product-photoshoot"],
    when: "The job is a product still: studio, lifestyle, close-up, hero, carousel, or try-on.",
    notWhen: "A product film, ad video, or marketplace listing set.",
    uses: ["HERO_SHOT", "FLATLAY", "MACRO_DETAIL", "CLOSE_UP", "PRODUCT_REVEAL", "STYLE_TRANSFORMATION"],
    sequence: [
      "read the product reference",
      "choose one craft purpose",
      "generate through the existing image path",
    ],
    forbids: [CLI, "hidden photoshoot prompt template", "a dedicated product image model"],
  },
  brand_lock: {
    id: "brand_lock",
    replaces: ["higgsfield-brandkit"],
    when: "A brand's logo, palette, or type must be created or kept fixed.",
    notWhen: "A film that merely uses the brand. That is generate, under the lock that already exists.",
    uses: ["Style Bible", "Brand genesis"],
    sequence: [
      "lock official logo, palette, and type",
      "do not redraw an approved mark",
      "downstream art waits for that lock",
    ],
    forbids: [CLI, "brandbook generator", "invented claims", "redrawing an approved logo"],
  },
  cover_frame: {
    id: "cover_frame",
    replaces: ["higgsfield-youtube-thumbnail"],
    when: "A finished or planned film needs a truthful YouTube thumbnail or vertical cover.",
    notWhen: "The film itself, or a cover that would invent a result the film does not show.",
    uses: ["Existing image path", "Character reference", "Production topic"],
    sequence: [
      "read the film's real topic",
      "keep the character reference if a person is in the cover",
      "one image task on the existing path",
    ],
    forbids: [CLI, "required provider image model", "invented claims", "using a style reference as the person's identity"],
  },
};

function has(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => text.includes(phrase));
}

/**
 * Pick the one Spark skill for this intent. Narrow jobs win over generate.
 * This does not change production mode and does not call a provider.
 */
export function resolveSparkSkill(intent: string): SparkSkill {
  const text = intent.toLowerCase();

  if (has(text, ["thumbnail", "youtube cover", "shorts cover", "video cover"])) {
    return SPARK_SKILLS.cover_frame;
  }
  if (
    has(text, [
      "soul id",
      "soul character",
      "train my face",
      "digital twin",
      "my face",
      "character of me",
    ])
  ) {
    return SPARK_SKILLS.character_identity;
  }
  if (has(text, ["brand kit", "brandbook", "visual identity", "logo system", "brand lock"])) {
    return SPARK_SKILLS.brand_lock;
  }
  if (
    has(text, [
      "product photo",
      "product shot",
      "studio shot",
      "lifestyle image",
      "hero banner",
      "photoshoot",
      "virtual try-on",
      "try on",
    ])
  ) {
    return SPARK_SKILLS.product_still;
  }
  const narrated = has(text, ["explainer", "narrated", "faceless story", "explain this"]);
  const notNarrated = has(text, ["cinematic", "photoreal", "live action", "talking head", "ugc ad"]);
  if (narrated && !notNarrated) {
    return SPARK_SKILLS.narrated_explainer;
  }
  return SPARK_SKILLS.generate;
}

/** Craft purpose for a product still. Meaning only. The router still picks the model. */
export function productStillCraft(intent: string): "HERO_SHOT" | "FLATLAY" | "MACRO_DETAIL" | "CLOSE_UP" | "PRODUCT_REVEAL" | "STYLE_TRANSFORMATION" {
  const text = intent.toLowerCase();
  if (has(text, ["restyle", "different vibe", "change the vibe"])) return "STYLE_TRANSFORMATION";
  if (has(text, ["try on", "try-on", "wearing"])) return "HERO_SHOT";
  if (has(text, ["closeup", "close-up", "macro", "detail"])) return "MACRO_DETAIL";
  if (has(text, ["flat lay", "flatlay", "catalog", "white background"])) return "FLATLAY";
  if (has(text, ["reveal", "levitat", "splash"])) return "PRODUCT_REVEAL";
  if (has(text, ["hands", "partial face"])) return "CLOSE_UP";
  return "HERO_SHOT";
}
