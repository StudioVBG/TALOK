"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Calendar,
  Euro,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Home,
  User,
  Calculator,
  Download,
  Send,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { endOfLeaseService } from "@/features/end-of-lease/services/settlement.service";
import type {
  DepartureNoticeWithDetails,
  SettlementWithDetails,
  SettlementCalculation,
} from "@/lib/types/end-of-lease";
import {
  DEPARTURE_STATUS_LABELS,
  DEPARTURE_REASON_LABELS,
  SETTLEMENT_STATUS_LABELS,
  DEDUCTION_TYPE_LABELS,
} from "@/lib/types/end-of-lease";

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

function daysUntil(date: string): number {
  const target = new Date(date);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function EndOfLeasePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const leaseId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<DepartureNoticeWithDetails | null>(null);
  const [settlement, setSettlement] = useState<SettlementWithDetails | null>(null);
  const [calculation, setCalculation] = useState<SettlementCalculation | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        // Charger le préavis
        const noticeData = await endOfLeaseService.getDepartureNoticeByLease(leaseId);
        setNotice(noticeData);

        // Charger le solde existant
        const settlementData = await endOfLeaseService.getSettlementByLease(leaseId);
        setSettlement(settlementData);

        // Calculer le solde
        if (noticeData) {
          const calc = await endOfLeaseService.calculateSettlement(leaseId);
          setCalculation(calc);
        }
      } catch (error: any) {
        console.error("Erreur chargement:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [leaseId]);

  const handleGenerateSettlement = async () => {
    setGenerating(true);
    try {
      const newSettlement = await endOfLeaseService.generateSettlement(leaseId);
      setSettlement(newSettlement as SettlementWithDetails);
      toast({
        title: "Solde généré",
        description: "Le solde de tout compte a été créé.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de générer le solde",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSendForValidation = async () => {
    if (!settlement) return;
    try {
      const updated = await endOfLeaseService.sendForValidation(settlement.id);
      setSettlement(updated as SettlementWithDetails);
      toast({
        title: "Envoyé",
        description: "Le solde a été envoyé au locataire pour validation.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Aucun préavis</AlertTitle>
          <AlertDescription>
            Aucun préavis de départ n'a été enregistré pour ce bail.
            Le locataire ou vous-même devez d'abord donner un préavis.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Link href={`/owner/leases/${leaseId}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au bail
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const property = notice.lease?.property;
  const daysLeft = daysUntil(notice.expected_departure_date);
  const isOverdue = settlement?.is_overdue;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <Link href={`/owner/leases/${leaseId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Fin de bail</h1>
          <p className="text-muted-foreground">
            {property?.adresse_complete}, {property?.ville}
          </p>
        </div>
      </div>

      {/* Alertes */}
      {isOverdue && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Délai dépassé</AlertTitle>
          <AlertDescription>
            Le délai légal de restitution du dépôt de garantie est dépassé.
            Vous devez rembourser le locataire au plus vite avec des pénalités de retard.
          </AlertDescription>
        </Alert>
      )}

      {settlement?.status === "contested" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Solde contesté</AlertTitle>
          <AlertDescription>
            Le locataire a contesté le solde de tout compte.
            Raison : {settlement.contest_reason}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="notice" className="space-y-6">
        <TabsList>
          <TabsTrigger value="notice">Préavis</TabsTrigger>
          <TabsTrigger value="settlement">Solde de tout compte</TabsTrigger>
          <TabsTrigger value="comparison">Comparaison EDL</TabsTrigger>
        </TabsList>

        {/* Onglet Préavis */}
        <TabsContent value="notice" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Préavis de départ</CardTitle>
                  <CardDescription>
                    Donné par {notice.initiated_by === "tenant" ? "le locataire" : "le propriétaire"}
                  </CardDescription>
                </div>
                <Badge
                  className={
                    notice.status === "accepted"
                      ? "bg-green-100 text-green-800"
                      : notice.status === "contested"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }
                >
                  {DEPARTURE_STATUS_LABELS[notice.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date du préavis</p>
                      <p className="font-medium">{formatDate(notice.notice_date)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date de départ prévue</p>
                      <p className="font-medium">
                        {formatDate(notice.expected_departure_date)}
                        {daysLeft > 0 && (
                          <span className="text-muted-foreground ml-2">
                            (dans {daysLeft} jours)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Durée du préavis</p>
                      <p className="font-medium">{notice.notice_period_months} mois</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {notice.reason && (
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Motif</p>
                        <p className="font-medium">{DEPARTURE_REASON_LABELS[notice.reason]}</p>
                        {notice.reason_details && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {notice.reason_details}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {notice.acknowledgment_method && (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Accusé de réception</p>
                        <p className="font-medium">
                          {notice.acknowledgment_date && formatDate(notice.acknowledgment_date)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {notice.status === "pending" && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={async () => {
                      await endOfLeaseService.acceptDepartureNotice(notice.id);
                      setNotice({ ...notice, status: "accepted" });
                      toast({ title: "Préavis accepté" });
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Accepter le préavis
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Solde de tout compte */}
        <TabsContent value="settlement" className="space-y-6">
          {!settlement ? (
            <Card>
              <CardHeader>
                <CardTitle>Solde de tout compte</CardTitle>
                <CardDescription>
                  Calculez et générez le solde de tout compte pour la restitution du dépôt de garantie
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {calculation && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-muted/50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Dépôt de garantie</p>
                          <p className="text-2xl font-bold">
                            {formatCurrency(calculation.deposit_amount)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-muted/50">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Retenues estimées</p>
                          <p className="text-2xl font-bold text-orange-600">
                            -{formatCurrency(calculation.total_deductions)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">À rembourser</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(calculation.amount_to_return)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button
                    size="lg"
                    onClick={handleGenerateSettlement}
                    disabled={generating}
                  >
                    {generating ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Génération...
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4 mr-2" />
                        Générer le solde de tout compte
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Solde de tout compte</CardTitle>
                      <CardDescription>
                        Délai légal : {formatDate(settlement.legal_deadline)}
                      </CardDescription>
                    </div>
                    <Badge
                      className={
                        settlement.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : settlement.status === "contested"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }
                    >
                      {SETTLEMENT_STATUS_LABELS[settlement.status]}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Résumé financier */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Dépôt initial</p>
                      <p className="text-xl font-bold">
                        {formatCurrency(settlement.deposit_amount)}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Retenues</p>
                      <p className="text-xl font-bold text-orange-600">
                        -{formatCurrency(settlement.total_deductions)}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">À rembourser</p>
                      <p className="text-xl font-bold text-green-600">
                        {formatCurrency(settlement.amount_to_return)}
                      </p>
                    </div>
                    {settlement.amount_to_pay > 0 && (
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Dû par locataire</p>
                        <p className="text-xl font-bold text-red-600">
                          {formatCurrency(settlement.amount_to_pay)}
                        </p>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Détail des retenues */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">Détail des retenues</h3>
                      <Link href={`/owner/end-of-lease/${leaseId}/deductions`}>
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Ajouter une retenue
                        </Button>
                      </Link>
                    </div>

                    {settlement.deduction_items && settlement.deduction_items.length > 0 ? (
                      <div className="space-y-2">
                        {settlement.deduction_items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">
                                {DEDUCTION_TYPE_LABELS[item.deduction_type]}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {item.description}
                              </p>
                            </div>
                            <p className="font-semibold text-orange-600">
                              -{formatCurrency(item.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        Aucune retenue pour le moment
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3">
                    {settlement.status === "draft" && (
                      <Button onClick={handleSendForValidation}>
                        <Send className="h-4 w-4 mr-2" />
                        Envoyer au locataire
                      </Button>
                    )}
                    {settlement.status === "validated" && (
                      <Link href={`/owner/end-of-lease/${leaseId}/pay`}>
                        <Button>
                          <Euro className="h-4 w-4 mr-2" />
                          Marquer comme remboursé
                        </Button>
                      </Link>
                    )}
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger le document
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Onglet Comparaison EDL */}
        <TabsContent value="comparison" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Comparaison des états des lieux</CardTitle>
              <CardDescription>
                Comparez l'état des lieux d'entrée et de sortie pour identifier les dégradations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Fonctionnalité de comparaison automatique des EDL
                </p>
                <Link href={`/owner/end-of-lease/${leaseId}/comparison`}>
                  <Button>
                    Comparer les EDL
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}







