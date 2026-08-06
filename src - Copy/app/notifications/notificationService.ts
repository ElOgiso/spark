import { AppNotification, NotificationType, NotificationPriority } from "./notificationTypes";

const LOCAL_STORAGE_KEY = "spark_notifications_store";

// Production: no fabricated executive notifications
const INITIAL_NOTIFICATIONS: AppNotification[] = [];

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
    return INITIAL_NOTIFICATIONS;
  }

  public static addNotification(
    typeOrObj: any,
    title?: string,
    description?: string,
    priority?: any,
    relatedRoute?: string,
    actionLabel?: string,
    metadata?: any
  ): AppNotification {
    let type: NotificationType;
    let finalTitle = title || "";
    let finalDescription = description || "";
    let finalPriority = priority || "medium";
    let finalRelatedRoute = relatedRoute || "/";
    let finalActionLabel = actionLabel;
    let finalMetadata = metadata;

    if (typeOrObj && typeof typeOrObj === "object") {
      type = typeOrObj.type;
      finalTitle = typeOrObj.title || "";
      finalDescription = typeOrObj.description || "";
      finalPriority = typeOrObj.priority || "medium";
      finalRelatedRoute = typeOrObj.relatedRoute || "/";
      finalActionLabel = typeOrObj.actionLabel;
      finalMetadata = typeOrObj.metadata;
    } else {
      type = typeOrObj;
    }

    const notifications = this.getNotifications();
    const newNotif: AppNotification = {
      id: "notif_" + Date.now(),
      type,
      title: finalTitle,
      description: finalDescription,
      timestamp: "Just now",
      priority: finalPriority,
      read: false,
      relatedRoute: finalRelatedRoute,
      actionLabel: finalActionLabel,
      metadata: finalMetadata
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
