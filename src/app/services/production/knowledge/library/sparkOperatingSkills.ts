/**
 * Spark operating skills — production knowledge, not agents and not vendor contracts.
 * They teach the existing planner and prompt compiler. They do not call a provider,
 * train an identity, or add a second generate path.
 *
 * One skill per job Spark kept from the upstream playbook. Marketplace cards,
 * websites, games, preset ad formats, and attention scoring are not Spark jobs.
 */

import type { FilmmakingSkill, SkillPrinciple } from "../types";
import { rule, skill } from "./helpers";

function principle(
  id: string,
  statement: string,
  opts?: Partial<Pick<SkillPrinciple, "classification" | "evidenceLevel" | "priorityLayer">>
): SkillPrinciple {
  return {
    id,
    statement,
    classification: opts?.classification ?? "ai-filmmaking",
    evidenceLevel: opts?.evidenceLevel ?? "heuristic",
    priorityLayer: opts?.priorityLayer ?? "production_requirements",
  };
}

/** Topic prefixes the prompt compiler keeps ahead of generic skill constraints. */
export const SPARK_OPERATING_CONSTRAINT_PREFIXES = [
  "generation.media_roles:",
  "character.identity_source:",
  "still.purpose:",
  "brand.lock:",
  "explainer.order:",
  "publish.cover:",
] as const;

export const SPARK_OPERATING_SKILLS: FilmmakingSkill[] = [
  skill({
    id: "generation-media-roles",
    name: "Generation Media Roles",
    domain: "generation",
    stages: ["generation_strategy", "prompt_compilation"],
    purpose:
      "Name the media roles a shot needs before a model is chosen. Routing stays with the router.",
    applicability: {
      whenAny: ["media_roles"],
    },
    principles: [
      principle(
        "gmr-roles",
        "Spark names the roles. A start frame is the opening state, not the identity lock. Identity references do not ride a request that only accepts a start frame and an optional end frame."
      ),
    ],
    rules: [
      rule({
        id: "gmr-declare",
        description: "Declare media roles and do not silently change the request shape.",
        topic: "generation.media_roles",
        value:
          "Name the media roles first. A start frame is opening state, not identity. Do not swap image-to-video and reference-to-video. A page address is not a media input.",
        classification: "ai-filmmaking",
        priorityLayer: "production_requirements",
      }),
    ],
    metadata: { origin: "spark-operating", sparkSkill: "generate" },
  }),

  skill({
    id: "durable-character-identity",
    name: "Durable Character Identity",
    domain: "character",
    stages: ["planning", "continuity", "prompt_compilation"],
    purpose:
      "Keep a recurring person on the approved character master. A new still is a state of that person, not a new identity.",
    applicability: {
      whenAny: ["has_character", "recurring_character"],
    },
    principles: [
      principle(
        "dci-master",
        "Durable identity is the approved character master and its sheet. Do not treat one casual still as a trained identity, and do not invent a vendor identity job."
      ),
    ],
    rules: [
      rule({
        id: "dci-reuse",
        description: "Reuse the approved character master instead of inventing a face.",
        topic: "character.identity_source",
        value:
          "Reuse the approved character master and sheet. Do not invent a new face. A single casual still is not a durable identity.",
        classification: "ai-filmmaking",
        priorityLayer: "production_requirements",
      }),
    ],
    metadata: { origin: "spark-operating", sparkSkill: "character_identity" },
  }),

  skill({
    id: "product-still-purpose",
    name: "Product Still Purpose",
    domain: "generation",
    stages: ["shot_planning", "prompt_compilation"],
    purpose: "Give each product still one job. The product reference owns shape; the skill does not own a prompt template.",
    applicability: {
      whenAny: ["product_still"],
      whenNone: ["publish_cover"],
    },
    principles: [
      principle(
        "psp-one-job",
        "Each product still is one existing craft purpose. Geometry comes from the approved product reference."
      ),
    ],
    rules: [
      rule({
        id: "psp-single",
        description: "One product still, one craft purpose, no invented packaging claims.",
        topic: "still.purpose",
        value: "One still, one craft purpose. Hold product shape to the approved reference. Do not invent packaging claims.",
        classification: "ai-filmmaking",
        priorityLayer: "production_requirements",
      }),
    ],
    metadata: { origin: "spark-operating", sparkSkill: "product_still" },
  }),

  skill({
    id: "brand-lock",
    name: "Brand Lock",
    domain: "continuity",
    stages: ["planning", "prompt_compilation", "continuity"],
    purpose: "Hold logo, palette, and type to the style bible before downstream stills and motion.",
    applicability: {
      whenAny: ["brand_lock"],
    },
    principles: [
      principle(
        "bl-bible",
        "Official logo, palette, and type stay on the style bible. Downstream work inherits that lock."
      ),
    ],
    rules: [
      rule({
        id: "bl-fixed",
        description: "Do not invent brand claims, slogans, or colors.",
        topic: "brand.lock",
        value: "Keep logo, palette, and type on the style bible. Do not invent claims, slogans, or colors.",
        classification: "general-filmmaking",
        evidenceLevel: "heuristic",
        priorityLayer: "project_constraints",
      }),
    ],
    metadata: { origin: "spark-operating", sparkSkill: "brand_lock" },
  }),

  skill({
    id: "narrated-explainer-order",
    name: "Narrated Explainer Order",
    domain: "audio",
    stages: ["planning", "shot_planning", "editorial"],
    purpose:
      "For a narrated explainer, lock one style, pair speech with picture, and assemble once. Voice stays on the narration lane.",
    applicability: {
      whenAny: ["narrated_explainer"],
      whenNone: ["publish_cover"],
    },
    principles: [
      principle(
        "neo-order",
        "Lock one style, pair each spoken line with one picture, and generate the voice takes before the pictures when speech sets the timing."
      ),
    ],
    rules: [
      rule({
        id: "neo-sequence",
        description: "One style, speech then picture, assemble once.",
        topic: "explainer.order",
        value: "One style lock. Speech before pictures when speech sets timing. Pair each line. Assemble once.",
        classification: "ai-filmmaking",
        priorityLayer: "production_requirements",
      }),
    ],
    metadata: { origin: "spark-operating", sparkSkill: "narrated_explainer" },
  }),

  skill({
    id: "publish-cover",
    name: "Publish Cover",
    domain: "editorial",
    stages: ["editorial", "prompt_compilation"],
    purpose: "After a video is approved, make one cover that promises what that video delivers.",
    applicability: {
      whenAny: ["publish_cover"],
    },
    principles: [
      principle(
        "pc-after",
        "A cover is one later image task on the existing image path. Default is no burned-in title."
      ),
    ],
    rules: [
      rule({
        id: "pc-truth",
        description: "Promise only what the approved video delivers.",
        topic: "publish.cover",
        value:
          "After approval only. Promise only what the video delivers. No burned-in text unless the production asks for a title.",
        classification: "general-filmmaking",
        priorityLayer: "production_requirements",
      }),
    ],
    metadata: { origin: "spark-operating", sparkSkill: "cover_frame" },
  }),
];
