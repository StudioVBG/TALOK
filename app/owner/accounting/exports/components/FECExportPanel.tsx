"use client";

/**
 * FECExportPanel — FEC (Fichier des Écritures Comptables) section of the
 * exports page. Pure presentational: the parent owns exerciseId and the
 * preview/download handlers.
 */

import { PlanGate } from "@/components/subscription/plan-gate";
import { FECPreview } from "@/components/accounting/FECPreview";
import { ShieldCheck } from "lucide-react";

export interface FECPreviewResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  lineCount: number;
}

interface FECExportPanelProps {
  exerciseId: string | null;
  fecPreview: FECPreviewResult | null;
  fecPreviewLoading: boolean;
  fecDownloading: boolean;
  onLoadPreview: () => void;
  onDownload: () => void;
}

export function FECExportPanel({
  exerciseId,
  fecPreview,
  fecPreviewLoading,
  fecDownloading,
  onLoadPreview,
  onDownload,
}: FECExportPanelProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5 flex flex-col gap-3 md:col-span-2">
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-teal-500 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground font-[family-name:var(--font-manrope)]">
            Export FEC
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Fichier des Ecritures Comptables au format reglementaire.
            Obligatoire en cas de controle fiscal.
          </p>
        </div>
      </div>

      <PlanGate feature="bank_reconciliation" mode="blur">
        <div className="space-y-3">
          {!fecPreview && (
            <button
              type="button"
              onClick={onLoadPreview}
              disabled={fecPreviewLoading || !exerciseId}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {fecPreviewLoading
                ? "Verification en cours..."
                : "Verifier et generer le FEC"}
            </button>
          )}

          {fecPreview && (
            <FECPreview
              lineCount={fecPreview.lineCount}
              errors={fecPreview.errors}
              warnings={fecPreview.warnings}
              onDownload={onDownload}
              downloading={fecDownloading}
            />
          )}
        </div>
      </PlanGate>
    </div>
  );
}
