"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Euro,
  Send,
  Eye,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
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
  type LeaseChargeRegularization,
  type CategoryDetailItem,
} from "@/lib/charges";
import { cn } from "@/lib/utils";

export default function TenantChargesPage() {
  const { toast } = useToast();

  const [regularizations, setRegularizations] = useState<
    LeaseChargeRegularization[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReg, setSelectedReg] =
    useState<LeaseChargeRegularization | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showContestDialog, setShowContestDialog] = useState(false);
  const [contestReason, setContestReason] = useState("");
  const [isContesting, setIsContesting] = useState(false);

  const fetchRegularizations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/charges/regularization");
      if (res.ok) {
        const data = await res.json();
        setRegularizations(data.regularizations || []);
      }
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de charger les régularisations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRegularizations();
  }, [fetchRegularizations]);

  const handleContest = async () => {
    if (!selectedReg || contestReason.length < 10) return;
    setIsContesting(true);
    try {
      const res = await fetch(
        `/api/charges/regularization/${selectedReg.id}/contest`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contest_reason: contestReason }),
        }
      );
      if (res.ok) {
        toast({ title: "Contestation enregistrée" });
        setShowContestDialog(false);
        setContestReason("");
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
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setIsContesting(false);
    }
  };

  const openDetail = (reg: LeaseChargeRegularization) => {
    setSelectedReg(reg);
    setShowDetailDialog(true);
  };

  const openContest = (reg: LeaseChargeRegularization) => {
    setSelectedReg(reg);
    setShowContestDialog(true);
  };

  const sentRegularizations = regularizations.filter(
    (r) => r.status !== "draft" && r.status !== "calculated"
  );

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-200 dark:shadow-blue-900/30">
              <Receipt className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Mes charges
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Régularisation annuelle des charges locatives
          </p>
        </motion.div>

        {/* Info banner */}
        <GlassCard className="p-4 border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Vos droits
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Vous pouvez consulter les justificatifs pendant 1 mois après
                réception du décompte. Vous disposez de 1 an pour contester
                une régularisation.
              </p>
            </div>
          </div>
        </GlassCard>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        ) : sentRegularizations.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <div className="h-16 w-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Aucune régularisation
            </h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              Votre propriétaire n&apos;a pas encore envoyé de régularisation
              de charges.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {sentRegularizations.map((reg, idx) => (
              <motion.div
                key={reg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <GlassCard className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          Régularisation {reg.fiscal_year}
                        </h3>
                        <Badge
                          className={cn(
                            "text-xs",
                            REGULARIZATION_STATUS_COLORS[reg.status]
                          )}
                        >
                          {REGULARIZATION_STATUS_LABELS[reg.status]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          Provisions :{" "}
                          {formatCurrency(
                            reg.total_provisions_cents / 100
                          )}
                        </span>
                        <span>
                          Réel :{" "}
                          {formatCurrency(reg.total_actual_cents / 100)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {reg.balance_cents > 0
                            ? "Complément à payer"
                            : reg.balance_cents < 0
                              ? "Remboursement"
                              : "Soldé"}
                        </p>
                        <p
                          className={cn(
                            "text-xl font-bold",
                            reg.balance_cents > 0
                              ? "text-amber-600"
                              : reg.balance_cents < 0
                                ? "text-green-600"
                                : "text-foreground"
                          )}
                        >
                          {formatCurrency(
                            Math.abs(reg.balance_cents) / 100
                          )}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetail(reg)}
                        >
                          <Eye className="h-4 w-4 mr-1" /> Détail
                        </Button>
                        {reg.status === "sent" && !reg.contested && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                            onClick={() => openContest(reg)}
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />{" "}
                            Contester
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {reg.contested && reg.contest_reason && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-red-700 dark:text-red-400">
                          Contestation enregistrée
                        </span>
                      </div>
                      <p className="text-sm text-red-600 dark:text-red-300">
                        {reg.contest_reason}
                      </p>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Détail — Régularisation {selectedReg?.fiscal_year}
              </DialogTitle>
            </DialogHeader>
            {selectedReg && (
              <div className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Provisions versées
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(
                        selectedReg.total_provisions_cents / 100
                      )}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Charges réelles
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(
                        selectedReg.total_actual_cents / 100
                      )}
                    </p>
                  </div>
                </div>

                {(
                  (selectedReg.detail_per_category || []) as CategoryDetailItem[]
                ).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">
                      Par catégorie
                    </h4>
                    <div className="space-y-2">
                      {(
                        (selectedReg.detail_per_category ||
                          []) as CategoryDetailItem[]
                      ).map((d) => (
                        <div
                          key={d.category_id}
                          className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                        >
                          <span className="text-sm text-foreground">
                            {d.category_label}
                          </span>
                          <span className="text-sm font-medium text-foreground">
                            {formatCurrency(d.actual_cents / 100)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-foreground">
                      {selectedReg.balance_cents > 0
                        ? "Complément à payer"
                        : "Trop-perçu à recevoir"}
                    </span>
                    <span
                      className={cn(
                        "text-xl font-bold",
                        selectedReg.balance_cents > 0
                          ? "text-amber-600"
                          : "text-green-600"
                      )}
                    >
                      {formatCurrency(
                        Math.abs(selectedReg.balance_cents) / 100
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Contest Dialog */}
        <Dialog open={showContestDialog} onOpenChange={setShowContestDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Contester la régularisation</DialogTitle>
              <DialogDescription>
                Vous avez 1 an pour contester cette régularisation. Détaillez
                les raisons de votre contestation ci-dessous.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                value={contestReason}
                onChange={(e) => setContestReason(e.target.value)}
                placeholder="Décrivez les raisons de votre contestation (minimum 10 caractères)..."
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {contestReason.length}/2000 caractères
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowContestDialog(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={handleContest}
                disabled={contestReason.length < 10 || isContesting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isContesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Envoyer la contestation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageTransition>
  );
}
