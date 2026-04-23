"use client";

/**
 * JournalExportPanel — "Journal général" export card.
 * Same shape as Balance/GL. Downloads entries grouped by journal_code,
 * chronological inside each group.
 */

import { ExportCard } from "@/components/accounting/ExportCard";
import { FileText } from "lucide-react";

interface JournalExportPanelProps {
  exerciseId: string | null;
  exerciseLabel: string;
  entityId: string | undefined;
  onDownload: (key: string, url: string, filename: string) => void;
  loadingMap: Record<string, boolean>;
}

export function JournalExportPanel({
  exerciseId,
  exerciseLabel,
  entityId,
  onDownload,
  loadingMap,
}: JournalExportPanelProps) {
  const disabled = !exerciseId || !entityId;
  const url = (format: "pdf" | "xlsx") =>
    `/accounting/exercises/${exerciseId}/journal?entityId=${encodeURIComponent(
      entityId ?? "",
    )}&format=${format}`;
  return (
    <ExportCard
      title="Journal general"
      description="Toutes les ecritures par journal (VE, AC, BQ, OD) et par ordre chronologique."
      icon={<FileText className="w-5 h-5" />}
      formats={[
        {
          label: "PDF",
          loading: loadingMap["journal-pdf"],
          onClick: () =>
            !disabled &&
            onDownload("journal-pdf", url("pdf"), `journal_${exerciseLabel}.pdf`),
          disabled,
        },
        {
          label: "Excel",
          loading: loadingMap["journal-xlsx"],
          onClick: () =>
            !disabled &&
            onDownload("journal-xlsx", url("xlsx"), `journal_${exerciseLabel}.xlsx`),
          disabled,
        },
      ]}
    />
  );
}
