import {
  Brand,
  Character,
  Account,
  AutomationMode,
  ProductionMode,
  ViralSpark,
  Production,
  ReviewItem,
  PublishJob,
  ExportPackage,
  AnalyticsInsight,
  MemoryItem,
  Asset
} from "./types";

/**
 * Service interfaces to prepare the Spark frontend for a clean transition 
 * from local storage and mock state to an asynchronous database (like Supabase).
 */

export interface ISparkService {
  getBrand(): Promise<Brand>;
  updateBrand(brand: Partial<Brand>): Promise<Brand>;
  toggleContentPillar(label: string): Promise<Brand>;
  toggleTone(label: string): Promise<Brand>;
  
  getCharacter(): Promise<Character>;
  updateCharacter(character: Partial<Character>): Promise<Character>;
  
  getAccounts(): Promise<Account[]>;
  updateAccountStatus(platform: string, status: "connected" | "disconnected"): Promise<Account[]>;

  getAutomationMode(): Promise<AutomationMode>;
  updateAutomationMode(mode: AutomationMode): Promise<AutomationMode>;

  getProductionMode(): Promise<ProductionMode>;
  updateProductionMode(mode: ProductionMode): Promise<ProductionMode>;
}

export interface IProductionService {
  getProductions(): Promise<Production[]>;
  createProduction(production: Omit<Production, "id" | "dateCreated">): Promise<Production>;
  updateProductionStatus(id: string, status: Production["status"]): Promise<Production>;
  getAssets(): Promise<Asset[]>;
  addAsset(name: string, type: Asset["type"], size: string): Promise<Asset>;
}

export interface IReviewService {
  getReviewItems(): Promise<ReviewItem[]>;
  approveReviewItem(id: string): Promise<ReviewItem>;
  rejectOrRequestEditReviewItem(id: string): Promise<ReviewItem>;
}

export interface ICalendarService {
  getPublishJobs(): Promise<PublishJob[]>;
  getExportPackages(): Promise<ExportPackage[]>;
  schedulePublishJob(id: string, scheduledTime: string): Promise<PublishJob>;
  createPublishJob(job: Omit<PublishJob, "id">): Promise<PublishJob>;
  createExportPackage(pkg: Omit<ExportPackage, "id">): Promise<ExportPackage>;
}

export interface IAnalyticsService {
  getAnalyticsInsights(): Promise<AnalyticsInsight[]>;
}

export interface IMemoryService {
  getMemoryItems(): Promise<MemoryItem[]>;
  addMemoryItem(text: string, type: "learned" | "rule", category?: string): Promise<MemoryItem>;
  removeMemoryItem(id: string): Promise<void>;
}
