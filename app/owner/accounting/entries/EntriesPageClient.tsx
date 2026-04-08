"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { PlanGate } from "@/components/subscription/plan-gate";
import {
  useAccountingEntries,
  type AccountingEntryRow,
} from "@/lib/hooks/use-accounting-entries";
import { QuickEntryForm } from "@/components/accounting/QuickEntryForm";
import { formatCents } from "@/lib/utils/format-cents";
import { cn } from "@/lib/utils";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// -- Constants ---------------------------------------------------------------

const JOURNAL_OPTIONS = [
  { value: "", label: "Tous" },
  { value: "ACH", label: "ACH" },
  { value: "VE", label: "VE" },
  { value: "BQ", label: "BQ" },
  { value: "OD", label: "OD" },
  { value: "AN", label: "AN" },
  { value: "CL", label: "CL" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "draft", label: "Brouillons" },
  { value: "validated", label: "Validees" },
] as const;

const SOURCE_OPTIONS = [
  { value: "", label: "Tous" },
  { value: "manual", label: "Manuel" },
  { value: "stripe", label: "Stripe" },
  { value: "ocr", label: "OCR" },
  { value: "import", label: "Import" },
] as const;

// -- Badge helpers -----------------------------------------------------------

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
        SOURCE_BADGE_STYLES[key] ?? SOURCE_BADGE_STYLES.manual
      )}
    >
      {SOURCE_LABELS[key] ?? key}
    </span>
  );
}

function StatusBadge({ entry }: { entry: AccountingEntryRow }) {
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
          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
      )}
    >
      {isValidated ? "Valide" : "Brouillon"}
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

function getEntryDebitCents(e: AccountingEntryRow): number {
  if (typeof e.total_debit_cents === "number") return e.total_debit_cents;
  if (typeof e.debit === "number") return Math.round(e.debit * 100);
  return 0;
}

function getEntryCreditCents(e: AccountingEntryRow): number {
  if (typeof e.total_credit_cents === "number") return e.total_credit_cents;
  if (typeof e.credit === "number") return Math.round(e.credit * 100);
  return 0;
}

function isDraft(e: AccountingEntryRow): boolean {
  return !e.is_validated && !e.valid_date;
}

// -- Main component ----------------------------------------------------------

export default function EntriesPageClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <EntriesPageContent />
    </PlanGate>
  );
}

function EntriesPageContent() {
  // Filters
  const [search, setSearch] = useState("");
  const [journalCode, setJournalCode] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "validated">("all");
  const [source, setSource] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // Sheet
  const [sheetOpen, setSheetOpen] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const {
    entries,
    total,
    totals,
    totalPages,
    isLoading,
    isFetching,
    error,
    validateEntries,
    isValidating,
  } = useAccountingEntries({
    journalCode: journalCode || undefined,
    search: search || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    status,
    source: source || undefined,
    page,
    limit: 50,
  });

  // Client-side status/source filtering (API may not support all filters)
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (status === "draft") {
      result = result.filter((e: AccountingEntryRow) => isDraft(e));
    } else if (status === "validated") {
      result = result.filter((e: AccountingEntryRow) => !isDraft(e));
    }
    if (source) {
      result = result.filter((e: AccountingEntryRow) => (e.source ?? "manual") === source);
    }
    return result;
  }, [entries, status, source]);

  // Draft entries for bulk selection
  const draftEntries = useMemo(
    () => filteredEntries.filter((e: AccountingEntryRow) => isDraft(e)),
    [filteredEntries]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selected.size === draftEntries.length && draftEntries.length > 0) {
      setSelected(new Set<string>());
    } else {
      setSelected(new Set(draftEntries.map((e: AccountingEntryRow) => e.id)));
    }
  }, [draftEntries, selected.size]);

  const handleValidateSelected = async () => {
    if (selected.size === 0) return;
    try {
      await validateEntries(Array.from(selected));
      setSelected(new Set());
    } catch {
      // Error handled by mutation
    }
  };

  // Totals for page
  const pageDebitCents = useMemo(
    () => filteredEntries.reduce((s: number, e: AccountingEntryRow) => s + getEntryDebitCents(e), 0),
    [filteredEntries]
  );
  const pageCreditCents = useMemo(
    () => filteredEntries.reduce((s: number, e: AccountingEntryRow) => s + getEntryCreditCents(e), 0),
    [filteredEntries]
  );

  // Reset page when filters change
  const handleFilterChange = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
      (value: T) => {
        setter(value);
        setPage(1);
        setSelected(new Set());
      },
    []
  );

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <p className="text-sm text-destructive">
            Erreur lors du chargement des ecritures. Veuillez reessayer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
          Ecritures comptables
        </h1>
        {isFetching && !isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleFilterChange(setSearch)(e.target.value)}
            placeholder="Rechercher..."
            className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Journal */}
        <select
          value={journalCode}
          onChange={(e) => handleFilterChange(setJournalCode)(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {JOURNAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={status}
          onChange={(e) =>
            handleFilterChange(setStatus)(
              e.target.value as "all" | "draft" | "validated"
            )
          }
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Source */}
        <select
          value={source}
          onChange={(e) => handleFilterChange(setSource)(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={startDate}
          onChange={(e) => handleFilterChange(setStartDate)(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Du"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => handleFilterChange(setEndDate)(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Au"
        />
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">
            {selected.size} ecriture{selected.size > 1 ? "s" : ""} selectionnee
            {selected.size > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={handleValidateSelected}
            disabled={isValidating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isValidating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Valider les {selected.size} selectionnees
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded-lg" />
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Aucune ecriture trouvee.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground bg-muted/30">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={
                          draftEntries.length > 0 &&
                          selected.size === draftEntries.length
                        }
                        onChange={toggleSelectAll}
                        className="rounded border-border"
                        aria-label="Tout selectionner"
                      />
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium">Date</th>
                    <th className="text-left px-3 py-2.5 font-medium">N</th>
                    <th className="text-left px-3 py-2.5 font-medium">
                      Journal
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium">
                      Libelle
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium">
                      Debit
                    </th>
                    <th className="text-right px-3 py-2.5 font-medium">
                      Credit
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium">
                      Statut
                    </th>
                    <th className="text-center px-3 py-2.5 font-medium">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry: AccountingEntryRow) => {
                    const entryIsDraft = isDraft(entry);
                    const entryDate =
                      entry.entry_date ?? entry.ecriture_date ?? "";
                    const entryNumber =
                      entry.entry_number ?? entry.ecriture_num ?? "";
                    const entryLabel =
                      entry.label ?? entry.ecriture_lib ?? "";
                    const debitCents = getEntryDebitCents(entry);
                    const creditCents = getEntryCreditCents(entry);

                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-3 py-3">
                          {entryIsDraft ? (
                            <input
                              type="checkbox"
                              checked={selected.has(entry.id)}
                              onChange={() => toggleSelect(entry.id)}
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
                          <StatusBadge entry={entry} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <SourceBadge source={entry.source} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filteredEntries.map((entry: AccountingEntryRow) => {
              const entryIsDraft = isDraft(entry);
              const entryDate = entry.entry_date ?? entry.ecriture_date ?? "";
              const entryLabel = entry.label ?? entry.ecriture_lib ?? "";
              const debitCents = getEntryDebitCents(entry);
              const creditCents = getEntryCreditCents(entry);
              const amount = debitCents > 0 ? debitCents : creditCents;

              return (
                <div
                  key={entry.id}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                >
                  <div className="flex items-start gap-3 px-4 py-3">
                    {entryIsDraft && (
                      <input
                        type="checkbox"
                        checked={selected.has(entry.id)}
                        onChange={() => toggleSelect(entry.id)}
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
                            {entryDate ? formatDate(entryDate) : ""} -{" "}
                            {entry.journal_code}
                          </p>
                        </div>
                        <p className="text-sm font-medium text-foreground whitespace-nowrap">
                          {formatCents(amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge entry={entry} />
                        <SourceBadge source={entry.source} />
                      </div>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals footer */}
          <div className="bg-card rounded-xl border border-border px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-muted-foreground">
                Totaux ({filteredEntries.length} ecriture
                {filteredEntries.length > 1 ? "s" : ""})
              </span>
              <div className="flex items-center gap-6">
                <span className="text-foreground">
                  <span className="text-muted-foreground mr-1">Debit :</span>
                  <span className="font-medium">
                    {formatCents(pageDebitCents)}
                  </span>
                </span>
                <span className="text-foreground">
                  <span className="text-muted-foreground mr-1">Credit :</span>
                  <span className="font-medium">
                    {formatCents(pageCreditCents)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} sur {totalPages} ({total} resultats)
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
                  aria-label="Page precedente"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
                  aria-label="Page suivante"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating action button */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
      >
        <Plus className="w-5 h-5" />
        <span className="hidden sm:inline">Nouvelle ecriture</span>
      </button>

      {/* Quick entry sheet */}
      <QuickEntryForm open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
