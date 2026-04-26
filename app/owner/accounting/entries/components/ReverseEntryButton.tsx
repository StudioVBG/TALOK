"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Undo2, Loader2, X } from "lucide-react";

interface ReverseEntryButtonProps {
  entryId: string;
  entryNumber: string;
  entryLabel: string;
  /** Si true, l'écriture est déjà extournée → bouton désactivé. */
  alreadyReversed?: boolean;
  /** Variante "icon" pour intégration en table (compact) ou "button" (texte). */
  variant?: "icon" | "button";
}

/**
 * Bouton + modal pour contre-passer une écriture comptable validée.
 * Appelle POST /api/accounting/entries/:id/reverse avec un motif obligatoire.
 * L'écriture d'extourne est posée par engine.reverseEntry (D/C inversés,
 * journal OD, source 'auto:reversal').
 */
export function ReverseEntryButton({
  entryId,
  entryNumber,
  entryLabel,
  alreadyReversed,
  variant = "icon",
}: ReverseEntryButtonProps) {
  const [open, setOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const reverseMutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/accounting/entries/${entryId}/reverse`, {
        motif: motif.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "entries"] });
      queryClient.invalidateQueries({ queryKey: ["accounting", "balance-generale"] });
      queryClient.invalidateQueries({ queryKey: ["accounting", "grand-livre"] });
      setOpen(false);
      setMotif("");
    },
    onError: (err: Error) => {
      setError(err.message ?? "Erreur lors de la contre-passation");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (motif.trim().length < 3) {
      setError("Le motif doit contenir au moins 3 caractères");
      return;
    }
    reverseMutation.mutate();
  };

  if (alreadyReversed) return null;

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
          title="Contre-passer cette écriture"
          aria-label="Contre-passer"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/40 transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Contre-passer
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => !reverseMutation.isPending && setOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="bg-card rounded-xl border border-border w-full max-w-md mx-4 p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Contre-passer une écriture
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Une écriture d'extourne sera créée dans le journal OD avec
                  les débits et crédits inversés. L'écriture originale reste
                  intangible (intangibilité comptable).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={reverseMutation.isPending}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-xs space-y-0.5">
              <div>
                <span className="text-muted-foreground">N° écriture :</span>{" "}
                <span className="font-mono">{entryNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Libellé :</span>{" "}
                {entryLabel}
              </div>
            </div>

            <label className="space-y-1 block">
              <span className="text-xs font-medium text-muted-foreground">
                Motif de la contre-passation <span className="text-rose-600">*</span>
              </span>
              <textarea
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                rows={3}
                placeholder="Ex. Erreur de saisie, doublon, paiement annulé…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                required
                minLength={3}
                maxLength={255}
                autoFocus
              />
              <span className="text-[11px] text-muted-foreground">
                Le motif sera repris dans le libellé de l'écriture d'extourne et
                conservé en audit log.
              </span>
            </label>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={reverseMutation.isPending}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-muted/50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={reverseMutation.isPending || motif.trim().length < 3}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {reverseMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Contre-passer
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
