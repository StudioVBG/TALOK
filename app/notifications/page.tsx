"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  CheckCheck,
  Loader2,
  FileText,
  Euro,
  Wrench,
  MessageSquare,
  Calendar,
  AlertCircle,
  Building2,
  User,
  Clock,
  Trash2,
  Settings,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
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
  type: "payment" | "ticket" | "document" | "lease" | "message" | "system";
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  link?: string;
}

const typeConfig = {
  payment: { icon: Euro, color: "bg-green-100 text-green-700" },
  ticket: { icon: Wrench, color: "bg-amber-100 text-amber-700" },
  document: { icon: FileText, color: "bg-blue-100 text-blue-700" },
  lease: { icon: Building2, color: "bg-purple-100 text-purple-700" },
  message: { icon: MessageSquare, color: "bg-indigo-100 text-indigo-700" },
  system: { icon: Bell, color: "bg-slate-100 text-slate-700" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // ✅ SOTA BIC 2026: Appel API réel au lieu de mock data
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const response = await fetch("/api/notifications");
        if (response.ok) {
          const data = await response.json();
          // Normaliser les données de l'API vers le format attendu
          const apiNotifications: Notification[] = (data.notifications || data || []).map((n: any) => ({
            id: n.id,
            type: n.type || "system",
            title: n.title || "Notification",
            message: n.message || n.body || "",
            created_at: n.created_at,
            read: n.read ?? false,
            link: n.link || n.metadata?.link || undefined,
          }));
          setNotifications(apiNotifications);
        } else {
          console.error("Erreur API notifications:", response.status);
          setNotifications([]);
        }
      } catch (error) {
        console.error("Erreur chargement notifications:", error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, []);

  // ✅ SOTA BIC 2026: Actions connectées à l'API
  const markAllAsRead = async () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
    } catch (error) {
      console.error("Erreur markAllAsRead:", error);
    }
  };

  const markAsRead = async (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id }),
      });
    } catch (error) {
      console.error("Erreur markAsRead:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
    try {
      await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (error) {
      console.error("Erreur deleteNotification:", error);
    }
  };

  const filteredNotifications = filter === "unread"
    ? notifications.filter((n) => !n.read)
    : notifications;

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0
              ? `Vous avez ${unreadCount} notification${unreadCount > 1 ? "s" : ""} non lue${unreadCount > 1 ? "s" : ""}`
              : "Toutes vos notifications sont lues"}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCheck className="mr-2 h-4 w-4" />
              Tout marquer comme lu
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

      {/* Filters */}
      <motion.div variants={itemVariants} className="mb-6">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
          <TabsList>
            <TabsTrigger value="all">Toutes ({notifications.length})</TabsTrigger>
            <TabsTrigger value="unread">
              Non lues
              {unreadCount > 0 && (
                <Badge className="ml-2 bg-red-500 text-white">{unreadCount}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* Notifications list */}
      {filteredNotifications.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="py-16 text-center">
              <Bell className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune notification</h3>
              <p className="text-muted-foreground">
                {filter === "unread"
                  ? "Vous n'avez pas de notifications non lues"
                  : "Vous n'avez pas encore de notifications"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={containerVariants} className="space-y-3">
          {filteredNotifications.map((notification) => {
            const typeInfo = typeConfig[notification.type] || typeConfig.system;
            const Icon = typeInfo.icon;

            const NotificationWrapper = notification.link
              ? ({ children }: { children: React.ReactNode }) => (
                  <Link href={notification.link!} onClick={() => markAsRead(notification.id)}>
                    {children}
                  </Link>
                )
              : ({ children }: { children: React.ReactNode }) => <>{children}</>;

            return (
              <motion.div key={notification.id} variants={itemVariants}>
                <Card
                  className={cn(
                    "transition-all hover:shadow-md",
                    !notification.read && "bg-blue-50/50 border-blue-200"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                          typeInfo.color
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <NotificationWrapper>
                        <div className="flex-1 min-w-0 cursor-pointer">
                          <div className="flex items-center gap-2 mb-1">
                            <h3
                              className={cn(
                                "font-medium",
                                !notification.read && "font-semibold"
                              )}
                            >
                              {notification.title}
                            </h3>
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>
                      </NotificationWrapper>

                      <div className="flex gap-1 shrink-0">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markAsRead(notification.id)}
                            title="Marquer comme lu"
                          >
                            <CheckCheck className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteNotification(notification.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
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

