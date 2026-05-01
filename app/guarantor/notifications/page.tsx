"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/lib/hooks/use-notifications";
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  FileSignature,
  Trash2,
  Loader2,
} from "lucide-react";
import Link from "next/link";

const ICON_BY_TYPE: Record<string, typeof Bell> = {
  payment_late: AlertTriangle,
  payment_reminder: AlertTriangle,
  lease_signed: CheckCircle2,
  lease_pending_signature: FileSignature,
  document_signed: FileSignature,
  document_uploaded: FileSignature,
  reminder: Bell,
  alert: AlertTriangle,
  system: Bell,
};

export default function GuarantorNotificationsPage() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications({ limit: 100, showToast: false });

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-3xl flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Notifications</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
                : "Toutes les notifications sont lues"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <Bell className="w-10 h-10 mx-auto opacity-30" />
            <p>Aucune notification pour le moment.</p>
            <p className="text-sm">
              Vous serez notifié des incidents de paiement, des nouveaux engagements et
              des changements de statut.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const Icon = ICON_BY_TYPE[n.type] ?? Bell;
            const linkHref = n.link || n.link_url;
            return (
              <Card key={n.id} className={n.read ? "opacity-70" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          {n.title}
                          {!n.read && (
                            <Badge variant="default" className="text-[10px] h-5">
                              Nouveau
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {n.message || n.body}
                        </CardDescription>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(n.created_at).toLocaleString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteNotification(n.id)}
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                {(linkHref || !n.read) && (
                  <CardContent className="pt-0 flex gap-2">
                    {linkHref && (
                      <Link href={linkHref}>
                        <Button size="sm" variant="outline">
                          Voir
                        </Button>
                      </Link>
                    )}
                    {!n.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsRead(n.id)}
                      >
                        Marquer comme lu
                      </Button>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
