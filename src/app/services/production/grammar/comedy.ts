import type { NarrativeFunction } from "../specification/sceneSpec";
import type { ProductionGrammar } from "./types";

export const comedyGrammar: ProductionGrammar = {
  id: "comedy",
  label: "Comedy",
  description: "Timing, reaction, setup/punchline visual grammar",
  narrativeFunctions: ["hook", "context", "payoff", "cta"],
  coverage: {
    preferredShotTypes: ["medium", "closeup", "reaction", "wide", "insert"],
    preferredMovements: ["static", "push_in", "handheld"],
    requireEstablishing: false,
    requireInserts: false,
    dialogueCoverage: true,
    brollDensity: "low",
  },
  audioBias: { narration: true, dialogue: true, music: true, soundDesign: true },
  pacingBias: "compressed",
  visualNotes: ["reaction coverage", "clear punchline framing"],
  editorialNotes: ["hold for laugh", "timing over flourish"],
  tags: ["comedy", "timing"],
};

export default comedyGrammar;
