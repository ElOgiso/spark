export interface Brand {
  name: string;
  niche: string;
  archetype: string;
  purpose: string;
  contentPillars: { label: string; active: boolean }[];
  audience: {
    primary: string;
    painPoints: string[];
    desires: string[];
  };
  tone: { label: string; active: boolean }[];
  // Future backend and automation configuration fields
  automation_mode?: AutomationMode;
  review_required?: boolean;
  publish_requires_approval?: boolean;
  autonomous_publishing_enabled?: boolean;
  sensitive_content_rules?: string[];
  account_specific_rules?: Record<string, any>;
  platform_specific_permissions?: Record<string, any>;
}

export interface Character {
  name: string;
  role: string;
  style: string;
  traits: string[];
  voice: {
    name: string;
    language: string;
    tone: string;
    locked: boolean;
  };
}

export type AutomationMode = "manual" | "balanced" | "autonomous";
export type ProductionMode = "express" | "standard" | "deep";

export interface Account {
  platform: string;
  handle: string;
  status: "connected" | "disconnected";
  posts: number;
}

export interface ViralSpark {
  id: string;
  title: string;
  hook: string;
  views: string;
  velocity: string;
  platformFit: string;
  brandFitScore: number;
  category: "hot" | "rising" | "niche";
  timeWindow: string;
  productionTime: string;
  whyNow: string;
  angle: string;
}

export interface Production {
  id: string;
  title: string;
  sparkId?: string;
  status: "Drafting" | "Ready for Review" | "Approved" | "Needs Edit" | "Published" | "Failed";
  mode: ProductionMode;
  dateCreated: string;
  aspectRatio: string;
  formats: string[];
  scenes: { scene: number; description: string; duration: string }[];
}

export interface QualityCheck {
  brandSafety: "Passed" | "Warning" | "Failed";
  policyCheck: "Passed" | "Warning" | "Failed";
  technicalCheck: "Passed" | "Warning" | "Failed";
}

export interface ReviewItem {
  id: string;
  productionId: string;
  title: string;
  account: string;
  series: string;
  status: "Pending Review" | "Approved" | "Needs Edit";
  dateCreated: string;
  scriptSnippet: string;
  conceptText: string;
  openingMoment: string;
  qualityCheck: QualityCheck;
}

export interface PublishJob {
  id: string;
  productionId: string;
  title: string;
  platform: string;
  scheduledTime: string;
  status: "Scheduled" | "Export Ready" | "Published" | "Failed" | "Needs Review";
}

export interface ExportPackage {
  id: string;
  productionId: string;
  title: string;
  size: string;
  formats: string[];
  readyAt: string;
}

export interface AnalyticsInsight {
  id: string;
  title: string;
  description: string;
  metric: string;
  change: string;
  type: "worked" | "failed" | "learning";
  bestHook: string;
  bestFormat: string;
  bestPlatformFit: string;
}

export interface MemoryItem {
  id: string;
  type: "learned" | "rule";
  text: string;
  dateAdded: string;
}

export interface Asset {
  id: string;
  name: string;
  type: "video" | "audio" | "image" | "document";
  size: string;
  url: string;
}

export interface AutomationSettings {
  id: string;
  brandId: string;
  automationMode: AutomationMode;
  reviewRequired: boolean;
  publishRequiresApproval: boolean;
  autonomousPublishingEnabled: boolean;
  sensitiveContentRules: string[];
  accountSpecificRules: Record<string, any>;
  platformSpecificPermissions: Record<string, any>;
}

export interface AuditLog {
  id: string;
  userId?: string;
  brandId?: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

