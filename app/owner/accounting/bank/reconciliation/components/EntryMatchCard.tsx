"use client";

/**
 * EntryMatchCard — dumb "proposed accounting entry" display used inside
 * a TransactionCard when the reconciliation engine suggests a match.
 *
 * Shows the entry label + entry number returned by the hook's suggestion
 * shape, plus the confidence score. Does not own any state.
 */

import { Tag } from "lucide-react";

export interface EntryMatchSuggestion {
  entryId: string;
  entryNumber: string;
  entryLabel: string;
  /** Score in [0, 1], rendered as a percentage. */
  score: number;
}

export function EntryMatchCard({
  suggestion,
}: {
  suggestion: EntryMatchSuggestion;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
      <Tag className="w-3.5 h-3.5" />
      <span>Suggestion</span>
      <span className="text-muted-foreground">
        - {suggestion.entryLabel} ({suggestion.entryNumber})
      </span>
      <span className="ml-auto px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-[10px] font-medium">
        {Math.round(suggestion.score * 100)}%
      </span>
    </div>
  );
}
