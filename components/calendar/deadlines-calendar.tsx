"use client";

import { useState, useMemo } from "react";
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  Home, FileText, Receipt, AlertTriangle, Shield, TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Types
export type DeadlineType = 
  | "rent_due"
  | "lease_end"
  | "lease_start"
  | "diagnostic_expiry"
  | "insurance_expiry"
  | "rent_revision"
  | "maintenance"
  | "other";

export interface Deadline {
  id: string;
  type: DeadlineType;
  title: string;
  description?: string;
  date: string; // ISO date
  entityType?: "property" | "lease" | "tenant";
  entityId?: string;
  entityName?: string;
  priority?: "low" | "medium" | "high";
  completed?: boolean;
}

// Configuration des types de deadline
const deadlineConfig: Record<DeadlineType, {
  icon: typeof CalendarIcon;
  color: string;
  bgColor: string;
  label: string;
}> = {
  rent_due: {
    icon: Receipt,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    label: "Loyer",
  },
  lease_end: {
    icon: FileText,
    color: "text-orange-600",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    label: "Fin de bail",
  },
  lease_start: {
    icon: FileText,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    label: "Début de bail",
  },
  diagnostic_expiry: {
    icon: AlertTriangle,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    label: "Diagnostic",
  },
  insurance_expiry: {
    icon: Shield,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    label: "Assurance",
  },
  rent_revision: {
    icon: TrendingUp,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
    label: "Révision",
  },
  maintenance: {
    icon: Home,
    color: "text-gray-600",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
    label: "Maintenance",
  },
  other: {
    icon: CalendarIcon,
    color: "text-gray-600",
    bgColor: "bg-gray-100 dark:bg-gray-900/30",
    label: "Autre",
  },
};

// Utilitaires de date
const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Lundi = 0
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isSameDay(date1: string, date2: string): boolean {
  return date1.split("T")[0] === date2.split("T")[0];
}

function isToday(dateStr: string): boolean {
  return isSameDay(dateStr, new Date().toISOString());
}

interface DeadlinesCalendarProps {
  deadlines: Deadline[];
  onDateSelect?: (date: string) => void;
  onDeadlineClick?: (deadline: Deadline) => void;
  className?: string;
}

export function DeadlinesCalendar({
  deadlines,
  onDateSelect,
  onDeadlineClick,
  className,
}: DeadlinesCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(formatDate(new Date()));
  };

  // Générer les jours du calendrier
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: Array<{ date: string; dayNumber: number; isCurrentMonth: boolean }> = [];

    // Jours du mois précédent
    const prevMonthDays = getDaysInMonth(year, month - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i);
      days.push({
        date: formatDate(date),
        dayNumber: prevMonthDays - i,
        isCurrentMonth: false,
      });
    }

    // Jours du mois actuel
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date: formatDate(date),
        dayNumber: i,
        isCurrentMonth: true,
      });
    }

    // Jours du mois suivant
    const remainingDays = 42 - days.length; // 6 semaines x 7 jours
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date: formatDate(date),
        dayNumber: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  // Grouper les deadlines par date
  const deadlinesByDate = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    deadlines.forEach((deadline) => {
      const dateKey = deadline.date.split("T")[0];
      const existing = map.get(dateKey) || [];
      map.set(dateKey, [...existing, deadline]);
    });
    return map;
  }, [deadlines]);

  // Deadlines du jour sélectionné
  const selectedDayDeadlines = useMemo(() => {
    if (!selectedDate) return [];
    return deadlinesByDate.get(selectedDate) || [];
  }, [selectedDate, deadlinesByDate]);

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  return (
    <div className={cn("grid gap-4 md:grid-cols-[1fr,300px]", className)}>
      {/* Calendrier */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {MONTH_NAMES[month]} {year}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={goToPreviousMonth} aria-label="Mois précédent">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Aujourd'hui
              </Button>
              <Button variant="ghost" size="icon" onClick={goToNextMonth} aria-label="Mois suivant">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* En-têtes des jours */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_NAMES.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grille des jours */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ date, dayNumber, isCurrentMonth }, index) => {
              const dayDeadlines = deadlinesByDate.get(date) || [];
              const hasDeadlines = dayDeadlines.length > 0;
              const isSelected = selectedDate === date;
              const isTodayDate = isToday(date);

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(date)}
                  className={cn(
                    "relative aspect-square p-1 rounded-lg transition-colors",
                    "hover:bg-accent",
                    !isCurrentMonth && "text-muted-foreground/50",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                    isTodayDate && !isSelected && "ring-2 ring-primary"
                  )}
                >
                  <span className="text-sm">{dayNumber}</span>
                  
                  {/* Indicateurs de deadline */}
                  {hasDeadlines && (
                    <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                      {dayDeadlines.slice(0, 3).map((deadline, i) => {
                        const config = deadlineConfig[deadline.type];
                        return (
                          <div
                            key={i}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              isSelected ? "bg-primary-foreground" : config.color.replace("text-", "bg-")
                            )}
                          />
                        );
                      })}
                      {dayDeadlines.length > 3 && (
                        <span className="text-[10px]">+{dayDeadlines.length - 3}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Liste des échéances */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {selectedDate
              ? new Date(selectedDate).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })
              : "Sélectionnez une date"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDayDeadlines.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune échéance ce jour
            </p>
          ) : (
            <div className="space-y-3">
              {selectedDayDeadlines.map((deadline) => {
                const config = deadlineConfig[deadline.type];
                const Icon = config.icon;

                return (
                  <button
                    key={deadline.id}
                    onClick={() => onDeadlineClick?.(deadline)}
                    className={cn(
                      "w-full p-3 rounded-lg text-left transition-colors",
                      config.bgColor,
                      "hover:opacity-80"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {deadline.title}
                        </p>
                        {deadline.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {deadline.description}
                          </p>
                        )}
                        {deadline.entityName && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {deadline.entityName}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Version compacte pour le dashboard
export function UpcomingDeadlines({
  deadlines,
  limit = 5,
  onViewAll,
  className,
}: {
  deadlines: Deadline[];
  limit?: number;
  onViewAll?: () => void;
  className?: string;
}) {
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    return deadlines
      .filter((d) => new Date(d.date) >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, limit);
  }, [deadlines, limit]);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Prochaines échéances
          </CardTitle>
          {onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              Voir tout
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {upcomingDeadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune échéance à venir
          </p>
        ) : (
          <div className="space-y-3">
            {upcomingDeadlines.map((deadline) => {
              const config = deadlineConfig[deadline.type];
              const Icon = config.icon;
              const date = new Date(deadline.date);
              const daysUntil = Math.ceil(
                (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );

              return (
                <div
                  key={deadline.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <div className={cn("p-2 rounded-lg", config.bgColor)}>
                    <Icon className={cn("h-4 w-4", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{deadline.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {daysUntil === 0
                        ? "Aujourd'hui"
                        : daysUntil === 1
                        ? "Demain"
                        : `Dans ${daysUntil} jours`}
                    </p>
                  </div>
                  <Badge
                    variant={daysUntil <= 7 ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DeadlinesCalendar;

