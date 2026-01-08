"use client";

/**
 * Widget Alertes Intelligentes
 * 
 * Affiche des alertes contextuelles basées sur:
 * - Loyers impayés depuis X jours
 * - Documents manquants
 * - Baux expirant bientôt
 * - Actions recommandées
 */

import { useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Euro,
  FileText,
  Shield,
  TrendingUp,
  X,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/helpers/format";

type AlertType = 
  | "unpaid_rent"
  | "missing_document"
  | "lease_expiring"
  | "insurance_expiring"
  | "irl_available"
  | "recommendation"
  | "warning"
  | "info";

type AlertPriority = "critical" | "high" | "medium" | "low";

interface SmartAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  action?: {
    label: string;
    href: string;
  };
  dismissible?: boolean;
  metadata?: Record<string, any>;
}

interface SmartAlertsWidgetProps {
  alerts: SmartAlert[];
  onDismiss?: (alertId: string) => void;
  className?: string;
}

const alertIcons: Record<AlertType, typeof AlertTriangle> = {
  unpaid_rent: Euro,
  missing_document: FileText,
  lease_expiring: Clock,
  insurance_expiring: Shield,
  irl_available: TrendingUp,
  recommendation: Sparkles,
  warning: AlertTriangle,
  info: Info,
};

const alertStyles: Record<AlertPriority, { bg: string; border: string; icon: string }> = {
  critical: {
    bg: "bg-red-50",
    border: "border-red-200",
    icon: "text-red-600",
  },
  high: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    icon: "text-orange-600",
  },
  medium: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "text-amber-600",
  },
  low: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "text-blue-600",
  },
};

const priorityOrder: Record<AlertPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function AlertItem({
  alert,
  onDismiss,
  index,
}: {
  alert: SmartAlert;
  onDismiss?: (id: string) => void;
  index: number;
}) {
  const Icon = alertIcons[alert.type];
  const styles = alertStyles[alert.priority];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, height: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "relative p-4 rounded-lg border",
        styles.bg,
        styles.border
      )}
    >
      <div className="flex gap-3">
        <div className={cn("shrink-0 mt-0.5", styles.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm text-slate-900">
                {alert.title}
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
                {alert.message}
              </p>
            </div>
            {alert.dismissible && onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mt-1 -mr-1 shrink-0"
                onClick={() => onDismiss(alert.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {alert.action && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 mt-2"
              asChild
            >
              <Link href={alert.action.href}>
                {alert.action.label}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          )}
        </div>
      </div>
      
      {/* Indicateur de priorité */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-lg",
          alert.priority === "critical" && "bg-red-500",
          alert.priority === "high" && "bg-orange-500",
          alert.priority === "medium" && "bg-amber-500",
          alert.priority === "low" && "bg-blue-500"
        )}
      />
    </motion.div>
  );
}

export function SmartAlertsWidget({ alerts, onDismiss, className }: SmartAlertsWidgetProps) {
  // Trier par priorité
  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [alerts]);

  // Compter par priorité
  const counts = useMemo(() => {
    return {
      critical: alerts.filter((a) => a.priority === "critical").length,
      high: alerts.filter((a) => a.priority === "high").length,
      total: alerts.length,
    };
  }, [alerts]);

  if (alerts.length === 0) {
    return (
      <Card className={cn("h-full", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-lg">Tout va bien !</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-4 rounded-full bg-emerald-100 mb-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <p className="text-slate-600 font-medium">Aucune alerte</p>
            <p className="text-sm text-muted-foreground mt-1">
              Votre gestion locative est à jour
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Alertes & Actions</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {counts.critical > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {counts.critical} critique{counts.critical > 1 ? "s" : ""}
              </Badge>
            )}
            {counts.high > 0 && (
              <Badge className="bg-orange-500 hover:bg-orange-500/90">
                {counts.high} importante{counts.high > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          {counts.total} action{counts.total > 1 ? "s" : ""} requise{counts.total > 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sortedAlerts.map((alert, index) => (
              <AlertItem
                key={alert.id}
                alert={alert}
                onDismiss={onDismiss}
                index={index}
              />
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Génère les alertes automatiques basées sur les données
 */
export function generateSmartAlerts(params: {
  unpaidInvoices: Array<{ id: string; amount: number; daysLate: number; tenantName: string }>;
  expiringLeases: Array<{ id: string; address: string; daysUntilExpiry: number }>;
  missingDocuments: Array<{ type: string; property: string }>;
  pendingIRL: Array<{ leaseId: string; address: string; increase: number }>;
}): SmartAlert[] {
  const alerts: SmartAlert[] = [];

  // Alertes loyers impayés
  for (const invoice of params.unpaidInvoices) {
    alerts.push({
      id: `unpaid-${invoice.id}`,
      type: "unpaid_rent",
      priority: invoice.daysLate > 30 ? "critical" : invoice.daysLate > 15 ? "high" : "medium",
      title: `Loyer impayé - ${invoice.tenantName}`,
      message: `${formatCurrency(invoice.amount)} en retard de ${invoice.daysLate} jours`,
      action: {
        label: "Gérer l'impayé",
        href: `/owner/money?invoice=${invoice.id}`,
      },
    });
  }

  // Alertes baux expirants
  for (const lease of params.expiringLeases) {
    alerts.push({
      id: `lease-expiring-${lease.id}`,
      type: "lease_expiring",
      priority: lease.daysUntilExpiry <= 30 ? "high" : "medium",
      title: "Bail arrivant à échéance",
      message: `${lease.address} - expire dans ${lease.daysUntilExpiry} jours`,
      action: {
        label: "Gérer la fin de bail",
        href: `/owner/end-of-lease/${lease.id}`,
      },
    });
  }

  // Alertes documents manquants
  for (const doc of params.missingDocuments) {
    alerts.push({
      id: `missing-doc-${doc.type}-${doc.property}`,
      type: "missing_document",
      priority: "medium",
      title: `Document manquant`,
      message: `${doc.type} - ${doc.property}`,
      action: {
        label: "Ajouter le document",
        href: "/owner/documents/upload",
      },
      dismissible: true,
    });
  }

  // Alertes révision IRL disponible
  for (const irl of params.pendingIRL) {
    alerts.push({
      id: `irl-${irl.leaseId}`,
      type: "irl_available",
      priority: "low",
      title: "Révision de loyer disponible",
      message: `${irl.address} - +${irl.increase.toFixed(2)}€/mois possible`,
      action: {
        label: "Appliquer la révision",
        href: `/owner/leases/${irl.leaseId}/revision`,
      },
      dismissible: true,
    });
  }

  return alerts;
}

