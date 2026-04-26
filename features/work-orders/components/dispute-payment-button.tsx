"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

const REASONS = [
  { value: "work_not_done", label: "Travaux non réalisés" },
  { value: "work_incomplete", label: "Travaux partiellement réalisés" },
  { value: "quality_issue", label: "Problème de qualité" },
  { value: "wrong_amount", label: "Montant incorrect" },
  { value: "unauthorized", label: "Paiement non autorisé" },
  { value: "other", label: "Autre" },
] as const;

interface Props {
  workOrderId: string;
  paymentId: string;
  onDisputed?: () => void;
  size?: "sm" | "default";
  variant?: "destructive" | "outline";
}

/**
 * Bouton "Contester ce paiement" pour le proprio. Ouvre un modal qui collecte
 * motif + description (>=20 chars) puis poste sur
 * /api/work-orders/[id]/dispute. Bloque la libération automatique des fonds.
 */
export function DisputePaymentButton({
  workOrderId,
  paymentId,
  onDisputed,
  size = "default",
  variant = "outline",
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!reason || description.trim().length < 20) {
      toast({
        title: "Champs incomplets",
        description: "Sélectionnez un motif et décrivez le problème (20 caractères min)",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/work-orders/${workOrderId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_id: paymentId,
          reason,
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Erreur lors de la contestation");
      }
      toast({
        title: "Contestation enregistrée",
        description:
          "Le paiement est bloqué. Notre équipe vous contactera sous 48h pour examiner votre demande.",
      });
      setOpen(false);
      setReason("");
      setDescription("");
      onDisputed?.();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className="text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-950/30"
      >
        <ShieldAlert className="h-4 w-4 mr-2" />
        Contester ce paiement
      </Button>

      <Dialog open={open} onOpenChange={(o) => !submitting && setOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Contester le paiement
            </DialogTitle>
            <DialogDescription>
              Cette contestation bloque la libération des fonds vers le
              prestataire. Notre équipe examinera votre dossier et tranchera
              sous 48 à 72 heures (libération, remboursement total ou partiel).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dispute-reason">Motif</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="dispute-reason">
                  <SelectValue placeholder="Sélectionner un motif" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dispute-description">
                Description détaillée
                <span className="text-muted-foreground text-xs ml-1">
                  (20 caractères minimum)
                </span>
              </Label>
              <Textarea
                id="dispute-description"
                rows={5}
                placeholder="Décrivez précisément le problème : ce qui était prévu vs ce qui a été fait, dates, échanges avec le prestataire…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {description.trim().length}/2000 caractères
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={submit}
              disabled={
                submitting || !reason || description.trim().length < 20
              }
              variant="destructive"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldAlert className="h-4 w-4 mr-2" />
              )}
              Confirmer la contestation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
