"use client";

import * as React from "react";
import { useState, useCallback, forwardRef, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  CheckCheck,
  Euro,
  FileText,
  Wrench,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Clock,
  Settings,
  RefreshCw,
  Loader2,
  Banknote,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useNotifications, type Notification } from "@/lib/hooks/use-notifications";

// Étendre le type Notification pour inclure les différents champs de lien
interface NotificationWithLinks extends Notification {
  action_url?: string | null;
  route?: string | null;
}

function resolveNotificationLink(n: NotificationWithLinks): string | null {
  return (
    n.action_url ||
    n.link ||
    n.link_url ||
    n.route ||
    null
  );
}

// Icône selon le type
const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "payment_received":
      return Euro;
    case "payment_late":
    case "payment_reminder":
      return AlertTriangle;
    case "lease_signed":
    case "lease_pending_signature":
    case "lease_expiring":
      return FileText;
    case "ticket_new":
    case "ticket_update":
    case "ticket_resolved":
      return Wrench;
    case "message_new":
      return MessageSquare;
    case "document_uploaded":
    case "document_signed":
      return FileText;
    case "reminder":
      return Calendar;
    case "alert":
      return AlertTriangle;
    case "system":
    default:
      return Bell;
  }
};

function getIconForType(type: string) {
  // Overrides pour les nouveaux types
  if (type === "cash_receipt_pending_tenant" || type === "cash_receipt_signed" || type === "cash_receipt_signature_requested") {
    return Banknote;
  }
  return getNotificationIcon(type as Notification["type"]);
}

// Couleur selon le type
const getNotificationColor = (type: string) => {
  switch (type) {
    case "cash_receipt_signature_requested":
    case "cash_receipt_pending_tenant":
      return "bg-[#2563EB]/10 text-[#2563EB]";
    case "cash_receipt_signed":
    case "payment_received":
      return "bg-emerald-100 text-emerald-600";
    case "payment_late":
    case "payment_reminder":
      return "bg-red-100 text-red-600";
    case "lease_signed":
      return "bg-blue-100 text-blue-600";
    case "lease_pending_signature":
      return "bg-amber-100 text-amber-600";
    case "lease_expiring":
      return "bg-orange-100 text-orange-600";
    case "ticket_new":
      return "bg-purple-100 text-purple-600";
    case "ticket_update":
      return "bg-indigo-100 text-indigo-600";
    case "ticket_resolved":
      return "bg-emerald-100 text-emerald-600";
    case "message_new":
      return "bg-blue-100 text-blue-600";
    case "document_uploaded":
    case "document_signed":
      return "bg-slate-100 text-slate-600";
    case "reminder":
      return "bg-amber-100 text-amber-600";
    case "alert":
      return "bg-red-100 text-red-600";
    case "system":
    default:
      return "bg-slate-100 text-slate-600";
  }
};

// Composant Item de notification — simple cliquable, sans bouton supprimer
const NotificationItem = forwardRef<
  HTMLDivElement,
  {
    notification: NotificationWithLinks;
    onNavigate: (n: NotificationWithLinks) => void;
  }
>(({ notification, onNavigate }, ref) => {
  const Icon = getIconForType(notification.type);
  const colorClass = getNotificationColor(notification.type);
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: fr,
  });
  const link = resolveNotificationLink(notification);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      onClick={() => onNavigate(notification)}
      role={link ? "link" : undefined}
      className={cn(
        "relative flex gap-3 p-3 rounded-lg transition-colors cursor-pointer",
        notification.read
          ? "bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50"
          : "bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/30"
      )}
    >
      {/* Indicateur non lu */}
      {!notification.read && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#2563EB]" />
      )}

      {/* Icône */}
      <div className={cn("p-2 rounded-lg shrink-0", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", notification.read ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-slate-50")}>
          {notification.title}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
          {notification.message || notification.body}
        </p>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </p>
      </div>
    </motion.div>
  );
});

NotificationItem.displayName = "NotificationItem";

// Composant principal
export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const markedOnOpenRef = useRef<string | null>(null);

  // Utiliser le hook temps réel
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAllAsRead,
    refresh,
  } = useNotifications({
    enableSound: true,
    showToast: true,
    limit: 50,
  });

  // ✅ Ouvrir la cloche = marquer TOUTES les notifications affichées comme lues
  useEffect(() => {
    if (!open) {
      markedOnOpenRef.current = null;
      return;
    }
    // Marquer au plus une fois par ouverture, et seulement s'il y a des non-lues
    const snapshot = notifications.filter((n) => !n.read).map((n) => n.id).sort().join(",");
    if (snapshot && snapshot !== markedOnOpenRef.current) {
      markedOnOpenRef.current = snapshot;
      void markAllAsRead();
    }
  }, [open, notifications, markAllAsRead]);

  // Refresh manuel
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  // Un clic simple = navigation vers action_url si présent
  const handleNavigate = useCallback(
    (n: NotificationWithLinks) => {
      const link = resolveNotificationLink(n);
      if (link) {
        setOpen(false);
        router.push(link);
      }
    },
    [router],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-96 p-0 shadow-xl bg-card"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Actualiser"
              aria-label="Actualiser les notifications"
            >
              {isRefreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs text-muted-foreground h-7"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Tout lire
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              asChild
              aria-label="Paramètres des notifications"
            >
              <Link href="/owner/profile">
                <Settings className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Liste des notifications */}
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="p-4 rounded-full bg-red-100 mb-3">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Erreur de chargement</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleRefresh}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Réessayer
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted mb-3">
                <Bell className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">Aucune notification</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Vous êtes à jour !
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              <AnimatePresence mode="popLayout">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification as NotificationWithLinks}
                    onNavigate={handleNavigate}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t bg-muted/30">
            <Button
              variant="link"
              size="sm"
              className="text-xs text-muted-foreground h-auto p-0"
              asChild
            >
              <Link href="/notifications" onClick={() => setOpen(false)}>
                Voir toutes les notifications
              </Link>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
