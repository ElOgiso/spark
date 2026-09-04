import type { ProductionGrammar } from "./types";

export const animeGrammar: ProductionGrammar = {
  id: "anime",
  label: "Anime",
  description: "Anime visual language, expressive performance, stylized motion",
  narrativeFunctions: ["hook", "establishing", "confrontation", "payoff"],
  coverage: {
    preferredShotTypes: ["wide", "medium", "closeup", "extreme_closeup", "reaction"],
    preferredMovements: ["static", "push_in", "pan", "tracking"],
    requireEstablishing: true,
    requireInserts: false,
    dialogueCoverage: true,
    brollDensity: "low",
  },
  audioBias: { narration: false, dialogue: true, music: true, soundDesign: true },
  pacingBias: "variable",
  visualNotes: ["anime line language", "expressive eyes", "speed lines sparingly"],
  editorialNotes: ["impact frames", "reaction beats"],
  tags: ["anime", "stylized"],
};

export default animeGrammar;
