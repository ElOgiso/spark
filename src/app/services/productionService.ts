import { IProductionService } from "../domain/contracts";
import { Production, Asset } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const defaultProductions: Production[] = [
  {
    id: "p1",
    title: "5 Viral Marketing Tactics That Actually Work in 2026",
    status: "Ready for Review",
    mode: "standard",
    dateCreated: "2026-07-01",
    aspectRatio: "16:9",
    formats: ["Long-form Video", "TikTok Cuts"],
    scenes: [
      { scene: 1, description: "Hook: Show bad ads with big red X", duration: "0-5s" },
      { scene: 2, description: "Tunde intro: Demystify virality statistics", duration: "5-20s" },
      { scene: 3, description: "Tactic 1: Narrative sequencing style", duration: "20-55s" }
    ]
  },
  {
    id: "p2",
    title: "The Psychology Behind Viral Content",
    status: "Ready for Review",
    mode: "express",
    dateCreated: "2026-07-01",
    aspectRatio: "9:16",
    formats: ["TikTok Reel"],
    scenes: [
      { scene: 1, description: "Brain graphic with trigger buttons", duration: "0-8s" },
      { scene: 2, description: "Explain curiosity gap mechanics", duration: "8-30s" }
    ]
  },
  {
    id: "p3",
    title: "How AI Creates Engaging Stories",
    status: "Needs Edit",
    mode: "standard",
    dateCreated: "2026-06-30",
    aspectRatio: "1:1",
    formats: ["Instagram Slide Deck", "Audio Narrative"],
    scenes: [
      { scene: 1, description: "Graphic matching human and AI patterns side-by-side", duration: "0-10s" }
    ]
  },
  {
    id: "p4",
    title: "Building a Personal Brand in 2026",
    status: "Approved",
    mode: "deep",
    dateCreated: "2026-06-29",
    aspectRatio: "16:9",
    formats: ["LinkedIn Article", "YouTube Video"],
    scenes: [
      { scene: 1, description: "Tunde speaking directly to personal reputation strategy", duration: "0-45s" }
    ]
  },
  {
    id: "p5",
    title: "Content Creation Workflow Optimization",
    status: "Drafting",
    mode: "standard",
    dateCreated: "2026-07-01",
    aspectRatio: "16:9",
    formats: ["YouTube Tutorial"],
    scenes: []
  },
  {
    id: "p6",
    title: "Nigerian Creator Economy Deep Dive",
    status: "Drafting",
    mode: "deep",
    dateCreated: "2026-07-01",
    aspectRatio: "16:9",
    formats: ["YouTube Mini-Documentary"],
    scenes: []
  },
  {
    id: "p7",
    title: "AI Editing Tools Comparison 2026",
    status: "Approved",
    mode: "standard",
    dateCreated: "2026-06-28",
    aspectRatio: "16:9",
    formats: ["YouTube Comparison"],
    scenes: []
  },
  {
    id: "p8",
    title: "Free Tools Every Creator Needs",
    status: "Approved",
    mode: "express",
    dateCreated: "2026-06-28",
    aspectRatio: "9:16",
    formats: ["Short-form 45s"],
    scenes: []
  }
];

const defaultAssets: Asset[] = [
  { id: "as1", name: "tunde_host_voice_profile.wav", type: "audio", size: "8.4 MB", url: "#" },
  { id: "as2", name: "spark_branding_kit_2026.pdf", type: "document", size: "12.1 MB", url: "#" },
  { id: "as3", name: "fail_campaign_money_burn.mp4", type: "video", size: "24.5 MB", url: "#" },
  { id: "as4", name: "nigerian_creator_economy_report.pdf", type: "document", size: "3.2 MB", url: "#" }
];

export class ProductionService implements IProductionService {
  private getFullState() {
    return loadPersistedState<any>() || {};
  }

  private saveFullState(updates: any) {
    const current = this.getFullState();
    savePersistedState({ ...current, ...updates });
  }

  async getProductions(): Promise<Production[]> {
    const state = this.getFullState();
    if (!state.productions) {
      this.saveFullState({ productions: defaultProductions });
      return defaultProductions;
    }
    return state.productions;
  }

  async createProduction(productionData: Omit<Production, "id" | "dateCreated">): Promise<Production> {
    const productions = await this.getProductions();
    const newProduction: Production = {
      ...productionData,
      id: `p-${Date.now()}`,
      dateCreated: new Date().toISOString().split("T")[0]
    };
    const updated = [newProduction, ...productions];
    this.saveFullState({ productions: updated });
    return newProduction;
  }

  async updateProductionStatus(id: string, status: Production["status"]): Promise<Production> {
    const productions = await this.getProductions();
    let updatedProd: Production | null = null;
    const updated = productions.map((p) => {
      if (p.id === id) {
        updatedProd = { ...p, status };
        return updatedProd;
      }
      return p;
    });
    if (!updatedProd) {
      throw new Error(`Production with id ${id} not found`);
    }
    this.saveFullState({ productions: updated });
    return updatedProd;
  }

  async getAssets(): Promise<Asset[]> {
    const state = this.getFullState();
    if (!state.assets) {
      this.saveFullState({ assets: defaultAssets });
      return defaultAssets;
    }
    return state.assets;
  }

  async addAsset(name: string, type: Asset["type"], size: string): Promise<Asset> {
    const assets = await this.getAssets();
    const newAsset: Asset = {
      id: `as-${Date.now()}`,
      name,
      type,
      size,
      url: "#"
    };
    const updated = [newAsset, ...assets];
    this.saveFullState({ assets: updated });
    return newAsset;
  }
}

export const productionService = new ProductionService();
