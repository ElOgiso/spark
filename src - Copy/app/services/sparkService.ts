import { ISparkService } from "../domain/contracts";
import { Brand, Character, Account, AutomationMode, ProductionMode } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const defaultBrand: Brand = {
  name: "My Brand",
  niche: "Content Creation",
  archetype: "The Expert Guide",
  purpose: "Set up your brand identity during onboarding to personalize Spark.",
  contentPillars: [
    { label: "AI & Automation", active: true },
    { label: "Mobile Technology", active: true },
    { label: "Digital Marketing", active: true },
    { label: "Content Creation", active: true },
    { label: "Tech Entrepreneurship", active: true },
    { label: "African Tech Ecosystem", active: false },
  ],
  audience: {
    primary: "Your target audience — configure during onboarding",
    painPoints: [
      "Define your audience's challenges during onboarding",
    ],
    desires: [
      "Define your audience's goals during onboarding",
    ],
  },
  tone: [
    { label: "Energetic", active: true },
    { label: "Relatable", active: true },
    { label: "Expert", active: true },
    { label: "Humorous", active: true },
    { label: "Inspiring", active: true },
    { label: "Direct", active: false },
    { label: "Academic", active: false },
    { label: "Formal", active: false },
  ],
  automation_mode: "balanced",
  review_required: true,
  publish_requires_approval: true,
  autonomous_publishing_enabled: false,
  sensitive_content_rules: [
    "Never post contents showing speculative financial advice or unregistered digital currencies.",
    "Do not engage in regional political comparisons without direct factual source citations."
  ]
};

const defaultCharacter: Character = {
  name: "Creator",
  role: "Primary Host",
  style: "Modern creator — confident, clear, high-production standard",
  traits: ["Energetic", "Relatable", "Knowledgeable", "Inspiring"],
  voice: {
    name: "Spark_Default_Voice",
    language: "English",
    tone: "Energetic & Professional",
    locked: true,
  },
};

const defaultAccounts: Account[] = [];

export class SparkService implements ISparkService {
  private getFullState() {
    return loadPersistedState<any>() || {};
  }

  private saveFullState(updates: any) {
    const current = this.getFullState();
    savePersistedState({ ...current, ...updates });
  }

  async getBrand(): Promise<Brand> {
    const state = this.getFullState();
    if (!state.brand) {
      this.saveFullState({ brand: defaultBrand });
      return defaultBrand;
    }
    return state.brand;
  }

  async updateBrand(brandUpdates: Partial<Brand>): Promise<Brand> {
    const brand = await this.getBrand();
    const updated = { ...brand, ...brandUpdates };
    this.saveFullState({ brand: updated });
    return updated;
  }

  async toggleContentPillar(label: string): Promise<Brand> {
    const brand = await this.getBrand();
    const contentPillars = brand.contentPillars.map((p) =>
      p.label === label ? { ...p, active: !p.active } : p
    );
    return this.updateBrand({ contentPillars });
  }

  async toggleTone(label: string): Promise<Brand> {
    const brand = await this.getBrand();
    const tone = brand.tone.map((t) =>
      t.label === label ? { ...t, active: !t.active } : t
    );
    return this.updateBrand({ tone });
  }

  async getCharacter(): Promise<Character> {
    const state = this.getFullState();
    if (!state.character) {
      this.saveFullState({ character: defaultCharacter });
      return defaultCharacter;
    }
    return state.character;
  }

  async updateCharacter(characterUpdates: Partial<Character>): Promise<Character> {
    const character = await this.getCharacter();
    const updated = { ...character, ...characterUpdates };
    this.saveFullState({ character: updated });
    return updated;
  }

  async getAccounts(): Promise<Account[]> {
    const state = this.getFullState();
    if (!state.accounts) {
      this.saveFullState({ accounts: defaultAccounts });
      return defaultAccounts;
    }
    return state.accounts;
  }

  async updateAccountStatus(platform: string, status: "connected" | "disconnected"): Promise<Account[]> {
    const accounts = await this.getAccounts();
    const updated = accounts.map((acc) =>
      acc.platform === platform ? { ...acc, status } : acc
    );
    this.saveFullState({ accounts: updated });
    return updated;
  }

  async getAutomationMode(): Promise<AutomationMode> {
    const state = this.getFullState();
    return state.automationMode || "balanced";
  }

  async updateAutomationMode(mode: AutomationMode): Promise<AutomationMode> {
    this.saveFullState({ automationMode: mode });
    // Also sync the brand settings for the automation_mode field
    const brand = await this.getBrand();
    await this.updateBrand({
      automation_mode: mode,
      autonomous_publishing_enabled: mode === "autonomous",
      publish_requires_approval: mode !== "autonomous"
    });
    return mode;
  }

  async getProductionMode(): Promise<ProductionMode> {
    const state = this.getFullState();
    return state.productionMode || "standard";
  }

  async updateProductionMode(mode: ProductionMode): Promise<ProductionMode> {
    this.saveFullState({ productionMode: mode });
    return mode;
  }
}

export const sparkService = new SparkService();
