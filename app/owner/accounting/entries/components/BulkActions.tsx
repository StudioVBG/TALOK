"use client";

/**
 * BulkActions — action bar shown when at least one draft entry is
 * selected. Currently exposes only "validate selected"; delete is not
 * wired yet because the corresponding backend route is admin-only and
 * goes through a different flow.
 *
 * Dumb component: the parent owns the selection Set and the validate
 * mutation; we just render the CTA.
 */

import { Loader2, CheckCircle2 } from "lucide-react";

interface BulkActionsProps {
  selectedCount: number;
  isValidating: boolean;
  onValidateSelected: () => void;
}

export function BulkActions({
  selectedCount,
  isValidating,
  onValidateSelected,
}: BulkActionsProps) {
  if (selectedCount === 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
      <span className="text-sm font-medium text-foreground">
        {selectedCount} ecriture{selectedCount > 1 ? "s" : ""} selectionnee
        {selectedCount > 1 ? "s" : ""}
      </span>
      <button
        type="button"
        onClick={onValidateSelected}
        disabled={isValidating}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isValidating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5" />
        )}
        Valider les {selectedCount} selectionnees
      </button>
    </div>
  );
}
