import type { ProductionGrammar } from "./types";

export const narrativeFilmGrammar: ProductionGrammar = {
  id: "narrative_film",
  label: "Narrative Film",
  description: "Scene-based storytelling with character continuity and cinematic coverage",
  narrativeFunctions: ["establishing", "confrontation", "resolution", "hook", "payoff"],
  coverage: {
    preferredShotTypes: ["establishing", "wide", "medium", "closeup", "over_the_shoulder", "insert"],
    preferredMovements: ["static", "dolly", "tracking", "push_in"],
    requireEstablishing: true,
    requireInserts: true,
    dialogueCoverage: true,
    brollDensity: "medium",
  },
  audioBias: { narration: false, dialogue: true, music: true, soundDesign: true },
  pacingBias: "measured",
  visualNotes: ["character continuity", "emotional progression", "motivated camera"],
  editorialNotes: ["motivated cuts", "dialogue coverage", "visual transitions"],
  tags: ["cinematic", "story", "drama"],
};

export default narrativeFilmGrammar;
