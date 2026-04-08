"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  ArrowLeft,
  Trash2,
  Settings,
  FileText,
  Euro,
  Wrench,
  MessageSquare,
  Building2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  body?: string;
  created_at: string;
  is_read?: boolean;
  read_at?: string | null;
  action_url?: string;
  action_label?: string;
  route?: string;
  priority?: string;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  payment_received: { icon: Euro, color: "bg-green-100 text-green-700" },
  payment_due: { icon: Euro, color: "bg-amber-100 text-amber-700" },
  payment_late: { icon: AlertCircle, color: "bg-red-100 text-red-700" },
  "payment.received": { icon: Euro, color: "bg-green-100 text-green-700" },
  "payment.failed": { icon: AlertCircle, color: "bg-red-100 text-red-700" },
  "payment.overdue": { icon: AlertCircle, color: "bg-red-100 text-red-700" },
  lease_signed: { icon: FileText, color: "bg-blue-100 text-blue-700" },
  "lease.signed": { icon: FileText, color: "bg-blue-100 text-blue-700" },
  "lease.activated": { icon: FileText, color: "bg-blue-100 text-blue-700" },
  "lease.expiring_soon": { icon: AlertCircle, color: "bg-amber-100 text-amber-700" },
  ticket_created: { icon: Wrench, color: "bg-orange-100 text-orange-700" },
  "ticket.created": { icon: Wrench, color: "bg-orange-100 text-orange-700" },
  "ticket.resolved": { icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  document_uploaded: { icon: FileText, color: "bg-purple-100 text-purple-700" },
  "document.uploaded": { icon: FileText, color: "bg-purple-100 text-purple-700" },
  "document.expiring": { icon: AlertCircle, color: "bg-amber-100 text-amber-700" },
  message_received: { icon: MessageSquare, color: "bg-indigo-100 text-indigo-700" },
  "quote.received": { icon: Euro, color: "bg-blue-100 text-blue-700" },
  "intervention.completed": { icon: CheckCircle2, color: "bg-green-100 text-green-700" },
  "candidature.received": { icon: Building2, color: "bg-purple-100 text-purple-700" },
  system: { icon: Bell, color: "bg-slate-100 text-slate-700" },
};

function getTypeConfig(type: string) {
  return typeConfig[type] || { icon: Bell, color: "bg-slate-100 text-slate-700" };
}

export default function OwnerNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "urgent">("all");

  const fetchNotifications = useCallback(async () => {
    try {
      const unreadOnly = filter === "unread";
      const response = await fetch(`/api/notifications?unread=${unreadOnly}&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
    );
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id }),
      });
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const isUnread = (n: Notification) => !n.is_read && !n.read_at;
  const isUrgent = (n: Notification) => n.priority === "urgent" || n.priority === "high";

  const filteredNotifications =
    filter === "unread"
      ? notifications.filter(isUnread)
      : filter === "urgent"
        ? notifications.filter(isUrgent)
        : notifications;

  const unreadCount = notifications.filter(isUnread).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <Link
            href="/owner/dashboard"
            className="text-sm font-medium text-muted-foreground hover:text-primary flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Notifications</h1>
              <p className="text-muted-foreground mt-0.5">
                {unreadCount > 0
                  ? `${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`
                  : "Toutes vos notifications sont lues"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Tout marquer lu
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/settings/notifications">
              <Settings className="mr-2 h-4 w-4" />
              Paramètres
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants} className="mb-6">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">
              Toutes ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread">
              Non lues
              {unreadCount > 0 && (
                <Badge className="ml-2 bg-red-500 text-white">{unreadCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="urgent" className="data-[state=active]:text-red-600">
              Urgent
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* List */}
      {filteredNotifications.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="py-16 text-center">
              <Bell className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune notification</h3>
              <p className="text-muted-foreground">
                {filter === "unread"
                  ? "Vous n'avez pas de notifications non lues"
                  : filter === "urgent"
                    ? "Aucune notification urgente"
                    : "Vous n'avez pas encore de notifications"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {filteredNotifications.map((notification) => {
            const config = getTypeConfig(notification.type);
            const Icon = config.icon;
            const unread = isUnread(notification);
            const message = notification.message || notification.body || "";
            const actionUrl = notification.action_url || notification.route;

            return (
              <motion.div key={notification.id} variants={itemVariants}>
                <Card
                  className={cn(
                    "transition-all hover:shadow-md",
                    unread && "bg-blue-50/50 border-blue-200",
                    isUrgent(notification) && unread && "border-l-4 border-l-red-500"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                          config.color
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={cn("font-medium", unread && "font-semibold")}>
                            {notification.title}
                          </h3>
                          {unread && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                          {isUrgent(notification) && (
                            <Badge variant="destructive" className="text-xs">Urgent</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{message}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                          {actionUrl && (
                            <Link
                              href={actionUrl}
                              onClick={() => { if (unread) markAsRead(notification.id); }}
                              className="text-xs text-primary hover:underline"
                            >
                              {notification.action_label || "Voir les détails"}
                            </Link>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        {unread && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markAsRead(notification.id)}
                            title="Marquer comme lu"
                            className="h-8 w-8"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteNotification(notification.id)}
                          className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
