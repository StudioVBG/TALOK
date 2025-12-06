"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  AlertCircle,
  Lightbulb,
  ChevronRight,
  RefreshCw,
  Bot,
  Zap,
  Target,
  Shield,
  Brain,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type InsightType = "warning" | "opportunity" | "alert" | "suggestion" | "success";
export type InsightPriority = "low" | "medium" | "high" | "critical";

export interface AIInsight {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  confidence: number; // 0-100
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  metadata?: Record<string, any>;
  createdAt: string;
}

interface AICopilotPanelProps {
  insights: AIInsight[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onInsightAction?: (insight: AIInsight) => void;
  className?: string;
}

const insightConfig: Record<InsightType, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  warning: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  opportunity: {
    icon: TrendingUp,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    borderColor: "border-emerald-200 dark:border-emerald-800",
  },
  alert: {
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-900/20",
    borderColor: "border-red-200 dark:border-red-800",
  },
  suggestion: {
    icon: Lightbulb,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  success: {
    icon: Zap,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
};

const priorityConfig: Record<InsightPriority, { label: string; color: string }> = {
  low: { label: "Faible", color: "bg-slate-100 text-slate-600" },
  medium: { label: "Moyen", color: "bg-blue-100 text-blue-600" },
  high: { label: "Élevé", color: "bg-amber-100 text-amber-600" },
  critical: { label: "Critique", color: "bg-red-100 text-red-600" },
};

function InsightCard({ 
  insight, 
  index,
  onAction 
}: { 
  insight: AIInsight; 
  index: number;
  onAction?: (insight: AIInsight) => void;
}) {
  const config = insightConfig[insight.type];
  const priority = priorityConfig[insight.priority];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
    >
      <Card className={cn(
        "border transition-all duration-300 hover:shadow-md group cursor-pointer",
        config.bgColor,
        config.borderColor
      )}>
        <CardContent className="p-4">
          <div className="flex gap-3">
            {/* Icon */}
            <div className={cn(
              "flex-shrink-0 p-2 rounded-lg bg-white/60 dark:bg-slate-900/40",
              "group-hover:scale-110 transition-transform"
            )}>
              <Icon className={cn("h-5 w-5", config.color)} />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h4 className="font-semibold text-sm line-clamp-1">{insight.title}</h4>
                <Badge variant="secondary" className={cn("text-xs flex-shrink-0", priority.color)}>
                  {priority.label}
                </Badge>
              </div>
              
              <p 
                className="text-sm text-muted-foreground mb-3"
                title={insight.description}
              >
                {insight.description}
              </p>
              
              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* Confidence */}
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${insight.confidence}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
                        className={cn(
                          "h-full rounded-full",
                          insight.confidence >= 80 ? "bg-emerald-500" :
                          insight.confidence >= 60 ? "bg-blue-500" : "bg-amber-500"
                        )}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {insight.confidence}%
                    </span>
                  </div>
                </div>
                
                {insight.action && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 hover:bg-white/50 dark:hover:bg-slate-800/50"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (insight.action?.onClick) {
                        insight.action.onClick();
                      }
                      onAction?.(insight);
                    }}
                  >
                    {insight.action.label}
                    <ArrowUpRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-0 bg-muted/30">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center py-8"
    >
      <div className="inline-flex p-4 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
        <Shield className="h-8 w-8 text-emerald-600" />
      </div>
      <h4 className="font-semibold mb-1">Tout est en ordre ! 🎉</h4>
      <p className="text-sm text-muted-foreground">
        Aucune recommandation pour le moment.<br />
        Ce propriétaire a une excellente gestion.
      </p>
    </motion.div>
  );
}

export function AICopilotPanel({
  insights,
  isLoading = false,
  onRefresh,
  onInsightAction,
  className,
}: AICopilotPanelProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Trier par priorité
  const sortedInsights = React.useMemo(() => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...insights].sort((a, b) => 
      priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }, [insights]);

  // Compter par type
  const insightCounts = React.useMemo(() => {
    return insights.reduce((acc, insight) => {
      acc[insight.type] = (acc[insight.type] || 0) + 1;
      return acc;
    }, {} as Record<InsightType, number>);
  }, [insights]);

  return (
    <Card className={cn(
      "border-0 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-fuchsia-500/5",
      "backdrop-blur-sm overflow-hidden",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"
              />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                AI Copilot
                <Badge variant="secondary" className="text-xs bg-gradient-to-r from-violet-100 to-purple-100 text-purple-700">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Beta
                </Badge>
              </CardTitle>
              <CardDescription>
                Analyse intelligente et recommandations
              </CardDescription>
            </div>
          </div>
          
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="gap-2"
            >
              <RefreshCw className={cn(
                "h-4 w-4",
                (isRefreshing || isLoading) && "animate-spin"
              )} />
              Actualiser
            </Button>
          )}
        </div>
        
        {/* Stats rapides */}
        {!isLoading && insights.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {Object.entries(insightCounts).map(([type, count]) => {
              const config = insightConfig[type as InsightType];
              const Icon = config.icon;
              return (
                <Badge
                  key={type}
                  variant="outline"
                  className={cn("gap-1", config.bgColor, config.borderColor)}
                >
                  <Icon className={cn("h-3 w-3", config.color)} />
                  {count}
                </Badge>
              );
            })}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-3">
        {isLoading ? (
          <LoadingSkeleton />
        ) : sortedInsights.length === 0 ? (
          <EmptyState />
        ) : (
          <AnimatePresence mode="popLayout">
            {sortedInsights.map((insight, index) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                index={index}
                onAction={onInsightAction}
              />
            ))}
          </AnimatePresence>
        )}
        
        {/* Footer avec info */}
        {!isLoading && insights.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="pt-3 border-t border-dashed flex items-center justify-center gap-2 text-xs text-muted-foreground"
          >
            <Brain className="h-3 w-3" />
            Analyse basée sur l'historique et les tendances
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

// Fonction utilitaire pour générer des insights à partir des données propriétaire
export function generateOwnerInsights(ownerData: {
  occupancyRate: number;
  unpaidAmount: number;
  unpaidInvoices: number;
  monthlyRevenue: number;
  averagePaymentDelay: number;
  propertiesCount: number;
  vacantProperties: number;
  activeLeases: number;
  ticketsOpen: number;
}): AIInsight[] {
  const insights: AIInsight[] = [];
  const now = new Date().toISOString();

  // Taux d'occupation bas
  if (ownerData.occupancyRate < 70 && ownerData.vacantProperties > 0) {
    insights.push({
      id: "occupancy-low",
      type: "warning",
      priority: ownerData.occupancyRate < 50 ? "high" : "medium",
      title: "Taux d'occupation bas",
      description: `${ownerData.vacantProperties} bien(s) vacant(s) depuis plus de 30 jours. Suggérer une révision des loyers ou une amélioration des annonces.`,
      confidence: 88,
      action: { label: "Voir les biens vacants" },
      createdAt: now,
    });
  }

  // Impayés
  if (ownerData.unpaidAmount > 0) {
    const priority = ownerData.unpaidInvoices >= 3 ? "critical" : 
                    ownerData.unpaidInvoices >= 2 ? "high" : "medium";
    insights.push({
      id: "unpaid-invoices",
      type: "alert",
      priority,
      title: `${ownerData.unpaidInvoices} facture(s) impayée(s)`,
      description: `Montant total impayé: ${ownerData.unpaidAmount.toLocaleString("fr-FR")}€. Action urgente recommandée pour éviter l'accumulation.`,
      confidence: 100,
      action: { label: "Voir les impayés" },
      createdAt: now,
    });
  }

  // Potentiel d'upsell
  if (ownerData.monthlyRevenue > 5000 && ownerData.propertiesCount >= 3) {
    insights.push({
      id: "upsell-potential",
      type: "opportunity",
      priority: "medium",
      title: "Potentiel d'upsell détecté",
      description: `Revenus > 5000€/mois avec ${ownerData.propertiesCount} biens. Éligible au plan Premium avec gestion comptable automatisée.`,
      confidence: 85,
      action: { label: "Proposer upgrade" },
      createdAt: now,
    });
  }

  // Délai de paiement élevé
  if (ownerData.averagePaymentDelay > 10) {
    insights.push({
      id: "payment-delay",
      type: "suggestion",
      priority: "low",
      title: "Délais de paiement élevés",
      description: `Délai moyen de ${ownerData.averagePaymentDelay} jours. Suggérer l'activation du prélèvement automatique aux locataires.`,
      confidence: 75,
      action: { label: "Activer prélèvement auto" },
      createdAt: now,
    });
  }

  // Tickets ouverts
  if (ownerData.ticketsOpen > 3) {
    insights.push({
      id: "tickets-pending",
      type: "warning",
      priority: ownerData.ticketsOpen > 5 ? "high" : "medium",
      title: `${ownerData.ticketsOpen} tickets en attente`,
      description: "Plusieurs demandes de maintenance non traitées. Cela peut impacter la satisfaction des locataires.",
      confidence: 92,
      action: { label: "Voir les tickets" },
      createdAt: now,
    });
  }

  // Bonne gestion
  if (insights.length === 0 && ownerData.occupancyRate >= 90 && ownerData.unpaidAmount === 0) {
    insights.push({
      id: "excellent-management",
      type: "success",
      priority: "low",
      title: "Excellente gestion !",
      description: "Ce propriétaire maintient un taux d'occupation élevé et n'a aucun impayé. Profil exemplaire.",
      confidence: 95,
      createdAt: now,
    });
  }

  return insights;
}

