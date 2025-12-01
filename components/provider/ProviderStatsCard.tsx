"use client";

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  Euro, 
  TrendingUp, 
  Calendar,
  Star,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/helpers/format";

interface ProviderStatsCardProps {
  stats: {
    totalJobs: number;
    completedJobs: number;
    pendingJobs: number;
    inProgressJobs: number;
    totalRevenue: number;
    pendingPayments: number;
    averageRating: number;
    totalReviews: number;
    upcomingJobs: number;
  };
  className?: string;
}

/**
 * Carte de statistiques pour le dashboard prestataire
 */
export const ProviderStatsCard = memo(function ProviderStatsCard({
  stats,
  className,
}: ProviderStatsCardProps) {
  const completionRate = stats.totalJobs > 0 
    ? Math.round((stats.completedJobs / stats.totalJobs) * 100) 
    : 0;

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      {/* Missions totales */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Missions totales</CardTitle>
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalJobs}</div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              {stats.completedJobs} terminées
            </Badge>
            {stats.inProgressJobs > 0 && (
              <Badge variant="outline" className="text-xs">
                {stats.inProgressJobs} en cours
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Revenus */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenus</CardTitle>
          <Euro className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
          {stats.pendingPayments > 0 && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
              <Clock className="h-3 w-3" />
              {formatCurrency(stats.pendingPayments)} en attente
            </p>
          )}
        </CardContent>
      </Card>

      {/* Note moyenne */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Note moyenne</CardTitle>
          <Star className="h-4 w-4 text-amber-500" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">/5</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.totalReviews} avis
          </p>
        </CardContent>
      </Card>

      {/* Taux de complétion */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taux de complétion</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{completionRate}%</div>
          <div className="w-full bg-secondary rounded-full h-2 mt-2">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                completionRate >= 80 ? "bg-green-500" : completionRate >= 50 ? "bg-amber-500" : "bg-red-500"
              )}
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

/**
 * Liste des prochaines interventions
 */
interface UpcomingJob {
  id: string;
  title: string;
  propertyAddress: string;
  scheduledDate: string;
  scheduledTime?: string;
  status: "scheduled" | "confirmed" | "pending";
}

interface UpcomingJobsListProps {
  jobs: UpcomingJob[];
  className?: string;
}

export const UpcomingJobsList = memo(function UpcomingJobsList({
  jobs,
  className,
}: UpcomingJobsListProps) {
  if (jobs.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Prochaines interventions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Aucune intervention planifiée</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    scheduled: { label: "Planifiée", variant: "secondary" as const },
    confirmed: { label: "Confirmée", variant: "default" as const },
    pending: { label: "En attente", variant: "outline" as const },
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Prochaines interventions ({jobs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            className="flex items-start justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="space-y-1">
              <p className="font-medium text-sm">{job.title}</p>
              <p className="text-xs text-muted-foreground">{job.propertyAddress}</p>
              <div className="flex items-center gap-2 text-xs">
                <span>{job.scheduledDate}</span>
                {job.scheduledTime && (
                  <>
                    <span>•</span>
                    <span>{job.scheduledTime}</span>
                  </>
                )}
              </div>
            </div>
            <Badge variant={statusConfig[job.status].variant}>
              {statusConfig[job.status].label}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
});

/**
 * Alertes et notifications pour le prestataire
 */
interface ProviderAlert {
  id: string;
  type: "warning" | "info" | "success" | "urgent";
  message: string;
  action?: {
    label: string;
    href: string;
  };
}

interface ProviderAlertsProps {
  alerts: ProviderAlert[];
  className?: string;
}

export const ProviderAlerts = memo(function ProviderAlerts({
  alerts,
  className,
}: ProviderAlertsProps) {
  if (alerts.length === 0) return null;

  const typeConfig = {
    warning: { bg: "bg-amber-50 border-amber-200", icon: AlertCircle, iconColor: "text-amber-600" },
    info: { bg: "bg-blue-50 border-blue-200", icon: AlertCircle, iconColor: "text-blue-600" },
    success: { bg: "bg-green-50 border-green-200", icon: CheckCircle2, iconColor: "text-green-600" },
    urgent: { bg: "bg-red-50 border-red-200", icon: AlertCircle, iconColor: "text-red-600" },
  };

  return (
    <div className={cn("space-y-2", className)}>
      {alerts.map((alert) => {
        const config = typeConfig[alert.type];
        const Icon = config.icon;

        return (
          <div
            key={alert.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border",
              config.bg
            )}
          >
            <Icon className={cn("h-5 w-5 mt-0.5", config.iconColor)} />
            <div className="flex-1">
              <p className="text-sm">{alert.message}</p>
              {alert.action && (
                <a
                  href={alert.action.href}
                  className="text-sm font-medium text-primary hover:underline mt-1 inline-block"
                >
                  {alert.action.label} →
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default ProviderStatsCard;

