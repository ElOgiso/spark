import { useState, useEffect, useRef } from "react";
import { NotificationService } from "../notifications/notificationService";
import { AppNotification } from "../notifications/notificationTypes";
import {
  Bell, CheckCircle2, AlertCircle, TrendingUp, Sparkles,
  Shield, Info, Trash2, Clock, X, HelpCircle
} from "lucide-react";

interface NotificationCenterProps {
  onNavigate: (path: string) => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

export function NotificationCenter({ onNavigate, isMobile = false, onCloseMobile }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subscribe to notification updates
    const unsubscribe = NotificationService.subscribe((updated) => {
      setNotifications(updated);
    });

    return () => unsubscribe();
  }, []);

  // Handle outside clicks to close the dropdown on desktop
  useEffect(() => {
    if (isMobile) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobile]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (notification: AppNotification) => {
    NotificationService.markAsRead(notification.id);
    onNavigate(notification.relatedRoute);
    setIsOpen(false);
    if (onCloseMobile) onCloseMobile();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "review_required":
        return <AlertCircle className="w-4 h-4 text-warning flex-shrink-0" />;
      case "publishing_failed":
        return <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />;
      case "publishing_complete":
        return <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />;
      case "new_viral_opportunity":
        return <TrendingUp className="w-4 h-4 text-accent-foreground flex-shrink-0" />;
      case "memory_updated":
        return <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />;
      case "brand_rule_conflict":
        return <Shield className="w-4 h-4 text-warning flex-shrink-0" />;
      case "system_update":
        return <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />;
      default:
        return <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return "bg-destructive/15 text-destructive border-destructive/20";
      case "high":
        return "bg-warning/15 text-warning border-warning/20";
      case "medium":
        return "bg-accent/15 text-accent-foreground border-accent/20";
      default:
        return "bg-muted/15 text-muted-foreground border-border/20";
    }
  };

  const content = (
    <div className={`flex flex-col h-full ${isMobile ? "bg-background" : "bg-card border border-border rounded-xl shadow-2xl w-96 max-h-[500px]"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full font-bold">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => NotificationService.markAllAsRead()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Mark all read
          </button>
          <button
            onClick={() => NotificationService.clearAll()}
            className="text-xs text-destructive hover:text-destructive/80 transition-colors flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
          {isMobile && onCloseMobile && (
            <button onClick={onCloseMobile} className="p-1 rounded-lg hover:bg-accent/20">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-none divide-y divide-border/50 max-h-[400px]">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Bell className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1">No new notifications right now.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`p-4 transition-all hover:bg-accent/5 cursor-pointer relative flex items-start gap-3.5 ${
                !notification.read ? "bg-accent/5 border-l-2 border-l-accent-foreground" : "bg-transparent"
              }`}
            >
              {getIcon(notification.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold leading-relaxed text-foreground truncate">
                    {notification.title}
                  </span>
                  <span className={`text-[9px] uppercase tracking-wider font-semibold border px-1.5 py-0.2 rounded-full flex-shrink-0 ${getPriorityBadge(notification.priority)}`}>
                    {notification.priority}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {notification.description}
                </p>
                <div className="flex items-center justify-between mt-2.5">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {notification.timestamp}
                  </span>
                  {notification.actionLabel && (
                    <span className="text-[10px] text-accent-foreground font-semibold hover:underline">
                      {notification.actionLabel} →
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  NotificationService.deleteNotification(notification.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-accent/20 text-muted-foreground hover:text-destructive absolute top-3 right-3 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return content;
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        id="desktop-bell-button"
        className="relative p-2 rounded-lg hover:bg-accent/20 transition-colors"
      >
        <Bell className="w-5 h-5 text-foreground hover:text-accent-foreground transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-destructive border border-background rounded-full animate-pulse" />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 overflow-hidden">
          {content}
        </div>
      )}
    </div>
  );
}
