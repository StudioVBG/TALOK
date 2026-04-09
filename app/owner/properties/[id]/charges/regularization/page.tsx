"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  Calculator,
  Send,
  CheckCircle2,
  AlertTriangle,
  Euro,
  FileText,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/helpers/format";
import {
  REGULARIZATION_STATUS_LABELS,
  REGULARIZATION_STATUS_COLORS,
  getCategoryLabel,
  type ChargeCategoryCode,
  type LeaseChargeRegularization,
  type CategoryDetailItem,
} from "@/lib/charges";
import { cn } from "@/lib/utils";

const currentYear = new Date().getFullYear();

interface Lease {
  id: string;
  type_bail: string;
  statut: string;
  charges_forfaitaires: number;
  tenant_name?: string;
}

export default function OwnerRegularizationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const propertyId = params.id as string;

  const [leases, setLeases] = useState<Lease[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState("");
  const [fiscalYear, setFiscalYear] = useState(currentYear - 1);
  const [regularizations, setRegularizations] = useState<
    LeaseChargeRegularization[]
  >([]);
  const [currentCalc, setCurrentCalc] = useState<LeaseChargeRegularization | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);

  const fetchLeases = useCallback(async () => {
    try {
      const res = await fetch(`/api/leases?property_id=${propertyId}`);
      if (res.ok) {
        const data = await res.json();
        const leasesData = (data.leases || []).filter(
          (l: any) => l.statut === "active" || l.statut === "terminated"
        );
        setLeases(leasesData);
        if (leasesData.length > 0 && !selectedLeaseId) {
          setSelectedLeaseId(leasesData[0].id);
        }
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les baux",
        variant: "destructive",
      });
    }
  }, [propertyId, selectedLeaseId, toast]);

  const fetchRegularizations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/charges/regularization?property_id=${propertyId}`
      );
      if (res.ok) {
        const data = await res.json();
        setRegularizations(data.regularizations || []);

        // Check if there's already a calc for selected lease/year
        if (selectedLeaseId) {
          const existing = (data.regularizations || []).find(
            (r: any) =>
              r.lease_id === selectedLeaseId && r.fiscal_year === fiscalYear
          );
          setCurrentCalc(existing || null);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, selectedLeaseId, fiscalYear]);

  useEffect(() => {
    fetchLeases();
  }, [fetchLeases]);

  useEffect(() => {
    if (propertyId) fetchRegularizations();
  }, [propertyId, selectedLeaseId, fiscalYear, fetchRegularizations]);

  const handleCalculate = async () => {
    if (!selectedLeaseId) return;
    setIsCalculating(true);
    try {
      const res = await fetch("/api/charges/regularization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lease_id: selectedLeaseId,
          property_id: propertyId,
          fiscal_year: fiscalYear,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentCalc(data.regularization);
        toast({ title: "Régularisation calculée" });
        fetchRegularizations();
      } else {
        const err = await res.json();
        toast({
          title: "Erreur",
          description: err.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Erreur de calcul", variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSend = async () => {
    if (!currentCalc) return;
    setIsSending(true);
    try {
      const res = await fetch(
        `/api/charges/regularization/${currentCalc.id}/send`,
        { method: "POST" }
      );
      if (res.ok) {
        toast({ title: "Régularisation envoyée au locataire" });
        setShowSendDialog(false);
        fetchRegularizations();
      } else {
        const err = await res.json();
        toast({
          title: "Erreur",
          description: err.error,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Erreur d'envoi", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 1 - i);
  const details = (currentCalc?.detail_per_category || []) as CategoryDetailItem[];

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2"
            onClick={() =>
              router.push(`/owner/properties/${propertyId}/charges`)
            }
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux charges
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-600 rounded-lg shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30">
              <Calculator className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Régularisation annuelle
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Comparez les provisions versées aux charges réelles
          </p>
        </motion.div>

        {/* Controls */}
        <GlassCard className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium text-foreground">
                Bail
              </label>
              <Select
                value={selectedLeaseId}
                onValueChange={setSelectedLeaseId}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner un bail" />
                </SelectTrigger>
                <SelectContent>
                  {leases.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.type_bail} — {l.statut}
                      {l.tenant_name ? ` (${l.tenant_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[140px]">
              <label className="text-sm font-medium text-foreground">
                Année fiscale
              </label>
              <Select
                value={String(fiscalYear)}
                onValueChange={(v) => setFiscalYear(parseInt(v, 10))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleCalculate}
              disabled={!selectedLeaseId || isCalculating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isCalculating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              Calculer
            </Button>
          </div>
        </GlassCard>

        {/* Result */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        ) : currentCalc ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GlassCard className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  Provisions versées
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(currentCalc.total_provisions_cents / 100)}
                </p>
              </GlassCard>
              <GlassCard className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  Charges réelles
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(currentCalc.total_actual_cents / 100)}
                </p>
              </GlassCard>
              <GlassCard
                className={cn(
                  "p-6 text-center",
                  currentCalc.balance_cents > 0
                    ? "border-amber-300 dark:border-amber-700"
                    : currentCalc.balance_cents < 0
                      ? "border-green-300 dark:border-green-700"
                      : ""
                )}
              >
                <p className="text-sm text-muted-foreground mb-1">
                  {currentCalc.balance_cents > 0
                    ? "Complément dû par le locataire"
                    : currentCalc.balance_cents < 0
                      ? "Trop-perçu à rembourser"
                      : "Solde"}
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    currentCalc.balance_cents > 0
                      ? "text-amber-600"
                      : currentCalc.balance_cents < 0
                        ? "text-green-600"
                        : "text-foreground"
                  )}
                >
                  {formatCurrency(Math.abs(currentCalc.balance_cents) / 100)}
                </p>
              </GlassCard>
            </div>

            {/* Status + Actions */}
            <GlassCard className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Statut :
                  </span>
                  <Badge
                    className={cn(
                      REGULARIZATION_STATUS_COLORS[currentCalc.status]
                    )}
                  >
                    {REGULARIZATION_STATUS_LABELS[currentCalc.status]}
                  </Badge>
                  {currentCalc.sent_at && (
                    <span className="text-xs text-muted-foreground">
                      Envoyée le{" "}
                      {new Date(currentCalc.sent_at).toLocaleDateString("fr-FR")}
                    </span>
                  )}
                  {currentCalc.contested && (
                    <div className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs">Contestée</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {currentCalc.status === "calculated" && (
                    <Button
                      onClick={() => setShowSendDialog(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Send className="h-4 w-4 mr-2" /> Envoyer au
                      locataire
                    </Button>
                  )}
                </div>
              </div>
              {currentCalc.contest_reason && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                    Motif de contestation :
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300">
                    {currentCalc.contest_reason}
                  </p>
                </div>
              )}
            </GlassCard>

            {/* Detail per category */}
            {details.length > 0 && (
              <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Détail par catégorie
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">
                          Catégorie
                        </th>
                        <th className="text-right py-2 text-muted-foreground font-medium">
                          Budget
                        </th>
                        <th className="text-right py-2 text-muted-foreground font-medium">
                          Réel
                        </th>
                        <th className="text-right py-2 text-muted-foreground font-medium">
                          Écart
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.map((d) => (
                        <tr
                          key={d.category_id}
                          className="border-b border-border/50"
                        >
                          <td className="py-3 text-foreground">
                            {d.category_label}
                          </td>
                          <td className="py-3 text-right text-muted-foreground">
                            {formatCurrency(d.budget_cents / 100)}
                          </td>
                          <td className="py-3 text-right font-medium text-foreground">
                            {formatCurrency(d.actual_cents / 100)}
                          </td>
                          <td
                            className={cn(
                              "py-3 text-right font-medium",
                              d.difference_cents > 0
                                ? "text-amber-600"
                                : d.difference_cents < 0
                                  ? "text-green-600"
                                  : "text-muted-foreground"
                            )}
                          >
                            {d.difference_cents > 0 ? "+" : ""}
                            {formatCurrency(d.difference_cents / 100)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}

            {/* History */}
            {regularizations.length > 1 && (
              <GlassCard className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Historique des régularisations
                </h3>
                <div className="space-y-2">
                  {regularizations
                    .filter((r) => r.id !== currentCalc?.id)
                    .map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-foreground">
                            {r.fiscal_year}
                          </span>
                          <Badge
                            className={cn(
                              "text-xs",
                              REGULARIZATION_STATUS_COLORS[r.status]
                            )}
                          >
                            {REGULARIZATION_STATUS_LABELS[r.status]}
                          </Badge>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-medium",
                            r.balance_cents > 0
                              ? "text-amber-600"
                              : r.balance_cents < 0
                                ? "text-green-600"
                                : "text-foreground"
                          )}
                        >
                          {r.balance_cents > 0 ? "+" : ""}
                          {formatCurrency(r.balance_cents / 100)}
                        </span>
                      </div>
                    ))}
                </div>
              </GlassCard>
            )}
          </div>
        ) : (
          <GlassCard className="p-12 text-center">
            <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calculator className="h-8 w-8 text-emerald-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Aucune régularisation calculée
            </h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              Sélectionnez un bail et une année fiscale, puis cliquez sur
              &quot;Calculer&quot; pour lancer la régularisation annuelle.
            </p>
          </GlassCard>
        )}

        {/* Send Confirmation Dialog */}
        <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Envoyer la régularisation</DialogTitle>
              <DialogDescription>
                Le locataire recevra le détail de la régularisation et pourra
                consulter les justificatifs pendant 1 mois.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {currentCalc && (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Provisions versées
                    </span>
                    <span className="font-medium">
                      {formatCurrency(
                        currentCalc.total_provisions_cents / 100
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Charges réelles
                    </span>
                    <span className="font-medium">
                      {formatCurrency(currentCalc.total_actual_cents / 100)}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-medium text-foreground">
                      {currentCalc.balance_cents > 0
                        ? "Complément dû"
                        : "Trop-perçu"}
                    </span>
                    <span
                      className={cn(
                        "font-bold text-lg",
                        currentCalc.balance_cents > 0
                          ? "text-amber-600"
                          : "text-green-600"
                      )}
                    >
                      {formatCurrency(
                        Math.abs(currentCalc.balance_cents) / 100
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowSendDialog(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSend}
                disabled={isSending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Confirmer l&apos;envoi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
