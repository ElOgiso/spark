import { AppNotification, NotificationType, NotificationPriority } from "./notificationTypes";

const LOCAL_STORAGE_KEY = "spark_notifications_store";

// Initial set of seed notifications for executive presentation
const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    type: "new_viral_opportunity",
    title: "New Viral Spark opportunity",
    description: "Nigerian Creator Economy + AI topic matches your Brand Voice with 97% confidence.",
    timestamp: "5m ago",
    priority: "high",
    read: false,
    relatedRoute: "/viral-sparks",
    actionLabel: "Analyze Spark"
  },
  {
    id: "n2",
    type: "review_required",
    title: "Review Awaiting Executive Sign-Off",
    description: "Storyboard 'Psychology of Viral Content' is complete and awaiting your structural review.",
    timestamp: "12m ago",
    priority: "critical",
    read: false,
    relatedRoute: "/review",
    actionLabel: "Begin Review"
  },
  {
    id: "n3",
    type: "publishing_complete",
    title: "Weekly Tech Round-Up published",
    description: "Successfully released to connected YouTube and LinkedIn channels. Initial retention: +14% above baseline.",
    timestamp: "1h ago",
    priority: "medium",
    read: false,
    relatedRoute: "/calendar",
    actionLabel: "View Performance"
  },
  {
    id: "n4",
    type: "memory_updated",
    title: "Strategic Rule Learned",
    description: "Spark identified that placements of CTAs before the final 10 seconds increase subscriber conversion by 44%. Added to active guidelines.",
    timestamp: "2h ago",
    priority: "low",
    read: true,
    relatedRoute: "/my-spark",
    actionLabel: "Inspect Memory"
  },
  {
    id: "n5",
    type: "publishing_failed",
    title: "Instagram Reel schedule blocked",
    description: "Authorization expired for connected Instagram creator channel. Re-auth required before 2:00 PM publication.",
    timestamp: "4h ago",
    priority: "critical",
    read: false,
    relatedRoute: "/calendar",
    actionLabel: "Resolve Conflict"
  }
];

export class NotificationService {
  private static listeners: Array<(notifications: AppNotification[]) => void> = [];

  public static getNotifications(): AppNotification[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Error reading notifications", e);
    }
    // Seed initial notifications if empty
    this.saveNotifications(INITIAL_NOTIFICATIONS);
    return INITIAL_NOTIFICATIONS;
  }

  public static addNotification(
    type: NotificationType,
    title: string,
    description: string,
    priority: NotificationPriority,
    relatedRoute: string,
    actionLabel?: string,
    metadata?: any
  ): AppNotification {
    const notifications = this.getNotifications();
    const newNotif: AppNotification = {
      id: "notif_" + Date.now(),
      type,
      title,
      description,
      timestamp: "Just now",
      priority,
      read: false,
      relatedRoute,
      actionLabel,
      metadata
    };
    
    const updated = [newNotif, ...notifications];
    this.saveNotifications(updated);
    this.notifyListeners(updated);
    return newNotif;
  }

  public static markAsRead(id: string): void {
    const notifications = this.getNotifications();
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    this.saveNotifications(updated);
    this.notifyListeners(updated);
  }

  public static markAllAsRead(): void {
    const notifications = this.getNotifications();
    const updated = notifications.map((n) => ({ ...n, read: true }));
    this.saveNotifications(updated);
    this.notifyListeners(updated);
  }

  public static deleteNotification(id: string): void {
    const notifications = this.getNotifications();
    const updated = notifications.filter((n) => n.id !== id);
    this.saveNotifications(updated);
    this.notifyListeners(updated);
  }

  public static clearAll(): void {
    this.saveNotifications([]);
    this.notifyListeners([]);
  }

  public static subscribe(callback: (notifications: AppNotification[]) => void): () => void {
    this.listeners.push(callback);
    // Initial emission
    callback(this.getNotifications());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private static saveNotifications(notifications: AppNotification[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notifications));
    } catch (e) {
      console.error("Failed to save notifications", e);
    }
  }

  private static notifyListeners(notifications: AppNotification[]): void {
    this.listeners.forEach((listener) => {
      try {
        listener(notifications);
      } catch (e) {
        console.error("Error in notification listener", e);
      }
    });
  }
}
