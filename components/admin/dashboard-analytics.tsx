"use client";

import { motion } from "framer-motion";
import { useAdminMetrics } from "@/lib/hooks/use-admin-queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { BarChartHorizontal } from "@/components/charts/bar-chart-horizontal";
import { RadialProgress } from "@/components/ui/radial-progress";
import { Users, DollarSign, TrendingUp, ArrowUpRight, Ticket } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";

export function DashboardAnalytics() {
  const { data, isLoading } = useAdminMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Skeleton className="lg:col-span-8 h-80 rounded-xl" />
        <Skeleton className="lg:col-span-4 h-80 rounded-xl" />
        <Skeleton className="lg:col-span-6 h-72 rounded-xl" />
        <Skeleton className="lg:col-span-6 h-72 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const signupRoleData = Object.entries(data.signupsByRole).map(([role, count]) => ({
    name:
      role === "owner" ? "Propriétaires"
      : role === "tenant" ? "Locataires"
      : role === "provider" ? "Prestataires"
      : role,
    value: count,
    color:
      role === "owner" ? "hsl(217, 91%, 60%)"
      : role === "tenant" ? "hsl(142, 71%, 45%)"
      : role === "provider" ? "hsl(38, 92%, 50%)"
      : "hsl(215, 20%, 65%)",
  }));

  const dailySignups = Object.entries(data.signupsByDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, count]) => ({
      jour: day.slice(5),
      inscriptions: count,
    }));

  const avgDailySignups =
    Object.keys(data.signupsByDay).length > 0
      ? Math.round(
          Object.values(data.signupsByDay).reduce((a, b) => a + b, 0) /
            Object.keys(data.signupsByDay).length
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <motion.div
          className="lg:col-span-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
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
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Conversion</CardTitle>
              <CardDescription>Gratuit vers payant</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-6 py-6">
              <RadialProgress
                value={data.conversionRate}
                color={
                  data.conversionRate >= 15 ? "success"
                  : data.conversionRate >= 5 ? "warning"
                  : "destructive"
                }
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <BarChartHorizontal
            data={signupRoleData}
            title="Inscriptions 30j par rôle"
            description="Nouveaux comptes par type"
            height={280}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Indicateurs clés</CardTitle>
              <CardDescription>Santé de la plateforme</CardDescription>
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
                <span className="text-xl font-bold">{avgDailySignups}</span>
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

      {dailySignups.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
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
