"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Home,
  FileText,
  Ticket,
  DollarSign,
  FolderOpen,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Building2,
  AlertCircle,
  Shield,
  CreditCard,
  RefreshCw,
  Calendar,
  ArrowUpRight,
  Brain,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatsCardEnhanced } from "@/components/admin/stats-card-enhanced";
import { DonutChart } from "@/components/charts/donut-chart";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { BarChartHorizontal } from "@/components/charts/bar-chart-horizontal";
import { RadialProgress } from "@/components/ui/radial-progress";
import { formatDateShort, formatCurrency } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";
import Link from "next/link";

// Types pour les stats améliorées
export interface AdminStatsDataV2 {
  // Utilisateurs
  totalUsers: number;
  usersByRole: {
    admin: number;
    owner: number;
    tenant: number;
    provider: number;
  };
  newUsersThisMonth: number;
  newUsersPrevMonth: number;

  // Propriétés
  totalProperties: number;
  propertiesByStatus: {
    active: number;
    rented: number;
    draft: number;
    archived: number;
  };

  // Baux
  totalLeases: number;
  activeLeases: number;
  leasesByStatus: {
    active: number;
    pending_signature: number;
    draft: number;
    terminated: number;
  };

  // Factures
  totalInvoices: number;
  unpaidInvoices: number;
  invoicesByStatus: {
    paid: number;
    sent: number;
    late: number;
    draft: number;
  };

  // Tickets
  totalTickets: number;
  openTickets: number;
  ticketsByStatus: {
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
  };

  // Revenus mensuels (VRAIES DONNÉES)
  monthlyRevenue: Array<{
    month: string;
    attendu: number;
    encaisse: number;
  }>;

  // Tendances 7 jours
  trends: {
    users: number[];
    properties: number[];
    leases: number[];
  };

  // Taux
  occupancyRate: number;
  collectionRate: number;

  // Documents & Blog
  totalDocuments: number;
  totalBlogPosts: number;
  publishedBlogPosts: number;

  // Modération
  moderationPending: number;
  moderationCritical: number;

  // Abonnements
  subscriptionStats: {
    total: number;
    active: number;
    trial: number;
    churned: number;
  };

  // Activité récente
  recentActivity: Array<{
    type: 'user' | 'property' | 'lease' | 'payment';
    description: string;
    date: string;
  }>;
}

interface DashboardClientV2Props {
  stats: AdminStatsDataV2;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  },
};

// Calcul du trend
function calculateTrend(current: number, previous: number): { value: number; direction: "up" | "down" } {
  if (previous === 0) return { value: current > 0 ? 100 : 0, direction: "up" };
  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(Math.round(change)),
    direction: change >= 0 ? "up" : "down"
  };
}

export function DashboardClientV2({ stats }: DashboardClientV2Props) {
  // Calcul des tendances réelles
  const userTrend = calculateTrend(stats.newUsersThisMonth, stats.newUsersPrevMonth);

  // Données pour le donut chart des rôles
  const roleDistributionData = [
    { name: "Propriétaires", value: stats.usersByRole.owner, color: "hsl(217, 91%, 60%)" },
    { name: "Locataires", value: stats.usersByRole.tenant, color: "hsl(142, 71%, 45%)" },
    { name: "Prestataires", value: stats.usersByRole.provider, color: "hsl(38, 92%, 50%)" },
    { name: "Admins", value: stats.usersByRole.admin, color: "hsl(262, 83%, 58%)" },
  ];

  // Données pour le bar chart des baux
  const leaseStatusData = [
    { name: "Actifs", value: stats.leasesByStatus?.active || 0, color: "hsl(142, 71%, 45%)" },
    { name: "En attente", value: stats.leasesByStatus?.pending_signature || 0, color: "hsl(38, 92%, 50%)" },
    { name: "Brouillons", value: stats.leasesByStatus?.draft || 0, color: "hsl(215, 20%, 65%)" },
    { name: "Terminés", value: stats.leasesByStatus?.terminated || 0, color: "hsl(0, 84%, 60%)" },
  ];

  // Revenus depuis la DB (VRAIES DONNÉES)
  const revenueData = stats.monthlyRevenue?.length > 0
    ? stats.monthlyRevenue
    : []; // Pas de données simulées!

  const hasRevenueData = revenueData.length > 0;

  return (
    <TooltipProvider>
      <div className="space-y-6 p-2" role="main" aria-label="Tableau de bord administrateur">
        {/* Header avec titre et actions */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
            <p className="text-muted-foreground mt-1">
              Vue d'ensemble de la plateforme TALOK
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Actualiser les données">
                  <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                  Actualiser
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rafraîchir les statistiques</TooltipContent>
            </Tooltip>
            <Badge variant="secondary" className="gap-1">
              <Calendar className="h-3 w-3" aria-hidden="true" />
              {new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </Badge>
          </div>
        </motion.div>

        {/* Alertes IA - Modération & Critiques */}
        <AnimatePresence>
          {(stats.moderationPending > 0 || stats.moderationCritical > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-500/10">
                        <Brain className="h-5 w-5 text-amber-600" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
                          Modération IA
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {stats.moderationPending} élément{stats.moderationPending > 1 ? 's' : ''} en attente
                          {stats.moderationCritical > 0 && (
                            <span className="text-red-500 font-medium ml-2">
                              ({stats.moderationCritical} critique{stats.moderationCritical > 1 ? 's' : ''})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/admin/moderation">
                        Voir la file
                        <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI Cards avec Sparklines VRAIES DONNÉES */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          role="region"
          aria-label="Indicateurs clés de performance"
        >
          <motion.div variants={itemVariants}>
            <StatsCardEnhanced
              title="Utilisateurs"
              value={stats.totalUsers}
              trend={userTrend}
              sparklineData={stats.trends?.users || []}
              icon={Users}
              color="primary"
              description={`${stats.usersByRole.owner} proprio, ${stats.usersByRole.tenant} locataires`}
              delay={0}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatsCardEnhanced
              title="Logements"
              value={stats.totalProperties}
              trend={{
                value: stats.propertiesByStatus?.rented || 0 > 0 ?
                  Math.round((stats.propertiesByStatus?.rented / stats.totalProperties) * 100) : 0,
                direction: "up"
              }}
              sparklineData={stats.trends?.properties || []}
              icon={Home}
              color="success"
              description={`${stats.propertiesByStatus?.rented || 0} loués sur ${stats.totalProperties}`}
              delay={1}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatsCardEnhanced
              title="Baux actifs"
              value={stats.activeLeases}
              trend={{
                value: stats.leasesByStatus?.pending_signature || 0,
                direction: stats.leasesByStatus?.pending_signature > 0 ? "up" : "down"
              }}
              sparklineData={stats.trends?.leases || []}
              icon={FileText}
              color="info"
              description={`${stats.leasesByStatus?.pending_signature || 0} en attente signature`}
              delay={2}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatsCardEnhanced
              title="Tickets ouverts"
              value={stats.openTickets}
              trend={{
                value: stats.openTickets,
                direction: stats.openTickets > 5 ? "up" : "down"
              }}
              sparklineData={[]}
              icon={Ticket}
              color={stats.openTickets > 10 ? "warning" : "primary"}
              description={`Sur ${stats.totalTickets} total`}
              delay={3}
            />
          </motion.div>
        </motion.div>

        {/* Section Graphiques principaux */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
          {/* Graphique d'évolution des revenus - VRAIES DONNÉES */}
          <motion.div
            className="lg:col-span-8"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            {hasRevenueData ? (
              <AreaChartCard
                title="Évolution des revenus"
                description="Loyers attendus vs encaissés (données réelles)"
                data={revenueData}
                series={[
                  { key: "attendu", name: "Loyers attendus", color: "hsl(217, 91%, 60%)" },
                  { key: "encaisse", name: "Loyers encaissés", color: "hsl(142, 71%, 45%)" },
                ]}
                xAxisKey="month"
                height={320}
                valueFormatter={(v) => formatCurrency(v)}
              />
            ) : (
              <Card className="h-full border-0 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Évolution des revenus</CardTitle>
                  <CardDescription>Données en cours de calcul...</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-64">
                  <DollarSign className="h-12 w-12 text-muted-foreground/30 mb-4" aria-hidden="true" />
                  <p className="text-muted-foreground text-center">
                    Les données de revenus seront disponibles<br />
                    dès les premières factures créées.
                  </p>
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Jauges circulaires - Performance */}
          <motion.div
            className="lg:col-span-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="h-full border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold">Performance</CardTitle>
                <CardDescription>Indicateurs de santé plateforme</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center gap-6 py-4">
                <div className="flex flex-col items-center" role="meter" aria-valuenow={stats.occupancyRate || 0} aria-valuemin={0} aria-valuemax={100} aria-label="Taux d'occupation">
                  <RadialProgress
                    value={stats.occupancyRate || 0}
                    color={
                      (stats.occupancyRate || 0) >= 75 ? "success" :
                      (stats.occupancyRate || 0) >= 50 ? "warning" : "destructive"
                    }
                    label="Occupation"
                    size={120}
                  />
                </div>
                <div className="flex flex-col items-center" role="meter" aria-valuenow={stats.collectionRate || 0} aria-valuemin={0} aria-valuemax={100} aria-label="Taux de recouvrement">
                  <RadialProgress
                    value={stats.collectionRate || 0}
                    color={
                      (stats.collectionRate || 0) >= 90 ? "success" :
                      (stats.collectionRate || 0) >= 70 ? "warning" : "destructive"
                    }
                    label="Recouvrement"
                    size={120}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Section Répartitions - 3 colonnes */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {/* Donut Chart - Répartition utilisateurs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
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
            transition={{ delay: 0.55 }}
          >
            <BarChartHorizontal
              data={leaseStatusData}
              title="Baux par statut"
              description="Répartition des contrats"
              height={280}
            />
          </motion.div>

          {/* Stats Facturation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="h-full border-0 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <CreditCard className="h-5 w-5" aria-hidden="true" />
                  Facturation
                </CardTitle>
                <CardDescription>État des factures</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <DollarSign className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Payées</p>
                      <p className="text-xs text-muted-foreground">Ce mois</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-emerald-600">
                    {stats.invoicesByStatus?.paid || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <FileText className="h-5 w-5 text-amber-600" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">En attente</p>
                      <p className="text-xs text-muted-foreground">Envoyées</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-amber-600">
                    {stats.invoicesByStatus?.sent || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">En retard</p>
                      <p className="text-xs text-muted-foreground">Impayées</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold text-red-600">
                    {stats.invoicesByStatus?.late || 0}
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

        {/* Section Abonnements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <Card className="border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <CreditCard className="h-5 w-5" aria-hidden="true" />
                    Abonnements plateforme
                  </CardTitle>
                  <CardDescription>Suivi des forfaits propriétaires</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/plans">
                    Gérer les forfaits
                    <ArrowUpRight className="h-4 w-4 ml-1" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-3xl font-bold text-primary">{stats.subscriptionStats?.active || 0}</p>
                  <p className="text-sm text-muted-foreground">Actifs</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-3xl font-bold text-blue-500">{stats.subscriptionStats?.trial || 0}</p>
                  <p className="text-sm text-muted-foreground">En essai</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-3xl font-bold">{stats.subscriptionStats?.total || 0}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/30">
                  <p className="text-3xl font-bold text-red-500">{stats.subscriptionStats?.churned || 0}</p>
                  <p className="text-sm text-muted-foreground">Résiliés</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Activité récente */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold">Activité récente</CardTitle>
                  <CardDescription>Dernières actions sur la plateforme</CardDescription>
                </div>
                <Badge variant="secondary" className="px-3">
                  {stats.recentActivity?.length || 0} événements
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {(!stats.recentActivity || stats.recentActivity.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" aria-hidden="true" />
                  <p>Aucune activité récente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.recentActivity.slice(0, 8).map((activity, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.75 + index * 0.04 }}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg transition-transform group-hover:scale-110",
                          activity.type === 'user' && 'bg-blue-500/10',
                          activity.type === 'property' && 'bg-emerald-500/10',
                          activity.type === 'lease' && 'bg-purple-500/10',
                          activity.type === 'payment' && 'bg-amber-500/10',
                        )}>
                          {activity.type === 'user' && <Users className="h-4 w-4 text-blue-600" aria-hidden="true" />}
                          {activity.type === 'property' && <Building2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
                          {activity.type === 'lease' && <FileText className="h-4 w-4 text-purple-600" aria-hidden="true" />}
                          {activity.type === 'payment' && <DollarSign className="h-4 w-4 text-amber-600" aria-hidden="true" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{activity.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateShort(activity.date)}
                          </p>
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

        {/* Footer stats - 4 colonnes */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          role="region"
          aria-label="Statistiques générales"
        >
          <div className="p-4 rounded-xl bg-muted/30 text-center hover:bg-muted/50 transition-colors">
            <FolderOpen className="h-6 w-6 mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
            <p className="text-2xl font-bold">{stats.totalDocuments}</p>
            <p className="text-xs text-muted-foreground">Documents</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/30 text-center hover:bg-muted/50 transition-colors">
            <BookOpen className="h-6 w-6 mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
            <p className="text-2xl font-bold">{stats.publishedBlogPosts}</p>
            <p className="text-xs text-muted-foreground">Articles publiés</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/30 text-center hover:bg-muted/50 transition-colors">
            <Building2 className="h-6 w-6 mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
            <p className="text-2xl font-bold">{stats.usersByRole.provider}</p>
            <p className="text-xs text-muted-foreground">Prestataires</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/30 text-center hover:bg-muted/50 transition-colors">
            <Shield className="h-6 w-6 mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
            <p className="text-2xl font-bold">{stats.usersByRole.admin}</p>
            <p className="text-xs text-muted-foreground">Administrateurs</p>
          </div>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}
