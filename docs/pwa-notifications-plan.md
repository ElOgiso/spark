# Spark — PWA & Push Notification Architecture Plan

This document outlines the strategic roadmap and future integration plan for the native-parity mobile experience, offline synchronization, and multi-platform push notification systems for the **Spark Media Operating System**.

---

## 1. Executive Summary
To transform Spark from a web-based experience into a mission-critical, enterprise-grade **Media Operating System**, we implement native PWA (Progressive Web App) architecture with offline capabilities and a unified Notification Hub. 

This phase delivers:
1. **Installed PWA State**: Full mobile and desktop standalone app configuration.
2. **Offline Resilience**: Immediate load times via the App Shell and safe offline transaction queuing.
3. **Multi-Channel Notification Core**: Unified delivery pipeline across in-app hub, desktop browser, Android, and iOS devices.

---

## 2. PWA & Native Standalone Architecture
By implementing a standard `manifest.webmanifest` and Service Worker (`sw.js`), Spark achieves parity with traditional mobile and desktop app environments.

### Device Specific Configurations:
* **iOS Safari Integration**: 
  * Apple devices do not support standard `beforeinstallprompt` events.
  * We provide an elegant iOS-specific manual installation sheet detailing the standard flow: `Share` → `Add to Home Screen`.
  * Status-bar configuration set to `black-translucent` to leverage the notched display layout.
* **Android Standalone Mode**:
  * Utilizes standard chrome prompt, triggered by custom premium action cards.
  * Orientation is locked to `portrait-primary` for mobile setups.
* **Desktop Standalone Mode**:
  * App is installable via a subtle install banner in the "More" page or utility bar.

---

## 3. Offline App Shell & Transaction Queue
When connection drops, Spark prevents blank page crashes by immediately switching into Offline Mode.

```
+------------------------------------------------------------+
|                       Spark Client                         |
+------------------------------------------------------------+
       |                                              |
       v (Online)                                     v (Offline)
+---------------+                              +---------------------+
|  Live Network |                              | Cache Storage (SW)  |
+---------------+                              +---------------------+
                                                      |
                                                      v
                                               +---------------------+
                                               | Action Queue        |
                                               | (Local Storage)     |
                                               +---------------------+
```

### Strategic Offline Capabilities:
* **Offline Navigation**: The service worker intercepts `navigate` events and returns the cached `index.html` app shell, enabling the React Router / State Switcher to operate flawlessly offline.
* **Stale-While-Revalidate**: Static files and compiled JS bundles are cached immediately and revalidated in the background.
* **Offline Action Queue**:
  * Write transactions (e.g., approving storyboards, changing scheduling slots, creating opportunity drafts) are intercepted.
  * Instead of failing, they are stored inside a local offline transaction queue.
  * An inline, calm indicator banner notifies the user of the queue status.
  * When connection is re-established, the queue auto-synchronizes with the database, and a completion alert is shown.

---

## 4. Multi-Platform Push Notification Architecture
Future backend-driven push notifications will utilize the standard Web Push protocol, eliminating costly third-party client wrapper SDKs.

### Push Delivery Channels:
1. **Installed iOS App (iOS 16.4+)**:
  * Standalone PWAs added to the iOS home screen have full access to native Apple Push Notification service (APNs).
  * Requesting permissions must be initiated by direct user gesture inside standalone mode.
2. **Android Browser & App**:
  * Standard Firebase Cloud Messaging (FCM) or custom Web Push endpoint registration via the active service worker.
3. **Desktop Browser Push**:
  * Native browser popup alerts using VAPID keys.

### Core Architecture Components:
* **VAPID Key Pair**:
  * `Public Key`: Shared with the client to authenticate subscription requests.
  * `Private Key`: Secured on the server to sign push messages.
* **Service Worker Background Listener**:
  ```javascript
  self.addEventListener('push', function(event) {
    const payload = event.data ? event.data.json() : { title: 'Update', body: 'New opportunity' };
    event.waitUntil(
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/icons/icon.svg',
        badge: '/icons/icon.svg',
        data: { url: payload.relatedRoute }
      })
    );
  });
  ```

---

## 5. Notification Preferences & Quiet Hours
To maintain an elegant, high-retention user experience, Spark integrates granular notification controls.

### Preference Controls (Stored Locally / Synced to Account Profile):
* **Operational Reminders**: Awaiting reviews, production drafts completed.
* **Critical Alerts**: Channel authorization expired, publishing failures.
* **Insights**: Analytics insights, automated brand rule violations.
* **Quiet Hours**:
  * Configurable timezone-aware blackout hours (e.g., 10:00 PM to 7:00 AM).
  * During quiet hours, high-priority notifications are delivered silently to the inbox, and native popups are strictly suppressed, except for *critical* publishing alerts.
