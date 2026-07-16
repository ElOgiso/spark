import { Brand, Account, AutomationSettings } from "../../domain/types";

export interface WorkspaceSnapshot {
  id: string;
  name: string;
  activeBrand: Brand;
  connectedAccounts: Account[];
  companyGoals: string[];
  activeCampaigns: string[];
  toneGuidelines: string[];
  targetAudience: string;
  writingPreferences: string[];
  contentPillars: string[];
  approvalSettings: {
    reviewRequired: boolean;
    publishRequiresApproval: boolean;
  };
  automationSettings: AutomationSettings;
}

export class WorkspaceIntelligence {
  private static instance: WorkspaceIntelligence;
  private snapshot: WorkspaceSnapshot | null = null;

  private constructor() {
    this.loadDefaultWorkspace();
  }

  public static getInstance(): WorkspaceIntelligence {
    if (!WorkspaceIntelligence.instance) {
      WorkspaceIntelligence.instance = new WorkspaceIntelligence();
    }
    return WorkspaceIntelligence.instance;
  }

  private loadDefaultWorkspace(): void {
    const defaultBrand: Brand = {
      name: "Spark Media OS",
      niche: "AI-native content automation and tools development",
      archetype: "Innovator / Sage",
      purpose: "Empowering creators and builders to scale media output autonomously",
      contentPillars: [
        { label: "AI Workflows", active: true },
        { label: "Web Engineering", active: true },
        { label: "Productivity", active: false }
      ],
      audience: {
        primary: "Developers, technical founders, and growth marketers",
        painPoints: ["Scaling content quality", "Managing multiple AI platforms", "Time spent editing"],
        desires: ["Automated premium quality assets", "One-click deployment", "Clear performance tracking"]
      },
      tone: [
        { label: "Authoritative", active: true },
        { role: "system", label: "Insightful", active: true } as any, // casting to allow role if needed
        { label: "Direct", active: true },
        { label: "Vibrant", active: false }
      ]
    };

    const defaultSettings: AutomationSettings = {
      id: "settings-default",
      brandId: "brand-default",
      automationMode: "balanced",
      reviewRequired: true,
      publishRequiresApproval: true,
      autonomousPublishingEnabled: false,
      sensitiveContentRules: ["No controversial topics", "Verify all outbound links"],
      accountSpecificRules: {},
      platformSpecificPermissions: {}
    };

    this.snapshot = {
      id: "workspace-default",
      name: "Default Executive Workspace",
      activeBrand: defaultBrand,
      connectedAccounts: [
        { platform: "twitter", handle: "@spark_media_os", status: "connected", posts: 42 },
        { platform: "linkedin", handle: "spark-media-os", status: "connected", posts: 19 }
      ],
      companyGoals: [
        "Increase weekly impressions by 25% with zero manual copy-writing",
        "Publish 3 high-quality educational posts daily",
        "Promote technical AI framework updates automatically"
      ],
      activeCampaigns: ["Sprint 9 Workspace Launch", "Multi-Agent OS Showcase"],
      toneGuidelines: ["Energetic, yet precise", "Focus on technical value over hype", "Always provide clear takeaways"],
      targetAudience: "Technical creators, developers, AI-curious growth engineers",
      writingPreferences: ["Keep paragraphs brief (max 3 sentences)", "Use formatting like bullet lists heavily", "Avoid empty buzzwords"],
      contentPillars: ["Multi-agent OS", "Brand memory integration", "Workspace intelligence scaling"],
      approvalSettings: {
        reviewRequired: true,
        publishRequiresApproval: true
      },
      automationSettings: defaultSettings
    };
  }

  public getWorkspaceSnapshot(): WorkspaceSnapshot {
    if (!this.snapshot) {
      this.loadDefaultWorkspace();
    }
    return this.snapshot!;
  }

  // ── Production Artifacts Storage ──────────────────────────────────
  private productions: Map<string, any> = new Map();

  public addProductionArtifacts(productionId: string, artifacts: any): void {
    this.productions.set(productionId, artifacts);
    console.log(`[Workspace Intelligence] Registered artifacts for production: ${productionId}`);
  }

  public getProductionArtifacts(productionId: string): any | undefined {
    return this.productions.get(productionId);
  }

  public refresh(): void {
    console.log("[Workspace Intelligence] Refreshing active workspace snapshot...");
    this.loadDefaultWorkspace();
  }

  public invalidate(): void {
    console.log("[Workspace Intelligence] Invalidating workspace cache...");
    this.snapshot = null;
  }
}
