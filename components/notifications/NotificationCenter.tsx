"use client";

import * as React from "react";
import { useState, useCallback, forwardRef } from "react";
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
  Check,
  CheckCheck,
  Euro,
  FileText,
  Wrench,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Clock,
  Trash2,
  Settings,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useNotifications, type Notification } from "@/lib/hooks/use-notifications";

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

// Couleur selon le type
const getNotificationColor = (type: Notification["type"]) => {
  switch (type) {
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

// Composant Item de notification avec forwardRef pour AnimatePresence
const NotificationItem = forwardRef<
  HTMLDivElement,
  {
    notification: Notification;
    onMarkAsRead: (id: string) => void;
    onDelete: (id: string) => void;
  }
>(({ notification, onMarkAsRead, onDelete }, ref) => {
  const Icon = getNotificationIcon(notification.type);
  const colorClass = getNotificationColor(notification.type);
  const timeAgo = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: fr,
  });

  const content = (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className={cn(
        "group relative flex gap-3 p-3 rounded-lg transition-colors",
        notification.read
          ? "bg-transparent hover:bg-slate-50"
          : "bg-blue-50/50 hover:bg-blue-50"
      )}
    >
      {/* Indicateur non lu */}
      {!notification.read && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
      )}

      {/* Icône */}
      <div className={cn("p-2 rounded-lg shrink-0", colorClass)}>
        <Icon className="h-4 w-4" />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", notification.read ? "text-slate-700" : "text-slate-900")}>
          {notification.title}
        </p>
        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.read && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMarkAsRead(notification.id);
            }}
            title="Marquer comme lu"
            aria-label="Marquer comme lu"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-400 hover:text-red-500"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(notification.id);
          }}
          title="Supprimer"
          aria-label="Supprimer la notification"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );

  if (notification.link) {
    return <Link href={notification.link}>{content}</Link>;
  }

  return content;
});

NotificationItem.displayName = "NotificationItem";

// Composant principal
export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Utiliser le hook temps réel
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    refresh,
  } = useNotifications({
    enableSound: true,
    showToast: true,
    limit: 50,
  });

  // Refresh manuel
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  }, [refresh]);

  // Marquer comme lu
  const handleMarkAsRead = useCallback((id: string) => {
    markAsRead(id);
  }, [markAsRead]);

  // Marquer tout comme lu
  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  // Supprimer
  const handleDelete = useCallback((id: string) => {
    deleteNotification(id);
  }, [deleteNotification]);

  // Supprimer tout
  const handleDeleteAll = useCallback(() => {
    deleteAllNotifications();
  }, [deleteAllNotifications]);

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
        className="w-96 p-0 shadow-xl"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
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
                className="text-xs text-slate-500 h-7"
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
              <Link href="/owner/settings/notifications">
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
              <p className="text-sm text-slate-600 font-medium">Erreur de chargement</p>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
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
              <div className="p-4 rounded-full bg-slate-100 mb-3">
                <Bell className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm text-slate-600 font-medium">Aucune notification</p>
              <p className="text-xs text-slate-400 mt-1">
                Vous êtes à jour !
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              <AnimatePresence mode="popLayout">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={handleMarkAsRead}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-3 border-t bg-slate-50/50">
            <div className="flex items-center justify-between">
              <Button
                variant="link"
                size="sm"
                className="text-xs text-slate-500 h-auto p-0"
                asChild
              >
                <Link href="/owner/notifications">
                  Voir toutes les notifications
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteAll}
                className="text-xs text-red-500 hover:text-red-600 h-7"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Tout effacer
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

