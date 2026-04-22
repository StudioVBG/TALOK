"use client";

/**
 * EntryRow — one row of the accounting entries table.
 *
 * Renders both the desktop <tr> variant and the mobile card variant
 * via two named exports so the parent can reuse the same entry-level
 * helpers (status badge, source badge, debit/credit extraction) in both
 * responsive layouts without duplicating them.
 *
 * Dumb component: the parent owns selection and mutations and passes
 * callbacks in.
 */

import Link from "next/link";
import type { AccountingEntryRow as AccountingEntryRowData } from "@/lib/hooks/use-accounting-entries";
import { formatCents } from "@/lib/utils/format-cents";
import { cn } from "@/lib/utils";

// ── Helpers (shared with parent via re-export) ─────────────────────

export function isDraft(e: AccountingEntryRowData): boolean {
  return !e.is_validated && !e.valid_date;
}

export function getEntryDebitCents(e: AccountingEntryRowData): number {
  if (typeof e.total_debit_cents === "number") return e.total_debit_cents;
  if (typeof e.debit === "number") return Math.round(e.debit * 100);
  return 0;
}

export function getEntryCreditCents(e: AccountingEntryRowData): number {
  if (typeof e.total_credit_cents === "number") return e.total_credit_cents;
  if (typeof e.credit === "number") return Math.round(e.credit * 100);
  return 0;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Badges ─────────────────────────────────────────────────────────

const SOURCE_BADGE_STYLES: Record<string, string> = {
  manual: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  stripe: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  ocr: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  import: "bg-teal-500/10 text-teal-400 border-teal-500/20",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manuel",
  stripe: "Stripe",
  ocr: "OCR",
  import: "Import",
};

function SourceBadge({ source }: { source: string | null }) {
  const key = source ?? "manual";
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border",
        SOURCE_BADGE_STYLES[key] ?? SOURCE_BADGE_STYLES.manual,
      )}
    >
      {SOURCE_LABELS[key] ?? key}
    </span>
  );
}

function StatusBadge({ entry }: { entry: AccountingEntryRowData }) {
  const isValidated = entry.is_validated || !!entry.valid_date;
  const isReversed = !!entry.reversal_of;

  if (isReversed) {
    return (
      <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-red-500/10 text-red-500 border-red-500/20">
        Contre-passe
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border",
        isValidated
          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          : "bg-amber-500/10 text-amber-500 border-amber-500/20",
      )}
    >
      {isValidated ? "Valide" : "Brouillon"}
    </span>
  );
}

function InformationalBadge() {
  return (
    <span
      className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-blue-500/10 text-blue-500 border-blue-500/20"
      title="Écriture créée à titre informatif (régime micro-foncier). Non intégrée au FEC."
    >
      Info
    </span>
  );
}

// ── Row (desktop table variant) ────────────────────────────────────

interface EntryRowProps {
  entry: AccountingEntryRowData;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

export function EntryRow({ entry, isSelected, onToggleSelect }: EntryRowProps) {
  const entryIsDraft = isDraft(entry);
  const entryDate = entry.entry_date ?? entry.ecriture_date ?? "";
  const entryNumber = entry.entry_number ?? entry.ecriture_num ?? "";
  const entryLabel = entry.label ?? entry.ecriture_lib ?? "";
  const debitCents = getEntryDebitCents(entry);
  const creditCents = getEntryCreditCents(entry);

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors">
      <td className="px-3 py-3">
        {entryIsDraft ? (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(entry.id)}
            className="rounded border-border"
            aria-label={`Selectionner ${entryLabel}`}
          />
        ) : (
          <span className="block w-4" />
        )}
      </td>
      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
        {entryDate ? formatDate(entryDate) : "-"}
      </td>
      <td className="px-3 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
        {entryNumber}
      </td>
      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
        {entry.journal_code}
      </td>
      <td className="px-3 py-3">
        <Link
          href={`/owner/accounting/entries/${entry.id}`}
          className="text-foreground hover:text-primary font-medium transition-colors"
        >
          {entryLabel}
        </Link>
      </td>
      <td className="px-3 py-3 text-right font-medium text-foreground whitespace-nowrap">
        {debitCents > 0 ? formatCents(debitCents) : "-"}
      </td>
      <td className="px-3 py-3 text-right font-medium text-foreground whitespace-nowrap">
        {creditCents > 0 ? formatCents(creditCents) : "-"}
      </td>
      <td className="px-3 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <StatusBadge entry={entry} />
          {entry.informational && <InformationalBadge />}
        </div>
      </td>
      <td className="px-3 py-3 text-center">
        <SourceBadge source={entry.source} />
      </td>
    </tr>
  );
}

// ── Card (mobile variant) ──────────────────────────────────────────

export function EntryCard({ entry, isSelected, onToggleSelect }: EntryRowProps) {
  const entryIsDraft = isDraft(entry);
  const entryDate = entry.entry_date ?? entry.ecriture_date ?? "";
  const entryLabel = entry.label ?? entry.ecriture_lib ?? "";
  const debitCents = getEntryDebitCents(entry);
  const creditCents = getEntryCreditCents(entry);
  const amount = debitCents > 0 ? debitCents : creditCents;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        {entryIsDraft && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(entry.id)}
            className="rounded border-border mt-1 shrink-0"
            aria-label={`Selectionner ${entryLabel}`}
          />
        )}
        <Link
          href={`/owner/accounting/entries/${entry.id}`}
          className="flex-1 min-w-0"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {entryLabel}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {entryDate ? formatDate(entryDate) : ""} - {entry.journal_code}
              </p>
            </div>
            <p className="text-sm font-medium text-foreground whitespace-nowrap">
              {formatCents(amount)}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge entry={entry} />
            {entry.informational && <InformationalBadge />}
            <SourceBadge source={entry.source} />
          </div>
        </Link>
      </div>
    </div>
  );
}
