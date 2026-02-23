"use client";

import { Bell, CheckCircle2, Clock, Info, MessageSquare, Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/ui/page-transition";
import { ErrorState } from "@/components/ui/error-state";
import { formatDateShort } from "@/lib/helpers/format";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTenantNotifications, useMarkNotificationRead } from "@/lib/hooks/queries/use-tenant-notifications";

export default function TenantNotificationsPage() {
  const { data: notifications = [], isLoading: loading, error, refetch } = useTenantNotifications();
  const markAsRead = useMarkNotificationRead();

  const handleMarkAsRead = (id: string) => {
    markAsRead.mutate(id);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case "info": return <Info className="h-5 w-5 text-blue-600" />;
      case "warning": return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case "message": return <MessageSquare className="h-5 w-5 text-indigo-600" />;
      default: return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <Link 
              href="/tenant/dashboard" 
              className="group text-sm font-bold text-muted-foreground hover:text-indigo-600 flex items-center gap-2 transition-colors mb-4"
            >
              <div className="p-1.5 rounded-lg bg-muted group-hover:bg-indigo-50 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </div>
              Retour au tableau de bord
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                <Bell className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-foreground">Notifications</h1>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div role="status" aria-label="Chargement des notifications">
              <Loader2 className="animate-spin h-10 w-10 text-indigo-600" />
              <span className="sr-only">Chargement en cours…</span>
            </div>
          </div>
        ) : error ? (
          <ErrorState
            title="Erreur de chargement"
            description="Impossible de charger vos notifications."
            onRetry={() => refetch()}
          />
        ) : notifications.length === 0 ? (
          <GlassCard className="p-12 text-center border-border">
            <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Bell className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <h3 className="text-xl font-bold">Aucune notification</h3>
            <p className="text-muted-foreground mt-2">Vous êtes à jour ! Toutes les nouvelles alertes apparaîtront ici.</p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {notifications.map((n) => (
              <GlassCard 
                key={n.id} 
                className={cn(
                  "p-5 border-border bg-card hover:shadow-xl transition-all group",
                  !n.read_at && "border-l-4 border-l-indigo-600 bg-indigo-50/10"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-2xl flex-shrink-0",
                      !n.read_at ? "bg-indigo-100" : "bg-muted"
                    )}>
                      {getIcon(n.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-foreground">{n.title}</h4>
                        {!n.read_at && <Badge className="bg-indigo-600 h-2 w-2 p-0 rounded-full" />}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{n.body}</p>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-2 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> {formatDateShort(n.created_at)}
                      </p>
                    </div>
                  </div>
                  {!n.read_at && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleMarkAsRead(n.id)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                      aria-label="Marquer la notification comme lue"
                    >
                      Marquer comme lu
                    </Button>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}

      </div>
    </PageTransition>
  );
}



