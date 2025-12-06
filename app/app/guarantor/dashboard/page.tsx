"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileCheck,
  AlertTriangle,
  Home,
  Users,
  Euro,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { guarantorProfilesService } from "@/features/profiles/services/guarantor-profiles.service";
import type {
  GuarantorDashboardData,
  GuarantorDashboardEngagement,
} from "@/lib/types/guarantor";
import {
  ENGAGEMENT_STATUS_LABELS,
  CAUTION_TYPE_LABELS,
  INCIDENT_TYPE_LABELS,
} from "@/lib/types/guarantor";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function EngagementCard({ engagement }: { engagement: GuarantorDashboardEngagement }) {
  const statusColors: Record<string, string> = {
    pending_signature: "bg-yellow-100 text-yellow-800",
    active: "bg-green-100 text-green-800",
    terminated: "bg-gray-100 text-gray-800",
    called: "bg-red-100 text-red-800",
    released: "bg-blue-100 text-blue-800",
  };

  const totalRent = engagement.lease.loyer + engagement.lease.charges;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base font-medium">
                {engagement.property.adresse}
              </CardTitle>
              <CardDescription>{engagement.property.ville}</CardDescription>
            </div>
          </div>
          <Badge className={statusColors[engagement.status] || "bg-gray-100"}>
            {ENGAGEMENT_STATUS_LABELS[engagement.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Locataire</p>
            <p className="font-medium">{engagement.tenant.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Type de caution</p>
            <p className="font-medium">{CAUTION_TYPE_LABELS[engagement.caution_type]}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Loyer total</p>
            <p className="font-medium">{formatCurrency(totalRent)}/mois</p>
          </div>
          <div>
            <p className="text-muted-foreground">Montant garanti</p>
            <p className="font-medium">
              {engagement.montant_garanti
                ? formatCurrency(engagement.montant_garanti)
                : "Illimité (légal)"}
            </p>
          </div>
        </div>

        {engagement.status === "pending_signature" && (
          <div className="pt-2 border-t">
            <Link href={`/app/guarantor/engagements/${engagement.id}/sign`}>
              <Button className="w-full">
                <FileCheck className="h-4 w-4 mr-2" />
                Signer l'acte de caution
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GuarantorDashboardPage() {
  const [data, setData] = useState<GuarantorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const dashboardData = await guarantorProfilesService.getDashboard();
        setData(dashboardData);
      } catch (err: any) {
        console.error("Erreur chargement dashboard:", err);
        setError(err.message || "Erreur lors du chargement");
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

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Bienvenue, garant !</h2>
            <p className="text-muted-foreground mb-6">
              Vous n'avez pas encore de profil garant. Créez votre profil pour
              commencer à vous porter caution.
            </p>
            <Link href="/app/guarantor/profile">
              <Button>
                Créer mon profil garant
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stats, engagements, incidents } = data;
  const pendingEngagements = engagements.filter(
    (e) => e.status === "pending_signature"
  );
  const activeEngagements = engagements.filter((e) => e.status === "active");
  const unresolvedIncidents = incidents.filter((i) => !i.resolved_at);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord garant</h1>
          <p className="text-muted-foreground">
            Gérez vos engagements de caution
          </p>
        </div>
        <Link href="/app/guarantor/profile">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Mon profil
          </Button>
        </Link>
      </div>

      {/* Alertes */}
      {pendingEngagements.length > 0 && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>{pendingEngagements.length}</strong> engagement(s) en
            attente de votre signature.
          </AlertDescription>
        </Alert>
      )}

      {unresolvedIncidents.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{unresolvedIncidents.length}</strong> incident(s) de
            paiement non résolu(s). Votre caution pourrait être appelée.
          </AlertDescription>
        </Alert>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Engagements actifs</CardDescription>
            <CardTitle className="text-3xl">{stats.total_engagements}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
              Cautions en cours
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>En attente de signature</CardDescription>
            <CardTitle className="text-3xl">{stats.pending_signatures}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="h-4 w-4 mr-1 text-yellow-500" />
              À signer
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Montant total garanti</CardDescription>
            <CardTitle className="text-2xl">
              {stats.total_amount_guaranteed > 0
                ? formatCurrency(stats.total_amount_guaranteed)
                : "Variable"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              <Euro className="h-4 w-4 mr-1" />
              Engagement financier
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Incidents actifs</CardDescription>
            <CardTitle className="text-3xl">{stats.active_incidents}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-sm text-muted-foreground">
              {stats.active_incidents > 0 ? (
                <>
                  <XCircle className="h-4 w-4 mr-1 text-red-500" />
                  Attention requise
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1 text-green-500" />
                  Aucun incident
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contenu principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagements */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Mes engagements</h2>
            <Link href="/app/guarantor/engagements">
              <Button variant="ghost" size="sm">
                Voir tout
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {engagements.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <Home className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">
                  Aucun engagement de caution pour le moment.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {engagements.slice(0, 3).map((engagement) => (
                <EngagementCard key={engagement.id} engagement={engagement} />
              ))}
            </div>
          )}
        </div>

        {/* Incidents récents */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Incidents récents</h2>

          {incidents.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <p className="text-muted-foreground">
                  Aucun incident de paiement à signaler.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {incidents.slice(0, 5).map((incident) => (
                    <div
                      key={incident.id}
                      className="p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-full ${
                            incident.resolved_at
                              ? "bg-green-100"
                              : "bg-red-100"
                          }`}
                        >
                          {incident.resolved_at ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {INCIDENT_TYPE_LABELS[incident.incident_type]}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(incident.created_at)}
                            {incident.days_late && ` • ${incident.days_late} jours de retard`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          {formatCurrency(incident.amount_due)}
                        </p>
                        <Badge
                          variant={incident.resolved_at ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {incident.resolved_at ? "Résolu" : "En cours"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Actions rapides */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/app/guarantor/profile">
              <Button variant="outline" className="w-full justify-start">
                <FileText className="h-4 w-4 mr-2" />
                Compléter mon profil
              </Button>
            </Link>
            <Link href="/app/guarantor/documents">
              <Button variant="outline" className="w-full justify-start">
                <FileCheck className="h-4 w-4 mr-2" />
                Gérer mes documents
              </Button>
            </Link>
            <Link href="/app/guarantor/engagements">
              <Button variant="outline" className="w-full justify-start">
                <Home className="h-4 w-4 mr-2" />
                Voir tous les engagements
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}







