"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  FileText,
  Calendar,
  Sparkles,
  Download,
} from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import {
  useApplication,
  useAcceptApplication,
  useRejectApplication,
  useScoreApplication,
} from "@/lib/hooks/queries/use-candidatures";
import { CompletenessBar } from "@/features/candidatures/components/CompletenessBar";
import { ScoreBadge } from "@/features/candidatures/components/ScoreBadge";
import { AcceptRejectButtons } from "@/features/candidatures/components/AcceptRejectButtons";
import {
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
} from "@/lib/types/candidatures";
import { useToast } from "@/components/ui/use-toast";

const DOC_TYPE_LABELS: Record<string, string> = {
  identity: "Pièce d'identité",
  income: "Justificatif de revenus",
  tax_notice: "Avis d'imposition",
  employment: "Contrat de travail",
  address_proof: "Justificatif de domicile",
  rent_receipt: "Quittances de loyer",
  other: "Autre document",
};

export default function ApplicationDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const applicationId = params.appId as string;
  const listingId = params.id as string;

  const { data: application, isLoading } = useApplication(applicationId);
  const acceptMutation = useAcceptApplication();
  const rejectMutation = useRejectApplication();
  const scoreMutation = useScoreApplication();

  const handleAccept = async (id: string) => {
    try {
      const result = await acceptMutation.mutateAsync(id);
      toast({
        title: "Candidature acceptée",
        description: result.lease_id
          ? "Un bail draft a été créé. Les autres candidats ont été notifiés."
          : "Le candidat a été notifié.",
      });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    try {
      await rejectMutation.mutateAsync({ id, reason });
      toast({ title: "Candidature refusée" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleScore = async () => {
    if (!application) return;
    try {
      const result = await scoreMutation.mutateAsync(application.id);
      toast({
        title: "Scoring terminé",
        description: `Score : ${result.scoring.total_score}/100`,
      });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={["owner"]}>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3" />
            <Card><CardContent className="p-6"><div className="h-40 bg-muted rounded" /></CardContent></Card>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!application) {
    return (
      <ProtectedRoute allowedRoles={["owner"]}>
        <div className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">Candidature introuvable</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href={`/owner/listings/${listingId}/applications`}>Retour</Link>
          </Button>
        </div>
      </ProtectedRoute>
    );
  }

  const isActionable = !["accepted", "rejected", "withdrawn"].includes(application.status);

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <PageTransition>
        <div className="container mx-auto px-4 py-4 md:py-8 max-w-4xl">
          {/* Back button */}
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link href={`/owner/listings/${listingId}/applications`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Retour aux candidatures
            </Link>
          </Button>

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{application.applicant_name}</h1>
              <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                <span className="flex items-center gap-1 text-sm">
                  <Mail className="h-4 w-4" />
                  {application.applicant_email}
                </span>
                {application.applicant_phone && (
                  <span className="flex items-center gap-1 text-sm">
                    <Phone className="h-4 w-4" />
                    {application.applicant_phone}
                  </span>
                )}
              </div>
            </div>
            <Badge className={APPLICATION_STATUS_COLORS[application.status]}>
              {APPLICATION_STATUS_LABELS[application.status]}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Colonne principale */}
            <div className="lg:col-span-2 space-y-6">
              {/* Scores */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Évaluation du dossier</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Complétude du dossier</p>
                    <CompletenessBar score={application.completeness_score} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Score IA</p>
                      {application.ai_score !== null ? (
                        <ScoreBadge score={application.ai_score} />
                      ) : (
                        <p className="text-sm text-muted-foreground mt-1">Non évalué</p>
                      )}
                    </div>
                    {application.ai_score === null && isActionable && (
                      <Button
                        variant="outline"
                        onClick={handleScore}
                        disabled={scoreMutation.isPending}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Lancer le scoring IA
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Message */}
              {application.message && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Message du candidat</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {application.message}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documents ({application.documents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {application.documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Aucun document fourni
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {application.documents.map((doc, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{doc.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {DOC_TYPE_LABELS[doc.type] || doc.type}
                              </p>
                            </div>
                          </div>
                          {doc.url && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Actions */}
              {isActionable && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Décision</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AcceptRejectButtons
                      applicationId={application.id}
                      applicantName={application.applicant_name}
                      onAccept={handleAccept}
                      onReject={handleReject}
                      acceptLoading={acceptMutation.isPending}
                      rejectLoading={rejectMutation.isPending}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Infos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Reçue le {new Date(application.created_at).toLocaleDateString("fr-FR")}
                  </div>
                  {application.accepted_at && (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <Calendar className="h-4 w-4" />
                      Acceptée le {new Date(application.accepted_at).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                  {application.rejected_at && (
                    <div className="flex items-center gap-2 text-red-600">
                      <Calendar className="h-4 w-4" />
                      Refusée le {new Date(application.rejected_at).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                  {application.rejection_reason && (
                    <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300 text-xs">
                      Motif : {application.rejection_reason}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </PageTransition>
    </ProtectedRoute>
  );
}
