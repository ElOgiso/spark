export interface Brand {
  name: string;
  niche: string;
  archetype: string;
  purpose: string;
  country?: string;
  language?: string;
  website?: string;
  contentPillars: { label: string; active: boolean }[];
  audience: {
    primary: string;
    painPoints: string[];
    desires: string[];
  };
  tone: { label: string; active: boolean }[];
  style?: { label: string; active: boolean }[];
  // Future backend and automation configuration fields
  automation_mode?: AutomationMode;
  productionMode?: string;
  formatSettings?: ProductionFormatSettings;
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
  avatarUrl?: string | null;
  imageUrl?: string | null;
  characterSheetUrl?: string | null;
  voice: {
    name: string;
    language: string;
    tone: string;
    locked: boolean;
    voiceId?: string;
    description?: string;
    gender?: string;
    previewUrl?: string;
  };
}

export type AutomationMode = "manual" | "balanced" | "autonomous";
export type ProductionMode = "express" | "standard" | "deep";

export interface Account {
  platform: string;
  handle: string;
  status: "connected" | "needs_reconnect" | "disconnected";
  posts: number;
}

export interface StructuredResearchContext {
  sourceName?: string;
  platform?: string;
  hookPattern?: string;
  titlePattern?: string;
  format?: string;
  ctaStyle?: string;
  nicheLanguage?: string[];
  viralReasons?: string[];
  retentionSignals?: string[];
  provenStructure?: string;
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
  audienceEmotion: string;
  expectedRetention: string;
  difficulty: string;
  riskLevel: "Low" | "Medium" | "High";
  suggestedFormat: string;
  suggestedProductionMode: string;
  suggestedMode?: "express" | "standard" | "deep";
  origin?: "TREND" | "SOURCE" | "HYBRID";
  sourceId?: string;
  fingerprint?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  lastSyncedAt?: string;
  syncCount?: number;
  researchContext?: StructuredResearchContext;
}

export type SceneStatus = "pending" | "generating" | "ready" | "needs_edit" | "approved" | "failed";

export interface ProductionScene {
  scene: number;
  duration: string;
  shotList: string;
  cameraDirection: string;
  transitions: string;
  onScreenText: string;
  pacing: string;
  scriptSnippet: string;
  spokenLines?: string;
  audio?: "vo" | "talent";
  valueJob?: "hook" | "problem" | "context" | "proof" | "example" | "myth_bust" | "payoff" | "cta" | string;
  visualDescription: string;
  startState?: string;
  endState?: string;
  primaryChange?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  image?: string;
  videoUrl?: string;

  id?: string;
  productionId?: string;
  brandId?: string;
  index?: number;
  durationSec?: number;
  action?: string;
  camera?: string;
  scriptBeat?: string;
  keyframeImageUrl?: string;
  lastFrameUrl?: string;
  status?: SceneStatus;
  editNotes?: string;
  lastError?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GenerationProgressStage {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "failed";
}

export interface GenerationProgress {
  percent: number;
  stage: string;
  stages: GenerationProgressStage[];
  message?: string;
  updatedAt?: string;
  partialAssets?: {
    storyboard?: ProductionScene[];
    thumbnails?: { id: string; variant: string; concept: string; image?: string; url?: string }[];
    voiceUrl?: string;
    videoUrl?: string;
    lastError?: string;
  };
}

export type OfferType = "link" | "product" | "course";

export interface Offer {
  id: string;
  type: OfferType;
  title: string;
  url: string;
  priceLabel?: string;       // display only e.g. "₦15,000" | "Free" | "$49"
  description?: string;      // short CTA support text
  active: boolean;
  isDefault?: boolean;       // at most one default active offer recommended
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductionBriefBeat {
  timecode: string;
  valueJob: "hook" | "problem" | "context" | "proof" | "example" | "myth_bust" | "payoff" | "cta";
  spokenLines: string;
  onScreenText: string;
  cameraDirection?: string;
}

export interface ProductionBrief {
  title: string;
  productionMode: string;
  hook: string;
  scriptOutline: string;
  beats?: ProductionBriefBeat[];
  spokenCta?: string;
  onScreenCta?: string;
  visualDirection: string;
  caption: string;
  platformRecommendation: string;
  whyThisWorks: string;
  brandFitScore: number;
  suggestedDuration: string;
  targetDurationSec?: number;
  storyboard?: ProductionScene[];
  storyboardGridUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  generationProgress?: GenerationProgress;
  offerCta?: {
    id?: string;
    type?: OfferType;
    title: string;
    url: string;
    priceLabel?: string;
    description?: string;
  };
  generatedAssets?: {
    storyboardGridUrl?: string;
    sceneClips?: string[];
    thumbnails?: { id: string; concept: string; variant: string; url?: string; image?: string }[];
    voiceoverUrl?: string;
    generatedFrames?: string[];
    generatedVideos?: string[];
    generatedAudio?: string[];
    generationProgress?: GenerationProgress;
    generationMetadata?: {
      renderStartedAt?: string;
      renderCompletedAt?: string;
      providerUsed?: string;
      generationStatus?: string;
      lastError?: string;
    };
  };
}

export interface Production {
  id: string;
  title: string;
  sparkId?: string;
  status: "Drafting" | "Ready for Review" | "Approved" | "Needs Edit" | "Published" | "Failed" | "Cancelled";
  mode: ProductionMode;
  dateCreated: string;
  aspectRatio: string;
  formats: string[];
  targetDurationSec?: number;
  formatSettings?: ProductionFormatSettings;
  scenes: { scene: number; description: string; duration: string; image?: string; videoUrl?: string }[];
  productionScenes?: ProductionScene[];
  reasoning?: any;
  brief?: ProductionBrief;
  audioUrl?: string;
  videoUrl?: string;
  isGeneratingAssets?: boolean;
  generationProgress?: GenerationProgress;
  lastError?: string;
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
  brief?: ProductionBrief;
  whyThisWorks?: string;
  videoUrl?: string;
  audioUrl?: string;
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
  category?: "Character" | "Voice" | "Brand" | "Niche" | "Audio" | "Winning hooks" | "Winning thumbnails" | "Audience preferences" | "Failures" | "Publishing behavior";
  pinned?: boolean;
  archived?: boolean;
  fingerprint?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  syncCount?: number;
}

export interface ProductionAsset {
  id: string;
  brandId?: string;
  productionId: string;
  assetType: "image" | "frame" | "storyboard" | "video" | "audio" | "thumbnail";
  provider?: string;
  storageBucket?: string;
  storagePath?: string;
  publicUrl?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  expiresAt?: string;
  mimeType?: string;
  duration?: string;
  generationPrompt?: string;
  generationSettings?: Record<string, any>;
  status: "completed" | "failed" | "pending";
  createdAt?: string;
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

export type ResearchPatternType =
  | "Hook"
  | "Story Structure"
  | "Visual Style"
  | "Thumbnail Pattern"
  | "Opening Pattern"
  | "Retention Pattern"
  | "Posting Cadence"
  | "CTA Pattern"
  | "Editing Pattern"
  | "Audio Pattern"
  | "Topic Cluster"
  | "Comment Trigger"
  | "Series Format"
  | "Emotion Pattern";

export interface VideoInsightSummary {
  id: string;
  sourceId: string;
  title: string;
  durationSec?: number;
  transcriptSnippet?: string;
  keyframeLabels?: string[];
  pacingScore?: number;
  createdAt: string;
}

export interface ResearchObservation {
  id: string;
  sourceId: string;
  platformPostId?: string;
  contentTitle?: string;
  contentUrl?: string;
  videoLengthSec?: number;
  hookText?: string;
  publishedAt?: string;
  metrics?: Record<string, any>;
  createdAt: string;
}

export interface SparkScoreBreakdown {
  totalScore: number;
  subScores: {
    hookStrength?: number;
    postingCadence?: number;
    topicConsistency?: number;
    audienceMatch?: number;
    engagementRatio?: number;
  };
  explanation: string[];
}

export interface RecentVideo {
  id: string;
  videoId?: string;
  title: string;
  url?: string;
  thumbnail?: string;
  publishedAt?: string;
  durationSec?: number;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  description?: string;
  tags?: string[];
  sparkScore?: number | null;
  sparkScoreBreakdown?: SparkScoreBreakdown;
  observations?: string[];
  observationsCategorized?: {
    hook?: string;
    format?: string;
    story?: string;
    thumbnail?: string;
    cta?: string;
    editing?: string;
  };
  hookText?: string;
  pacingText?: string;
  topicText?: string;
  whySelected?: string;
}

export interface CuratedContentItem {
  id: string;
  title: string;
  sparkScore: number | null;
  sparkScoreBreakdown?: SparkScoreBreakdown;
  reason: string;
  why: string[];
  url?: string;
  views?: string | null;
}

export interface PatternBreakdownScores {
  hooks: number;
  storytelling: number;
  editing: number;
  retention: number;
  postingConsistency: number;
}

export interface ConversationSession {
  id: string;
  workspaceId?: string;
  brandId: string;
  userId?: string;
  title: string;
  subtitle?: string;
  category?: "executive" | "research" | "production" | "general";
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchSource {
  id: string;
  platform: "youtube" | "tiktok" | "instagram" | "x" | "facebook" | "linkedin";
  platformAccountId?: string;
  url: string;
  username: string;
  displayName: string;
  avatar?: string;
  banner?: string;
  followers?: number | null;
  videoCount?: number | null;
  totalViews?: number | null;
  metricsAvailability: "available" | "unavailable" | "restricted";
  verified?: boolean;
  description?: string;
  topics?: string[];
  language?: string;
  country?: string;
  creationDate?: string;
  lastSyncedAt?: string;
  status: "active" | "syncing" | "error" | "unavailable";
  videoInsights?: VideoInsightSummary[];
  observations?: ResearchObservation[];
  recentVideos?: RecentVideo[];
  topContent?: CuratedContentItem[];
  patternBreakdown?: PatternBreakdownScores;
  learnings?: string[];
  researchConfidence?: number | null; // 0.0 - 1.0, null if not enough data
  sourceType?: "channel" | "video";
  videoResearch?: VideoResearch;
  createdAt: string;
  updatedAt?: string;
}

export interface VideoResearch {
  videoId: string;
  platform: string;
  title: string;
  url: string;
  thumbnail?: string;
  durationSec?: number;
  creatorHandle?: string;
  creatorName?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  publishedAt?: string;
  transcript?: string;
  metadata?: Record<string, any>;
  hookAnalysis: string;
  retentionAnalysis: string;
  pacingAnalysis: string;
  editingStyle: string;
  storytelling: string;
  visualStyle: string;
  emotionalPattern: string;
  thumbnailLanguage: string;
  CTAAnalysis: string;
  audienceSignals: string[];
  viralReasons: string[];
  strengths: string[];
  weaknesses: string[];
  sparkScore: number;
  confidence: number;
}

/** Future Video Understanding Architecture Interface */
export interface VideoAnalysisRequest {
  videoId: string;
  sourceUrl: string;
  transcriptRequested?: boolean;
  keyframesRequested?: boolean;
  semanticRequested?: boolean;
}

export interface VideoAnalysisResult {
  videoId: string;
  transcriptSnippet?: string;
  keyframeLabels?: string[];
  semanticSummary?: string;
  analyzedAt?: string;
  status: "pending" | "completed" | "unsupported";
}

export interface VideoAnalysisProvider {
  analyzeVideo(request: VideoAnalysisRequest): Promise<VideoAnalysisResult>;
}

export interface ResearchPattern {
  id: string;
  sourceId: string;
  patternType: ResearchPatternType;
  confidence: number; // 0.0 - 1.0
  originWeight: number; // 0.0 - 1.0
  title: string;
  description: string;
  evidence: string;
  metrics?: Record<string, any>;
  createdAt: string;
  fingerprint?: string;
  firstSeenAt?: string;
  lastSeenAt?: string;
  lastSyncedAt?: string;
  syncCount?: number;
}

/** Phase 19A: Dynamic AI Model Routing & Orchestration Types */
export type AICapabilityType =
  | "Chat"
  | "Vision"
  | "Video Understanding"
  | "Reasoning"
  | "Tool Calling"
  | "Image Generation"
  | "Video Generation"
  | "Speech"
  | "Text To Speech"
  | "Embeddings"
  | "Transcription";

export type AIProviderId =
  | "auto"
  | "openai"
  | "gemini"
  | "claude"
  | "grok"
  | "elevenlabs"
  | "higgsfield"
  | "kling"
  | "luma"
  | "runway";

export type AIRoutingCategory =
  | "superSpark"
  | "research"
  | "videoUnderstanding"
  | "production"
  | "automation"
  | "executive"
  | "analytics"
  | "publishing"
  | "scheduling"
  | "memory"
  | "review"
  | "storyboardImages"
  | "videoGeneration"
  | "voice";

export type AIModelRoutingConfig = Record<AIRoutingCategory, AIProviderId>;
export type AIModelSelectionConfig = Partial<Record<AIRoutingCategory, string>>;

export interface AISettings {
  routing: AIModelRoutingConfig;
  models?: AIModelSelectionConfig;
  customApiKeys?: Record<string, string>;
  customBaseUrls?: Record<string, string>;
}

export interface GenerationCreditSettings {
  thumbnailCount: number;       // default 3, min 1, max 3
  keyframeCount: number;        // default 3, min 1, max 6
  shortsDurationSec: number;    // default 8, allowed [5, 8, 10, 15]
  cinematicDurationSec: number; // default 12, allowed [8, 12, 15, 20]
  maxVideoClips?: number;       // default = keyframeCount
}

export const DEFAULT_CREDIT_SETTINGS: GenerationCreditSettings = {
  thumbnailCount: 3,
  keyframeCount: 3,
  shortsDurationSec: 8,
  cinematicDurationSec: 12,
  maxVideoClips: 3,
};

export type AspectMode = "landscape" | "portrait" | "dynamic";

export interface ProductionFormatSettings {
  aspectMode: AspectMode;
  targetDurationSec: number; // 15, 30, 60 (1m), 180 (3m), 300 (5m), 600 (10m), 900 (15m), 1200 (20m), 1800 (30m), 2700 (45m), 3600 (60m)
  preferredVideoProvider?: AIProviderId;
  preferredVideoModel?: string;
}

export const DEFAULT_FORMAT_SETTINGS: ProductionFormatSettings = {
  aspectMode: "portrait",
  targetDurationSec: 60,
  preferredVideoProvider: "auto",
};

export function getEffectiveFormatSettings(source?: any): ProductionFormatSettings {
  if (!source) return { ...DEFAULT_FORMAT_SETTINGS };
  const direct = source?.formatSettings || (typeof source?.targetDurationSec === "number" ? source : undefined);
  const brandSettings = source?.brand?.formatSettings;
  return {
    ...DEFAULT_FORMAT_SETTINGS,
    ...(brandSettings || {}),
    ...(direct || {}),
  };
}

export function getEffectiveCreditSettings(source?: any): GenerationCreditSettings {
  if (!source) return { ...DEFAULT_CREDIT_SETTINGS };
  const direct = source?.creditSettings || (typeof source?.maxVideoClips === "number" ? source : undefined);
  const brandSettings = source?.brand?.creditSettings;
  return {
    ...DEFAULT_CREDIT_SETTINGS,
    ...(brandSettings || {}),
    ...(direct || {}),
  };
}

export interface ThinkingState {
  step: string;
  timestamp: string;
  provider?: string;
  model?: string;
}


