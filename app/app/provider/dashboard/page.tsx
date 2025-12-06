"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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
  Phone,
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
  reviewer: {
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

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
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/provider/dashboard");
        if (!response.ok) {
          throw new Error("Erreur lors du chargement");
        }
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || "Erreur de chargement"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { stats, pending_orders, recent_reviews } = data;
  const completionRate = stats.total_interventions > 0
    ? Math.round((stats.completed_interventions / stats.total_interventions) * 100)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord prestataire</h1>
          <p className="text-muted-foreground">
            Gérez vos interventions et votre activité
          </p>
        </div>
        <Link href="/app/provider/calendar">
          <Button>
            <Calendar className="h-4 w-4 mr-2" />
            Mon calendrier
          </Button>
        </Link>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Interventions totales</CardDescription>
            <CardTitle className="text-3xl">{stats.total_interventions}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Wrench className="h-4 w-4 mr-1" />
              {stats.completed_interventions} terminées
            </div>
            <Progress value={completionRate} className="h-2 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>En attente</CardDescription>
            <CardTitle className="text-3xl">{stats.pending_interventions}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1 text-yellow-500" />
              À planifier
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Chiffre d'affaires</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(stats.total_revenue)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Euro className="h-4 w-4 mr-1 text-green-500" />
              Total facturé
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Note moyenne</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {stats.avg_rating ? stats.avg_rating.toFixed(1) : "—"}
              <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              {stats.total_reviews} avis
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenu principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interventions en attente */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Interventions à venir</CardTitle>
              <Link href="/app/provider/jobs">
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
                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">
                  Aucune intervention en attente
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pending_orders.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium">{order.ticket.titre}</h4>
                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          {order.property.adresse}, {order.property.ville}
                        </div>
                      </div>
                      <Badge
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
                          ? formatDate(order.date_intervention_prevue)
                          : "Date à définir"}
                      </span>
                      {order.cout_estime && (
                        <span className="font-medium">
                          {formatCurrency(order.cout_estime)}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Link href="/app/provider/jobs">
                        <Button size="sm" variant="outline">
                          Voir détails
                        </Button>
                      </Link>
                      <Button size="sm">
                        <Phone className="h-3 w-3 mr-1" />
                        Contacter
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Avis récents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Avis récents</CardTitle>
              <Link href="/app/provider/reviews">
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
                <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Aucun avis pour le moment
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recent_reviews.map((review) => (
                  <div key={review.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">
                        {review.reviewer.prenom} {review.reviewer.nom}
                      </span>
                      <RatingStars rating={review.rating_overall} />
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        "{review.comment}"
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions rapides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link href="/app/provider/quotes">
              <Button variant="outline" className="w-full justify-start">
                <Wrench className="h-4 w-4 mr-2" />
                Mes devis
              </Button>
            </Link>
            <Link href="/app/provider/calendar">
              <Button variant="outline" className="w-full justify-start">
                <Calendar className="h-4 w-4 mr-2" />
                Mon calendrier
              </Button>
            </Link>
            <Link href="/app/provider/invoices">
              <Button variant="outline" className="w-full justify-start">
                <Euro className="h-4 w-4 mr-2" />
                Mes factures
              </Button>
            </Link>
            <Link href="/app/provider/compliance">
              <Button variant="outline" className="w-full justify-start">
                <Star className="h-4 w-4 mr-2" />
                Mes documents
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
