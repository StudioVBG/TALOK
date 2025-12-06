"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Calendar,
  PiggyBank,
  Receipt,
  CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadialProgress } from "@/components/ui/radial-progress";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { formatCurrency } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";

export interface OwnerFinancialMetrics {
  // Revenus
  totalRevenue: number;
  revenueGrowth: number;
  monthlyRevenue: number;
  averageRent: number;
  
  // Santé financière
  collectionRate: number;
  averagePaymentDelay: number;
  unpaidAmount: number;
  unpaidInvoices: number;
  
  // Dépôts
  totalDeposits: number;
  
  // Prédictions
  predictedRevenueNextMonth: number;
  riskScore: number;
  
  // Historique
  revenueHistory: { month: string; attendu: number; encaisse: number }[];
  
  // Répartition paiements
  paymentStats: {
    onTime: number;
    late: number;
    veryLate: number;
  };
}

interface OwnerFinancialDashboardProps {
  metrics: OwnerFinancialMetrics;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "default",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; direction: "up" | "down" };
  color?: "default" | "success" | "warning" | "danger";
}) {
  const colorClasses = {
    default: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    warning: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    danger: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <motion.div variants={itemVariants}>
      <Card className="border-0 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{title}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{value}</span>
                {trend && (
                  <span
                    className={cn(
                      "flex items-center text-xs font-medium",
                      trend.direction === "up" ? "text-emerald-600" : "text-red-600"
                    )}
                  >
                    {trend.direction === "up" ? (
                      <TrendingUp className="h-3 w-3 mr-0.5" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-0.5" />
                    )}
                    {trend.value > 0 ? "+" : ""}{trend.value}%
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
            <div className={cn("p-2.5 rounded-xl", colorClasses[color])}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PaymentHealthIndicator({ 
  onTime, 
  late, 
  veryLate 
}: { 
  onTime: number; 
  late: number; 
  veryLate: number;
}) {
  const total = onTime + late + veryLate;
  if (total === 0) return null;
  
  const onTimePercent = Math.round((onTime / total) * 100);
  const latePercent = Math.round((late / total) * 100);
  const veryLatePercent = Math.round((veryLate / total) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Répartition des paiements</span>
        <span className="font-medium">{total} paiements</span>
      </div>
      
      {/* Barre de progression segmentée */}
      <div className="h-3 rounded-full overflow-hidden flex bg-muted">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${onTimePercent}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="bg-emerald-500 h-full"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${latePercent}%` }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="bg-amber-500 h-full"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${veryLatePercent}%` }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="bg-red-500 h-full"
        />
      </div>
      
      {/* Légende */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">À temps</span>
          <span className="font-medium">{onTimePercent}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-muted-foreground">En retard</span>
          <span className="font-medium">{latePercent}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-muted-foreground">Impayé</span>
          <span className="font-medium">{veryLatePercent}%</span>
        </div>
      </div>
    </div>
  );
}

export function OwnerFinancialDashboard({ metrics, className }: OwnerFinancialDashboardProps) {
  const healthColor = 
    metrics.collectionRate >= 90 ? "success" : 
    metrics.collectionRate >= 70 ? "warning" : "destructive";

  const riskColor = 
    metrics.riskScore <= 30 ? "success" : 
    metrics.riskScore <= 60 ? "warning" : "destructive";

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn("space-y-6", className)}
    >
      {/* Header avec score de santé */}
      <Card className="border-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <PiggyBank className="h-5 w-5 text-primary" />
                Dashboard Financier
              </CardTitle>
              <CardDescription>
                Aperçu des performances financières
              </CardDescription>
            </div>
            <Badge 
              variant={metrics.riskScore <= 30 ? "default" : metrics.riskScore <= 60 ? "secondary" : "destructive"}
              className="px-3 py-1"
            >
              Risque: {metrics.riskScore <= 30 ? "Faible" : metrics.riskScore <= 60 ? "Modéré" : "Élevé"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Jauges de santé */}
            <div className="flex flex-col items-center justify-center p-4">
              <RadialProgress
                value={metrics.collectionRate}
                color={healthColor}
                size={100}
                label="Recouvrement"
              />
            </div>
            
            {/* Revenus mensuels */}
            <div className="flex flex-col justify-center">
              <p className="text-sm text-muted-foreground mb-1">Revenus mensuels</p>
              <p className="text-3xl font-bold text-primary">
                {formatCurrency(metrics.monthlyRevenue)}
              </p>
              {metrics.revenueGrowth !== 0 && (
                <p className={cn(
                  "text-sm flex items-center gap-1 mt-1",
                  metrics.revenueGrowth > 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {metrics.revenueGrowth > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {metrics.revenueGrowth > 0 ? "+" : ""}{metrics.revenueGrowth}% vs mois dernier
                </p>
              )}
            </div>
            
            {/* Impayés */}
            <div className="flex flex-col justify-center">
              <p className="text-sm text-muted-foreground mb-1">Impayés</p>
              <p className={cn(
                "text-3xl font-bold",
                metrics.unpaidAmount > 0 ? "text-red-600" : "text-emerald-600"
              )}>
                {formatCurrency(metrics.unpaidAmount)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {metrics.unpaidInvoices} facture{metrics.unpaidInvoices > 1 ? "s" : ""} en attente
              </p>
            </div>
            
            {/* Prédiction */}
            <div className="flex flex-col justify-center">
              <p className="text-sm text-muted-foreground mb-1">Prévision mois prochain</p>
              <p className="text-3xl font-bold text-purple-600">
                {formatCurrency(metrics.predictedRevenueNextMonth)}
              </p>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Estimation IA
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métriques détaillées */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Revenus totaux"
          value={formatCurrency(metrics.totalRevenue)}
          subtitle="Depuis le début"
          icon={DollarSign}
          color="success"
        />
        <MetricCard
          title="Loyer moyen"
          value={formatCurrency(metrics.averageRent)}
          subtitle="Par bien"
          icon={Receipt}
          color="default"
        />
        <MetricCard
          title="Délai moyen"
          value={`${metrics.averagePaymentDelay}j`}
          subtitle="Réception paiements"
          icon={Clock}
          color={metrics.averagePaymentDelay <= 5 ? "success" : metrics.averagePaymentDelay <= 10 ? "warning" : "danger"}
        />
        <MetricCard
          title="Dépôts de garantie"
          value={formatCurrency(metrics.totalDeposits)}
          subtitle="Total conservé"
          icon={CreditCard}
          color="default"
        />
      </div>

      {/* Graphique + Santé des paiements */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Graphique d'évolution */}
        <div className="lg:col-span-2">
          {metrics.revenueHistory.length > 0 && (
            <AreaChartCard
              data={metrics.revenueHistory}
              series={[
                { key: "attendu", name: "Loyers attendus", color: "hsl(217, 91%, 60%)" },
                { key: "encaisse", name: "Loyers encaissés", color: "hsl(142, 71%, 45%)" },
              ]}
              xAxisKey="month"
              title="Évolution des revenus"
              description="Comparaison loyers attendus vs encaissés sur 12 mois"
              height={280}
              valueFormatter={(v) => formatCurrency(v)}
            />
          )}
        </div>

        {/* Santé des paiements */}
        <Card className="border-0 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Santé des paiements</CardTitle>
            <CardDescription>Analyse des comportements de paiement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <PaymentHealthIndicator {...metrics.paymentStats} />
            
            {/* Indicateurs supplémentaires */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm">Paiements à temps</span>
                </div>
                <span className="font-medium">{metrics.paymentStats.onTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">Paiements en retard</span>
                </div>
                <span className="font-medium">{metrics.paymentStats.late}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Impayés</span>
                </div>
                <span className="font-medium text-red-600">{metrics.paymentStats.veryLate}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

// Données par défaut pour les tests
export const defaultFinancialMetrics: OwnerFinancialMetrics = {
  totalRevenue: 0,
  revenueGrowth: 0,
  monthlyRevenue: 0,
  averageRent: 0,
  collectionRate: 100,
  averagePaymentDelay: 0,
  unpaidAmount: 0,
  unpaidInvoices: 0,
  totalDeposits: 0,
  predictedRevenueNextMonth: 0,
  riskScore: 0,
  revenueHistory: [],
  paymentStats: { onTime: 0, late: 0, veryLate: 0 },
};

