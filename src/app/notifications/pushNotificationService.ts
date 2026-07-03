import { NotificationService } from "./notificationService";
import { NotificationType, NotificationPriority } from "./notificationTypes";

export class PushNotificationService {
  private static permissionStatus: NotificationPermission = "default";

  /**
   * Register the Service Worker for PWA
   */
  public static async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!("serviceWorker" in navigator)) {
      return null;
    }
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/"
      });
      console.log("[PWA] Service Worker registered with scope:", registration.scope);
      return registration;
    } catch (error) {
      console.error("[PWA] Service Worker registration failed:", error);
      return null;
    }
  }

  /**
   * Get current browser notification permission status
   */
  public static getPermissionStatus(): NotificationPermission {
    if (!("Notification" in window)) {
      return "denied";
    }
    return Notification.permission;
  }

  /**
   * Request user permission to receive push notifications
   * This is triggered purely by explicit user interactions.
   */
  public static async requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      return "denied";
    }
    try {
      const permission = await Notification.requestPermission();
      this.permissionStatus = permission;
      return permission;
    } catch (error) {
      console.error("Error requesting notification permission", error);
      return "default";
    }
  }

  /**
   * Subscribe to Web Push notifications (future capability placeholder)
   */
  public static async subscribe(userPreferences: any): Promise<{ endpoint: string } | null> {
    const status = this.getPermissionStatus();
    if (status !== "granted") {
      console.warn("Cannot subscribe: notification permission not granted.");
      return null;
    }

    console.log("[Push Notification] Simulating backend Web Push subscription registration...");
    // Return mock subscription details
    return {
      endpoint: "https://updates.spark-mos.io/push-gateway/sub_mock_" + Math.random().toString(36).substring(2, 10)
    };
  }

  /**
   * Unsubscribe from Web Push notifications
   */
  public static async unsubscribe(): Promise<boolean> {
    console.log("[Push Notification] Simulating push unsubscription...");
    return true;
  }

  /**
   * Trigger a native browser desktop notification locally.
   * This bridges the gap between simulated mock updates and real executive desktop feel.
   */
  public static sendLocalMockNotification(
    type: NotificationType,
    title: string,
    body: string,
    relatedRoute: string,
    priority: NotificationPriority = "medium"
  ): void {
    // 1. Log to the internal app notification center
    NotificationService.addNotification(type, title, body, priority, relatedRoute, "Review");

    // 2. Try to trigger native browser notification if granted
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const options: NotificationOptions = {
          body,
          icon: "/icons/icon.svg",
          badge: "/icons/icon.svg",
          tag: "spark-notification-tag",
          data: { relatedRoute }
        };

        const notification = new Notification(title, options);
        notification.onclick = () => {
          window.focus();
          // Custom navigation can hook here or dispatch a global event
          const event = new CustomEvent("spark-navigate", { detail: relatedRoute });
          window.dispatchEvent(event);
          notification.close();
        };
      } catch (err) {
        console.warn("Failed to trigger native desktop notification, service worker background fallback...", err);
        // Fallback using service worker if active
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: "/icons/icon.svg",
            data: { relatedRoute }
          });
        }).catch((regErr) => console.error("SW fallback failed too", regErr));
      }
    }
  }

  /**
   * Handles incoming web push events inside the Service Worker
   */
  public static handlePushEvent(event: any): void {
    console.log("[Service Worker] Push event received:", event);
  }
}
