"use client";

/**
 * TransactionCard — one bank transaction in the reconciliation list.
 *
 * Handles its own UI state (categorize drawer, per-row loading) but
 * delegates every mutation to callbacks passed from the parent so the
 * React-Query invalidation logic lives in one place.
 */

import { useRef, useState } from "react";
import type { BankTransactionRow } from "@/lib/hooks/use-reconciliation";
import { formatCents } from "@/lib/utils/format-cents";
import { useToast } from "@/components/ui/use-toast";
import {
  Link2,
  AlertTriangle,
  Check,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  Tag,
  Repeat,
} from "lucide-react";
import { EntryMatchCard } from "./EntryMatchCard";

export interface TransactionCardProps {
  transaction: BankTransactionRow;
  onMatch: (txId: string, entryId: string) => Promise<void>;
  onIgnore: (txId: string) => Promise<void>;
  onCategorize: (
    txId: string,
    data: { accountNumber: string; label: string; journalCode: string },
  ) => Promise<void>;
  onRefresh: () => void;
}

export function TransactionCard({
  transaction: tx,
  onMatch,
  onIgnore,
  onCategorize,
  onRefresh,
}: TransactionCardProps) {
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
          <EntryMatchCard suggestion={tx.suggestion} />
          <div className="flex gap-2">
            <button
              type="button"
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
              type="button"
              onClick={() => setShowCategorize(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
            >
              Modifier
            </button>
            <button
              type="button"
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
              type="button"
              onClick={() => setShowCategorize(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Tag className="w-3 h-3" />
              Categoriser
            </button>
            <button
              type="button"
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
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Journal
              </label>
              <select
                value={catJournal}
                onChange={(e) => setCatJournal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
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
              type="button"
              onClick={handleCategorize}
              disabled={loading || !catAccount || !catLabel}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Enregistrer
            </button>
            <button
              type="button"
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
