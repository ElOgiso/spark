export type NotificationType =
  | "review_required"
  | "production_generated"
  | "production_approved"
  | "production_scheduled"
  | "publishing_failed"
  | "publishing_complete"
  | "memory_updated"
  | "brand_rule_conflict"
  | "new_viral_opportunity"
  | "analytics_recommendation"
  | "system_update";

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: string; // ISO string or human-readable (e.g., "5m ago")
  priority: NotificationPriority;
  read: boolean;
  relatedRoute: string; // e.g., "/review", "/calendar", "/analytics"
  actionLabel?: string;
  metadata?: any;
}

export interface NotificationPreferences {
  reviewReminders: boolean;
  productionUpdates: boolean;
  publishingAlerts: boolean;
  viralOpportunities: boolean;
  analyticsInsights: boolean;
  memoryUpdates: boolean;
  systemUpdates: boolean;
  marketingUpdates: boolean;
  quietHours: boolean;
  pushNotificationsFuture: boolean;
  emailNotificationsFuture: boolean;
}
