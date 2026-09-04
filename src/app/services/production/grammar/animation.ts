import type { ProductionGrammar } from "./types";

export const animationGrammar: ProductionGrammar = {
  id: "animation",
  label: "Animation",
  description: "Character/environment consistency, staging, motion rules",
  narrativeFunctions: ["hook", "establishing", "confrontation", "payoff", "cta"],
  coverage: {
    preferredShotTypes: ["wide", "medium", "closeup", "insert"],
    preferredMovements: ["static", "pan", "push_in"],
    requireEstablishing: true,
    requireInserts: false,
    dialogueCoverage: true,
    brollDensity: "low",
  },
  audioBias: { narration: false, dialogue: true, music: true, soundDesign: true },
  pacingBias: "measured",
  visualNotes: ["character design consistency", "environment consistency", "clear staging"],
  editorialNotes: ["hold poses for readability"],
  tags: ["animated", "stylized"],
};

export default animationGrammar;
