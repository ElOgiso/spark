import { ISparkService } from "../domain/contracts";
import { Brand, Character, Account, AutomationMode, ProductionMode } from "../domain/types";
import { loadPersistedState, savePersistedState } from "../state/persistence";

const defaultBrand: Brand = {
  name: "Tech Insights Nigeria",
  niche: "AI & Technology Education",
  archetype: "The Expert Guide",
  purpose: "Demystifying technology for African creators and entrepreneurs — making the complex accessible, practical, and profitable.",
  contentPillars: [
    { label: "AI & Automation", active: true },
    { label: "Mobile Technology", active: true },
    { label: "Digital Marketing", active: true },
    { label: "Content Creation", active: true },
    { label: "Tech Entrepreneurship", active: true },
    { label: "African Tech Ecosystem", active: false },
  ],
  audience: {
    primary: "Nigerian tech enthusiasts, entrepreneurs, and creators aged 18–35",
    painPoints: [
      "Tech feels inaccessible or too Western-focused",
      "Don't know which tools to invest in",
      "Want to build online income but don't know how",
    ],
    desires: [
      "Feel ahead of the curve on technology",
      "Build a profitable online presence",
      "Connect with a community of similar minds",
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
  name: "Tunde",
  role: "Primary Host",
  style: "Young Nigerian male, tech-casual — glasses, branded tees, high energy",
  traits: ["Energetic", "Relatable", "Knowledgeable", "Humorous"],
  voice: {
    name: "Spark_Nigeria_English",
    language: "English (Nigerian accent)",
    tone: "Energetic & Friendly",
    locked: true,
  },
};

const defaultAccounts: Account[] = [
  { platform: "YouTube", handle: "@TechInsightsNG", status: "connected", posts: 187 },
  { platform: "TikTok", handle: "@techinsightsng", status: "connected", posts: 312 },
  { platform: "Instagram", handle: "@techinsightsng", status: "connected", posts: 89 },
  { platform: "LinkedIn", handle: "Tech Insights Nigeria", status: "connected", posts: 45 },
  { platform: "Twitter/X", handle: "@TechInsightsNG", status: "disconnected", posts: 0 },
];

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
