"use client";

/**
 * EntryFilters — dumb filter bar for the accounting entries page.
 *
 * Controlled: every state lives in the parent, we only render inputs
 * and wire their change handlers. Split from EntriesPageClient as part
 * of the P2-1 extraction so the page body reads top-to-bottom instead
 * of scrolling past 80 lines of select markup.
 */

import { Search } from "lucide-react";

export type EntryFilterStatus = "all" | "draft" | "validated";

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

interface EntryFiltersProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;

  journalCode: string;
  onJournalCodeChange: (value: string) => void;

  status: EntryFilterStatus;
  onStatusChange: (value: EntryFilterStatus) => void;

  source: string;
  onSourceChange: (value: string) => void;

  startDate: string;
  onStartDateChange: (value: string) => void;

  endDate: string;
  onEndDateChange: (value: string) => void;
}

export function EntryFilters({
  searchInput,
  onSearchInputChange,
  journalCode,
  onJournalCodeChange,
  status,
  onStatusChange,
  source,
  onSourceChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
}: EntryFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {/* Search — controlled by the raw input state; the debounced value
          is what drives the query in the parent. */}
      <div className="relative flex-1 min-w-[12rem]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => onSearchInputChange(e.target.value)}
          placeholder="Rechercher..."
          className="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Journal */}
      <select
        value={journalCode}
        onChange={(e) => onJournalCodeChange(e.target.value)}
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
        onChange={(e) => onStatusChange(e.target.value as EntryFilterStatus)}
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
        onChange={(e) => onSourceChange(e.target.value)}
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
        onChange={(e) => onStartDateChange(e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        placeholder="Du"
      />
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        placeholder="Au"
      />
    </div>
  );
}
