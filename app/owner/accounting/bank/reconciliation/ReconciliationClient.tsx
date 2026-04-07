"use client";

import { useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useReconciliation } from "@/lib/hooks/use-reconciliation";
import { useBankConnections } from "@/lib/hooks/use-bank-connections";
import { formatCents } from "@/lib/utils/format-cents";
import Link from "next/link";
import {
  ArrowLeft,
  Link2,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Tag,
  Eye,
} from "lucide-react";

export default function ReconciliationClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <ReconciliationContent />
    </PlanGate>
  );
}

function ReconciliationContent() {
  const { connections } = useBankConnections();
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(null);
  const {
    transactions,
    stats,
    isLoading,
    matchTransaction,
    ignoreTransaction,
    categorizeTransaction,
    runMatching,
    isRunning,
  } = useReconciliation(activeConnectionId);
  const [filter, setFilter] = useState<string>("all");
  const [showCategorizeFor, setShowCategorizeFor] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ accountNumber: "", label: "", journalCode: "ACH" });

  const activeConn = activeConnectionId
    ? connections?.find((c: { id: string }) => c.id === activeConnectionId)
    : connections?.[0];

  const filtered = (transactions ?? []).filter((tx: { reconciliation_status: string }) => {
    if (filter === "all") return true;
    if (filter === "suggested") return tx.reconciliation_status === "suggested";
    if (filter === "orphan") return tx.reconciliation_status === "orphan";
    if (filter === "matched") return tx.reconciliation_status.startsWith("matched");
    return true;
  });

  const total = stats?.total ?? 0;
  const matched = stats?.matchedAuto ?? 0;
  const suggested = stats?.suggested ?? 0;
  const orphan = stats?.orphan ?? 0;
  const pct = total > 0 ? Math.round(((matched) / total) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/owner/accounting/bank" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">Rapprochement bancaire</h1>
      </div>

      {/* Connection tabs */}
      {connections && connections.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {connections.map((conn: { id: string; bank_name: string; account_type: string }) => (
            <button
              key={conn.id}
              onClick={() => setActiveConnectionId(conn.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                (activeConnectionId ?? connections[0]?.id) === conn.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground hover:bg-accent"
              }`}
            >
              {conn.bank_name ?? conn.account_type}
            </button>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-500/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{matched}</p>
          <p className="text-xs text-emerald-600">Rapproches</p>
        </div>
        <div className="bg-amber-500/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{suggested}</p>
          <p className="text-xs text-amber-600">A valider</p>
        </div>
        <div className="bg-red-500/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{orphan}</p>
          <p className="text-xs text-red-600">Non identifies</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden flex">
        {total > 0 && (
          <>
            <div className="bg-emerald-500 h-full" style={{ width: `${(matched / total) * 100}%` }} />
            <div className="bg-amber-500 h-full" style={{ width: `${(suggested / total) * 100}%` }} />
            <div className="bg-red-500 h-full" style={{ width: `${(orphan / total) * 100}%` }} />
          </>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: "Tous" },
          { key: "suggested", label: "A valider" },
          { key: "orphan", label: "Non identifies" },
          { key: "matched", label: "Rapproches" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
              filter === f.key ? "bg-primary text-primary-foreground" : "bg-card border border-border"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((tx: {
            id: string;
            reconciliation_status: string;
            amount_cents: number;
            label: string;
            transaction_date: string;
            match_score: number | null;
            suggestion: Record<string, unknown> | null;
            is_internal_transfer: boolean;
            matched_entry_id: string | null;
          }) => {
            const isMatched = tx.reconciliation_status.startsWith("matched");
            const isSuggested = tx.reconciliation_status === "suggested";
            const isOrphan = tx.reconciliation_status === "orphan";

            const borderColor = isMatched
              ? "border-l-emerald-500"
              : isSuggested
              ? "border-l-amber-500"
              : "border-l-red-500";

            const bgColor = isMatched
              ? "bg-emerald-500/5"
              : isSuggested
              ? "bg-amber-500/5"
              : "bg-red-500/5";

            return (
              <div key={tx.id} className={`bg-card rounded-xl border border-border border-l-4 ${borderColor} ${bgColor} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{tx.transaction_date}</span>
                      {tx.is_internal_transfer && (
                        <span className="text-xs bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">Interne</span>
                      )}
                      {tx.match_score !== null && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                          {Math.round(tx.match_score)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate mt-1">{tx.label}</p>
                    {isMatched && (
                      <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
                        <Link2 className="w-3 h-3" /> Rapproche
                      </p>
                    )}
                    {isSuggested && tx.suggestion && (
                      <p className="text-xs text-amber-600 mt-1">
                        Proposition : {(tx.suggestion as { entryLabel?: string }).entryLabel ?? "ecriture"}
                      </p>
                    )}
                  </div>
                  <p className={`text-lg font-bold whitespace-nowrap ${tx.amount_cents >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCents(Math.abs(tx.amount_cents))}
                  </p>
                </div>

                {/* Action buttons */}
                {isSuggested && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        const suggestion = tx.suggestion as { entryId?: string } | null;
                        if (suggestion?.entryId) matchTransaction(tx.id, suggestion.entryId);
                      }}
                      className="flex-1 bg-emerald-500 text-white rounded-lg px-3 py-2 text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Valider
                    </button>
                    <button
                      onClick={() => ignoreTransaction(tx.id)}
                      className="bg-card border border-border rounded-lg px-3 py-2 text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {isOrphan && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setShowCategorizeFor(tx.id)}
                      className="flex-1 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <Tag className="w-3 h-3" /> Categoriser
                    </button>
                    <button
                      onClick={() => ignoreTransaction(tx.id)}
                      className="bg-card border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground"
                    >
                      Ignorer
                    </button>
                  </div>
                )}

                {/* Categorize drawer */}
                {showCategorizeFor === tx.id && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
                    <input
                      placeholder="Compte (ex: 615100)"
                      value={catForm.accountNumber}
                      onChange={(e) => setCatForm({ ...catForm, accountNumber: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <input
                      placeholder="Libelle"
                      value={catForm.label}
                      onChange={(e) => setCatForm({ ...catForm, label: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          categorizeTransaction(tx.id, catForm);
                          setShowCategorizeFor(null);
                          setCatForm({ accountNumber: "", label: "", journalCode: "ACH" });
                        }}
                        className="flex-1 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs font-medium"
                      >
                        Comptabiliser
                      </button>
                      <button
                        onClick={() => setShowCategorizeFor(null)}
                        className="bg-card border border-border rounded-lg px-3 py-2 text-xs"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer stats */}
      <div className="text-center text-sm text-muted-foreground">
        {matched}/{total} rapprochees ({pct}%)
      </div>

      {/* Floating action */}
      <button
        onClick={() => runMatching()}
        disabled={isRunning}
        className="fixed bottom-6 right-6 bg-primary text-primary-foreground rounded-full p-4 shadow-lg hover:bg-primary/90 disabled:opacity-50"
      >
        <RefreshCw className={`w-5 h-5 ${isRunning ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
