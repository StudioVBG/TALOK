"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Loader2,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────

interface FECPreviewProps {
  lineCount: number;
  errors: string[];
  warnings: string[];
  onDownload: () => void;
  downloading?: boolean;
}

// ── Component ───────────────────────────────────────────────────────

export function FECPreview({
  lineCount,
  errors,
  warnings,
  onDownload,
  downloading,
}: FECPreviewProps) {
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  return (
    <div className="space-y-3">
      {/* Status banner */}
      {hasErrors ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-400">
              FEC non conforme — {errors.length} erreur{errors.length > 1 ? "s" : ""} a corriger
            </p>
            <ul className="mt-2 space-y-1">
              {errors.map((err, i) => (
                <li key={i} className="text-xs text-red-300/90 flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5">-</span>
                  <span>{err}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-400">
              FEC conforme — {lineCount} ligne{lineCount > 1 ? "s" : ""}, pret a exporter
            </p>
          </div>
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-400">
              {warnings.length} avertissement{warnings.length > 1 ? "s" : ""}
            </p>
            <ul className="mt-2 space-y-1">
              {warnings.map((w, i) => (
                <li key={i} className="text-xs text-amber-300/90 flex items-start gap-1.5">
                  <span className="shrink-0 mt-0.5">-</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Download button */}
      <button
        type="button"
        onClick={onDownload}
        disabled={hasErrors || downloading}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          hasErrors
            ? "bg-muted text-muted-foreground border border-border"
            : "bg-teal-600 hover:bg-teal-500 text-white"
        )}
      >
        {downloading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Telecharger le FEC
      </button>
    </div>
  );
}

export default FECPreview;
