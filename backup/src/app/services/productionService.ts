import { IProductionService } from "../domain/contracts";
import { Production, Asset } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

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
