"use client";

/**
 * ReconciliationFilters — dumb filter bars for the bank reconciliation page.
 *
 * Two independent filter rows stacked vertically:
 *   1. Connection tabs    : all | one per bank_connection
 *   2. Status tabs        : all | suggested | orphan | matched
 *
 * Purely presentational: the parent owns both filter values and passes
 * setters down.
 */

import type { BankConnection } from "@/lib/hooks/use-bank-connections";

export type ReconciliationFilterTab =
  | "all"
  | "suggested"
  | "orphan"
  | "matched";

const FILTER_TABS: ReadonlyArray<{ key: ReconciliationFilterTab; label: string }> = [
  { key: "all", label: "Tous" },
  { key: "suggested", label: "A valider" },
  { key: "orphan", label: "Non identifies" },
  { key: "matched", label: "Rapproches" },
];

function connectionLabel(c: BankConnection): string {
  switch (c.account_type) {
    case "exploitation":
      return "Exploitation";
    case "epargne":
      return "Epargne";
    case "depot_garantie":
      return "DG";
    default:
      return "Autre";
  }
}

interface ReconciliationFiltersProps {
  connections: BankConnection[];
  selectedConnectionId: string | undefined;
  onSelectConnection: (id: string | undefined) => void;
  filterTab: ReconciliationFilterTab;
  onChangeFilterTab: (tab: ReconciliationFilterTab) => void;
}

export function ReconciliationFilters({
  connections,
  selectedConnectionId,
  onSelectConnection,
  filterTab,
  onChangeFilterTab,
}: ReconciliationFiltersProps) {
  return (
    <>
      {connections.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onSelectConnection(undefined)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              !selectedConnectionId
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Tous
          </button>
          {connections.map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() => onSelectConnection(c.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedConnectionId === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {connectionLabel(c)}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => onChangeFilterTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filterTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </>
  );
}
