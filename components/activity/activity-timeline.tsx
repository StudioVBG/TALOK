"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  FileText,
  Users,
  Euro,
  Wrench,
  File,
  ClipboardCheck,
  User,
  ChevronDown,
  Filter,
  Calendar,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import type { ActivityLog, ActivityCategory } from "@/lib/services/activity-log.service";

// Icônes par catégorie
const categoryIcons: Record<ActivityCategory, typeof Building2> = {
  property: Building2,
  lease: FileText,
  tenant: Users,
  payment: Euro,
  ticket: Wrench,
  document: File,
  inspection: ClipboardCheck,
  account: User,
};

// Couleurs par catégorie
const categoryColors: Record<ActivityCategory, string> = {
  property: "bg-blue-100 text-blue-600 border-blue-200",
  lease: "bg-violet-100 text-violet-600 border-violet-200",
  tenant: "bg-emerald-100 text-emerald-600 border-emerald-200",
  payment: "bg-amber-100 text-amber-600 border-amber-200",
  ticket: "bg-orange-100 text-orange-600 border-orange-200",
  document: "bg-slate-100 text-slate-600 border-slate-200",
  inspection: "bg-cyan-100 text-cyan-600 border-cyan-200",
  account: "bg-pink-100 text-pink-600 border-pink-200",
};

// Labels des catégories
const categoryLabels: Record<ActivityCategory, string> = {
  property: "Biens",
  lease: "Baux",
  tenant: "Locataires",
  payment: "Paiements",
  ticket: "Tickets",
  document: "Documents",
  inspection: "EDL",
  account: "Compte",
};

interface ActivityTimelineProps {
  profileId?: string;
  className?: string;
  limit?: number;
  showFilters?: boolean;
  compact?: boolean;
}

export function ActivityTimeline({
  profileId,
  className,
  limit = 20,
  showFilters = true,
  compact = false,
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<ActivityCategory | "all">("all");
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    const fetchActivities = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ limit: limit.toString() });
        if (categoryFilter !== "all") {
          params.append("category", categoryFilter);
        }

        const res = await fetch(`/api/activities?${params}`);
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        } else {
          // Données de démo si pas d'API
          setActivities(getDemoActivities());
        }
      } catch (error) {
        console.error("Erreur chargement activités:", error);
        setActivities(getDemoActivities());
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivities();
  }, [limit, categoryFilter]);

  const displayedActivities = showMore ? activities : activities.slice(0, compact ? 5 : 10);

  // Grouper par date
  const groupedActivities = displayedActivities.reduce((groups, activity) => {
    const date = format(new Date(activity.createdAt), "yyyy-MM-dd");
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, ActivityLog[]>);

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Activité récente
          </CardTitle>
          {showFilters && (
            <Select
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v as ActivityCategory | "all")}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Aucune activité récente</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedActivities).map(([date, dayActivities]) => (
              <div key={date}>
                {/* Date header */}
                <div className="sticky top-0 bg-background pb-2 mb-3">
                  <Badge variant="outline" className="text-xs font-normal">
                    {formatDateHeader(date)}
                  </Badge>
                </div>

                {/* Activities for this date */}
                <div className="space-y-3 relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                  {dayActivities.map((activity, index) => {
                    const Icon = categoryIcons[activity.category];
                    const colorClass = categoryColors[activity.category];

                    return (
                      <div
                        key={activity.id}
                        className="relative flex items-start gap-4 pl-10"
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            "absolute left-0 p-2 rounded-full border-2 bg-background",
                            colorClass
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{activity.title}</p>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {activity.description}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(activity.createdAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </p>
                        </div>

                        {/* Category badge */}
                        {!compact && (
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] shrink-0", colorClass)}
                          >
                            {categoryLabels[activity.category]}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Show more button */}
            {activities.length > (compact ? 5 : 10) && !showMore && (
              <Button
                variant="ghost"
                className="w-full text-xs"
                onClick={() => setShowMore(true)}
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                Voir plus d'activités
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDateHeader(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === format(today, "yyyy-MM-dd")) {
    return "Aujourd'hui";
  }
  if (dateStr === format(yesterday, "yyyy-MM-dd")) {
    return "Hier";
  }
  return format(date, "EEEE d MMMM", { locale: fr });
}

// Données de démo
function getDemoActivities(): ActivityLog[] {
  const now = new Date();
  return [
    {
      id: "1",
      type: "payment_received",
      category: "payment",
      title: "Paiement de 850€ reçu",
      description: "De Jean Dupont",
      profileId: "demo",
      createdAt: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: "2",
      type: "property_updated",
      category: "property",
      title: "Bien 'Appartement Paris 15' modifié",
      profileId: "demo",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "3",
      type: "ticket_created",
      category: "ticket",
      title: "Ticket 'Fuite robinet' créé",
      profileId: "demo",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: "4",
      type: "document_uploaded",
      category: "document",
      title: "Document 'Assurance habitation' uploadé",
      profileId: "demo",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: "5",
      type: "lease_signed",
      category: "lease",
      title: "Bail signé par Marie Martin",
      profileId: "demo",
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    },
  ];
}

export default ActivityTimeline;

