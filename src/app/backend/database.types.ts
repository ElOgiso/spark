export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AutomationMode = "manual" | "balanced" | "autonomous";
export type ProductionMode = "narrator" | "hybrid" | "cinematic";

/** Frozen memory taxonomy */
export enum MemoryCategory {
  IDENTITY = "IDENTITY",
  BUSINESS = "BUSINESS",
  GOALS = "GOALS",
  PREFERENCES = "PREFERENCES",
  CREATIVE_STYLE = "CREATIVE_STYLE",
  VOICE = "VOICE",
  CHARACTER = "CHARACTER",
  RELATIONSHIP = "RELATIONSHIP",
  WORKFLOW = "WORKFLOW",
  TOOLS = "TOOLS",
  LEARNING = "LEARNING",
  DECISIONS = "DECISIONS",
  IMPORTANT_FACT = "IMPORTANT_FACT",
  EXECUTIVE_NOTE = "EXECUTIVE_NOTE",
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
  role: string | null;
  avatar_url: string | null;
  /** Present on legacy SPARK profiles table */
  email?: string | null;
  full_name?: string | null;
  username?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandRow {
  id: string;
  owner_id: string;
  name: string;
  niche: string | null;
  archetype: string | null;
  purpose: string | null;
  audience: Json;
  tone: Json;
  content_pillars: Json;
  automation_mode: AutomationMode;
  review_required: boolean;
  publish_requires_approval: boolean;
  autonomous_publishing_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CharacterRow {
  id: string;
  brand_id: string;
  name: string;
  role: string | null;
  appearance: Json;
  personality: Json;
  voice: Json;
  consistency_rules: Json;
  generation_rules: Json;
  created_at: string;
  updated_at: string;
}

export interface BrandRuleRow {
  id: string;
  brand_id: string;
  category: string | null;
  rule: string;
  reason: string | null;
  confidence: string | null;
  source: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemoryItemRow {
  id: string;
  brand_id: string;
  category: MemoryCategory;
  title: string;
  description: string | null;
  source: string | null;
  confidence: string | null;
  evidence: Json;
  affected_systems: Json;
  archived: boolean;
  created_at: string;
  updated_at: string;
  /** Additional fields */
  importance?: string; // LOW, MEDIUM, HIGH, CRITICAL
  confirmed?: boolean;
}

export interface AccountRow {
  id: string;
  brand_id: string;
  platform: string;
  handle: string | null;
  display_name: string | null;
  status: string | null;
  permissions: Json;
  connected_at: string | null;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViralSparkRow {
  id: string;
  brand_id: string;
  title: string;
  opportunity: string | null;
  why_now: string | null;
  audience_fit: string | null;
  brand_fit: string | null;
  hook_potential: string | null;
  confidence: string | null;
  risk: string | null;
  expected_outcome: string | null;
  evidence: Json;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionRow {
  id: string;
  brand_id: string;
  viral_spark_id: string | null;
  title: string;
  production_mode: ProductionMode;
  status: string | null;
  brief: Json;
  assets: Json;
  reasoning: Json;
  created_at: string;
  updated_at: string;
}

export interface ReviewItemRow {
  id: string;
  brand_id: string;
  production_id: string;
  status: string | null;
  decision: string | null;
  quality_score: number | null;
  confidence: string | null;
  risk: string | null;
  notes: string | null;
  reasoning: Json;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublishJobRow {
  id: string;
  brand_id: string;
  production_id: string;
  account_id: string | null;
  platform: string | null;
  scheduled_for: string | null;
  status: string * null;
  caption: string | null;
  metadata: Json;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsSnapshotRow {
  id: string;
  brand_id: string;
  production_id: string | null;
  platform: string | null;
  metrics: Json;
  insight: string | null;
  recommendation: string * null;
  learned_memory_id: string | null;
  captured_at: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  brand_id: string;
  user_id: string;
  type: string | null;
  title: string;
  description: string | null;
  priority: string | null;
  read: boolean;
  related_route: string | null;
  action_label: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferenceRow {
  id: string;
  user_id: string;
  review_reminders: boolean;
  production_updates: boolean;
  publishing_alerts: boolean;
  viral_opportunities: boolean;
  analytics_insights: boolean;
  memory_updates: boolean;
  system_updates: boolean;
  marketing_updates: boolean;
  quiet_hours: Json;
  push_enabled: boolean;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  brand_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessageRow {
  id: string;
  brand_id: string;
  sender: "user" | "spark";
  text: string;
  metadata: Json;
  created_at: string;
}

export interface ExecutiveConversationMessageRow {
  id: string;
  brand_id: string;
  session_id: string;
  sender: "user" | "director";
  text: string;
  metadata: Json;
  provider?: string; // e.g., "openai"
  model?: string; // model name
  token_count?: number;
  api_version?: string;
  created_at: string;
}

export interface ExecutiveSessionRow {
  id: string;
  brand_id: string;
  active_production_id: string | null;
  active_scene: number | null;
  active_department: string | null;
  last_screen: string;
  last_summary: string | null;
  last_activity: string | null;
  conversation_checkpoint: string | null;
  working_memory_snapshot: Json | null;
  updated_at: string;
}

export interface ExecutiveDirectorSummaryRow {
  id: string;
  brand_id: string;
  brand_summary: string | null;
  mission: string | null;
  goals: Json;
  audience: string | null;
  voice_archetype: string | null;
  character_name: string | null;
  publishing_platforms: Json;
  automation_mode: string | null;
  current_objectives: Json;
  pending_tasks: Json;
  updated_at: string;
}

export interface ExecutiveTimelineRow {
  id: string;
  brand_id: string;
  session_id: string;
  type: string; // e.g., ONBOARDING_COMPLETE, PRODUCTION_CREATED
  description: string | null;
  created_at: string;
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      brands: Table<BrandRow>;
      characters: Table<CharacterRow>;
      brand_rules: Table<BrandRuleRow>;
      memory_items: Table<MemoryItemRow>;
      accounts: Table<AccountRow>;
      viral_sparks: Table<ViralSparkRow>;
      productions: Table<ProductionRow>;
      review_items: Table<ReviewItemRow>;
      publish_jobs: Table<PublishJobRow>;
      analytics_snapshots: Table<AnalyticsSnapshotRow>;
      notifications: Table<NotificationRow>;
      notification_preferences: Table<NotificationPreferenceRow>;
      audit_logs: Table<AuditLogRow>;
      conversation_messages: Table<ConversationMessageRow>;
      executive_conversation_messages: Table<ExecutiveConversationMessageRow>;
      executive_sessions: Table<ExecutiveSessionRow>;
      executive_director_summaries: Table<ExecutiveDirectorSummaryRow>;
      executive_timeline: Table<ExecutiveTimelineRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
