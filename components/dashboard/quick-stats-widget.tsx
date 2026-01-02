"use client";

import { useState, useEffect } from "react";
import { 
  Building2, 
  Users, 
  Euro, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface QuickStat {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: typeof Building2;
  href?: string;
  status?: "success" | "warning" | "danger" | "neutral";
}

interface QuickStatsWidgetProps {
  className?: string;
  compact?: boolean;
}

export function QuickStatsWidget({ className, compact = false }: QuickStatsWidgetProps) {
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch dashboard stats
        const res = await fetch("/api/owner/dashboard");
        if (res.ok) {
          const data = await res.json();
          
          setStats([
            {
              id: "properties",
              label: "Biens",
              value: data.properties?.total || 0,
              icon: Building2,
              href: "/owner/properties",
              status: "neutral",
            },
            {
              id: "tenants",
              label: "Locataires",
              value: data.tenants?.active || 0,
              icon: Users,
              href: "/owner/tenants",
              status: "neutral",
            },
            {
              id: "revenue",
              label: "Ce mois",
              value: formatCurrency(data.finance?.revenue_month || 0),
              change: data.finance?.revenue_change,
              changeLabel: "vs mois précédent",
              icon: Euro,
              href: "/owner/money",
              status: (data.finance?.revenue_change || 0) >= 0 ? "success" : "warning",
            },
            {
              id: "unpaid",
              label: "Impayés",
              value: data.finance?.unpaid_count || 0,
              icon: AlertCircle,
              href: "/owner/money?filter=unpaid",
              status: (data.finance?.unpaid_count || 0) > 0 ? "danger" : "success",
            },
          ]);
        } else {
          // Données par défaut si erreur
          setStats([
            { id: "properties", label: "Biens", value: "-", icon: Building2, status: "neutral" },
            { id: "tenants", label: "Locataires", value: "-", icon: Users, status: "neutral" },
            { id: "revenue", label: "Revenus", value: "-", icon: Euro, status: "neutral" },
            { id: "unpaid", label: "Impayés", value: "-", icon: AlertCircle, status: "neutral" },
          ]);
        }
      } catch (error) {
        console.error("Erreur chargement stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-4 flex-wrap", className)}>
        {stats.map((stat) => (
          <div
            key={stat.id}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
              stat.status === "success" && "bg-emerald-100 text-emerald-700",
              stat.status === "warning" && "bg-amber-100 text-amber-700",
              stat.status === "danger" && "bg-red-100 text-red-700",
              stat.status === "neutral" && "bg-slate-100 text-slate-700"
            )}
          >
            <stat.icon className="h-3.5 w-3.5" />
            <span className="font-medium">{stat.value}</span>
            <span className="text-xs opacity-70">{stat.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0">
          {stats.map((stat) => {
            const content = (
              <div
                className={cn(
                  "p-4 hover:bg-muted/50 transition-colors",
                  stat.href && "cursor-pointer"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      stat.status === "success" && "bg-emerald-100 text-emerald-600",
                      stat.status === "warning" && "bg-amber-100 text-amber-600",
                      stat.status === "danger" && "bg-red-100 text-red-600",
                      stat.status === "neutral" && "bg-slate-100 text-slate-600"
                    )}
                  >
                    <stat.icon className="h-4 w-4" />
                  </div>
                  {stat.href && (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  {stat.change !== undefined && (
                    <div className="flex items-center gap-1 text-xs">
                      {stat.change >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      <span
                        className={cn(
                          stat.change >= 0 ? "text-emerald-600" : "text-red-600"
                        )}
                      >
                        {stat.change >= 0 ? "+" : ""}{stat.change}%
                      </span>
                      {stat.changeLabel && (
                        <span className="text-muted-foreground">{stat.changeLabel}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );

            return stat.href ? (
              <Link key={stat.id} href={stat.href} className="block">
                {content}
              </Link>
            ) : (
              <div key={stat.id}>{content}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default QuickStatsWidget;

