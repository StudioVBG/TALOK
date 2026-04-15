"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Building2,
  DollarSign,
  FileText,
  FolderOpen,
  Home,
  ShieldCheck,
  Ticket,
  TrendingUp,
  Users,
  TrendingDown,
  UserPlus,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatsCardEnhanced } from "@/components/admin/stats-card-enhanced";
import { DonutChart } from "@/components/charts/donut-chart";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { BarChartHorizontal } from "@/components/charts/bar-chart-horizontal";
import { RadialProgress } from "@/components/ui/radial-progress";
import { SecondaryContentPanel } from "@/components/layout/secondary-content-panel";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { useAdminRealtimeSync } from "@/lib/hooks/use-realtime-sync";
import type { AdminStatsDataV2 } from "../_data/fetchAdminStats";

interface DashboardClientProps {
  stats: AdminStatsDataV2;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function DashboardClient({ stats }: DashboardClientProps) {
  useAdminRealtimeSync();

  const occupancyRate = stats.totalProperties > 0
    ? Math.round((stats.activeLeases / stats.totalProperties) * 100)
    : 0;

  const collectionRate = stats.totalInvoices > 0
    ? Math.round(((stats.totalInvoices - stats.unpaidInvoices) / stats.totalInvoices) * 100)
    : 100;

  const roleDistributionData = [
    { name: "Propriétaires", value: stats.usersByRole.owner, color: "hsl(217, 91%, 60%)" },
    { name: "Locataires", value: stats.usersByRole.tenant, color: "hsl(142, 71%, 45%)" },
    { name: "Prestataires", value: stats.usersByRole.provider, color: "hsl(38, 92%, 50%)" },
    { name: "Admins", value: stats.usersByRole.admin, color: "hsl(262, 83%, 58%)" },
  ];

  const leaseStatusData = [
    { name: "Actifs", value: stats.leasesByStatus.active || 0, color: "hsl(142, 71%, 45%)" },
    { name: "En attente", value: stats.leasesByStatus.pending_signature || 0, color: "hsl(38, 92%, 50%)" },
    { name: "Brouillons", value: stats.leasesByStatus.draft || 0, color: "hsl(215, 20%, 65%)" },
    { name: "Terminés", value: stats.leasesByStatus.terminated || 0, color: "hsl(0, 84%, 60%)" },
  ];

  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  const baseRevenue = stats.totalInvoices > 0 ? Math.round((stats.invoicesByStatus.paid || 0) * 1000) : 0;
  const revenueData = stats.monthlyRevenue && stats.monthlyRevenue.length > 0
    ? stats.monthlyRevenue
    : months.map((month) => ({
        month,
        attendu: baseRevenue,
        encaisse: Math.round((baseRevenue * collectionRate) / 100),
      }));

  const actionItems = [
    {
      id: "moderation-critical",
      title: "Cas critiques à modérer",
      description: "Traitez les contenus ou comptes sensibles en priorité.",
      count: stats.moderationCritical,
      href: "/admin/moderation",
      icon: AlertCircle,
      tone: "critical",
    },
    {
      id: "unpaid-invoices",
      title: "Factures en retard",
      description: "Vérifiez les impayés qui peuvent dégrader le recouvrement.",
      count: stats.invoicesByStatus.late || stats.unpaidInvoices,
      href: "/admin/accounting",
      icon: DollarSign,
      tone: "critical",
    },
    {
      id: "moderation-pending",
      title: "Éléments à modérer",
      description: "Traitez les files d'attente avant qu'elles ne grossissent.",
      count: stats.moderationPending,
      href: "/admin/moderation",
      icon: ShieldCheck,
      tone: "warning",
    },
    {
      id: "tickets-open",
      title: "Tickets ouverts",
      description: "Surveillez les demandes encore sans résolution.",
      count: stats.openTickets,
      href: "/admin/reports",
      icon: Ticket,
      tone: "warning",
    },
    {
      id: "leases-pending",
      title: "Baux en attente de signature",
      description: "Identifiez les contrats qui ralentissent l'activation des dossiers.",
      count: stats.leasesByStatus.pending_signature || 0,
      href: "/admin/reports",
      icon: FileText,
      tone: "info",
    },
  ].filter((item) => item.count > 0);

  const primaryAction = actionItems[0] ?? null;
  const secondaryActions = actionItems.slice(1, 4);

  return (
    <div className="space-y-8 p-2">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Centre d'action</h1>
        <p className="mt-1 text-muted-foreground">
          Commencez par les sujets bloquants, puis ouvrez les analyses utiles.
        </p>
      </motion.div>

      {primaryAction ? (
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
        >
          <Card className="border-0 bg-slate-950 text-white shadow-xl">
            <CardContent className="flex h-full flex-col justify-between gap-6 p-6">
              <div className="space-y-3">
                <Badge variant="secondary" className="w-fit bg-white/10 text-white">
                  À traiter maintenant
                </Badge>
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <primaryAction.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{primaryAction.title}</h2>
                    <p className="mt-1 text-sm text-slate-300">{primaryAction.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Volume</p>
                  <p className="text-5xl font-black">{primaryAction.count}</p>
                </div>
                <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                  <Link href={primaryAction.href}>
                    Ouvrir le sujet
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {secondaryActions.length > 0 ? secondaryActions.map((action) => (
              <Card key={action.id} className="border-border bg-card">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-muted p-2">
                      <action.icon className="h-5 w-5 text-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{action.title}</p>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground">{action.count}</p>
                    <Button variant="link" asChild className="h-auto px-0">
                      <Link href={action.href}>Traiter</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className="border-border bg-card">
                <CardContent className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                  Aucun sujet bloquant immédiat. Vous pouvez passer aux analyses.
                </CardContent>
              </Card>
            )}
          </div>
        </motion.section>
      ) : null}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={itemVariants}>
          <StatsCardEnhanced
            title="Utilisateurs"
            value={stats.totalUsers}
            icon={Users}
            color="primary"
            description={`${stats.usersByRole.owner} propriétaires, ${stats.usersByRole.tenant} locataires`}
            delay={0}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCardEnhanced
            title="Logements"
            value={stats.totalProperties}
            icon={Home}
            color="success"
            description="Total des biens enregistrés"
            delay={1}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCardEnhanced
            title="Baux actifs"
            value={stats.activeLeases}
            icon={FileText}
            color="info"
            description={`Sur ${stats.totalLeases} baux au total`}
            delay={2}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCardEnhanced
            title="Tickets ouverts"
            value={stats.openTickets}
            icon={Ticket}
            color={stats.openTickets > 10 ? "warning" : "primary"}
            description={`Sur ${stats.totalTickets} tickets au total`}
            delay={3}
          />
        </motion.div>
      </motion.div>

      {/* KPIs revenue/churn */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={itemVariants}>
          <StatsCardEnhanced
            title="MRR"
            value={formatCurrency((stats.mrr || 0) / 100)}
            icon={Wallet}
            color="success"
            description={`${stats.subscriptionStats.active} abonnements actifs`}
            delay={0}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCardEnhanced
            title="Churn (30j)"
            value={`${stats.churnRate || 0}%`}
            icon={TrendingDown}
            color={stats.churnRate > 5 ? "warning" : "success"}
            description={`${stats.subscriptionStats.churned} annulations`}
            delay={1}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCardEnhanced
            title="Inscriptions (7j)"
            value={stats.newUsersThisWeek || 0}
            icon={UserPlus}
            color="primary"
            description={`${stats.newUsersThisMonth} ce mois-ci`}
            delay={2}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <StatsCardEnhanced
            title="Essais en cours"
            value={stats.subscriptionStats.trial}
            icon={TrendingUp}
            color="info"
            description="Periodes d'essai actives"
            delay={3}
          />
        </motion.div>
      </motion.div>

      {/* Revenue by plan */}
      {stats.revenueByPlan && stats.revenueByPlan.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                MRR par plan
              </CardTitle>
              <CardDescription>
                Repartition du revenu mensuel recurrent par forfait
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.revenueByPlan.map((p) => {
                  const maxMrr = Math.max(...stats.revenueByPlan.map((x) => x.mrr));
                  const pct = maxMrr > 0 ? (p.mrr / maxMrr) * 100 : 0;
                  return (
                    <div key={p.plan} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{p.plan}</span>
                        <span className="text-muted-foreground">
                          {formatCurrency(p.mrr / 100)} · {p.subscribers} abonne{p.subscribers > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Card className="border-border bg-card/80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Activité récente</CardTitle>
                <CardDescription>Ce qui s'est passé récemment sur la plateforme</CardDescription>
              </div>
              <Badge variant="secondary" className="px-3">
                {stats.recentActivity.length} événements
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <FolderOpen className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p>Aucune activité récente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.slice(0, 8).map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + index * 0.05 }}
                    className="group flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        p-2 rounded-lg transition-transform group-hover:scale-110
                        ${activity.type === "user" ? "bg-blue-500/10" : ""}
                        ${activity.type === "property" ? "bg-emerald-500/10" : ""}
                        ${activity.type === "lease" ? "bg-purple-500/10" : ""}
                        ${activity.type === "payment" ? "bg-amber-500/10" : ""}
                        ${!["user", "property", "lease", "payment"].includes(activity.type) ? "bg-muted" : ""}
                      `}>
                        {activity.type === "user" ? <Users className="h-4 w-4 text-blue-600" /> : null}
                        {activity.type === "property" ? <Building2 className="h-4 w-4 text-emerald-600" /> : null}
                        {activity.type === "lease" ? <FileText className="h-4 w-4 text-purple-600" /> : null}
                        {activity.type === "payment" ? <DollarSign className="h-4 w-4 text-amber-600" /> : null}
                        {!["user", "property", "lease", "payment"].includes(activity.type) ? (
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        ) : null}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDateShort(activity.date)}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="capitalize text-xs">
                      {activity.type}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <SecondaryContentPanel
        title="Analyses et tendances"
        description="Ouvrez les volumes, répartitions et indicateurs détaillés seulement quand vous en avez besoin."
        contentClassName="space-y-6"
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <motion.div
            className="lg:col-span-8"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
          >
            <AreaChartCard
              title="Évolution des revenus"
              description="Loyers attendus vs encaissés sur 12 mois"
              data={revenueData}
              series={[
                { key: "attendu", name: "Loyers attendus", color: "hsl(217, 91%, 60%)" },
                { key: "encaisse", name: "Loyers encaissés", color: "hsl(142, 71%, 45%)" },
              ]}
              xAxisKey="month"
              height={320}
              valueFormatter={(value) => formatCurrency(value)}
            />
          </motion.div>

          <motion.div
            className="lg:col-span-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.55 }}
          >
            <Card className="h-full border-border bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Performance</CardTitle>
                <CardDescription>Indicateurs clés de santé</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center gap-8 py-6">
                <RadialProgress
                  value={occupancyRate}
                  color={occupancyRate >= 75 ? "success" : occupancyRate >= 50 ? "warning" : "destructive"}
                  label="Occupation"
                  size={130}
                />
                <RadialProgress
                  value={collectionRate}
                  color={collectionRate >= 90 ? "success" : collectionRate >= 70 ? "warning" : "destructive"}
                  label="Recouvrement"
                  size={130}
                />
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <DonutChart
            data={roleDistributionData}
            title="Répartition des utilisateurs"
            centerValue={stats.totalUsers}
            centerLabel="Total"
          />

          <BarChartHorizontal
            data={leaseStatusData}
            title="Baux par statut"
            description="Répartition des contrats"
            height={280}
          />

          <Card className="h-full border-border bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Facturation</CardTitle>
              <CardDescription>État des factures</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Payées</p>
                    <p className="text-xs text-muted-foreground">Ce mois</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-emerald-600">{stats.invoicesByStatus.paid || 0}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-amber-500/10 p-2">
                    <FileText className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">En attente</p>
                    <p className="text-xs text-muted-foreground">Envoyées</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-amber-600">{stats.invoicesByStatus.sent || 0}</span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-red-500/10 p-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">En retard</p>
                    <p className="text-xs text-muted-foreground">Impayées</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-red-600">{stats.invoicesByStatus.late || 0}</span>
              </div>

              <div className="border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total factures</span>
                  <span className="font-semibold">{stats.totalInvoices}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-muted/30 p-4 text-center">
            <FolderOpen className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-2xl font-bold">{stats.totalDocuments}</p>
            <p className="text-xs text-muted-foreground">Documents</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-4 text-center">
            <BookOpen className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-2xl font-bold">{stats.publishedBlogPosts}</p>
            <p className="text-xs text-muted-foreground">Articles publiés</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-4 text-center">
            <Building2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-2xl font-bold">{stats.usersByRole.provider}</p>
            <p className="text-xs text-muted-foreground">Prestataires</p>
          </div>
          <div className="rounded-xl bg-muted/30 p-4 text-center">
            <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-2xl font-bold">{stats.usersByRole.admin}</p>
            <p className="text-xs text-muted-foreground">Administrateurs</p>
          </div>
        </div>
      </SecondaryContentPanel>
    </div>
  );
}
