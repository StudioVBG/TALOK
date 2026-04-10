"use client";

/**
 * BalanceExportPanel — "Balance générale" export card.
 *
 * Mirror of GrandLivreExportPanel for the balance endpoint. Kept as a
 * separate component so the exports page reads as a flat list of
 * sections rather than a wall of ExportCard prop literals.
 */

import { ExportCard } from "@/components/accounting/ExportCard";
import { Scale } from "lucide-react";

interface BalanceExportPanelProps {
  exerciseId: string | null;
  exerciseLabel: string;
  onDownload: (key: string, url: string, filename: string) => void;
  loadingMap: Record<string, boolean>;
}

export function BalanceExportPanel({
  exerciseId,
  exerciseLabel,
  onDownload,
  loadingMap,
}: BalanceExportPanelProps) {
  const disabled = !exerciseId;
  return (
    <ExportCard
      title="Balance generale"
      description="Soldes de chaque compte avec totaux debit et credit de l'exercice."
      icon={<Scale className="w-5 h-5" />}
      formats={[
        {
          label: "PDF",
          loading: loadingMap["bal-pdf"],
          onClick: () =>
            exerciseId &&
            onDownload(
              "bal-pdf",
              `/accounting/exercises/${exerciseId}/balance?format=pdf`,
              `balance_${exerciseLabel}.pdf`,
            ),
          disabled,
        },
        {
          label: "CSV",
          loading: loadingMap["bal-csv"],
          onClick: () =>
            exerciseId &&
            onDownload(
              "bal-csv",
              `/accounting/exercises/${exerciseId}/balance?format=csv`,
              `balance_${exerciseLabel}.csv`,
            ),
          disabled,
        },
      ]}
    />
  );
}
