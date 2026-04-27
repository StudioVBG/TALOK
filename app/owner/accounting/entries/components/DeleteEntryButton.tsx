"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Trash2, Loader2, X } from "lucide-react";

interface DeleteEntryButtonProps {
  entryId: string;
  entryNumber: string;
  entryLabel: string;
  /** "icon" for in-table compact, "button" for the detail page header. */
  variant?: "icon" | "button";
}

/**
 * Bouton + modal de confirmation pour supprimer un brouillon.
 *
 * Une écriture validée ne peut pas être supprimée (intangibilité comptable,
 * art. A47 LPF) — utiliser ReverseEntryButton à la place. Le garde-fou est
 * dupliqué côté API : DELETE /api/accounting/entries/:id renvoie 400 si
 * `is_validated` ou `valid_date` est posé.
 */
export function DeleteEntryButton({
  entryId,
  entryNumber,
  entryLabel,
  variant = "icon",
}: DeleteEntryButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () =>
      apiClient.delete(`/accounting/entries/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "entries"] });
      queryClient.invalidateQueries({ queryKey: ["accounting", "balance-generale"] });
      queryClient.invalidateQueries({ queryKey: ["accounting", "grand-livre"] });
      setOpen(false);
    },
    onError: (err: Error) => {
      setError(err.message ?? "Erreur lors de la suppression");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    deleteMutation.mutate();
  };

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
          title="Supprimer ce brouillon"
          aria-label="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/40 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Supprimer
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => !deleteMutation.isPending && setOpen(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="bg-card rounded-xl border border-border w-full max-w-md mx-4 p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Supprimer ce brouillon ?
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Cette écriture n'a pas encore été validée — elle peut être
                  supprimée définitivement. Une écriture validée doit être
                  contre-passée à la place (intangibilité comptable).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={deleteMutation.isPending}
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

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-muted/50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleteMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                Supprimer définitivement
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
