"use client";

/**
 * BulkActions — action bar shown when at least one draft entry is selected.
 *
 * Exposes both "validate selected" (turns drafts into intangible journal
 * entries) and "delete selected" (removes drafts permanently). The delete
 * action is restricted to drafts at the API layer too — the bulk button
 * here is just convenience for the common "I selected a batch of mistaken
 * imports, drop them" workflow.
 *
 * Dumb component: the parent owns the selection Set and both mutations.
 */

import { useState } from "react";
import { Loader2, CheckCircle2, Trash2, X } from "lucide-react";

interface BulkActionsProps {
  selectedCount: number;
  isValidating: boolean;
  isDeleting: boolean;
  onValidateSelected: () => void;
  onDeleteSelected: () => void;
}

export function BulkActions({
  selectedCount,
  isValidating,
  isDeleting,
  onValidateSelected,
  onDeleteSelected,
}: BulkActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (selectedCount === 0) return null;

  const busy = isValidating || isDeleting;

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
        <span className="text-sm font-medium text-foreground">
          {selectedCount} ecriture{selectedCount > 1 ? "s" : ""} selectionnee
          {selectedCount > 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={onValidateSelected}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isValidating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          Valider les {selectedCount} selectionnees
        </button>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-card px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
          Supprimer la selection
        </button>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => !isDeleting && setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-xl border border-border w-full max-w-md mx-4 p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Supprimer {selectedCount} brouillon
                  {selectedCount > 1 ? "s" : ""} ?
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Les écritures sélectionnées seront supprimées définitivement.
                  Cette action est irréversible. Les écritures déjà validées
                  doivent être contre-passées à la place.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isDeleting}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isDeleting}
                className="rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-muted/50 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSelected();
                  setConfirmOpen(false);
                }}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
