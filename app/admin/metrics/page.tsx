"use client";

import { motion } from "framer-motion";
import { useAdminMetrics } from "@/lib/hooks/use-admin-queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChartHorizontal } from "@/components/charts/bar-chart-horizontal";
import { RadialProgress } from "@/components/ui/radial-progress";
import {
  RefreshCw,
  Users,
  Building2,
  FileText,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Ticket,
} from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";

export default function AdminMetricsPage() {
  const { data, isLoading, refetch } = useAdminMetrics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Erreur lors du chargement des metriques.
      </div>
    );
  }

  const roleDistribution = Object.entries(data.totalByRole).map(([role, count]) => ({
    name: role === "owner" ? "Proprietaires"
      : role === "tenant" ? "Locataires"
      : role === "provider" ? "Prestataires"
      : role === "admin" ? "Admins"
      : role,
    value: count,
    color: role === "owner" ? "hsl(217, 91%, 60%)"
      : role === "tenant" ? "hsl(142, 71%, 45%)"
      : role === "provider" ? "hsl(38, 92%, 50%)"
      : role === "admin" ? "hsl(262, 83%, 58%)"
      : "hsl(215, 20%, 65%)",
  }));

  const signupRoleData = Object.entries(data.signupsByRole).map(([role, count]) => ({
    name: role === "owner" ? "Proprietaires"
      : role === "tenant" ? "Locataires"
      : role === "provider" ? "Prestataires"
      : role,
    value: count,
    color: role === "owner" ? "hsl(217, 91%, 60%)"
      : role === "tenant" ? "hsl(142, 71%, 45%)"
      : role === "provider" ? "hsl(38, 92%, 50%)"
      : "hsl(215, 20%, 65%)",
  }));

  // Daily signups chart data
  const dailySignups = Object.entries(data.signupsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({
      jour: day.slice(5), // "MM-DD"
      inscriptions: count,
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Metriques</h1>
          <p className="text-muted-foreground">
            Indicateurs de performance et tendances de la plateforme
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Utilisateurs</p>
                <p className="text-3xl font-bold mt-1">{data.totalUsers}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.payingUsers} payants ({data.conversionRate}%)
                </p>
              </div>
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-500/20">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Biens (30j)</p>
                <p className="text-3xl font-bold mt-1">{data.newProperties}</p>
                <p className="text-xs text-muted-foreground mt-1">nouveaux ce mois</p>
              </div>
              <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-500/20">
                <Building2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Baux actifs</p>
                <p className="text-3xl font-bold mt-1">{data.activeLeases}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  sur {data.totalLeases} au total
                </p>
              </div>
              <div className="p-3 rounded-lg bg-violet-100 dark:bg-violet-500/20">
                <FileText className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paiements (30j)</p>
                <p className="text-3xl font-bold mt-1">
                  {formatCurrency(data.paymentStats.paid_volume)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.paymentStats.paid_count} paiements encaisses
                </p>
              </div>
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-500/20">
                <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.div
          className="lg:col-span-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AreaChartCard
            title="Inscriptions par mois"
            description="Nouveaux utilisateurs sur les 12 derniers mois"
            data={data.signupsChart}
            series={[
              { key: "inscriptions", name: "Inscriptions", color: "hsl(217, 91%, 60%)" },
            ]}
            xAxisKey="month"
            height={320}
          />
        </motion.div>

        <motion.div
          className="lg:col-span-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Conversion</CardTitle>
              <CardDescription>Gratuit vers payant</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-6 py-6">
              <RadialProgress
                value={data.conversionRate}
                color={data.conversionRate >= 15 ? "success" : data.conversionRate >= 5 ? "warning" : "destructive"}
                label="Conversion"
                size={140}
              />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {data.payingUsers} payants / {data.totalUsers} total
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <DonutChart
            data={roleDistribution}
            title="Utilisateurs par role"
            centerValue={data.totalUsers}
            centerLabel="Total"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <BarChartHorizontal
            data={signupRoleData}
            title="Inscriptions 30j par role"
            description="Nouveaux comptes par type"
            height={280}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Indicateurs cles</CardTitle>
              <CardDescription>Sante de la plateforme</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Inscriptions/jour</p>
                    <p className="text-xs text-muted-foreground">Moyenne 30j</p>
                  </div>
                </div>
                <span className="text-xl font-bold">
                  {Object.keys(data.signupsByDay).length > 0
                    ? Math.round(
                        Object.values(data.signupsByDay).reduce((a, b) => a + b, 0) /
                          Object.keys(data.signupsByDay).length
                      )
                    : 0}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Volume paiements</p>
                    <p className="text-xs text-muted-foreground">30 derniers jours</p>
                  </div>
                </div>
                <span className="text-xl font-bold">
                  {formatCurrency(data.paymentStats.total_volume)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-500/10 p-2">
                    <Ticket className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Tickets ouverts</p>
                    <p className="text-xs text-muted-foreground">Support en cours</p>
                  </div>
                </div>
                <span className="text-xl font-bold">{data.openTickets}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-violet-500/10 p-2">
                    <TrendingUp className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Taux conversion</p>
                    <p className="text-xs text-muted-foreground">Gratuit vers payant</p>
                  </div>
                </div>
                <span className="text-xl font-bold flex items-center gap-1">
                  {data.conversionRate}%
                  <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Daily signups chart */}
      {dailySignups.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <AreaChartCard
            title="Inscriptions quotidiennes (30 jours)"
            description="Tendance des nouvelles inscriptions"
            data={dailySignups}
            series={[
              { key: "inscriptions", name: "Inscriptions", color: "hsl(142, 71%, 45%)" },
            ]}
            xAxisKey="jour"
            height={280}
          />
        </motion.div>
      )}
    </div>
  );
}
