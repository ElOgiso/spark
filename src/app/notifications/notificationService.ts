import { AppNotification, NotificationType, NotificationPriority } from "./notificationTypes";

const STORAGE_KEY = "spark_notifications_store";

type Listener = (notifications: AppNotification[]) => void;

class NotificationServiceManager {
  private listeners: Listener[] = [];
  private notifications: AppNotification[] = [];

  constructor() {
    this.load();
  }

  private load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.notifications = JSON.parse(stored);
      } else {
        this.notifications = this.getDefaultNotifications();
        this.save();
      }
    } catch {
      this.notifications = this.getDefaultNotifications();
    }
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications));
    } catch {
      // Ignore storage errors
    }
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.notifications]));
  }

  private getDefaultNotifications(): AppNotification[] {
    return [
      {
        id: "notif-1",
        type: "new_viral_opportunity",
        title: "New Viral Opportunity Discovered",
        description: "AI Tech Startups in West Africa is trending (+40% velocity).",
        timestamp: "10m ago",
        priority: "high",
        read: false,
        relatedRoute: "/viral-sparks",
        actionLabel: "View Opportunity",
      },
      {
        id: "notif-2",
        type: "review_required",
        title: "Production Ready for Review",
        description: "Top 5 AI Tools Nigerian Founders Use Daily is ready for executive sign-off.",
        timestamp: "1h ago",
        priority: "high",
        read: false,
        relatedRoute: "/review",
        actionLabel: "Review Script",
      },
    ];
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    listener([...this.notifications]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getNotifications(): AppNotification[] {
    return [...this.notifications];
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.read).length;
  }

  public addNotification(
    typeOrPayload: NotificationType | Partial<AppNotification>,
    title?: string,
    description?: string,
    priority: NotificationPriority = "medium",
    relatedRoute: string = "/",
    actionLabel?: string
  ) {
    let newNotif: AppNotification;
    if (typeof typeOrPayload === "object") {
      newNotif = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: typeOrPayload.type || "system_update",
        title: typeOrPayload.title || "Notification",
        description: typeOrPayload.description || "",
        timestamp: typeOrPayload.timestamp || "Just now",
        priority: typeOrPayload.priority || "medium",
        read: false,
        relatedRoute: typeOrPayload.relatedRoute || "/",
        actionLabel: typeOrPayload.actionLabel,
        metadata: typeOrPayload.metadata,
      };
    } else {
      newNotif = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        type: typeOrPayload,
        title: title || "Notification",
        description: description || "",
        timestamp: "Just now",
        priority,
        read: false,
        relatedRoute,
        actionLabel,
      };
    }
    this.notifications.unshift(newNotif);
    this.save();
    return newNotif;
  }

  public markAsRead(id: string) {
    this.notifications = this.notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    this.save();
  }

  public markAllAsRead() {
    this.notifications = this.notifications.map((n) => ({ ...n, read: true }));
    this.save();
  }

  public deleteNotification(id: string) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.save();
  }

  public clearAll() {
    this.notifications = [];
    this.save();
  }
}

export const NotificationService = new NotificationServiceManager();
