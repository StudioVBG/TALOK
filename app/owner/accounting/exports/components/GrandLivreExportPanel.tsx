"use client";

/**
 * GrandLivreExportPanel — "Grand livre" export card.
 *
 * Thin wrapper around ExportCard with the PDF/CSV format buttons
 * pre-wired for the grand-livre endpoint. The parent passes the
 * exercise context and a single download handler.
 */

import { ExportCard } from "@/components/accounting/ExportCard";
import { BookOpen } from "lucide-react";

interface GrandLivreExportPanelProps {
  exerciseId: string | null;
  exerciseLabel: string;
  onDownload: (key: string, url: string, filename: string) => void;
  loadingMap: Record<string, boolean>;
}

export function GrandLivreExportPanel({
  exerciseId,
  exerciseLabel,
  onDownload,
  loadingMap,
}: GrandLivreExportPanelProps) {
  const disabled = !exerciseId;
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
            exerciseId &&
            onDownload(
              "gl-pdf",
              `/accounting/exercises/${exerciseId}/grand-livre?format=pdf`,
              `grand_livre_${exerciseLabel}.pdf`,
            ),
          disabled,
        },
        {
          label: "CSV",
          loading: loadingMap["gl-csv"],
          onClick: () =>
            exerciseId &&
            onDownload(
              "gl-csv",
              `/accounting/exercises/${exerciseId}/grand-livre?format=csv`,
              `grand_livre_${exerciseLabel}.csv`,
            ),
          disabled,
        },
      ]}
    />
  );
}
