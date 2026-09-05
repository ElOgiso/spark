/**
 * Provider-neutral filmmaking skill catalog (research-derived heuristics).
 * Skills encode production knowledge modules — not agents or vendor contracts.
 */

import type { FilmmakingSkill, SkillPrinciple } from "../types";
import { rule, skill } from "./helpers";

function principle(
  id: string,
  statement: string,
  opts?: Partial<Pick<SkillPrinciple, "classification" | "evidenceLevel" | "priorityLayer" | "scope">>
): SkillPrinciple {
  return {
    id,
    statement,
    classification: opts?.classification ?? "heuristic",
    evidenceLevel: opts?.evidenceLevel ?? "heuristic",
    priorityLayer: opts?.priorityLayer ?? "ai_generation_heuristics",
    scope: opts?.scope,
  };
}

export const FILMMAKING_SKILL_CATALOG: FilmmakingSkill[] = [
  skill({
    id: "reference-first-visual-continuity",
    name: "Reference-First Visual Continuity",
    domain: "continuity",
    evidenceLevel: "verified",
    stages: ["continuity", "prompt_compilation", "generation_strategy"],
    purpose:
      "Prefer approved visual references before free-form description when identity or place must hold across shots.",
    applicability: {
      whenAny: ["has_character", "recurring_character", "recurring_location", "multi_reference"],
    },
    principles: [
      principle(
        "ref-before-prose",
        "When a locked reference exists, treat it as the primary identity signal; prose should reinforce, not invent, appearance.",
        { classification: "ai-filmmaking", evidenceLevel: "heuristic" }
      ),
      principle(
        "ref-count-discipline",
        "Fewer high-quality, consistent references usually outperform many conflicting ones for identity lock.",
        { classification: "heuristic", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "rff-use-refs",
        description: "Include character/location reference URLs or asset ids in generation inputs when available.",
        topic: "continuity.reference_first",
        value: "required",
        classification: "ai-filmmaking",
      }),
      rule({
        id: "rff-no-reinvent",
        description: "Do not rewrite wardrobe, face, or location layout that contradicts approved references.",
        classification: "heuristic",
      }),
    ],
    qualityCriteria: [
      {
        id: "rff-qc",
        dimension: "identity_lock",
        checks: ["Subject matches reference silhouette and wardrobe", "Location geometry matches anchor refs"],
      },
    ],
    failureModes: [
      {
        id: "rff-drift",
        symptom: "Character or set drifts across shots",
        likelyCause: "Prompt overrode references or mixed conflicting refs",
        recovery: "Reduce prose variance; re-anchor to a single approved reference pack",
      },
    ],
    promptContextKeys: ["reference_pack", "identity_lock"],
  }),

  skill({
    id: "character-visual-contract",
    name: "Character Visual Contract",
    domain: "character",
    evidenceLevel: "verified",
    stages: ["planning", "prompt_compilation", "continuity"],
    purpose: "Keep recurring characters under a stable visual contract across the production.",
    applicability: {
      whenAny: ["has_character", "recurring_character"],
    },
    principles: [
      principle(
        "cvc-lock-traits",
        "Define a small set of non-negotiable visual traits (face, hair, wardrobe signature) and treat them as a contract.",
        { classification: "general-filmmaking", evidenceLevel: "verified", priorityLayer: "general_filmmaking" }
      ),
      principle(
        "cvc-ai-drift",
        "AI generators commonly drift facial structure and wardrobe unless traits are restated and referenced every shot.",
        { classification: "ai-filmmaking", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "cvc-restate",
        description: "Restate locked character traits in every shot that features the character.",
        topic: "character.contract",
        value: "restate_traits",
        classification: "ai-filmmaking",
      }),
      rule({
        id: "cvc-no-new-wardrobe",
        description: "Do not introduce unplanned wardrobe changes without an explicit continuity beat.",
        classification: "general-filmmaking",
        evidenceLevel: "verified",
        priorityLayer: "general_filmmaking",
      }),
    ],
    constraints: ["Character identity must remain consistent with CharacterMaster + refs"],
    promptContextKeys: ["character_contract"],
  }),

  skill({
    id: "character-sheet",
    name: "Character Sheet Discipline",
    domain: "character",
    stages: ["planning", "generation_strategy"],
    purpose: "Use sheet-like multi-view / trait packs when establishing or locking a character for generation.",
    applicability: {
      whenAny: ["has_character", "recurring_character"],
    },
    principles: [
      principle(
        "sheet-coverage",
        "A practical character sheet covers front/side (or 3/4) plus wardrobe and defining marks before multi-shot generation.",
        { classification: "ai-filmmaking", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "sheet-prefer",
        description: "Prefer a character sheet or multi-angle pack over a single candid still for recurring leads.",
        topic: "character.sheet",
        value: "prefer_sheet",
        classification: "ai-filmmaking",
      }),
    ],
    procedure: [
      { id: "sheet-1", action: "Confirm sheet or multi-view refs exist before dependent character shots" },
      { id: "sheet-2", action: "Attach sheet refs to all shots sharing the character id" },
    ],
  }),

  skill({
    id: "location-anchor",
    name: "Location Anchor",
    domain: "environment",
    evidenceLevel: "verified",
    stages: ["planning", "continuity", "prompt_compilation"],
    purpose: "Anchor recurring locations so geography, lighting, and set dressing stay coherent.",
    applicability: {
      whenAny: ["recurring_location"],
    },
    principles: [
      principle(
        "loc-anchor",
        "Treat location refs and scene.locationId as spatial anchors; describe relative placement rather than inventing a new set each shot.",
        { classification: "general-filmmaking", evidenceLevel: "verified", priorityLayer: "general_filmmaking" }
      ),
    ],
    rules: [
      rule({
        id: "loc-ref",
        description: "Pass location references when the scene has a locationId or locationRefs.",
        topic: "environment.anchor",
        value: "use_location_refs",
        classification: "ai-filmmaking",
      }),
      rule({
        id: "loc-lighting",
        description: "Keep time-of-day and key light direction consistent unless a time jump is intentional.",
        classification: "general-filmmaking",
        evidenceLevel: "verified",
        priorityLayer: "general_filmmaking",
      }),
    ],
    promptContextKeys: ["location_anchor"],
  }),

  skill({
    id: "storyboard-blueprint",
    name: "Storyboard Blueprint",
    domain: "storyboard",
    evidenceLevel: "verified",
    stages: ["shot_planning", "planning"],
    purpose: "Plan shots as intentional coverage beats before prompting generation.",
    applicability: {
      whenAny: ["shot_planning"],
    },
    principles: [
      principle(
        "sb-intent",
        "Each shot should answer a coverage question: establish, react, detail, or advance action — avoid orphan frames.",
        { classification: "general-filmmaking", evidenceLevel: "verified", priorityLayer: "general_filmmaking" }
      ),
    ],
    rules: [
      rule({
        id: "sb-purpose",
        description: "Require a non-empty shot purpose before generation.",
        topic: "storyboard.purpose_required",
        value: "true",
        classification: "general-filmmaking",
        evidenceLevel: "verified",
        priorityLayer: "general_filmmaking",
      }),
    ],
    procedure: [
      { id: "sb-1", action: "List scene beats" },
      { id: "sb-2", action: "Assign shot purposes that cover establishing, action, and reaction as needed" },
    ],
  }),

  skill({
    id: "motion-prompting",
    name: "Motion Prompting",
    domain: "cinematography",
    stages: ["prompt_compilation", "generation_strategy"],
    purpose: "Describe subject and camera motion as explicit begin→end change, not static adjectives.",
    applicability: {
      whenAny: ["requires_motion", "i2v", "t2v"],
    },
    principles: [
      principle(
        "mot-begin-end",
        "Motion prompts work better when they specify what changes from the first frame to the last, not only a vibe word.",
        { classification: "generation-technique", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "mot-states",
        description: "Include beginState and endState (or equivalent) for video motion shots.",
        topic: "motion.begin_end",
        value: "required",
        classification: "generation-technique",
      }),
      rule({
        id: "mot-avoid-static",
        description: "Avoid purely static subject language when the strategy requires motion.",
        classification: "heuristic",
      }),
    ],
    promptContextKeys: ["motion_begin", "motion_end"],
  }),

  skill({
    id: "timeline-prompting",
    name: "Timeline Prompting",
    domain: "generation",
    stages: ["prompt_compilation", "generation_strategy"],
    purpose: "Structure prompts along a short timeline when start/end frames or staged action matter.",
    applicability: {
      whenAny: ["requires_timeline", "start_end_frame"],
    },
    principles: [
      principle(
        "tl-stages",
        "For timeline-aware generation, sequence action as early / mid / late beats rather than a single undifferentiated clause.",
        { classification: "generation-technique", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "tl-structure",
        description: "Compile prompt with ordered temporal beats when timeline control is required.",
        topic: "timeline.structure",
        value: "ordered_beats",
        classification: "generation-technique",
      }),
    ],
  }),

  skill({
    id: "start-end-frame-control",
    name: "Start–End Frame Control",
    domain: "generation",
    stages: ["generation_strategy", "continuity"],
    purpose: "Use first and last frame anchors to constrain video interpolation when available.",
    applicability: {
      whenAny: ["start_end_frame", "has_first_frame", "has_last_frame"],
    },
    principles: [
      principle(
        "sef-anchors",
        "When both start and end frames are available, they should dominate motion interpolation over free text.",
        { classification: "generation-technique", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "sef-pass-frames",
        description: "Pass firstFrame and lastFrame inputs when strategy is first_last_frame or both URLs exist.",
        topic: "generation.start_end_frames",
        value: "required",
        classification: "generation-technique",
      }),
    ],
    failureModes: [
      {
        id: "sef-mismatch",
        symptom: "Interpolation morphs identity between frames",
        likelyCause: "Start/end frames depict incompatible subjects or lighting",
        recovery: "Align identity and lighting across anchors; reduce motion amplitude",
      },
    ],
  }),

  skill({
    id: "shot-handoff",
    name: "Shot Handoff",
    domain: "continuity",
    evidenceLevel: "verified",
    stages: ["continuity", "shot_planning"],
    purpose: "Carry exit state of the previous shot into the entrance state of the next dependent shot.",
    applicability: {
      whenAny: ["dependent_shot"],
    },
    principles: [
      principle(
        "hh-exit-enter",
        "Dependent shots should inherit exit pose, eyeline, and wardrobe state from the prior shot unless a cut justifies a reset.",
        { classification: "general-filmmaking", evidenceLevel: "verified", priorityLayer: "general_filmmaking" }
      ),
    ],
    rules: [
      rule({
        id: "hh-bridge",
        description: "Encode handoff continuity requirements when previousShotId or handoff language is present.",
        topic: "continuity.handoff",
        value: "bridge_exit_to_enter",
        classification: "general-filmmaking",
        evidenceLevel: "verified",
        priorityLayer: "general_filmmaking",
      }),
    ],
    procedure: [
      { id: "hh-1", action: "Read previous shot endState / last frame" },
      { id: "hh-2", action: "Set current beginState to match unless narrative reset" },
    ],
  }),

  skill({
    id: "previous-video-continuation",
    name: "Previous Video Continuation",
    domain: "continuity",
    stages: ["generation_strategy", "continuity"],
    purpose: "When extending or continuing from prior video, preserve motion and identity from the previous clip.",
    applicability: {
      whenAny: ["previous_video", "video_continuation"],
    },
    principles: [
      principle(
        "pvc-extend",
        "Continuation/extend flows should condition on the prior clip rather than regenerating the beat from text alone.",
        { classification: "ai-filmmaking", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "pvc-condition",
        description: "Attach previous video / last frame when strategy is extend or hasPreviousVideo.",
        topic: "generation.continuation",
        value: "condition_on_previous",
        classification: "ai-filmmaking",
      }),
    ],
  }),

  skill({
    id: "parallel-vs-sequential-generation",
    name: "Parallel vs Sequential Generation",
    domain: "generation",
    stages: ["generation_strategy", "shot_planning"],
    purpose: "Choose parallel generation for independent shots and sequential for dependency chains.",
    applicability: {
      whenAny: ["shot_planning", "dependent_shot"],
    },
    principles: [
      principle(
        "pvs-deps",
        "Shots that depend on prior media or handoff state should run sequentially; isolated coverage can run in parallel.",
        { classification: "ai-filmmaking", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "pvs-seq",
        description: "Mark dependent_shot / continuation shots as sequential in the generation plan.",
        topic: "generation.scheduling",
        value: "sequential_when_dependent",
        classification: "ai-filmmaking",
      }),
      rule({
        id: "pvs-par",
        description: "Allow parallel generation for isolated_shot coverage without shared identity locks.",
        optional: true,
        classification: "heuristic",
      }),
    ],
  }),

  skill({
    id: "continuity-first-generation",
    name: "Continuity-First Generation",
    domain: "continuity",
    evidenceLevel: "verified",
    stages: ["generation_strategy", "continuity", "qc"],
    purpose: "Prioritize continuity locks over novel variation when characters or locations recur.",
    applicability: {
      whenAny: ["dependent_shot", "recurring_character", "recurring_location"],
    },
    principles: [
      principle(
        "cf-priority",
        "For recurring elements, continuity constraints should outrank stylistic improvisation in prompts and QC.",
        { classification: "general-filmmaking", evidenceLevel: "verified", priorityLayer: "general_filmmaking" }
      ),
    ],
    rules: [
      rule({
        id: "cf-lock",
        description: "Elevate continuityRequirements ahead of decorative style clauses for recurring subjects.",
        topic: "continuity.priority",
        value: "continuity_first",
        classification: "general-filmmaking",
        evidenceLevel: "verified",
        priorityLayer: "general_filmmaking",
      }),
    ],
  }),

  skill({
    id: "shot-purpose",
    name: "Shot Purpose",
    domain: "cinematography",
    evidenceLevel: "verified",
    stages: ["shot_planning", "prompt_compilation"],
    purpose: "Keep the shot's narrative purpose as the organizing idea for framing and action.",
    applicability: {
      whenAny: ["shot_planning"],
    },
    principles: [
      principle(
        "sp-one-job",
        "A shot should primarily serve one storytelling job; competing jobs usually belong in separate shots.",
        { classification: "general-filmmaking", evidenceLevel: "verified", priorityLayer: "general_filmmaking" }
      ),
    ],
    rules: [
      rule({
        id: "sp-lead",
        description: "Lead prompt compilation with shot.purpose / productionReason before decorative detail.",
        topic: "shot.purpose_lead",
        value: "true",
        classification: "general-filmmaking",
        evidenceLevel: "verified",
        priorityLayer: "general_filmmaking",
      }),
    ],
  }),

  skill({
    id: "cinematic-coverage",
    name: "Cinematic Coverage",
    domain: "cinematography",
    evidenceLevel: "verified",
    stages: ["shot_planning", "planning"],
    purpose: "Build readable coverage: establish space, then advance action and reaction.",
    applicability: {
      whenAny: ["cinematic_coverage", "shot_planning"],
    },
    principles: [
      principle(
        "cc-establish",
        "Audiences typically need spatial orientation before tight coverage; establishing or wide context helps when geography matters.",
        { classification: "general-filmmaking", evidenceLevel: "verified", priorityLayer: "general_filmmaking" }
      ),
      principle(
        "cc-ai-note",
        "This is a planning heuristic, not a universal law — stylized sequences may intentionally withhold geography.",
        { classification: "heuristic", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "cc-mix",
        description: "Prefer a mix of wide/medium/close coverage across a scene rather than identical framing every shot.",
        classification: "general-filmmaking",
        evidenceLevel: "verified",
        priorityLayer: "general_filmmaking",
      }),
    ],
  }),

  skill({
    id: "camera-movement-purpose",
    name: "Camera Movement Purpose",
    domain: "cinematography",
    evidenceLevel: "verified",
    stages: ["shot_planning", "prompt_compilation"],
    purpose: "Choose camera movement only when it serves story emphasis; default to motivated stillness.",
    applicability: {
      whenAny: ["camera_move", "shot_planning", "motivated_camera_move"],
    },
    principles: [
      principle(
        "cam-motivate",
        "Camera moves should be motivated by subject motion, revelation, or emotional intensification — not applied by default.",
        { classification: "general-filmmaking", evidenceLevel: "verified", priorityLayer: "general_filmmaking" }
      ),
    ],
    rules: [
      rule({
        id: "cam-static-default",
        description: "Prefer static camera when movement is not motivated by story or subject.",
        topic: "camera.movement",
        value: "static",
        optional: true,
        classification: "general-filmmaking",
        evidenceLevel: "verified",
        priorityLayer: "general_filmmaking",
      }),
      rule({
        id: "cam-name-move",
        description: "When moving, name the move type and purpose in the cinematic layer.",
        classification: "heuristic",
      }),
    ],
  }),

  skill({
    id: "visual-style-consistency",
    name: "Visual Style Consistency",
    domain: "cinematography",
    evidenceLevel: "verified",
    stages: ["prompt_compilation", "qc"],
    purpose: "Keep look, color, and lighting language consistent with the production visual style.",
    applicability: {
      whenAny: ["shot_planning", "prompt_compilation"],
    },
    principles: [
      principle(
        "vs-lock",
        "Reuse the production visualLanguage / look tokens rather than inventing a new look per shot.",
        { classification: "general-filmmaking", evidenceLevel: "verified", priorityLayer: "general_filmmaking" }
      ),
    ],
    rules: [
      rule({
        id: "vs-apply",
        description: "Apply VisualStyleSpec look and colorLanguage consistently across shots.",
        topic: "style.consistency",
        value: "production_look",
        classification: "general-filmmaking",
        evidenceLevel: "verified",
        priorityLayer: "general_filmmaking",
      }),
    ],
  }),

  skill({
    id: "prompt-compilation-principles",
    name: "Prompt Compilation Principles",
    domain: "generation",
    stages: ["prompt_compilation"],
    purpose: "Compile prompts from structured layers; avoid filler and contradictory instructions.",
    applicability: {
      whenAny: ["prompt_compilation"],
    },
    principles: [
      principle(
        "pc-structured",
        "Compile from semantic + cinematic layers instead of a single free-form marketing paragraph.",
        { classification: "ai-filmmaking", evidenceLevel: "heuristic" }
      ),
      principle(
        "pc-no-filler",
        "Avoid empty intensifiers (beautiful/stunning/epic/masterpiece) that do not change composition.",
        { classification: "ai-filmmaking", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "pc-layers",
        description: "Preserve structured fields (subject, action, camera, lighting, continuity) during compilation.",
        topic: "prompt.compilation",
        value: "structured_layers",
        classification: "ai-filmmaking",
      }),
      rule({
        id: "pc-no-contradict",
        description: "Do not emit contradictory camera or lighting clauses in the same prompt.",
        classification: "heuristic",
      }),
    ],
  }),

  skill({
    id: "generation-quality-criteria",
    name: "Generation Quality Criteria",
    domain: "quality",
    stages: ["qc", "generation_strategy"],
    purpose: "Define practical QC checks for identity, continuity, motion, and technical fitness.",
    applicability: {
      whenAny: ["quality_gate"],
    },
    principles: [
      principle(
        "gq-multi",
        "QC should cover intent match, identity/continuity, motion coherence, and technical decode — not aesthetics alone.",
        { classification: "ai-filmmaking", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "gq-gates",
        description: "Run quality gates appropriate to strategy (still vs video) before approval.",
        topic: "quality.gates",
        value: "strategy_aware",
        classification: "ai-filmmaking",
      }),
    ],
    qualityCriteria: [
      {
        id: "gq-intent",
        dimension: "intent",
        checks: ["Shot purpose is readable in the frame", "Subject action matches spec"],
      },
      {
        id: "gq-tech",
        dimension: "technical",
        checks: ["No severe artifacts blocking delivery", "Framing matches requested shot type"],
      },
    ],
  }),

  skill({
    id: "failure-awareness",
    name: "Failure Awareness",
    domain: "quality",
    stages: ["qc", "generation_strategy"],
    purpose: "Anticipate common generation failures and attach recovery hints.",
    applicability: {
      whenAny: ["failure_awareness"],
    },
    principles: [
      principle(
        "fa-expect",
        "Identity drift, motion smear, and prompt contradiction are common AI failure modes — plan remediation paths.",
        { classification: "ai-filmmaking", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "fa-taxonomy",
        description: "Map failures to likely cause and recovery rather than blind retry with the same prompt.",
        topic: "quality.failure_awareness",
        value: "diagnose_then_retry",
        classification: "ai-filmmaking",
      }),
    ],
    failureModes: [
      {
        id: "fa-identity",
        symptom: "Face or wardrobe changes mid-sequence",
        likelyCause: "Weak references or conflicting prose",
        recovery: "Strengthen reference pack; shorten conflicting style clauses",
      },
      {
        id: "fa-motion",
        symptom: "Unwanted morphing or smear",
        likelyCause: "Over-ambitious motion or mismatched start/end frames",
        recovery: "Reduce motion amplitude; align anchors",
      },
    ],
  }),

  skill({
    id: "reference-selection",
    name: "Reference Selection",
    domain: "generation",
    stages: ["generation_strategy", "prompt_compilation"],
    purpose: "Select the minimum coherent reference set for the shot's identity and style needs.",
    applicability: {
      whenAny: ["has_character", "recurring_location", "multi_reference", "has_first_frame"],
    },
    principles: [
      principle(
        "rs-min",
        "Select the smallest reference set that covers identity and style; extra conflicting refs often hurt more than help.",
        { classification: "ai-filmmaking", evidenceLevel: "heuristic" }
      ),
    ],
    rules: [
      rule({
        id: "rs-coherent",
        description: "Prefer coherent same-subject refs; drop outliers that fight the contract.",
        topic: "generation.reference_selection",
        value: "coherent_minimum",
        classification: "ai-filmmaking",
      }),
    ],
  }),

  // TEST-ONLY companion for conflict resolution unit tests
  skill({
    id: "camera-movement-tracking-bias",
    name: "Camera Movement Tracking Bias (Test)",
    version: "1.0.0-test",
    status: "experimental",
    domain: "cinematography",
    stages: ["shot_planning", "prompt_compilation"],
    purpose:
      "TEST-ONLY: biases camera.movement toward tracking to exercise conflict resolution against camera-movement-purpose.",
    applicability: {
      whenAny: ["camera_move", "motivated_camera_move"],
    },
    principles: [
      principle(
        "cmtb-test",
        "Test companion only — not a production recommendation.",
        { classification: "experimental", evidenceLevel: "experimental", priorityLayer: "experimental" }
      ),
    ],
    rules: [
      rule({
        id: "cmtb-tracking",
        description: "Prefer tracking camera movement (test conflict fixture).",
        topic: "camera.movement",
        value: "tracking",
        classification: "experimental",
        evidenceLevel: "experimental",
        priorityLayer: "ai_generation_heuristics",
      }),
    ],
    evidenceLevel: "experimental",
    sourceType: "research-derived",
    metadata: { testOnly: "true" },
  }),
];

export const FILMMAKING_SKILL_IDS: string[] = FILMMAKING_SKILL_CATALOG.map((s) => s.id);
