"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated

import { useState, useCallback, useRef } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useBankConnections, BankConnection } from "@/lib/hooks/use-bank-connections";
import {
  useReconciliation,
  useReconciliationActions,
  BankTransactionRow,
} from "@/lib/hooks/use-reconciliation";
import { formatCents } from "@/lib/utils/format-cents";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import {
  ArrowLeft,
  Link2,
  AlertTriangle,
  Check,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Loader2,
  Filter,
  Tag,
  Clock,
  Repeat,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────

type FilterTab = "all" | "suggested" | "orphan" | "matched";

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
  const [filterTab, setFilterTab] = useState<FilterTab>("all");

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

  const { match, ignore, categorize, runMatching } =
    useReconciliationActions();
  const { toast } = useToast();
  const [runningMatch, setRunningMatch] = useState(false);

  // Filter transactions for display (matched includes both auto and manual)
  const filteredTransactions =
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

  const connectionLabel = (c: BankConnection) => {
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
  };

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

      {/* Account tabs */}
      {connections.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedConnectionId(undefined)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              !selectedConnectionId
                ? "bg-[#2563EB] text-white"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Tous
          </button>
          {connections.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedConnectionId(c.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedConnectionId === c.id
                  ? "bg-[#2563EB] text-white"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {connectionLabel(c)}
            </button>
          ))}
        </div>
      )}

      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="Rapproches"
          count={stats.matched}
          color="green"
          icon={<Check className="w-4 h-4" />}
        />
        <StatCard
          label="A valider"
          count={stats.suggested}
          color="orange"
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="Non identifies"
          count={stats.orphan}
          color="red"
          icon={<AlertTriangle className="w-4 h-4" />}
        />
      </div>

      {/* Overall progress bar */}
      {stats.total > 0 && (
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
          {stats.matched > 0 && (
            <div
              className="h-full bg-green-500"
              style={{ width: `${(stats.matched / stats.total) * 100}%` }}
            />
          )}
          {stats.suggested > 0 && (
            <div
              className="h-full bg-orange-500"
              style={{ width: `${(stats.suggested / stats.total) * 100}%` }}
            />
          )}
          {stats.orphan > 0 && (
            <div
              className="h-full bg-red-500"
              style={{ width: `${(stats.orphan / stats.total) * 100}%` }}
            />
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            { key: "all", label: "Tous" },
            { key: "suggested", label: "A valider" },
            { key: "orphan", label: "Non identifies" },
            { key: "matched", label: "Rapproches" },
          ] as { key: FilterTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filterTab === tab.key
                ? "bg-[#2563EB] text-white"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Filter className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Aucune transaction pour ce filtre.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((tx) => (
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
          onClick={handleRunMatching}
          disabled={runningMatch}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#2563EB] text-white text-sm font-medium shadow-lg hover:bg-[#1B2A6B] transition-colors disabled:opacity-50"
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

// ── Stat card ───────────────────────────────────────────────────────

function StatCard({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color: "green" | "orange" | "red";
  icon: React.ReactNode;
}) {
  const colorMap = {
    green:
      "bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 border-green-200 dark:border-green-900",
    orange:
      "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900",
    red: "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900",
  };

  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold font-[family-name:var(--font-manrope)]">
        {count}
      </p>
    </div>
  );
}

// ── Transaction card ────────────────────────────────────────────────

function TransactionCard({
  transaction: tx,
  onMatch,
  onIgnore,
  onCategorize,
  onRefresh,
}: {
  transaction: BankTransactionRow;
  onMatch: (txId: string, entryId: string) => Promise<void>;
  onIgnore: (txId: string) => Promise<void>;
  onCategorize: (
    txId: string,
    data: { accountNumber: string; label: string; journalCode: string },
  ) => Promise<void>;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showCategorize, setShowCategorize] = useState(false);
  const [catAccount, setCatAccount] = useState("");
  const [catLabel, setCatLabel] = useState("");
  const [catJournal, setCatJournal] = useState("BQ");
  const undoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPositive = tx.amount_cents >= 0;
  const status = tx.reconciliation_status;

  const isMatched = status === "matched_auto" || status === "matched_manual";
  const isSuggested = status === "suggested";
  const isOrphan = status === "orphan";

  // Border + bg colors per status
  const cardClasses = isMatched
    ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
    : isSuggested
      ? "border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20"
      : isOrphan
        ? "border-l-red-500 bg-red-50/50 dark:bg-red-950/20"
        : "border-l-gray-300";

  const handleValidate = async () => {
    if (!tx.suggestion?.entryId) return;
    setLoading(true);
    try {
      await onMatch(tx.id, tx.suggestion.entryId);
      onRefresh();
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de valider.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleIgnore = async () => {
    toast({
      title: "Transaction ignoree",
      description: "Annuler dans 5 secondes...",
    });

    undoRef.current = setTimeout(async () => {
      try {
        await onIgnore(tx.id);
        onRefresh();
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible d'ignorer la transaction.",
          variant: "destructive",
        });
      }
    }, 5000);
  };

  const handleCategorize = async () => {
    if (!catAccount || !catLabel) return;
    setLoading(true);
    try {
      await onCategorize(tx.id, {
        accountNumber: catAccount,
        label: catLabel,
        journalCode: catJournal,
      });
      setShowCategorize(false);
      onRefresh();
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de categoriser.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`bg-card rounded-xl border border-border border-l-4 ${cardClasses} p-4 space-y-3 transition-all`}
    >
      {/* Main row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Amount direction icon */}
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isPositive
                ? "bg-green-100 dark:bg-green-950/50"
                : "bg-red-100 dark:bg-red-950/50"
            }`}
          >
            {isPositive ? (
              <ArrowDownLeft className="w-4 h-4 text-green-600 dark:text-green-400" />
            ) : (
              <ArrowUpRight className="w-4 h-4 text-red-600 dark:text-red-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {tx.label || tx.raw_label || "Transaction"}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(tx.transaction_date).toLocaleDateString("fr-FR")}
              {tx.counterpart_name && ` - ${tx.counterpart_name}`}
            </p>
          </div>
        </div>
        <p
          className={`text-sm font-bold whitespace-nowrap font-[family-name:var(--font-manrope)] ${
            isPositive
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {isPositive ? "+" : ""}
          {formatCents(tx.amount_cents)}
        </p>
      </div>

      {/* Status details */}
      {isMatched && (
        <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
          <Link2 className="w-3.5 h-3.5" />
          <span>Rapproche</span>
          {tx.matched_entry && (
            <span className="text-muted-foreground">
              - Ecriture {tx.matched_entry.entry_number}
            </span>
          )}
          {tx.match_score != null && (
            <span className="ml-auto px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-[10px] font-medium">
              {Math.round(tx.match_score * 100)}%
            </span>
          )}
          {tx.is_internal_transfer && (
            <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-medium inline-flex items-center gap-0.5">
              <Repeat className="w-3 h-3" />
              Interne
            </span>
          )}
        </div>
      )}

      {isSuggested && tx.suggestion && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
            <Tag className="w-3.5 h-3.5" />
            <span>Suggestion</span>
            <span className="text-muted-foreground">
              - {tx.suggestion.entryLabel} ({tx.suggestion.entryNumber})
            </span>
            <span className="ml-auto px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 text-[10px] font-medium">
              {Math.round(tx.suggestion.score * 100)}%
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleValidate}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Valider
            </button>
            <button
              onClick={() => setShowCategorize(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
            >
              Modifier
            </button>
            <button
              onClick={handleIgnore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-3 h-3" />
              Rejeter
            </button>
          </div>
        </div>
      )}

      {isOrphan && (
        <div className="space-y-2">
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Non identifie
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCategorize(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563EB] text-white text-xs font-medium hover:bg-[#1B2A6B] transition-colors"
            >
              <Tag className="w-3 h-3" />
              Categoriser
            </button>
            <button
              onClick={handleIgnore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-3 h-3" />
              Ignorer
            </button>
          </div>
        </div>
      )}

      {/* Categorize drawer */}
      {showCategorize && (
        <div className="border-t border-border pt-3 space-y-3">
          <h4 className="text-xs font-semibold text-foreground">
            Categoriser la transaction
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Compte comptable
              </label>
              <input
                type="text"
                placeholder="Ex: 706000"
                value={catAccount}
                onChange={(e) => setCatAccount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Libelle
              </label>
              <input
                type="text"
                placeholder="Libelle de l'ecriture"
                value={catLabel}
                onChange={(e) => setCatLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Journal
              </label>
              <select
                value={catJournal}
                onChange={(e) => setCatJournal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="BQ">BQ - Banque</option>
                <option value="OD">OD - Operations diverses</option>
                <option value="HA">HA - Achats</option>
                <option value="VE">VE - Ventes</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCategorize}
              disabled={loading || !catAccount || !catLabel}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-medium hover:bg-[#1B2A6B] transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Enregistrer
            </button>
            <button
              onClick={() => setShowCategorize(false)}
              className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
