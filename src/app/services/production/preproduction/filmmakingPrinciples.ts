/**
 * Research-derived filmmaking principles for visual preproduction (§36–38).
 * Provider-neutral heuristics — not a second cinematography system.
 */

import type { FilmmakingPrinciple } from "./types";

/**
 * Three core principles encoding look / assets / purpose ordering before generation.
 * Tags mark research-supported production technique for AI filmmaking pipelines.
 */
export const FILMMAKING_PRINCIPLES: FilmmakingPrinciple[] = [
  {
    id: "look_before_generation",
    title: "Look before generation",
    text:
      "Establish a coherent visual treatment (palette, lighting mood, camera language, texture) " +
      "before any shot or storyboard image is generated. Color grading alone is not cinematography; " +
      "look is a coordinated system of lighting, composition, lens language, blocking, and finishing.",
    tags: ["ai-filmmaking", "production-technique", "research-supported"],
    certainty: "supported",
  },
  {
    id: "assets_before_shots",
    title: "Assets before shots",
    text:
      "Lock character, location, and product visual contracts (identity, wardrobe, environment, branding) " +
      "before planning or generating individual shots. Stable master assets prevent identity drift across " +
      "panels and candidates; storyboard panels reference ShotSpec and contracts — they do not invent assets.",
    tags: ["ai-filmmaking", "production-technique", "research-supported"],
    certainty: "supported",
  },
  {
    id: "purpose_before_camera",
    title: "Purpose before camera",
    text:
      "Every shot must declare why it exists (dramatic / editorial purpose) before framing, lens, " +
      "depth of field, or camera movement are chosen. Unmotivated motion and purposeless coverage " +
      "degrade continuity and editorial usefulness; ShotSpec.productionReason remains mandatory.",
    tags: ["ai-filmmaking", "production-technique", "research-supported"],
    certainty: "supported",
  },
];

export function getFilmmakingPrinciples(): FilmmakingPrinciple[] {
  return FILMMAKING_PRINCIPLES.map((p) => ({ ...p, tags: [...p.tags] }));
}

export function filmmakingPrincipleIds(): string[] {
  return FILMMAKING_PRINCIPLES.map((p) => p.id);
}

export function principleById(id: string): FilmmakingPrinciple | undefined {
  return FILMMAKING_PRINCIPLES.find((p) => p.id === id);
}
