"use client";
// @ts-nocheck

import { motion } from "framer-motion";
import {
  Users,
  Home,
  FileText,
  Ticket,
  DollarSign,
  FolderOpen,
  BookOpen,
  TrendingUp,
  Building2,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatsCardEnhanced } from "@/components/admin/stats-card-enhanced";
import { DonutChart } from "@/components/charts/donut-chart";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { BarChartHorizontal } from "@/components/charts/bar-chart-horizontal";
import { RadialProgress } from "@/components/ui/radial-progress";
import { formatDateShort, formatCurrency } from "@/lib/helpers/format";
import type { AdminStatsData } from "../_data/fetchAdminStats";

interface DashboardClientProps {
  stats: AdminStatsData;
}

// Animation variants
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

// Données simulées pour les graphiques (à remplacer par données réelles)
function generateMonthlyData(baseValue: number) {
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  return months.map((month, i) => ({
    month,
    attendu: Math.round(baseValue * (0.9 + Math.random() * 0.2)),
    encaisse: Math.round(baseValue * (0.85 + Math.random() * 0.15)),
  }));
}

function generateSparklineData(count: number = 7) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 50) + 20);
}

export function DashboardClient({ stats }: DashboardClientProps) {
  // Calculs des métriques
  const occupancyRate = stats.totalProperties > 0
    ? Math.round((stats.activeLeases / stats.totalProperties) * 100)
    : 0;

  const collectionRate = stats.totalInvoices > 0
    ? Math.round(((stats.totalInvoices - stats.unpaidInvoices) / stats.totalInvoices) * 100)
    : 100;

  // Données pour le donut chart des rôles
  const roleDistributionData = [
    { name: "Propriétaires", value: stats.usersByRole.owner, color: "hsl(217, 91%, 60%)" },
    { name: "Locataires", value: stats.usersByRole.tenant, color: "hsl(142, 71%, 45%)" },
    { name: "Prestataires", value: stats.usersByRole.provider, color: "hsl(38, 92%, 50%)" },
    { name: "Admins", value: stats.usersByRole.admin, color: "hsl(262, 83%, 58%)" },
  ];

  // Données pour le bar chart des baux
  const leaseStatusData = [
    { name: "Actifs", value: stats.leasesByStatus.active || 0, color: "hsl(142, 71%, 45%)" },
    { name: "En attente", value: stats.leasesByStatus.pending_signature || 0, color: "hsl(38, 92%, 50%)" },
    { name: "Brouillons", value: stats.leasesByStatus.draft || 0, color: "hsl(215, 20%, 65%)" },
    { name: "Terminés", value: stats.leasesByStatus.terminated || 0, color: "hsl(0, 84%, 60%)" },
  ];

  // Données pour le graphique d'évolution
  const revenueData = generateMonthlyData(15000);

  return (
    <div className="space-y-8 p-2">
      {/* Header avec titre animé */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground mt-1">
          Vue d'ensemble de la plateforme de gestion locative
        </p>
      </motion.div>

      {/* KPI Cards avec Sparklines */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={itemVariants}>
          <StatsCardEnhanced
            title="Utilisateurs"
            value={stats.totalUsers}
            trend={{ value: 12, direction: "up" }}
            sparklineData={generateSparklineData()}
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
            trend={{ value: 5, direction: "up" }}
            sparklineData={generateSparklineData()}
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
            trend={{ value: 3, direction: "up" }}
            sparklineData={generateSparklineData()}
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
            trend={{ 
              value: stats.openTickets > 5 ? 8 : -5, 
              direction: stats.openTickets > 5 ? "up" : "down" 
            }}
            sparklineData={generateSparklineData()}
            icon={Ticket}
            color={stats.openTickets > 10 ? "warning" : "primary"}
            description={`Sur ${stats.totalTickets} tickets total`}
            delay={3}
          />
        </motion.div>
      </motion.div>

      {/* Section Graphiques principaux */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        {/* Graphique d'évolution des revenus - Large */}
        <motion.div
          className="lg:col-span-8"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
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
            valueFormatter={(v) => formatCurrency(v)}
          />
        </motion.div>

        {/* Jauges circulaires */}
        <motion.div
          className="lg:col-span-4"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="h-full border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Performance</CardTitle>
              <CardDescription>Indicateurs clés de santé</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-8 py-6">
              <div className="flex flex-col items-center">
                <RadialProgress
                  value={occupancyRate}
                  color={occupancyRate >= 75 ? "success" : occupancyRate >= 50 ? "warning" : "destructive"}
                  label="Occupation"
                  size={130}
                />
              </div>
              <div className="flex flex-col items-center">
                <RadialProgress
                  value={collectionRate}
                  color={collectionRate >= 90 ? "success" : collectionRate >= 70 ? "warning" : "destructive"}
                  label="Recouvrement"
                  size={130}
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Section Répartitions */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {/* Donut Chart - Répartition utilisateurs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <DonutChart
            data={roleDistributionData}
            title="Répartition des utilisateurs"
            centerValue={stats.totalUsers}
            centerLabel="Total"
          />
        </motion.div>

        {/* Bar Chart - Statuts des baux */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <BarChartHorizontal
            data={leaseStatusData}
            title="Baux par statut"
            description="Répartition des contrats"
            height={280}
          />
        </motion.div>

        {/* Stats détaillées */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="h-full border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Facturation</CardTitle>
              <CardDescription>État des factures</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Payées</p>
                    <p className="text-xs text-muted-foreground">Ce mois</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-emerald-600">
                  {stats.invoicesByStatus.paid || 0}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <FileText className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">En attente</p>
                    <p className="text-xs text-muted-foreground">Envoyées</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-amber-600">
                  {stats.invoicesByStatus.sent || 0}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">En retard</p>
                    <p className="text-xs text-muted-foreground">Impayées</p>
                  </div>
                </div>
                <span className="text-xl font-bold text-red-600">
                  {stats.invoicesByStatus.late || 0}
                </span>
              </div>

              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total factures</span>
                  <span className="font-semibold">{stats.totalInvoices}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Activité récente */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <Card className="border-0 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold">Activité récente</CardTitle>
                <CardDescription>Les dernières actions sur la plateforme</CardDescription>
              </div>
              <Badge variant="secondary" className="px-3">
                {stats.recentActivity.length} événements
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucune activité récente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recentActivity.slice(0, 8).map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 + index * 0.05 }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        p-2 rounded-lg transition-transform group-hover:scale-110
                        ${activity.type === 'user' ? 'bg-blue-500/10' : ''}
                        ${activity.type === 'property' ? 'bg-emerald-500/10' : ''}
                        ${activity.type === 'lease' ? 'bg-purple-500/10' : ''}
                        ${activity.type === 'payment' ? 'bg-amber-500/10' : ''}
                        ${!['user', 'property', 'lease', 'payment'].includes(activity.type) ? 'bg-muted' : ''}
                      `}>
                        {activity.type === 'user' && <Users className="h-4 w-4 text-blue-600" />}
                        {activity.type === 'property' && <Building2 className="h-4 w-4 text-emerald-600" />}
                        {activity.type === 'lease' && <FileText className="h-4 w-4 text-purple-600" />}
                        {activity.type === 'payment' && <DollarSign className="h-4 w-4 text-amber-600" />}
                        {!['user', 'property', 'lease', 'payment'].includes(activity.type) && (
                          <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateShort(activity.date)}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="capitalize text-xs"
                    >
                      {activity.type}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Footer stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="p-4 rounded-xl bg-muted/30 text-center">
          <FolderOpen className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-2xl font-bold">{stats.totalDocuments}</p>
          <p className="text-xs text-muted-foreground">Documents</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 text-center">
          <BookOpen className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-2xl font-bold">{stats.publishedBlogPosts}</p>
          <p className="text-xs text-muted-foreground">Articles publiés</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 text-center">
          <Building2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-2xl font-bold">{stats.usersByRole.provider}</p>
          <p className="text-xs text-muted-foreground">Prestataires</p>
        </div>
        <div className="p-4 rounded-xl bg-muted/30 text-center">
          <Users className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-2xl font-bold">{stats.usersByRole.admin}</p>
          <p className="text-xs text-muted-foreground">Administrateurs</p>
        </div>
      </motion.div>
    </div>
  );
}
