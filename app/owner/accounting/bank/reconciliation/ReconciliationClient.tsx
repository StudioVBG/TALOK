"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useBankConnections } from "@/lib/hooks/use-bank-connections";
import {
  useReconciliation,
  useReconciliationActions,
} from "@/lib/hooks/use-reconciliation";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Filter, Loader2, RefreshCw } from "lucide-react";
import { ReconciliationStats } from "./components/ReconciliationStats";
import {
  ReconciliationFilters,
  type ReconciliationFilterTab,
} from "./components/ReconciliationFilters";
import { TransactionCard } from "./components/TransactionCard";

// ── Wrapper ─────────────────────────────────────────────────────────

export default function ReconciliationClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <ReconciliationContent />
    </PlanGate>
  );
}

// ── Main content ────────────────────────────────────────────────────

function ReconciliationContent() {
  const { connections, isLoading: connLoading } = useBankConnections();
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | undefined
  >();
  const [filterTab, setFilterTab] = useState<ReconciliationFilterTab>("all");

  const statusFilter =
    filterTab === "all"
      ? undefined
      : filterTab === "matched"
        ? "matched_auto"
        : filterTab;

  const {
    transactions,
    stats,
    isLoading: txLoading,
    mutate,
  } = useReconciliation({
    connectionId: selectedConnectionId,
    status: statusFilter,
  });

  const { match, ignore, categorize, runMatching } = useReconciliationActions();
  const { toast } = useToast();
  const [runningMatch, setRunningMatch] = useState(false);

  // The server filters by `matched_auto` only, so when the user picks the
  // "matched" tab we also include `matched_manual` client-side — this is a
  // UX conversion, not a data filter. Keep the pass minimal.
  const displayTransactions =
    filterTab === "matched"
      ? transactions.filter(
          (tx) =>
            tx.reconciliation_status === "matched_auto" ||
            tx.reconciliation_status === "matched_manual",
        )
      : transactions;

  const handleRunMatching = useCallback(async () => {
    setRunningMatch(true);
    try {
      const summary = await runMatching("");
      toast({
        title: "Rapprochement termine",
        description: summary
          ? `${summary.matchedAuto} rapprochements automatiques, ${summary.suggested} suggestions`
          : "Le rapprochement a ete effectue.",
      });
      mutate();
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de lancer le rapprochement.",
        variant: "destructive",
      });
    } finally {
      setRunningMatch(false);
    }
  }, [runMatching, mutate, toast]);

  const isLoading = connLoading || txLoading;

  const pctReconciled =
    stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/owner/accounting/bank"
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Link>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Rapprochement bancaire
          </h1>
        </div>
      </div>

      {/* Filters (connection tabs + status tabs) */}
      <ReconciliationFilters
        connections={connections}
        selectedConnectionId={selectedConnectionId}
        onSelectConnection={setSelectedConnectionId}
        filterTab={filterTab}
        onChangeFilterTab={setFilterTab}
      />

      {/* KPI cards + progress bar */}
      <ReconciliationStats stats={stats} />

      {/* Transaction list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : displayTransactions.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Filter className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucune transaction pour ce filtre.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayTransactions.map((tx) => (
            <TransactionCard
              key={tx.id}
              transaction={tx}
              onMatch={match}
              onIgnore={ignore}
              onCategorize={categorize}
              onRefresh={mutate}
            />
          ))}
        </div>
      )}

      {/* Stats footer */}
      <div className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {stats.matched}/{stats.total} rapprochees ({pctReconciled}%)
        </p>
      </div>

      {/* Floating action button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={handleRunMatching}
          disabled={runningMatch}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground text-sm font-medium shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {runningMatch ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Relancer le matching
        </button>
      </div>
    </div>
  );
}
