"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Home,
  FileText,
  DollarSign,
  Ticket,
  Upload,
  User,
  Bell,
  LogIn,
  Edit,
  Plus,
  Check,
  X,
  Clock,
  MessageSquare,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export type ActivityType = 
  | "property_created"
  | "property_updated"
  | "lease_created"
  | "lease_signed"
  | "lease_terminated"
  | "payment_received"
  | "payment_late"
  | "ticket_created"
  | "ticket_resolved"
  | "document_uploaded"
  | "profile_updated"
  | "login"
  | "notification_sent"
  | "message_sent";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  isNew?: boolean;
}

interface OwnerActivityFeedProps {
  activities: ActivityEvent[];
  isLoading?: boolean;
  isLive?: boolean;
  onRefresh?: () => void;
  maxHeight?: number;
  className?: string;
}

const activityConfig: Record<ActivityType, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
}> = {
  property_created: {
    icon: Plus,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  property_updated: {
    icon: Edit,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  lease_created: {
    icon: FileText,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  lease_signed: {
    icon: Check,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  lease_terminated: {
    icon: X,
    color: "text-red-600",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  payment_received: {
    icon: DollarSign,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  payment_late: {
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  ticket_created: {
    icon: Ticket,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
  },
  ticket_resolved: {
    icon: Check,
    color: "text-emerald-600",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
  document_uploaded: {
    icon: Upload,
    color: "text-cyan-600",
    bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
  },
  profile_updated: {
    icon: User,
    color: "text-slate-600",
    bgColor: "bg-slate-100 dark:bg-slate-800",
  },
  login: {
    icon: LogIn,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  notification_sent: {
    icon: Bell,
    color: "text-violet-600",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
  },
  message_sent: {
    icon: MessageSquare,
    color: "text-pink-600",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
  },
};

function ActivityItem({ 
  activity, 
  index 
}: { 
  activity: ActivityEvent; 
  index: number;
}) {
  const config = activityConfig[activity.type] || {
    icon: Activity,
    color: "text-slate-600",
    bgColor: "bg-slate-100",
  };
  const Icon = config.icon;
  
  const timeAgo = React.useMemo(() => {
    try {
      return formatDistanceToNow(new Date(activity.timestamp), {
        addSuffix: true,
        locale: fr,
      });
    } catch {
      return "Date inconnue";
    }
  }, [activity.timestamp]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        "flex gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50",
        activity.isNew && "bg-primary/5 border-l-2 border-primary"
      )}
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className={cn("p-2 rounded-lg", config.bgColor)}>
          <Icon className={cn("h-4 w-4", config.color)} />
        </div>
        {/* Line connector */}
        <div className="w-px flex-1 bg-border mt-2" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium" title={activity.title}>
              {activity.title}
            </p>
            {activity.description && (
              <p 
                className="text-xs text-muted-foreground mt-0.5"
                title={activity.description}
              >
                {activity.description}
              </p>
            )}
          </div>
          {activity.isNew && (
            <Badge variant="default" className="text-xs px-1.5 py-0 h-5 flex-shrink-0">
              Nouveau
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 p-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">Aucune activité récente</p>
    </div>
  );
}

export function OwnerActivityFeed({
  activities,
  isLoading = false,
  isLive = false,
  onRefresh,
  maxHeight = 400,
  className,
}: OwnerActivityFeedProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Grouper par jour
  const groupedActivities = React.useMemo(() => {
    const groups: Record<string, ActivityEvent[]> = {};
    
    activities.forEach((activity) => {
      const date = new Date(activity.timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = "Aujourd'hui";
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = "Hier";
      } else {
        key = date.toLocaleDateString("fr-FR", { 
          weekday: "long", 
          day: "numeric", 
          month: "long" 
        });
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(activity);
    });
    
    return groups;
  }, [activities]);

  return (
    <Card className={cn("border-0 bg-card/50 backdrop-blur-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                <Activity className="h-5 w-5 text-cyan-600" />
              </div>
              {isLive && (
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"
                />
              )}
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Activité
                {isLive && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Zap className="h-3 w-3" />
                    Live
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {activities.length} événement{activities.length > 1 ? "s" : ""} récent{activities.length > 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
          
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
            >
              <RefreshCw className={cn(
                "h-4 w-4",
                (isRefreshing || isLoading) && "animate-spin"
              )} />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {isLoading ? (
          <LoadingSkeleton />
        ) : activities.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea style={{ maxHeight }} className="px-4 pb-4">
            <AnimatePresence mode="popLayout">
              {Object.entries(groupedActivities).map(([date, events]) => (
                <div key={date} className="mb-4">
                  <div className="sticky top-0 bg-card/95 backdrop-blur-sm py-2 z-10">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {date}
                    </p>
                  </div>
                  {events.map((activity, index) => (
                    <ActivityItem
                      key={activity.id}
                      activity={activity}
                      index={index}
                    />
                  ))}
                </div>
              ))}
            </AnimatePresence>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// Hook pour les activités temps réel (à utiliser avec Supabase Realtime)
export function useOwnerActivityFeed(ownerId: string) {
  const [activities, setActivities] = React.useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchActivities = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/people/owners/${ownerId}/activity`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  // Fetch initial
  React.useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // TODO: Ajouter Supabase Realtime subscription
  // React.useEffect(() => {
  //   const supabase = createClient();
  //   const channel = supabase
  //     .channel(`owner-${ownerId}-activity`)
  //     .on('postgres_changes', { ... })
  //     .subscribe();
  //   return () => { channel.unsubscribe(); };
  // }, [ownerId]);

  const addActivity = React.useCallback((activity: ActivityEvent) => {
    setActivities(prev => [{ ...activity, isNew: true }, ...prev]);
  }, []);

  return {
    activities,
    isLoading,
    refresh: fetchActivities,
    addActivity,
  };
}

// Fonction utilitaire pour formater un événement de base de données en ActivityEvent
export function formatActivityEvent(
  event: { 
    type: string; 
    created_at: string; 
    metadata?: Record<string, any>;
  }
): ActivityEvent {
  const typeMapping: Record<string, { type: ActivityType; getTitle: (m?: Record<string, any>) => string }> = {
    "property.created": { 
      type: "property_created", 
      getTitle: (m) => `Nouveau bien ajouté${m?.address ? `: ${m.address}` : ""}` 
    },
    "property.updated": { 
      type: "property_updated", 
      getTitle: () => "Bien mis à jour" 
    },
    "lease.created": { 
      type: "lease_created", 
      getTitle: () => "Nouveau bail créé" 
    },
    "lease.signed": { 
      type: "lease_signed", 
      getTitle: () => "Bail signé" 
    },
    "lease.terminated": { 
      type: "lease_terminated", 
      getTitle: () => "Bail résilié" 
    },
    "payment.received": { 
      type: "payment_received", 
      getTitle: (m) => `Paiement reçu${m?.amount ? `: ${m.amount}€` : ""}` 
    },
    "payment.late": { 
      type: "payment_late", 
      getTitle: () => "Paiement en retard" 
    },
    "ticket.created": { 
      type: "ticket_created", 
      getTitle: (m) => `Nouveau ticket${m?.title ? `: ${m.title}` : ""}` 
    },
    "ticket.resolved": { 
      type: "ticket_resolved", 
      getTitle: () => "Ticket résolu" 
    },
    "document.uploaded": { 
      type: "document_uploaded", 
      getTitle: (m) => `Document uploadé${m?.name ? `: ${m.name}` : ""}` 
    },
    "user.login": { 
      type: "login", 
      getTitle: () => "Connexion" 
    },
    "profile.updated": { 
      type: "profile_updated", 
      getTitle: () => "Profil mis à jour" 
    },
  };

  const mapping = typeMapping[event.type] || { 
    type: "profile_updated" as ActivityType, 
    getTitle: () => event.type 
  };

  return {
    id: `${event.type}-${event.created_at}`,
    type: mapping.type,
    title: mapping.getTitle(event.metadata),
    timestamp: event.created_at,
    metadata: event.metadata,
  };
}

