"use client";

/**
 * DepositRestitutionForm — Formulaire de restitution du dépôt de garantie
 *
 * Permet au propriétaire de restituer un dépôt avec :
 * - Montant à restituer vs retenues
 * - Détails des retenues (motif + montant + justification)
 * - Choix du mode de restitution
 * - Calcul automatique de la pénalité de retard
 */

import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  Loader2,
  Plus,
  Trash2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import type { SecurityDeposit } from "./deposit-tracker";

interface RetenueItem {
  motif: string;
  amount_cents: number;
  justification: string;
}

interface DepositRestitutionFormProps {
  deposit: SecurityDeposit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const RETENUE_MOTIFS = [
  "Loyers impayés",
  "Dégradations constatées",
  "Charges locatives",
  "Réparations locatives",
  "Nettoyage",
  "Autre",
];

function centsToEur(cents: number): number {
  return cents / 100;
}

function eurToCents(eur: number): number {
  return Math.round(eur * 100);
}

export function DepositRestitutionForm({
  deposit,
  open,
  onOpenChange,
  onSuccess,
}: DepositRestitutionFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [restitutionMethod, setRestitutionMethod] = useState<string>("virement");
  const [notes, setNotes] = useState("");
  const [retenues, setRetenues] = useState<RetenueItem[]>([]);

  const depositAmountEur = centsToEur(deposit.amount_cents);

  // Calculated values
  const totalRetenueCents = useMemo(
    () => retenues.reduce((sum, r) => sum + r.amount_cents, 0),
    [retenues]
  );

  const restitutionCents = deposit.amount_cents - totalRetenueCents;

  // Late penalty calculation
  const latePenalty = useMemo(() => {
    if (!deposit.restitution_due_date) return 0;
    const due = new Date(deposit.restitution_due_date);
    const now = new Date();
    if (now <= due) return 0;
    const monthsLate = Math.ceil(
      (now.getTime() - due.getTime()) / (30 * 24 * 60 * 60 * 1000)
    );
    const monthlyRentCents = (deposit.lease?.loyer || 0) * 100;
    return Math.round(monthlyRentCents * 0.1 * monthsLate);
  }, [deposit.restitution_due_date, deposit.lease?.loyer]);

  const isOverdue =
    deposit.restitution_due_date &&
    new Date(deposit.restitution_due_date) < new Date();

  // Add retenue
  const addRetenue = () => {
    setRetenues((prev) => [
      ...prev,
      { motif: "", amount_cents: 0, justification: "" },
    ]);
  };

  const updateRetenue = (index: number, field: keyof RetenueItem, value: string | number) => {
    setRetenues((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, [field]: value } : r
      )
    );
  };

  const removeRetenue = (index: number) => {
    setRetenues((prev) => prev.filter((_, i) => i !== index));
  };

  // Validation
  const isValid = useMemo(() => {
    if (totalRetenueCents > deposit.amount_cents) return false;
    if (totalRetenueCents < 0) return false;
    if (restitutionCents < 0) return false;
    // All retenues must have a motif
    if (retenues.some((r) => !r.motif || r.amount_cents <= 0)) return false;
    return true;
  }, [totalRetenueCents, deposit.amount_cents, restitutionCents, retenues]);

  // Submit
  const handleSubmit = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/deposits/${deposit.id}/restitute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restitution_amount_cents: restitutionCents,
          retenue_cents: totalRetenueCents,
          retenue_details: retenues.filter((r) => r.amount_cents > 0),
          restitution_method: restitutionMethod,
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la restitution");
      }

      toast({
        title: "Restitution enregistrée",
        description:
          totalRetenueCents > 0
            ? `Restitution partielle : ${centsToEur(restitutionCents).toFixed(2)}€ (retenues : ${centsToEur(totalRetenueCents).toFixed(2)}€)`
            : `Restitution intégrale : ${depositAmountEur.toFixed(2)}€`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la restitution",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fmt = (cents: number) =>
    centsToEur(cents).toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR",
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowDownRight className="h-5 w-5" />
            Restitution du dépôt de garantie
          </DialogTitle>
          <DialogDescription>
            {deposit.tenant
              ? `${deposit.tenant.prenom} ${deposit.tenant.nom}`
              : "Locataire"}{" "}
            — {fmt(deposit.amount_cents)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Late penalty warning */}
          {isOverdue && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800/50 p-3 flex gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-red-800 dark:text-red-300">
                  Restitution en retard
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  Date limite dépassée ({new Date(deposit.restitution_due_date!).toLocaleDateString("fr-FR")}).
                  Pénalité estimée : {fmt(latePenalty)} (10% du loyer/mois).
                </p>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Dépôt encaissé</span>
              <span className="font-bold">{fmt(deposit.amount_cents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Retenues</span>
              <span
                className={cn(
                  "font-medium",
                  totalRetenueCents > 0 ? "text-red-600" : "text-muted-foreground"
                )}
              >
                − {fmt(totalRetenueCents)}
              </span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span className="font-semibold">À restituer</span>
              <span
                className={cn(
                  "font-bold text-lg",
                  restitutionCents > 0 ? "text-emerald-600" : "text-muted-foreground"
                )}
              >
                {fmt(restitutionCents)}
              </span>
            </div>
          </div>

          {/* Retenues */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Retenues</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRetenue}
                className="gap-1 h-7 text-xs"
              >
                <Plus className="h-3 w-3" />
                Ajouter une retenue
              </Button>
            </div>

            {retenues.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-lg p-3">
                <Info className="h-4 w-4 shrink-0" />
                <span>
                  Si l&apos;EDL de sortie est conforme, restituez l&apos;intégralité du dépôt sans retenue.
                </span>
              </div>
            )}

            {retenues.map((retenue, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2 bg-card">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={retenue.motif}
                      onValueChange={(v) => updateRetenue(index, "motif", v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Motif de la retenue" />
                      </SelectTrigger>
                      <SelectContent>
                        {RETENUE_MOTIFS.map((motif) => (
                          <SelectItem key={motif} value={motif}>
                            {motif}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      min={0}
                      max={centsToEur(deposit.amount_cents)}
                      step={0.01}
                      placeholder="Montant"
                      className="h-8 text-xs"
                      value={retenue.amount_cents > 0 ? centsToEur(retenue.amount_cents) : ""}
                      onChange={(e) =>
                        updateRetenue(index, "amount_cents", eurToCents(parseFloat(e.target.value) || 0))
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => removeRetenue(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Textarea
                  placeholder="Justification (photos EDL, factures...)"
                  className="min-h-[60px] text-xs"
                  value={retenue.justification}
                  onChange={(e) => updateRetenue(index, "justification", e.target.value)}
                />
              </div>
            ))}

            {totalRetenueCents > deposit.amount_cents && (
              <p className="text-xs text-red-600 font-medium">
                Le total des retenues dépasse le montant du dépôt.
              </p>
            )}
          </div>

          {/* Restitution method */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Mode de restitution</Label>
            <Select value={restitutionMethod} onValueChange={setRestitutionMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="virement">Virement bancaire</SelectItem>
                <SelectItem value="cheque">Chèque</SelectItem>
                <SelectItem value="especes">Espèces</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Notes (optionnel)</Label>
            <Textarea
              placeholder="Informations complémentaires..."
              className="min-h-[60px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading} className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            Confirmer la restitution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
