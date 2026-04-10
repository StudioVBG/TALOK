"use client";

/**
 * CahierExportPanel — "Récapitulatif annuel" / cahier comptable export card.
 *
 * Shows three KPI tiles (revenus, charges, résultat) from the exercise
 * balance, plus a PDF download button. Purely presentational.
 */

import type { AccountingBalance } from "@/lib/hooks/use-accounting-dashboard";
import { formatCents } from "@/lib/utils/format-cents";
import { FileText } from "lucide-react";

interface CahierExportPanelProps {
  balance: AccountingBalance | null | undefined;
  year: number;
  exerciseLabel: string;
  downloading: boolean;
  onDownload: (key: string, url: string, filename: string) => void;
}

export function CahierExportPanel({
  balance,
  year,
  exerciseLabel,
  downloading,
  onDownload,
}: CahierExportPanelProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 sm:p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="shrink-0 text-primary mt-0.5">
          <FileText className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground font-[family-name:var(--font-manrope)]">
            Recapitulatif annuel
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Synthese des revenus, charges et resultat net de l&apos;exercice.
          </p>
        </div>
      </div>

      {balance && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Revenus
            </p>
            <p className="text-sm font-bold text-emerald-500">
              {formatCents(balance.revenueCents)}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Charges
            </p>
            <p className="text-sm font-bold text-red-500">
              {formatCents(balance.expensesCents)}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Resultat
            </p>
            <p className="text-sm font-bold text-foreground">
              {formatCents(balance.resultCents)}
            </p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          onDownload(
            "fiscal-pdf",
            `/accounting/fiscal?format=pdf&year=${year}`,
            `recap_annuel_${exerciseLabel}.pdf`,
          )
        }
        disabled={downloading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border bg-muted/50 hover:bg-muted text-foreground border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-auto"
      >
        {downloading ? "Telechargement..." : "Telecharger PDF"}
      </button>
    </div>
  );
}
