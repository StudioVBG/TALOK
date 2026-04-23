"use client";

/**
 * GrandLivreExportPanel — "Grand livre" export card.
 *
 * Thin wrapper around ExportCard with PDF/XLSX buttons pre-wired for the
 * grand-livre endpoint. Parent passes the exercise + entity context and a
 * single download handler.
 */

import { ExportCard } from "@/components/accounting/ExportCard";
import { BookOpen } from "lucide-react";

interface GrandLivreExportPanelProps {
  exerciseId: string | null;
  exerciseLabel: string;
  entityId: string | undefined;
  onDownload: (key: string, url: string, filename: string) => void;
  loadingMap: Record<string, boolean>;
}

export function GrandLivreExportPanel({
  exerciseId,
  exerciseLabel,
  entityId,
  onDownload,
  loadingMap,
}: GrandLivreExportPanelProps) {
  const disabled = !exerciseId || !entityId;
  const url = (format: "pdf" | "xlsx") =>
    `/accounting/exercises/${exerciseId}/grand-livre?entityId=${encodeURIComponent(
      entityId ?? "",
    )}&format=${format}`;
  return (
    <ExportCard
      title="Grand livre"
      description="Toutes les ecritures classees par compte, avec le detail des mouvements."
      icon={<BookOpen className="w-5 h-5" />}
      formats={[
        {
          label: "PDF",
          loading: loadingMap["gl-pdf"],
          onClick: () =>
            !disabled &&
            onDownload("gl-pdf", url("pdf"), `grand_livre_${exerciseLabel}.pdf`),
          disabled,
        },
        {
          label: "Excel",
          loading: loadingMap["gl-xlsx"],
          onClick: () =>
            !disabled &&
            onDownload("gl-xlsx", url("xlsx"), `grand_livre_${exerciseLabel}.xlsx`),
          disabled,
        },
      ]}
    />
  );
}
