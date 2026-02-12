"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { GlassCard } from "@/components/ui/glass-card";
import { PageTransition } from "@/components/ui/page-transition";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import {
  Wrench,
  Calendar,
  Euro,
  Star,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  MapPin,
  MessageCircle,
  RefreshCw,
  Sparkles,
  FileText,
} from "lucide-react";
import Link from "next/link";

interface ProviderStats {
  total_interventions: number;
  completed_interventions: number;
  pending_interventions: number;
  total_revenue: number;
  avg_rating: number | null;
  total_reviews: number;
}

interface PendingOrder {
  id: string;
  ticket_id: string;
  statut: string;
  cout_estime: number;
  date_intervention_prevue: string;
  created_at: string;
  ticket: {
    titre: string;
    priorite: string;
  };
  property: {
    adresse: string;
    ville: string;
  };
}

interface Review {
  id: string;
  rating_overall: number;
  comment: string;
  created_at: string;
  reviewer?: {
    prenom: string;
    nom: string;
  };
}

interface DashboardData {
  profile_id: string;
  stats: ProviderStats;
  pending_orders: PendingOrder[];
  recent_reviews: Review[];
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } },
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

export default function ProviderDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/provider/dashboard");
      if (!response.ok) {
        throw new Error("Erreur lors du chargement");
      }
      const result = await response.json();
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-4 sm:p-6 space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || "Erreur de chargement"}</AlertDescription>
        </Alert>
        <Button onClick={() => loadDashboard()} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Réessayer
        </Button>
      </div>
    );
  }

  const { stats, pending_orders, recent_reviews } = data;
  const completionRate = stats.total_interventions > 0
    ? Math.round((stats.completed_interventions / stats.total_interventions) * 100)
    : 0;

  return (
    <PageTransition>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container mx-auto p-4 sm:p-6 space-y-6 pb-10"
      >
        {/* En-tete SOTA 2026 avec gradient */}
        <motion.header
          variants={itemVariants}
          className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-orange-600 via-amber-600 to-orange-700 p-4 sm:p-6 lg:p-8 text-white shadow-2xl"
        >
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-48 w-48 rounded-full bg-orange-300/10 blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                  Tableau de bord
                </h1>
                <Badge className="bg-white/20 text-white border-white/30 text-xs">
                  Prestataire
                </Badge>
              </div>
              <p className="text-white/80 text-sm sm:text-base">
                {stats.pending_interventions > 0
                  ? `${stats.pending_interventions} intervention${stats.pending_interventions > 1 ? 's' : ''} en attente`
                  : "Toutes vos interventions sont à jour"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                onClick={() => loadDashboard(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? "..." : "Actualiser"}
              </Button>
              <Button className="bg-white text-orange-700 hover:bg-white/90 font-bold" asChild>
                <Link href="/provider/calendar">
                  <Calendar className="h-4 w-4 mr-2" />
                  Calendrier
                </Link>
              </Button>
            </div>
          </div>

          {/* Quick Stats dans le header */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 border-t border-white/10 pt-4 sm:pt-6">
            <div>
              <p className="text-white/60 text-xs sm:text-sm font-medium">Interventions</p>
              <p className="text-xl sm:text-2xl font-bold">{stats.total_interventions}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs sm:text-sm font-medium">En attente</p>
              <p className="text-xl sm:text-2xl font-bold">{stats.pending_interventions}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs sm:text-sm font-medium">Chiffre d&apos;affaires</p>
              <p className="text-xl sm:text-2xl font-bold">{formatCurrency(stats.total_revenue)}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs sm:text-sm font-medium">Note moyenne</p>
              <p className="text-xl sm:text-2xl font-bold flex items-center gap-1">
                {stats.avg_rating ? stats.avg_rating.toFixed(1) : "—"}
                <Star className="h-5 w-5 fill-yellow-300 text-yellow-300" />
              </p>
            </div>
          </div>
        </motion.header>

        {/* Statistiques detaillees */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <GlassCard hoverEffect className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-orange-100 rounded-xl">
                <Wrench className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Interventions</p>
            </div>
            <p className="text-3xl font-bold">{stats.total_interventions}</p>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              {stats.completed_interventions} terminées
            </div>
            <Progress value={completionRate} className="h-1.5 mt-3" />
          </GlassCard>

          <GlassCard hoverEffect className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-amber-100 rounded-xl">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">En attente</p>
            </div>
            <p className="text-3xl font-bold">{stats.pending_interventions}</p>
            <p className="text-sm text-muted-foreground mt-2">À planifier</p>
          </GlassCard>

          <GlassCard hoverEffect className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-emerald-100 rounded-xl">
                <Euro className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Chiffre d&apos;affaires</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(stats.total_revenue)}</p>
            <p className="text-sm text-muted-foreground mt-2">Total facturé</p>
          </GlassCard>

          <GlassCard hoverEffect className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-yellow-100 rounded-xl">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Note moyenne</p>
            </div>
            <p className="text-3xl font-bold flex items-center gap-2">
              {stats.avg_rating ? stats.avg_rating.toFixed(1) : "—"}
              <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
            </p>
            <p className="text-sm text-muted-foreground mt-2">{stats.total_reviews} avis</p>
          </GlassCard>
        </motion.div>

        {/* Contenu principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Interventions en attente */}
          <motion.div variants={itemVariants}>
            <Card className="shadow-lg border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Interventions à venir</CardTitle>
                  <Link href="/provider/jobs">
                    <Button variant="ghost" size="sm">
                      Voir tout
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {pending_orders.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto p-4 bg-green-50 rounded-2xl w-fit mb-4">
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                    </div>
                    <p className="font-medium text-foreground">Tout est en ordre</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Aucune intervention en attente
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pending_orders.map((order, idx) => (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-4 border rounded-xl hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-medium truncate">{order.ticket.titre}</h4>
                            <div className="flex items-center text-sm text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{order.property.adresse}, {order.property.ville}</span>
                            </div>
                          </div>
                          <Badge
                            className="self-start flex-shrink-0"
                            variant={
                              order.ticket.priorite === "haute"
                                ? "destructive"
                                : order.ticket.priorite === "normale"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {order.ticket.priorite}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-3 text-sm">
                          <span className="text-muted-foreground">
                            {order.date_intervention_prevue
                              ? formatDateShort(order.date_intervention_prevue)
                              : "Date à définir"}
                          </span>
                          {order.cout_estime > 0 && (
                            <span className="font-medium">
                              {formatCurrency(order.cout_estime)}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href="/provider/jobs">
                              Voir détails
                            </Link>
                          </Button>
                          <Button size="sm" asChild>
                            <Link href="/provider/jobs">
                              <MessageCircle className="h-3 w-3 mr-1" />
                              Contacter
                            </Link>
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Avis recents */}
          <motion.div variants={itemVariants}>
            <Card className="shadow-lg border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Avis récents</CardTitle>
                  <Link href="/provider/reviews">
                    <Button variant="ghost" size="sm">
                      Voir tout
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {recent_reviews.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto p-4 bg-muted rounded-2xl w-fit mb-4">
                      <Star className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">Pas encore d&apos;avis</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Les avis apparaîtront ici après vos interventions
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recent_reviews.map((review, idx) => (
                      <motion.div
                        key={review.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="p-4 border rounded-xl"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                          <span className="font-medium truncate">
                            {review.reviewer?.prenom ?? "Anonyme"} {review.reviewer?.nom ?? ""}
                          </span>
                          <RatingStars rating={review.rating_overall} />
                        </div>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            &ldquo;{review.comment}&rdquo;
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDateShort(review.created_at)}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Actions rapides */}
        <motion.section variants={itemVariants}>
          <h2 className="text-lg font-semibold mb-3">Actions rapides</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/provider/quotes">
              <GlassCard hoverEffect className="p-4 text-center cursor-pointer min-h-[80px] flex flex-col items-center justify-center">
                <FileText className="h-6 w-6 mx-auto text-orange-600 mb-2" />
                <p className="text-xs sm:text-sm font-medium">Mes devis</p>
              </GlassCard>
            </Link>
            <Link href="/provider/calendar">
              <GlassCard hoverEffect className="p-4 text-center cursor-pointer min-h-[80px] flex flex-col items-center justify-center">
                <Calendar className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                <p className="text-xs sm:text-sm font-medium">Mon calendrier</p>
              </GlassCard>
            </Link>
            <Link href="/provider/invoices">
              <GlassCard hoverEffect className="p-4 text-center cursor-pointer min-h-[80px] flex flex-col items-center justify-center">
                <Euro className="h-6 w-6 mx-auto text-emerald-600 mb-2" />
                <p className="text-xs sm:text-sm font-medium">Mes factures</p>
              </GlassCard>
            </Link>
            <Link href="/provider/compliance">
              <GlassCard hoverEffect className="p-4 text-center cursor-pointer min-h-[80px] flex flex-col items-center justify-center">
                <Sparkles className="h-6 w-6 mx-auto text-purple-600 mb-2" />
                <p className="text-xs sm:text-sm font-medium">Mes documents</p>
              </GlassCard>
            </Link>
          </div>
        </motion.section>
      </motion.div>
    </PageTransition>
  );
}
