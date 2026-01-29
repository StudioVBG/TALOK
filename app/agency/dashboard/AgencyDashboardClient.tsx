"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Euro,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Home,
  PiggyBank,
  Percent,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

// Animation variants
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

// Données de démonstration
const mockStats = {
  mandatsActifs: 12,
  mandatsTotal: 15,
  proprietaires: 12,
  biensGeres: 47,
  biensOccupes: 42,
  locataires: 58,
  commissionsEncaissees: 8450,
  commissionsEnAttente: 2340,
  loyersEncaissesMois: 52800,
  tauxOccupation: 89,
  ticketsOuverts: 5,
};

const recentMandates = [
  {
    id: "1",
    owner: "Jean Dupont",
    type: "Gestion",
    biens: 3,
    status: "active",
    commission: "7%",
  },
  {
    id: "2",
    owner: "Marie Martin",
    type: "Gestion",
    biens: 5,
    status: "active",
    commission: "6.5%",
  },
  {
    id: "3",
    owner: "SCI Les Oliviers",
    type: "Gestion",
    biens: 8,
    status: "pending_signature",
    commission: "6%",
  },
];

const recentPayments = [
  {
    id: "1",
    property: "Apt. 3 - Rue Victor Hugo",
    tenant: "Sophie Bernard",
    amount: 950,
    status: "paid",
    date: "05/12/2025",
  },
  {
    id: "2",
    property: "Studio - Av. de la République",
    tenant: "Lucas Petit",
    amount: 650,
    status: "paid",
    date: "04/12/2025",
  },
  {
    id: "3",
    property: "T3 - Bd Gambetta",
    tenant: "Emma Durand",
    amount: 1100,
    status: "pending",
    date: "01/12/2025",
  },
];

const pendingTasks = [
  {
    id: "1",
    title: "EDL sortie - 15 rue des Lilas",
    type: "edl",
    dueDate: "10/12/2025",
  },
  {
    id: "2",
    title: "Signature bail - M. Rousseau",
    type: "signature",
    dueDate: "08/12/2025",
  },
  {
    id: "3",
    title: "Révision loyer - Apt. Beaumont",
    type: "revision",
    dueDate: "15/12/2025",
  },
];

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: { value: number; positive: boolean };
  gradient: string;
  href?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, trend, gradient, href }: StatCardProps) {
  const content = (
    <Card className={cn(
      "relative overflow-hidden border-0 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
      "bg-gradient-to-br",
      gradient
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/80">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            {subtitle && (
              <p className="text-xs text-white/70">{subtitle}</p>
            )}
            {trend && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium",
                trend.positive ? "text-emerald-200" : "text-red-200"
              )}>
                {trend.positive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {trend.positive ? "+" : ""}{trend.value}% ce mois
              </div>
            )}
          </div>
          <div className="p-3 bg-white/20 rounded-xl">
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

export function AgencyDashboardClient({ data }: { data: any }) {
  const stats = data?.stats || {};
  const recentMandates = data?.recentMandates || [];
  const recentPayments = data?.recentPayments || [];
  const pendingTasks = data?.pendingTasks || [];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground mt-1">
            Bienvenue dans votre espace agence
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link href="/agency/mandates/new">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau mandat
            </Link>
          </Button>
          <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700" asChild>
            <Link href="/agency/owners/invite">
              <Users className="w-4 h-4 mr-2" />
              Inviter un propriétaire
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Mandats actifs"
          value={stats.mandatsActifs || 0}
          subtitle={`${stats.mandatsTotal || 0} au total`}
          icon={FileText}
          gradient="from-indigo-500 to-indigo-600"
          href="/agency/mandates"
        />
        <StatCard
          title="Biens gérés"
          value={stats.biensGeres || 0}
          subtitle="Gérés par mandat"
          icon={Building2}
          gradient="from-purple-500 to-purple-600"
          href="/agency/properties"
        />
        <StatCard
          title="Commissions du mois"
          value={`${(stats.commissionsEncaissees || 0).toLocaleString("fr-FR")}€`}
          subtitle={`${(stats.commissionsEnAttente || 0).toLocaleString("fr-FR")}€ en attente`}
          icon={Euro}
          gradient="from-emerald-500 to-emerald-600"
          href="/agency/commissions"
        />
        <StatCard
          title="Taux d'occupation"
          value={`${stats.tauxOccupation || 0}%`}
          subtitle="Biens occupés / gérés"
          icon={Home}
          gradient="from-amber-500 to-orange-500"
          href="/agency/properties?filter=vacant"
        />
      </motion.div>

      {/* Secondary Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.proprietaires || 0}</p>
              <p className="text-sm text-muted-foreground">Propriétaires mandants</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-900/30">
              <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.ticketsOuverts || 0}</p>
              <p className="text-sm text-muted-foreground">Tickets ouverts</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
              <PiggyBank className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{(stats.loyersEncaissesMois || 0).toLocaleString("fr-FR")}€</p>
              <p className="text-sm text-muted-foreground">Loyers encaissés ce mois</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mandats récents */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="border-0 bg-card/60 backdrop-blur-sm h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Mandats récents</CardTitle>
                <CardDescription>Vos derniers mandats de gestion</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/agency/mandates">
                  Voir tout <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentMandates.length > 0 ? (
                recentMandates.map((mandate: any) => (
                  <div
                    key={mandate.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-semibold">
                        {mandate.owner.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{mandate.owner}</p>
                        <p className="text-sm text-muted-foreground">
                          {mandate.biens} biens • Commission {mandate.commission}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        mandate.status === "active" && "border-emerald-500 text-emerald-600 bg-emerald-50",
                        mandate.status === "pending_signature" && "border-amber-500 text-amber-600 bg-amber-50"
                      )}
                    >
                      {mandate.status === "active" ? "Actif" : "En attente"}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Aucun mandat récent
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Tâches en attente */}
        <motion.div variants={itemVariants}>
          <Card className="border-0 bg-card/60 backdrop-blur-sm h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                À faire
              </CardTitle>
              <CardDescription>Tâches prioritaires</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingTasks.length > 0 ? (
                pendingTasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted"
                  >
                    <div className={cn(
                      "mt-0.5 p-1.5 rounded-lg",
                      task.type === "edl" && "bg-blue-100 dark:bg-blue-900/30",
                      task.type === "signature" && "bg-purple-100 dark:bg-purple-900/30",
                      task.type === "revision" && "bg-amber-100 dark:bg-amber-900/30"
                    )}>
                      {task.type === "edl" && <Home className="w-4 h-4 text-blue-600" />}
                      {task.type === "signature" && <FileText className="w-4 h-4 text-purple-600" />}
                      {task.type === "revision" && <Percent className="w-4 h-4 text-amber-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {task.dueDate}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Aucune tâche en attente
                </div>
              )}
              <Button variant="outline" className="w-full mt-2" size="sm">
                Voir toutes les tâches
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Paiements récents */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Derniers paiements reçus</CardTitle>
              <CardDescription>Loyers encaissés récemment</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/agency/finances">
                Voir tout <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="md:hidden space-y-3">
              {recentPayments.length > 0 ? (
                recentPayments.map((payment: any) => (
                  <div key={payment.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{payment.property}</p>
                        <p className="text-sm text-muted-foreground">{payment.tenant}</p>
                      </div>
                      <span className="font-semibold text-sm">{payment.amount}€</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={cn("text-xs", payment.status === "paid" && "border-emerald-500 text-emerald-600 bg-emerald-50", payment.status === "pending" && "border-amber-500 text-amber-600 bg-amber-50", payment.status === "sent" && "border-blue-500 text-blue-600 bg-blue-50", payment.status === "late" && "border-red-500 text-red-600 bg-red-50")}>
                        {payment.status === "paid" ? "Payé" : payment.status === "late" ? "Retard" : "En attente"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{payment.date}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground">Aucun paiement récent</div>
              )}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Bien</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Locataire</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Montant</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.length > 0 ? (
                    recentPayments.map((payment: any) => (
                      <tr key={payment.id} className="border-b border-border last:border-0">
                        <td className="py-3 px-4">
                          <p className="font-medium text-sm">{payment.property}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{payment.tenant}</td>
                        <td className="py-3 px-4 text-right font-semibold text-sm">{payment.amount}€</td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              payment.status === "paid" && "border-emerald-500 text-emerald-600 bg-emerald-50",
                              payment.status === "pending" && "border-amber-500 text-amber-600 bg-amber-50",
                              payment.status === "sent" && "border-blue-500 text-blue-600 bg-blue-50",
                              payment.status === "late" && "border-red-500 text-red-600 bg-red-50"
                            )}
                          >
                            {payment.status === "paid" ? (
                              <><CheckCircle className="w-3 h-3 mr-1" /> Payé</>
                            ) : payment.status === "late" ? (
                              <><AlertTriangle className="w-3 h-3 mr-1" /> Retard</>
                            ) : (
                              <><Clock className="w-3 h-3 mr-1" /> En attente</>
                            )}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-muted-foreground">{payment.date}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        Aucun paiement récent
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Performance Card */}
      <motion.div variants={itemVariants}>
        <Card className="border-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Performance ce mois</h3>
                <p className="text-white/80 text-sm">
                  Vous avez encaissé {mockStats.loyersEncaissesMois.toLocaleString("fr-FR")}€ de loyers
                  pour une commission de {mockStats.commissionsEncaissees.toLocaleString("fr-FR")}€
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{mockStats.tauxOccupation}%</p>
                  <p className="text-xs text-white/70">Taux occupation</p>
                </div>
                <div className="h-12 w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-3xl font-bold">98%</p>
                  <p className="text-xs text-white/70">Taux recouvrement</p>
                </div>
                <div className="h-12 w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-3xl font-bold">4.8</p>
                  <p className="text-xs text-white/70">Note clients</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

