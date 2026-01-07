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

  useEffect(() => {
    async function fetchNotifications() {
      try {
        // Simulation - en production, appeler l'API
        const mockNotifications: Notification[] = [
          {
            id: "1",
            type: "payment",
            title: "Paiement reçu",
            message: "Le loyer de novembre 2024 a été reçu pour le 12 rue de la Paix.",
            created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
            read: false,
            link: "/owner/money",
          },
          {
            id: "2",
            type: "ticket",
            title: "Nouveau ticket",
            message: "Un nouveau ticket a été créé : Fuite salle de bain",
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2h ago
            read: false,
            link: "/owner/tickets",
          },
          {
            id: "3",
            type: "document",
            title: "Document disponible",
            message: "Votre quittance de novembre est disponible.",
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
            read: true,
            link: "/owner/documents",
          },
          {
            id: "4",
            type: "lease",
            title: "Bail à renouveler",
            message: "Le bail du 45 avenue des Champs se termine dans 30 jours.",
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
            read: true,
            link: "/owner/leases",
          },
          {
            id: "5",
            type: "system",
            title: "Bienvenue !",
            message: "Votre compte a été créé avec succès. Découvrez toutes les fonctionnalités.",
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
            read: true,
          },
        ];
        setNotifications(mockNotifications);
      } catch (error) {
        console.error("Erreur chargement notifications:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, []);

  const markAllAsRead = async () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    // En production, appeler l'API
  };

  const markAsRead = async (id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
    // En production, appeler l'API
  };

  const deleteNotification = async (id: string) => {
    setNotifications(notifications.filter((n) => n.id !== id));
    // En production, appeler l'API
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

