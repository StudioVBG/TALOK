"use client";

import Link from "next/link";
import { formatCents } from "@/lib/utils/format-cents";
import { cn } from "@/lib/utils";
import type { AccountingEntry } from "@/lib/hooks/use-accounting-dashboard";

interface RecentEntriesProps {
  entries: AccountingEntry[];
}

const sourceLabels: Record<AccountingEntry["source"], string> = {
  manual: "Manuel",
  stripe: "Stripe",
  ocr: "OCR",
};

const sourceBadge: Record<AccountingEntry["source"], string> = {
  manual: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  stripe: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  ocr: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

function StatusBadge({ isValidated }: { isValidated: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border",
        isValidated
          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
      )}
    >
      {isValidated ? "Valide" : "Brouillon"}
    </span>
  );
}

function SourceBadge({ source }: { source: AccountingEntry["source"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border",
        sourceBadge[source]
      )}
    >
      {sourceLabels[source]}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function RecentEntries({ entries }: RecentEntriesProps) {
  if (entries.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">
          Ecritures recentes
        </h3>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="text-left px-4 py-2 font-medium">Libelle</th>
              <th className="text-left px-4 py-2 font-medium">Journal</th>
              <th className="text-right px-4 py-2 font-medium">Montant</th>
              <th className="text-center px-4 py-2 font-medium">Source</th>
              <th className="text-center px-4 py-2 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
              >
                <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                  {formatDate(entry.entryDate)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/owner/accounting/entries/${entry.id}`}
                    className="text-foreground hover:text-primary font-medium transition-colors"
                  >
                    {entry.label}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {entry.journalCode}
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground whitespace-nowrap">
                  {formatCents(entry.totalDebitCents)}
                </td>
                <td className="px-4 py-3 text-center">
                  <SourceBadge source={entry.source} />
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge isValidated={entry.isValidated} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-border">
        {entries.map((entry) => (
          <Link
            key={entry.id}
            href={`/owner/accounting/entries/${entry.id}`}
            className="block px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {entry.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(entry.entryDate)} - {entry.journalCode}
                </p>
              </div>
              <p className="text-sm font-medium text-foreground whitespace-nowrap">
                {formatCents(entry.totalDebitCents)}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <SourceBadge source={entry.source} />
              <StatusBadge isValidated={entry.isValidated} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default RecentEntries;
