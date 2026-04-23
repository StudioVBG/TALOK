"use client";

import Link from "next/link";
import { AlertCircle, Clock, CheckCircle2, Star, Wrench, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPIData {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  closed: number;
  avg_resolution_hours: number | null;
  avg_first_response_hours: number | null;
  avg_satisfaction: number | null;
  by_category: Record<string, number>;
  by_priority: Record<string, number>;
}

interface TicketKPIsProps {
  kpis?: KPIData | null;
  loading?: boolean;
  activeStatus?: string | null;
  activeCategory?: string | null;
  activePriority?: string | null;
  basePath?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  plomberie: "Plomberie",
  electricite: "Électricité",
  serrurerie: "Serrurerie",
  chauffage: "Chauffage",
  humidite: "Humidité",
  nuisibles: "Nuisibles",
  bruit: "Bruit",
  parties_communes: "Parties communes",
  equipement: "Équipement",
  autre: "Autre",
  non_categorise: "Non catégorisé",
};

const PRIORITY_LABELS: Record<string, string> = {
  basse: "Basse",
  low: "Basse",
  normale: "Normale",
  normal: "Normale",
  haute: "Haute",
  urgent: "Urgent",
  urgente: "Urgente",
  emergency: "Urgence",
};

const PRIORITY_BAR_COLORS: Record<string, string> = {
  basse: "bg-slate-400",
  low: "bg-slate-400",
  normale: "bg-blue-500",
  normal: "bg-blue-500",
  haute: "bg-orange-500",
  urgent: "bg-orange-500",
  urgente: "bg-red-500",
  emergency: "bg-red-500",
};

function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}j`;
}

function buildHref(basePath: string, params: Record<string, string | null>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) qs.set(k, v);
  });
  const q = qs.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export function TicketKPIs({
  kpis,
  loading,
  activeStatus = null,
  activeCategory = null,
  activePriority = null,
  basePath = "/owner/tickets",
}: TicketKPIsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-card border border-border animate-pulse">
            <div className="h-4 w-20 bg-muted rounded mb-3" />
            <div className="h-8 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const cards = [
    {
      label: "Ouverts",
      value: kpis.open,
      icon: AlertCircle,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-900/20",
      filter: "open",
      ring: "ring-blue-500",
    },
    {
      label: "En cours",
      value: kpis.in_progress,
      icon: Wrench,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      filter: "in_progress",
      ring: "ring-amber-500",
    },
    {
      label: "Résolus",
      value: kpis.resolved + kpis.closed,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      filter: "resolved",
      ring: "ring-emerald-500",
    },
    {
      label: "Temps moyen résolution",
      value: formatHours(kpis.avg_resolution_hours),
      icon: Clock,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
      isText: true,
      filter: null as string | null,
      ring: "",
    },
  ];

  // Sort categories by count
  const sortedCategories = Object.entries(kpis.by_category)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const maxCatCount = sortedCategories.length > 0
    ? sortedCategories[0][1]
    : 1;

  // Sort priorities by count
  const sortedPriorities = Object.entries(kpis.by_priority).sort(
    ([, a], [, b]) => b - a
  );
  const maxPrioCount =
    sortedPriorities.length > 0 ? sortedPriorities[0][1] : 1;

  return (
    <div className="space-y-6">
      {/* Main KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((card) => {
          const isActive = card.filter !== null && activeStatus === card.filter;
          const href = card.filter
            ? buildHref(basePath, {
                status: isActive ? null : card.filter,
                category: activeCategory,
                priority: activePriority,
              })
            : null;

          const cardInner = (
            <>
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={cn("h-4 w-4", card.color)} />
                <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
              </div>
              <p className={cn("text-3xl font-bold", card.color)}>{card.value}</p>
            </>
          );

          if (!href) {
            return (
              <div
                key={card.label}
                className={cn(
                  "p-5 rounded-2xl border border-border shadow-sm",
                  card.bg
                )}
              >
                {cardInner}
              </div>
            );
          }

          return (
            <Link
              key={card.label}
              href={href}
              aria-pressed={isActive}
              className={cn(
                "p-5 rounded-2xl border shadow-sm transition-all hover:scale-[1.02] focus:outline-none focus-visible:ring-2",
                card.bg,
                isActive
                  ? cn("ring-2 border-transparent", card.ring)
                  : "border-border hover:border-foreground/20"
              )}
            >
              {cardInner}
            </Link>
          );
        })}
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Satisfaction */}
        {kpis.avg_satisfaction !== null && (
          <div className="p-5 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-medium text-muted-foreground">Satisfaction moyenne</p>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold text-foreground">{kpis.avg_satisfaction}</p>
              <p className="text-sm text-muted-foreground">/ 5</p>
            </div>
          </div>
        )}

        {/* First response time */}
        {kpis.avg_first_response_hours !== null && (
          <div className="p-5 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              <p className="text-sm font-medium text-muted-foreground">Temps première réponse</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {formatHours(kpis.avg_first_response_hours)}
            </p>
          </div>
        )}
      </div>

      {/* By priority pills */}
      {sortedPriorities.length > 0 && (
        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Par priorité</p>
            </div>
            {activePriority && (
              <Link
                href={buildHref(basePath, {
                  status: activeStatus,
                  category: activeCategory,
                  priority: null,
                })}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Réinitialiser
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {sortedPriorities.map(([prio, count]) => {
              const isActive = activePriority === prio;
              const barColor = PRIORITY_BAR_COLORS[prio] ?? "bg-blue-500";
              return (
                <Link
                  key={prio}
                  href={buildHref(basePath, {
                    status: activeStatus,
                    category: activeCategory,
                    priority: isActive ? null : prio,
                  })}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors",
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-400"
                      : "hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs w-28 truncate",
                      isActive
                        ? "font-bold text-blue-700 dark:text-blue-300"
                        : "text-muted-foreground"
                    )}
                  >
                    {PRIORITY_LABELS[prio] ?? prio}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", barColor)}
                      style={{ width: `${(count / maxPrioCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-foreground w-6 text-right">
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* By category mini chart */}
      {sortedCategories.length > 0 && (
        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Par catégorie</p>
            </div>
            {activeCategory && (
              <Link
                href={buildHref(basePath, {
                  status: activeStatus,
                  category: null,
                  priority: activePriority,
                })}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Réinitialiser
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {sortedCategories.map(([cat, count]) => {
              const isActive = activeCategory === cat;
              return (
                <Link
                  key={cat}
                  href={buildHref(basePath, {
                    status: activeStatus,
                    category: isActive ? null : cat,
                    priority: activePriority,
                  })}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition-colors",
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-400"
                      : "hover:bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs w-28 truncate",
                      isActive
                        ? "font-bold text-blue-700 dark:text-blue-300"
                        : "text-muted-foreground"
                    )}
                  >
                    {CATEGORY_LABELS[cat] || cat}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isActive
                          ? "bg-blue-600 dark:bg-blue-500"
                          : "bg-blue-500 dark:bg-blue-400"
                      )}
                      style={{ width: `${(count / maxCatCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-foreground w-6 text-right">
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
