"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCheck, Home, FileText, AlertCircle, Building2, Camera, Rocket, Mail, UserPlus, ClipboardCheck, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string | null;
  body?: string | null;
  read?: boolean;
  is_read?: boolean;
  read_at?: string | null;
  created_at: string;
  action_url?: string | null;
  metadata?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
}

function isUnread(n: Notification): boolean {
  if (typeof n.is_read === "boolean") return !n.is_read;
  if (typeof n.read === "boolean") return !n.read;
  return !n.read_at;
}

function getText(n: Notification): string {
  return n.message || n.body || "";
}

function getMeta(n: Notification): Record<string, unknown> {
  return n.metadata || n.data || {};
}

const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  lease_invite: Home,
  payment: FileText,
  alert: AlertCircle,
  edl_invitation: ClipboardCheck,
  edl_scheduled: FileText,
  edl_meter_pending: AlertCircle,
  meter_reading_required: AlertCircle,
  meter_reading_reminder: Bell,
  meter_reading_submitted: Check,
  property_draft_created: Building2,
  property_step_completed: Check,
  property_photos_added: Camera,
  property_ready: Rocket,
  property_published: Rocket,
  property_invitation_sent: Mail,
  property_tenant_joined: UserPlus,
  cash_receipt_signature_requested: Banknote,
  cash_receipt_pending_tenant: Banknote,
  cash_receipt_signed: Banknote,
  default: Bell,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  lease_invite: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
  payment: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
  alert: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
  edl_invitation: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
  edl_scheduled: "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400",
  edl_meter_pending: "bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400",
  meter_reading_required: "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
  meter_reading_reminder: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400",
  meter_reading_submitted: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
  property_draft_created: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400",
  property_step_completed: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400",
  property_photos_added: "bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400",
  property_ready: "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400",
  property_published: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
  property_invitation_sent: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/50 dark:text-cyan-400",
  property_tenant_joined: "bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400",
  cash_receipt_signature_requested: "bg-[#2563EB]/10 text-[#2563EB] dark:bg-blue-900/50 dark:text-blue-400",
  cash_receipt_pending_tenant: "bg-[#2563EB]/10 text-[#2563EB] dark:bg-blue-900/50 dark:text-blue-400",
  cash_receipt_signed: "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400",
  default: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const markedOnOpenRef = useRef<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?limit=10");
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error("Erreur chargement notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true, read: true, read_at: new Date().toISOString() })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Erreur marquage notifications:", error);
    }
  }, []);

  // ✅ Ouverture de la cloche = marquer TOUTES les notifications affichées comme lues
  useEffect(() => {
    if (!open) {
      markedOnOpenRef.current = null;
      return;
    }
    const snapshot = notifications.filter(isUnread).map(n => n.id).sort().join(",");
    if (snapshot && snapshot !== markedOnOpenRef.current) {
      markedOnOpenRef.current = snapshot;
      void markAllAsRead();
    }
  }, [open, notifications, markAllAsRead]);

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id: notificationId }),
      });

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Erreur marquage notification:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString("fr-FR");
  };

  const getNotificationLink = (notification: Notification): string | null => {
    if (notification.action_url) return notification.action_url;

    const meta = getMeta(notification);

    switch (notification.type) {
      case "cash_receipt_signature_requested":
      case "cash_receipt_pending_tenant":
      case "cash_receipt_signed":
        if (meta.receipt_id) return `/tenant/payments/cash-receipt/${meta.receipt_id}`;
        return `/tenant/payments`;

      case "lease_invite":
        return `/tenant/dashboard`;

      case "edl_invitation":
        if (meta.token) return `/signature-edl/${meta.token}`;
        return `/tenant/dashboard`;

      case "meter_reading_required":
      case "meter_reading_reminder":
      case "edl_meter_pending":
        return `/tenant/meters`;

      case "meter_reading_submitted":
        if (meta.edl_id) return `/owner/inspections/${meta.edl_id}`;
        if (meta.property_id) return `/owner/properties/${meta.property_id}`;
        return `/owner/dashboard`;

      case "edl_scheduled":
        return `/tenant/documents`;

      case "property_draft_created":
      case "property_step_completed":
      case "property_photos_added":
        if (meta.property_id) return `/owner/properties/new?id=${meta.property_id}`;
        return `/owner/properties`;

      case "property_ready":
      case "property_published":
      case "property_invitation_sent":
      case "property_tenant_joined":
        if (meta.property_id) return `/owner/properties/${meta.property_id}`;
        return `/owner/properties`;

      default:
        return null;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500 hover:bg-red-500"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Tout lire
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground">
              Chargement...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Aucune notification
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.default;
                const colorClass = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.default;
                const link = getNotificationLink(notification);
                const unread = isUnread(notification);

                return (
                  <div
                    key={notification.id}
                    role={link ? "link" : undefined}
                    className={cn(
                      "p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer",
                      unread && "bg-blue-50/50 dark:bg-blue-950/20"
                    )}
                    onClick={() => {
                      // Marquer comme lu (fire-and-forget)
                      if (unread) {
                        void markAsRead(notification.id);
                      }
                      // Navigation vers l'action cible
                      if (link) {
                        setOpen(false);
                        router.push(link);
                      }
                    }}
                  >
                    <div className="flex gap-3">
                      <div className={cn("p-2 rounded-lg shrink-0", colorClass)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-sm line-clamp-1",
                            unread && "font-semibold"
                          )}>
                            {notification.title}
                          </p>
                          {unread && (
                            <span className="h-2 w-2 rounded-full bg-[#2563EB] shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {getText(notification)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              asChild
            >
              <Link href="/tenant/notifications">
                Voir toutes les notifications
              </Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
