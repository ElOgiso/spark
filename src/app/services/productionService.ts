import { IProductionService } from "../domain/contracts";
import { Production, Asset, ViralSpark, Brand, Character, MemoryItem, ReviewItem, ProductionBrief } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";
import { ProductionBriefService } from "./production/productionBriefService";

const defaultProductions: Production[] = [];
const defaultAssets: Asset[] = [];

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

  /**
   * Extension: Creates a complete Production + ReviewItem + ProductionBrief from a ViralSpark
   */
  async createProductionFromSpark(params: {
    spark: ViralSpark;
    brand: Brand;
    character?: Character;
    niche?: string;
    memoryItems?: MemoryItem[];
    productionMode?: string;
  }): Promise<{ production: Production; reviewItem: ReviewItem; brief: ProductionBrief }> {
    const brief = await ProductionBriefService.generateBrief(params);

    const prodId = `p-${Date.now()}`;
    const reviewId = `r-${Date.now()}`;
    const dateStr = new Date().toISOString().split("T")[0];

    const platformRec = brief.platformRecommendation || params.spark.platformFit || "YouTube Shorts";
    const formats = platformRec.split(" + ").map((s) => s.trim()).filter(Boolean);

    const production: Production = {
      id: prodId,
      title: brief.title || params.spark.title,
      sparkId: params.spark.id,
      status: "Ready for Review",
      mode: (params.productionMode as any) || "Narrator",
      dateCreated: dateStr,
      aspectRatio: platformRec.includes("16:9") ? "16:9" : "9:16",
      formats,
      brief,
      scenes: [
        { scene: 1, description: `Hook Angle: ${brief.hook}`, duration: "0-5s" },
        { scene: 2, description: `Visual & Script Body: ${brief.visualDirection.slice(0, 100)}...`, duration: "5-25s" },
        { scene: 3, description: `Call to Action: ${brief.caption}`, duration: "25-30s" },
      ],
    };

    const reviewItem: ReviewItem = {
      id: reviewId,
      productionId: prodId,
      title: brief.title || params.spark.title,
      account: formats[0] || "YouTube Shorts",
      series: "Viral Concept Series",
      status: "Pending Review",
      dateCreated: dateStr,
      scriptSnippet: brief.hook,
      conceptText: brief.whyThisWorks,
      openingMoment: brief.visualDirection,
      qualityCheck: { brandSafety: "Passed", policyCheck: "Passed", technicalCheck: "Passed" },
      brief,
      whyThisWorks: brief.whyThisWorks,
    };

    // Save state
    const state = this.getFullState();
    const currentProds: Production[] = state.productions || [];
    const currentReviews: ReviewItem[] = state.reviewItems || [];

    this.saveFullState({
      productions: [production, ...currentProds.filter((p) => p.id !== prodId)],
      reviewItems: [reviewItem, ...currentReviews.filter((r) => r.id !== reviewId)],
    });

    return { production, reviewItem, brief };
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
