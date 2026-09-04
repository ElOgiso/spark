import type { ShotType, CameraMovement } from "../specification/shotSpec";
import type { NarrativeFunction } from "../specification/sceneSpec";
import type { ContentGenreId } from "../specification/productionSpec";

export interface GrammarCoverageRule {
  preferredShotTypes: ShotType[];
  preferredMovements: CameraMovement[];
  requireEstablishing: boolean;
  requireInserts: boolean;
  dialogueCoverage: boolean;
  brollDensity: "none" | "low" | "medium" | "high";
}

export interface ProductionGrammar {
  id: ContentGenreId | string;
  label: string;
  description: string;
  narrativeFunctions: NarrativeFunction[];
  coverage: GrammarCoverageRule;
  audioBias: {
    narration: boolean;
    dialogue: boolean;
    music: boolean;
    soundDesign: boolean;
  };
  pacingBias: "compressed" | "measured" | "epic" | "variable";
  visualNotes: string[];
  editorialNotes: string[];
  tags: string[];
}

export interface ComposedGrammar extends ProductionGrammar {
  sources: string[];
}
