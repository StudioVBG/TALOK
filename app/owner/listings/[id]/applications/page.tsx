"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Users,
  BarChart3,
  Eye,
  ExternalLink,
  GitCompare,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { EmptyState } from "@/components/ui/empty-state";
import { useListing } from "@/lib/hooks/queries/use-listings";
import {
  useApplicationsForListing,
  useAcceptApplication,
  useRejectApplication,
  useScoreApplication,
  useCompareApplications,
} from "@/lib/hooks/queries/use-candidatures";
import { ApplicationCard } from "@/features/candidatures/components/ApplicationCard";
import { ComparisonTable } from "@/features/candidatures/components/ComparisonTable";
import { formatCurrency } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";
import type { ApplicationStatus } from "@/lib/types/candidatures";
import { APPLICATION_STATUS_LABELS } from "@/lib/types/candidatures";

export default function ListingApplicationsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const listingId = params.id as string;

  const { data: listing, isLoading: listingLoading } = useListing(listingId);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const {
    data: applications = [],
    isLoading: appsLoading,
  } = useApplicationsForListing(listingId, statusFilter === "all" ? undefined : statusFilter);

  const acceptMutation = useAcceptApplication();
  const rejectMutation = useRejectApplication();
  const scoreMutation = useScoreApplication();
  const compareMutation = useCompareApplications();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleAccept = async (id: string) => {
    try {
      const result = await acceptMutation.mutateAsync(id);
      toast({
        title: "Candidature acceptée",
        description: result.lease_id
          ? "Un bail draft a été créé automatiquement."
          : "Le candidat a été notifié.",
      });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'accepter la candidature.", variant: "destructive" });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectMutation.mutateAsync({ id });
      toast({ title: "Candidature refusée", description: "Le candidat a été notifié par email." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de refuser la candidature.", variant: "destructive" });
    }
  };

  const handleScore = async (id: string) => {
    try {
      const result = await scoreMutation.mutateAsync(id);
      toast({
        title: "Scoring terminé",
        description: `Score IA : ${result.scoring.total_score}/100 — ${result.scoring.recommendation}`,
      });
    } catch {
      toast({ title: "Erreur", description: "Impossible de lancer le scoring.", variant: "destructive" });
    }
  };

  const handleCompare = async () => {
    if (selectedIds.length < 2) {
      toast({ title: "Sélectionnez au moins 2 candidatures", variant: "destructive" });
      return;
    }
    try {
      await compareMutation.mutateAsync(selectedIds);
      setShowComparison(true);
    } catch {
      toast({ title: "Erreur", description: "Impossible de comparer.", variant: "destructive" });
    }
  };

  const isLoading = listingLoading || appsLoading;

  const statusCounts = useMemo(() => {
    const counts: Partial<Record<ApplicationStatus, number>> = {};
    for (const app of applications) {
      counts[app.status as ApplicationStatus] = (counts[app.status as ApplicationStatus] || 0) + 1;
    }
    return counts;
  }, [applications]);

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <PageTransition>
        <div className="container mx-auto px-4 py-4 md:py-8 max-w-6xl">
          {/* Header */}
          <div className="mb-6">
            <Button variant="ghost" size="sm" asChild className="mb-2">
              <Link href="/owner/listings">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Retour aux annonces
              </Link>
            </Button>

            {listing && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                    {listing.title}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {listing.property?.adresse_complete}, {listing.property?.ville} —{" "}
                    {formatCurrency(listing.rent_amount_cents / 100)}/mois
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {listing.is_published && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/annonce/${listing.public_url_token}`} target="_blank">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" />
                        Page publique
                      </Link>
                    </Button>
                  )}
                  <Badge variant={listing.is_published ? "default" : "secondary"}>
                    {listing.is_published ? "Publiée" : "Brouillon"}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Stats rapides */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="flex items-center gap-2 p-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-lg font-bold">{applications.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-2 p-3">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                <div>
                  <p className="text-lg font-bold">{statusCounts.complete || 0}</p>
                  <p className="text-xs text-muted-foreground">Complets</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-2 p-3">
                <BarChart3 className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-lg font-bold">{statusCounts.shortlisted || 0}</p>
                  <p className="text-xs text-muted-foreground">Présélectionnés</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-2 p-3">
                <Eye className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-lg font-bold">{listing?.views_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Vues</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Toolbar: filtres + actions */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-6">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(APPLICATION_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label} {statusCounts[value as ApplicationStatus] ? `(${statusCounts[value as ApplicationStatus]})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedIds.length >= 2 && (
              <Button variant="outline" onClick={handleCompare} disabled={compareMutation.isPending}>
                <GitCompare className="mr-2 h-4 w-4" />
                Comparer ({selectedIds.length})
              </Button>
            )}
          </div>

          {/* Tableau comparatif */}
          {showComparison && compareMutation.data && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Comparaison</h2>
                <Button variant="ghost" size="sm" onClick={() => setShowComparison(false)}>
                  Fermer
                </Button>
              </div>
              <ComparisonTable
                applications={compareMutation.data.applications}
                ranking={compareMutation.data.ranking}
                onSelectWinner={handleAccept}
              />
            </div>
          )}

          {/* Liste des candidatures */}
          {isLoading && (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4 space-y-3">
                    <div className="h-5 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && applications.length === 0 && (
            <EmptyState
              title="Aucune candidature"
              description="Vous n'avez pas encore reçu de candidature pour cette annonce."
            />
          )}

          {!isLoading && applications.length > 0 && (
            <div className="space-y-4">
              {applications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  listingId={listingId}
                  onAccept={handleAccept}
                  onReject={(id) => handleReject(id)}
                  onScore={handleScore}
                  selected={selectedIds.includes(application.id)}
                  onSelect={handleSelect}
                  acceptLoading={acceptMutation.isPending}
                  rejectLoading={rejectMutation.isPending}
                  scoreLoading={scoreMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </PageTransition>
    </ProtectedRoute>
  );
}
