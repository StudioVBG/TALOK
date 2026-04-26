"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import {
  useAccountingEntries,
  type AccountingEntryRow as AccountingEntryRowData,
} from "@/lib/hooks/use-accounting-entries";
import Link from "next/link";
import { QuickEntryForm } from "@/components/accounting/QuickEntryForm";
import { formatCents } from "@/lib/utils/format-cents";
import { BookOpen, ChevronLeft, ChevronRight, Plus, Loader2, Settings } from "lucide-react";
import { EntryFilters, type EntryFilterStatus } from "./components/EntryFilters";
import { BulkActions } from "./components/BulkActions";
import {
  EntryRow,
  EntryCard,
  getEntryCreditCents,
  getEntryDebitCents,
  isDraft,
} from "./components/EntryRow";

// -- Debounce hook -----------------------------------------------------------
// Small local hook to debounce a value. We keep it here (rather than adding a
// new file) because it's only used by this page. 300ms matches the audit
// requirement so the search box stays responsive but the API isn't hammered.
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
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
  // Filters — `searchInput` is the raw input value, `search` is the debounced
  // value that actually gets sent to the API (300ms) so the user can type
  // freely without firing a request on every keystroke.
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 300);
  const [journalCode, setJournalCode] = useState("");
  const [status, setStatus] = useState<EntryFilterStatus>("all");
  const [source, setSource] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // Sheet
  const [sheetOpen, setSheetOpen] = useState(false);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset pagination + selection whenever the debounced search changes so
  // the user doesn't end up on page 5 of a result set that no longer exists.
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [search]);

  const {
    entries,
    total,
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

  // Server now handles status/source/search/date filtering — we consume the
  // returned page as-is. `draftEntries` is only used to drive the bulk
  // "select all" checkbox; it's a derived helper, not a redundant filter.
  const draftEntries = useMemo(
    () => entries.filter((e: AccountingEntryRowData) => isDraft(e)),
    [entries],
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
      setSelected(new Set(draftEntries.map((e: AccountingEntryRowData) => e.id)));
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

  // Totals for page — derived aggregations from the server-filtered page,
  // not a second filter pass.
  const pageDebitCents = useMemo(
    () =>
      entries.reduce(
        (s: number, e: AccountingEntryRowData) => s + getEntryDebitCents(e),
        0,
      ),
    [entries],
  );
  const pageCreditCents = useMemo(
    () =>
      entries.reduce(
        (s: number, e: AccountingEntryRowData) => s + getEntryCreditCents(e),
        0,
      ),
    [entries],
  );

  // Reset page + selection when any non-search filter changes. Wraps the
  // individual filter setters so the EntryFilters sub-component stays dumb.
  const onFilterChange = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T>>) =>
      (value: T) => {
        setter(value);
        setPage(1);
        setSelected(new Set());
      },
    [],
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
      <EntryFilters
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        journalCode={journalCode}
        onJournalCodeChange={onFilterChange(setJournalCode)}
        status={status}
        onStatusChange={onFilterChange(setStatus)}
        source={source}
        onSourceChange={onFilterChange(setSource)}
        startDate={startDate}
        onStartDateChange={onFilterChange(setStartDate)}
        endDate={endDate}
        onEndDateChange={onFilterChange(setEndDate)}
      />

      {/* Bulk actions */}
      <BulkActions
        selectedCount={selected.size}
        isValidating={isValidating}
        onValidateSelected={handleValidateSelected}
      />

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-muted rounded-lg" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyEntriesState
          hasActiveFilters={
            !!search ||
            !!journalCode ||
            status !== "all" ||
            !!source ||
            !!startDate ||
            !!endDate
          }
        />
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
                    <th className="text-center px-3 py-2.5 font-medium">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry: AccountingEntryRowData) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      isSelected={selected.has(entry.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {entries.map((entry: AccountingEntryRowData) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                isSelected={selected.has(entry.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>

          {/* Totals footer */}
          <div className="bg-card rounded-xl border border-border px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-muted-foreground">
                Totaux ({entries.length} ecriture
                {entries.length > 1 ? "s" : ""})
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

function EmptyEntriesState({ hasActiveFilters }: { hasActiveFilters: boolean }) {
  if (hasActiveFilters) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Aucune écriture ne correspond aux filtres sélectionnés.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center space-y-4">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <BookOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1 max-w-md mx-auto">
        <h3 className="text-base font-medium">Aucune écriture pour le moment</h3>
        <p className="text-sm text-muted-foreground">
          Activez la comptabilité automatique dans les paramètres pour que Talok
          génère une écriture à chaque loyer, paiement, dépôt et dépense.
          Vous pouvez aussi créer une écriture manuellement ou importer
          l'historique.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center pt-2">
        <Link
          href="/owner/accounting/settings"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Ouvrir les paramètres
        </Link>
      </div>
    </div>
  );
}
