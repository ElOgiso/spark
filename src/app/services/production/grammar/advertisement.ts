import type { ProductionGrammar } from "./types";

export const advertisementGrammar: ProductionGrammar = {
  id: "advertisement",
  label: "Advertisement",
  description: "Product priority, brand visibility, benefit demo, CTA",
  narrativeFunctions: ["hook", "problem", "product", "proof", "payoff", "cta"],
  coverage: {
    preferredShotTypes: ["closeup", "macro", "medium", "wide", "insert"],
    preferredMovements: ["push_in", "orbit", "static", "dolly"],
    requireEstablishing: false,
    requireInserts: true,
    dialogueCoverage: false,
    brollDensity: "medium",
  },
  audioBias: { narration: true, dialogue: false, music: true, soundDesign: true },
  pacingBias: "compressed",
  visualNotes: ["premium composition", "product closeups", "brand-safe lighting"],
  editorialNotes: ["controlled pacing", "CTA beat mandatory"],
  tags: ["commercial", "luxury", "product"],
};

export default advertisementGrammar;
