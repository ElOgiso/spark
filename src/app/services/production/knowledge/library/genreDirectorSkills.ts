/**
 * Visual-genre director skills — knowledge modules (NOT agents).
 * Live sheet/still/motion compilers consume `templates.look_law`.
 * Spec prompt compilation also picks these up via visual_genre_* tags.
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
    priorityLayer: opts?.priorityLayer ?? "general_filmmaking",
    scope: opts?.scope,
  };
}

type GenreSkillInput = Omit<Parameters<typeof skill>[0], "domain" | "stages"> & {
  domain?: Parameters<typeof skill>[0]["domain"];
  stages?: Parameters<typeof skill>[0]["stages"];
};

function genreSkill(input: GenreSkillInput): FilmmakingSkill {
  return skill({
    domain: "cinematography",
    stages: ["planning", "shot_planning", "prompt_compilation", "generation_strategy"],
    sourceType: "research-derived",
    evidenceLevel: "heuristic",
    ...input,
  });
}

export const GENRE_DIRECTOR_SKILLS: FilmmakingSkill[] = [
  genreSkill({
    id: "cinematic-craft-overlay",
    name: "Cinematic Craft Overlay",
    purpose:
      "Camera/coverage craft that can ride on ANY visual genre without forcing photoreal medium.",
    applicability: { whenAny: ["cinematic_craft"] },
    principles: [
      principle(
        "craft-overlay",
        "Cinematic craft is coverage and motivated camera — not a look. It must not restyle anime into live-action or donghua into generic CGI."
      ),
    ],
    rules: [
      rule({
        id: "craft-keep-medium",
        description: "Do not change the locked visualGenre medium while applying cinematic coverage.",
        topic: "genre.cinematic_craft",
        value: "overlay",
      }),
    ],
    templates: {
      look_law: [
        "CINEMATIC CRAFT (all looks): motivated camera, establish geography then action, one primary motion, lighting has a story reason.",
        "Do NOT change medium, wardrobe, or set to 'photoreal cinema' unless visualGenre is cinematic/realistic.",
      ].join("\n"),
    },
    promptContextKeys: ["cinematic_craft"],
  }),

  genreSkill({
    id: "genre-director-cinematic",
    name: "Cinematic Live-Action Director",
    purpose:
      "Photoreal cinema grammar: motivated coverage, theatrical-but-physical light, single action. Overlayable as craft on other looks when cinematicCraft is on.",
    applicability: { whenAny: ["visual_genre_cinematic"] },
    principles: [
      principle(
        "cin-coverage",
        "Establish space, then advance action. Camera moves only when motivated by subject, reveal, or emotion."
      ),
    ],
    rules: [
      rule({
        id: "cin-no-generic-pretty",
        description: "Do not substitute 'cinematic' for a missing visual genre; name medium separately.",
        topic: "genre.cinematic_craft",
        value: "overlay",
      }),
    ],
    templates: {
      look_law: [
        "VISUAL GENRE: Cinematic photoreal live-action.",
        "MEDIUM: real-world materials, skin, cloth, architecture. Not anime, not CGI cartoon.",
        "LIGHT: motivated key with shape; practicals in frame when possible; coherent color grade.",
        "CAMERA: prime-lens coverage, motivated push/track, single continuous beat per shot.",
        "Do not restyle into illustration, cel shading, or plastic 3D cartoon.",
      ].join("\n"),
    },
    promptContextKeys: ["visual_genre", "look_law"],
    constraints: ["Photoreal live-action unless a different visualGenre is locked"],
  }),

  genreSkill({
    id: "genre-director-realistic",
    name: "Naturalistic / Realistic Director",
    purpose: "Observed-light live-action. Less theatrical than cinematic; still coverage-literate.",
    applicability: { whenAny: ["visual_genre_realistic"] },
    principles: [
      principle(
        "real-observed",
        "Prefer available/practical light and unforced blocking over god-rays and hero rims unless story demands it."
      ),
    ],
    rules: [
      rule({
        id: "real-no-epic",
        description: "Avoid epic volumetric lighting and over-graded teal-orange as a default.",
      }),
    ],
    templates: {
      look_law: [
        "VISUAL GENRE: Realistic / naturalistic live-action.",
        "MEDIUM: observed photography — real textures, imperfect light, documentary-adjacent.",
        "LIGHT: available and practical; soft falloff; avoid theatrical colored rims unless motivated.",
        "CAMERA: restrained, often static or handheld-motivated; no default crane spectacle.",
        "Not anime. Not 3D cartoon. Not wuxia energy VFX.",
      ].join("\n"),
    },
    promptContextKeys: ["visual_genre", "look_law"],
  }),

  genreSkill({
    id: "genre-director-anime",
    name: "Modern Anime Cinematography Director",
    purpose:
      "Authentic modern anime (MAPPA-style action, Pierrot-style seinen horror, Lerche-style psychological thriller) — not generic 'anime style' and not photoreal.",
    applicability: { whenAny: ["visual_genre_anime"] },
    principles: [
      principle(
        "an-not-generic",
        "Never prompt only 'anime style'. Pick a grammar: shonen-action, seinen-horror, or thriller-drama."
      ),
      principle(
        "an-color-meaning",
        "Palette and lighting shifts communicate meaning (danger, class, manipulation, power) — not decoration."
      ),
      principle(
        "an-chiaroscuro",
        "Hard single-source lighting / chiaroscuro is a cross-genre anime staple at tension beats."
      ),
      principle(
        "an-impact",
        "Anime sells power through camera angle, motion blur, and impact holds — not photoreal physics."
      ),
      principle(
        "an-identity",
        "Hair color, eye color, and silhouette are instant identity markers; specify them every shot."
      ),
      principle(
        "an-register",
        "If blending: calmer thriller/drama grammar for setup; action grammar only for climax."
      ),
    ],
    rules: [
      rule({
        id: "an-medium",
        description: "Cel shading / anime line — forbid photoreal faces and live-action skin.",
        topic: "genre.medium",
        value: "anime_2d",
      }),
      rule({
        id: "an-select",
        description:
          "Action/tournament → MAPPA-like dynamic rotating camera + aura. Horror → Pierrot red-black chiaroscuro. Psychological → Lerche color-temperature-as-signal + static-then-break.",
      }),
    ],
    templates: {
      look_law: [
        "VISUAL GENRE: Modern anime cinematography (not photoreal, not generic anime).",
        "MEDIUM LOCK: 2D anime illustration, cel-shaded shadow bands, readable line, graphic eyes/hair.",
        "GRAMMAR PICK (choose one per scene unless blending is explicit):",
        "- Shonen action: fluid fight weight, rotating camera around impact, exaggerated motion blur, high-contrast aura on specials, low-angle hero on simple actions.",
        "- Seinen horror: high-contrast red/black, near-black grounds, single hard key, rim-lit face from darkness, warm-safe interior vs cold hostile exterior.",
        "- Psychological thriller: static controlled dialogue frames; warm→cold temperature shift as narrative signal; face split light/shadow at the reveal; tight close-up as pressure.",
        "Identity: specify silhouette, hair, eyes every shot. Color/light must mean something.",
        "Failure: even naturalistic lighting, random palette, photoreal skin, shonen camera on quiet drama.",
      ].join("\n"),
      action_fragment:
        "anime impact framing, exaggerated motion blur on the beat, hold the impact frame, camera language matched to genre register",
      horror_fragment:
        "high-contrast red-and-black, near-black desaturated ground, single hard key, sharp facial rim, pale eyes, rain-slick urban vs warm interior contrast",
      thriller_fragment:
        "static composition, warm-to-cold lighting shift at the reveal, face split half in shadow, status-coded wardrobe palettes, tight close-up for pressure",
    },
    failureModes: [
      {
        id: "an-generic",
        symptom: "Flat generic anime",
        likelyCause: "No studio/genre grammar selected",
        recovery: "Name action vs horror vs thriller register and lighting meaning",
      },
      {
        id: "an-photoreal",
        symptom: "Live-action faces",
        likelyCause: "Photoreal identity pack leaked",
        recovery: "Restate cel-shade medium lock; drop 8K skin language",
      },
    ],
    promptContextKeys: ["visual_genre", "look_law"],
    qualityCriteria: [
      {
        id: "an-qc",
        dimension: "anime_authenticity",
        checks: [
          "Correct register selected",
          "Lighting shift has narrative meaning",
          "Hair/eye/silhouette readable",
          "Not photoreal",
        ],
      },
    ],
  }),

  genreSkill({
    id: "genre-director-donghua-wuxia",
    name: "Wuxia / Xianxia Donghua Director",
    purpose:
      "Authentic Chinese wuxia / xianxia / xuanhuan donghua — theatrical lighting, qi VFX families, silhouette-first design. Not generic 3D, not Ne Zha blockbuster CGI.",
    applicability: { whenAny: ["visual_genre_donghua_wuxia"] },
    principles: [
      principle(
        "wx-lane",
        "Classify lane first: Wuxia (grounded martial, earthier, blade choreography) vs Xianxia (celestial, jade/gold/white, sects on floating peaks) vs Xuanhuan (elemental/beast, darker contrast). Do not give a wuxia duel a cosmic explosion unless the brief escalates power."
      ),
      principle(
        "wx-light",
        "Donghua light is theatrical and symbolic: rim/backlight reveals, 2–3 cel-shade bands, color-coded practicals (blue-white righteous, red/black-purple demonic, gold orthodox, green corruption), god-rays for sacred scale."
      ),
      principle(
        "wx-vfx",
        "Pick the VFX family: qi aura ribbons, sword-intent thin trails, calligraphic elemental ink-flow, talisman-array barriers, breakthrough bloom + scale wide, radial shockwave. Never generic glow."
      ),
      principle(
        "wx-silhouette",
        "Describe outline first — sleeves, guan/hair crown, braid, sash — then detail. Sect = consistent color+motif."
      ),
      principle(
        "wx-camera",
        "Establishing wides for peaks/halls; slow-mo push-in on named techniques; low-angle power-up; high-angle for scale; speed-ramp on blade clash; cutaway to environmental reaction."
      ),
    ],
    rules: [
      rule({
        id: "wx-medium",
        description: "Painterly / cel-adjacent donghua shading — not photoreal, not Light-Chaser blockbuster CGI.",
        topic: "genre.medium",
        value: "donghua",
      }),
      rule({
        id: "wx-no-bleed",
        description: "Do not mix faction motifs or power-stage intensity across shots without an explicit escalation beat.",
      }),
    ],
    templates: {
      look_law: [
        "VISUAL GENRE: Wuxia / Xianxia / Donghua cinematography.",
        "LANE: identify wuxia (grounded jianghu, blade, restrained VFX) vs xianxia (immortal, floating sects, jade/gold/white) vs xuanhuan (elemental/beast, fire/lightning/void).",
        "MEDIUM: painterly donghua / cel-shaded 3D-adjacent — discrete shadow bands, NOT photoreal, NOT generic mobile CGI, NOT Ne Zha realistic-myth CGI.",
        "LIGHT: theatrical color-coded rims and god-rays; hero palette contrasts the battlefield for silhouette.",
        "VFX FAMILY (pick one): qi-aura ribbons | sword-intent thin trails | calligraphic elemental ink | golden talisman array | breakthrough bloom + wide scale | radial shockwave.",
        "DESIGN: silhouette-first robes/hair; sect color+motif lock; cultivation-stage intensity matches the beat.",
        "CAMERA: wide establish for cosmic/sect geography; dedicated technique beat (push-in / low-angle / speed-ramp); environmental reaction cutaway.",
      ].join("\n"),
      scene_brief_order:
        "1) lane+tone 2) character+power stage 3) setting+establish 4) color-coded light 5) VFX family 6) technique camera beat",
    },
    failureModes: [
      {
        id: "wx-generic-glow",
        symptom: "Generic glowing energy",
        likelyCause: "No VFX family",
        recovery: "Name qi vs sword-intent vs elemental vs barrier vs breakthrough",
      },
      {
        id: "wx-natural",
        symptom: "Flat naturalistic light",
        likelyCause: "Photoreal pack",
        recovery: "Restore theatrical color-coded rim/god-ray language",
      },
      {
        id: "wx-cgi-mix",
        symptom: "Looks like Ne Zha blockbuster CGI",
        likelyCause: "Wrong Chinese-myth tradition",
        recovery: "Route realistic myth CGI to cartoon_3d Light-Chaser pack; keep this skill painterly",
      },
    ],
    promptContextKeys: ["visual_genre", "look_law"],
    qualityCriteria: [
      {
        id: "wx-qc",
        dimension: "donghua_authenticity",
        checks: [
          "Lane matched",
          "Correct VFX family",
          "Theatrical color-coded light",
          "Silhouette/sect readable",
          "Scale establish present when cosmic",
        ],
      },
    ],
  }),

  genreSkill({
    id: "genre-director-cartoon-3d",
    name: "3D Cartoon / Animated-Feature Director",
    purpose:
      "Studio-specific feature CGI (Pixar graphic, WDAS jewel/tropical, Light-Chaser/Enlight myth CGI) — not generic cute 3D.",
    applicability: { whenAny: ["visual_genre_cartoon_3d"] },
    principles: [
      principle(
        "c3-tradition",
        "Pick a tradition: Pixar graphic pop/retro-futurism; WDAS Frozen jewel dual-source ice OR Moana warm tropical zones; Light-Chaser/Enlight high-fidelity Chinese myth CGI (not painterly donghua)."
      ),
      principle(
        "c3-color-script",
        "Plan a color story per scene. Keep the hero color-distinct from the environment."
      ),
      principle(
        "c3-magic-light",
        "Magic/power is a literal light source that relights the scene — not a color filter."
      ),
      principle(
        "c3-arc-sat",
        "Emotional transformation is marked by desaturation↔saturation, not only a pose change."
      ),
      principle(
        "c3-material",
        "Premium shots name material behavior: cloth sim, translucency, eye highlights."
      ),
    ],
    rules: [
      rule({
        id: "c3-medium",
        description: "Stylized 3D feature render — not photoreal live-action, not 2D anime, not painterly donghua.",
        topic: "genre.medium",
        value: "feature_cgi",
      }),
    ],
    templates: {
      look_law: [
        "VISUAL GENRE: 3D animated-feature CGI (not generic mobile-game cartoon).",
        "PICK TRADITION:",
        "- Pixar/graphic: bold flat saturated blocking, poster-like shadow shapes, saturated character vs near-monochrome environment, clean confident key.",
        "- WDAS Frozen: jewel cyan/violet, dual source (daylight + internal ice glow), muted→saturated as emotional release.",
        "- WDAS Moana: ocean/jungle/sunset color zones, warm directional sun, gold magic as light source, optional 2D texture for mythic beats.",
        "- Light-Chaser/Enlight myth CGI: high-fidelity cloth/silk/crowns, saturated transformation burst, expressive proportions; steampunk-urban OR classical dynastic. NOT painterly wuxia donghua.",
        "Hero must not blend into background. Magic relights the set. Call out cloth/translucency/eyes on hero beats.",
      ].join("\n"),
    },
    failureModes: [
      {
        id: "c3-generic",
        symptom: "Plastic mobile-game CGI",
        likelyCause: "No studio tradition",
        recovery: "Name Pixar / WDAS / Light-Chaser register and color-script logic",
      },
      {
        id: "c3-donghua-mix",
        symptom: "Painterly donghua shading on Ne Zha brief",
        likelyCause: "Wrong Chinese tradition",
        recovery: "Use donghua_wuxia for ink/cel cultivation; this skill for realistic-myth CGI",
      },
    ],
    promptContextKeys: ["visual_genre", "look_law"],
  }),

  genreSkill({
    id: "genre-director-documentary",
    name: "Documentary Director",
    purpose: "Observational / interview / archive grammar.",
    applicability: { whenAny: ["visual_genre_documentary"] },
    principles: [
      principle(
        "doc-observe",
        "Let action happen; camera follows rather than invents spectacle. Jump cuts and B-roll are editorial, not I2V restyles."
      ),
    ],
    templates: {
      look_law: [
        "VISUAL GENRE: Documentary.",
        "MEDIUM: live-action observational — imperfect framing OK, motivated handheld, interview catch-lights, archive/B-roll inserts.",
        "LIGHT: available; interview key+fill when talking head; avoid cinema god-rays as default.",
        "Not anime. Not wuxia VFX. Not 3D cartoon.",
      ].join("\n"),
    },
    promptContextKeys: ["visual_genre", "look_law"],
  }),

  genreSkill({
    id: "genre-director-horror",
    name: "Horror Cinematography Director",
    purpose: "Dread through withheld information, contrast, and sound-implied off-screen threat (visuals still).",
    applicability: { whenAny: ["visual_genre_horror"] },
    principles: [
      principle(
        "hor-withhold",
        "Do not show the whole threat every frame. Negative space and off-screen implication beat gore-as-default."
      ),
    ],
    templates: {
      look_law: [
        "VISUAL GENRE: Horror.",
        "LIGHT: low-key, single practical, deep negative space, delayed reveal.",
        "CAMERA: withheld geography, slow push, sudden tight insert; avoid bright even lighting.",
        "Keep the locked storyboard still's set — dread is staging and light, not a new location.",
      ].join("\n"),
    },
    promptContextKeys: ["visual_genre", "look_law"],
  }),

  genreSkill({
    id: "genre-director-noir",
    name: "Noir Director",
    purpose: "Hard light, moral shadow, wet urban night.",
    applicability: { whenAny: ["visual_genre_noir"] },
    templates: {
      look_law: [
        "VISUAL GENRE: Noir.",
        "LIGHT: hard key, venetian / slat shadows, smoke, wet asphalt reflections, faces half in dark.",
        "PALETTE: monochrome-leaning with sparse practical color (neon sign, lamp).",
        "CAMERA: low angle, deep staging, silhouettes in doorways.",
      ].join("\n"),
    },
    promptContextKeys: ["visual_genre", "look_law"],
  }),

  genreSkill({
    id: "genre-director-cyberpunk",
    name: "Cyberpunk Director",
    purpose: "Neon as practical light, dense night city, rain, signage.",
    applicability: { whenAny: ["visual_genre_cyberpunk"] },
    templates: {
      look_law: [
        "VISUAL GENRE: Cyberpunk.",
        "LIGHT: neon signage as practicals (magenta/cyan), rain reflections, haze, interior sodium vs street neon contrast.",
        "SET: dense vertical city, cables, steam, multilingual signage — do not flatten into empty studio.",
        "Not generic blue sci-fi. Not donghua qi unless the locked genre is donghua.",
      ].join("\n"),
    },
    promptContextKeys: ["visual_genre", "look_law"],
  }),

  genreSkill({
    id: "genre-director-music-video",
    name: "Music Video Director",
    purpose: "Graphic performance cinema driven by rhythm and lighting change.",
    applicability: { whenAny: ["visual_genre_music_video"] },
    templates: {
      look_law: [
        "VISUAL GENRE: Music video.",
        "GRAPHIC LIGHT: colored cyc, hard edge lights, silhouette performance, rhythmic camera accents.",
        "Single visual motif per beat; do not turn it into a narrative sitcom coverage default.",
      ].join("\n"),
    },
    promptContextKeys: ["visual_genre", "look_law"],
  }),

  genreSkill({
    id: "genre-director-commercial",
    name: "Commercial / Product Cinema Director",
    purpose: "Hero-object luxury photography language.",
    applicability: { whenAny: ["visual_genre_commercial"] },
    templates: {
      look_law: [
        "VISUAL GENRE: Commercial / product cinema.",
        "HERO OBJECT: product/read readable, specular control, clean negative space, premium grade.",
        "Hands/host support the object — do not invent chaotic set dressing.",
      ].join("\n"),
    },
    promptContextKeys: ["visual_genre", "look_law"],
  }),

  genreSkill({
    id: "genre-director-western",
    name: "Western Director",
    purpose: "Landscape scale, hard sun, dust, horizon.",
    applicability: { whenAny: ["visual_genre_western"] },
    templates: {
      look_law: [
        "VISUAL GENRE: Western.",
        "GEOGRAPHY: horizon line, hard sun, dust atmosphere, wood/leather/metal materials.",
        "CAMERA: wide landscape establish before close coverage; silhouette on ridges.",
      ].join("\n"),
    },
    promptContextKeys: ["visual_genre", "look_law"],
  }),

  genreSkill({
    id: "genre-director-stop-motion",
    name: "Stop-Motion Director",
    purpose: "Tactile miniature craft.",
    applicability: { whenAny: ["visual_genre_stop_motion"] },
    templates: {
      look_law: [
        "VISUAL GENRE: Stop motion.",
        "MEDIUM: visible craft materials (fabric, clay, wood, replacement faces), miniature set scale, tactile light.",
        "MOTION: stepped / handmade feel — not smooth photoreal CGI, not 2D anime.",
      ].join("\n"),
    },
    promptContextKeys: ["visual_genre", "look_law"],
  }),

  genreSkill({
    id: "genre-director-comic",
    name: "Comic / Graphic Novel Director",
    purpose: "Inked sequential-art grammar — silhouette, graphic color, panel-readable staging.",
    applicability: { whenAny: ["visual_genre_comic"] },
    templates: {
      look_law: [
        "VISUAL GENRE: Comic / graphic novel.",
        "MEDIUM: inked line, graphic flats or controlled halftone, silhouette-first characters — not photoreal, not 3D CGI, not generic anime unless blending is explicit.",
        "STAGING: readable poses, high-contrast shapes, environment as graphic blocks.",
        "MOTION (when animating a still): limited in-between with graphic smear/impact, not live-action physics.",
      ].join("\n"),
    },
    promptContextKeys: ["visual_genre", "look_law"],
  }),
];

export const GENRE_DIRECTOR_SKILL_IDS = GENRE_DIRECTOR_SKILLS.map((s) => s.id);
