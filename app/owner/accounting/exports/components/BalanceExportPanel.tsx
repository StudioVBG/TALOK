"use client";

/**
 * BalanceExportPanel — "Balance générale" export card.
 */

import { ExportCard } from "@/components/accounting/ExportCard";
import { Scale } from "lucide-react";

interface BalanceExportPanelProps {
  exerciseId: string | null;
  exerciseLabel: string;
  entityId: string | undefined;
  onDownload: (key: string, url: string, filename: string) => void;
  loadingMap: Record<string, boolean>;
}

export function BalanceExportPanel({
  exerciseId,
  exerciseLabel,
  entityId,
  onDownload,
  loadingMap,
}: BalanceExportPanelProps) {
  const disabled = !exerciseId || !entityId;
  const url = (format: "pdf" | "xlsx") =>
    `/accounting/exercises/${exerciseId}/balance?entityId=${encodeURIComponent(
      entityId ?? "",
    )}&format=${format}`;
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
            !disabled &&
            onDownload("bal-pdf", url("pdf"), `balance_${exerciseLabel}.pdf`),
          disabled,
        },
        {
          label: "Excel",
          loading: loadingMap["bal-xlsx"],
          onClick: () =>
            !disabled &&
            onDownload("bal-xlsx", url("xlsx"), `balance_${exerciseLabel}.xlsx`),
          disabled,
        },
      ]}
    />
  );
}
