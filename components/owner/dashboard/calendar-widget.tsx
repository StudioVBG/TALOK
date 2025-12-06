"use client";

/**
 * Widget Calendrier des Échéances
 * 
 * Affiche les événements importants à venir:
 * - Fins de bail
 * - Dates de révision IRL
 * - Échéances de factures
 * - Rendez-vous (visites, EDL)
 */

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  FileText,
  Euro,
  TrendingUp,
  Home,
  Clock,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/helpers/format";

interface CalendarEvent {
  id: string;
  type: "lease_expiry" | "irl_revision" | "invoice_due" | "inspection" | "reminder";
  title: string;
  description?: string;
  date: string;
  link?: string;
  priority: "low" | "medium" | "high" | "critical";
  property_address?: string;
}

interface CalendarWidgetProps {
  events: CalendarEvent[];
  className?: string;
}

const eventIcons = {
  lease_expiry: FileText,
  irl_revision: TrendingUp,
  invoice_due: Euro,
  inspection: Home,
  reminder: Clock,
};

const eventColors = {
  lease_expiry: "bg-orange-100 text-orange-700 border-orange-200",
  irl_revision: "bg-blue-100 text-blue-700 border-blue-200",
  invoice_due: "bg-emerald-100 text-emerald-700 border-emerald-200",
  inspection: "bg-purple-100 text-purple-700 border-purple-200",
  reminder: "bg-slate-100 text-slate-700 border-slate-200",
};

const priorityColors = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  critical: "bg-red-100 text-red-600",
};

const priorityLabels = {
  low: "Basse",
  medium: "Normale",
  high: "Haute",
  critical: "Urgente",
};

export function CalendarWidget({ events, className }: CalendarWidgetProps) {
  // Trier par date et prendre les 10 prochains
  const sortedEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => new Date(e.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [events]);

  // Grouper par période
  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: CalendarEvent[] }[] = [];
    const now = new Date();
    const thisWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const thisWeekEvents = sortedEvents.filter(
      (e) => new Date(e.date) <= thisWeek
    );
    const thisMonthEvents = sortedEvents.filter(
      (e) => new Date(e.date) > thisWeek && new Date(e.date) <= thisMonth
    );
    const laterEvents = sortedEvents.filter(
      (e) => new Date(e.date) > thisMonth
    );

    if (thisWeekEvents.length > 0) {
      groups.push({ label: "Cette semaine", events: thisWeekEvents });
    }
    if (thisMonthEvents.length > 0) {
      groups.push({ label: "Ce mois", events: thisMonthEvents });
    }
    if (laterEvents.length > 0) {
      groups.push({ label: "Plus tard", events: laterEvents });
    }

    return groups;
  }, [sortedEvents]);

  // Compter les événements critiques
  const criticalCount = events.filter(
    (e) => e.priority === "critical" || e.priority === "high"
  ).length;

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Échéances à venir</CardTitle>
          </div>
          {criticalCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {criticalCount} urgent{criticalCount > 1 ? "es" : "e"}
            </Badge>
          )}
        </div>
        <CardDescription>
          {sortedEvents.length} événement{sortedEvents.length > 1 ? "s" : ""} à venir
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Aucune échéance prévue
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-6">
              {groupedEvents.map((group) => (
                <div key={group.label}>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    {group.label}
                  </h4>
                  <div className="space-y-2">
                    {group.events.map((event, index) => {
                      const Icon = eventIcons[event.type];
                      const colorClass = eventColors[event.type];
                      
                      const content = (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={cn(
                            "group flex items-start gap-3 p-3 rounded-lg border transition-all",
                            "hover:shadow-sm hover:border-primary/20",
                            event.priority === "critical" && "border-red-200 bg-red-50/50"
                          )}
                        >
                          <div className={cn("p-2 rounded-lg shrink-0", colorClass)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">
                                {event.title}
                              </p>
                              <Badge
                                variant="outline"
                                className={cn("text-xs shrink-0", priorityColors[event.priority])}
                              >
                                {priorityLabels[event.priority]}
                              </Badge>
                            </div>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {event.description}
                              </p>
                            )}
                            {event.property_address && (
                              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Home className="h-3 w-3" />
                                {event.property_address}
                              </p>
                            )}
                            <p className="text-xs text-primary font-medium mt-1">
                              {formatDateShort(event.date)}
                            </p>
                          </div>
                          {event.link && (
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </motion.div>
                      );

                      if (event.link) {
                        return (
                          <Link key={event.id} href={event.link}>
                            {content}
                          </Link>
                        );
                      }
                      
                      return <div key={event.id}>{content}</div>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

