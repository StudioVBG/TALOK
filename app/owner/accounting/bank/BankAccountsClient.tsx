"use client";

import { PlanGate } from "@/components/subscription/plan-gate";
import { useBankConnections, BankConnection } from "@/lib/hooks/use-bank-connections";
import { useReconciliation } from "@/lib/hooks/use-reconciliation";
import { formatCents } from "@/lib/utils/format-cents";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  RefreshCw,
  Link2,
  AlertTriangle,
  Plus,
  ArrowRight,
  Loader2,
  Landmark,
  PiggyBank,
  Shield,
} from "lucide-react";

export default function BankAccountsClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <BankAccountsContent />
    </PlanGate>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function maskIban(iban: string | null): string {
  if (!iban || iban.length < 8) return "****";
  const clean = iban.replace(/\s/g, "");
  return `${clean.slice(0, 4)} **** ${clean.slice(-4)}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Jamais synchronise";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "A l'instant";
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

function accountBorderColor(type: BankConnection["account_type"]): string {
  switch (type) {
    case "exploitation":
      return "border-l-green-500";
    case "epargne":
      return "border-l-violet-500";
    case "depot_garantie":
      return "border-l-orange-500";
    default:
      return "border-l-gray-400";
  }
}

function accountIcon(type: BankConnection["account_type"]) {
  switch (type) {
    case "exploitation":
      return <Landmark className="w-5 h-5 text-green-500" />;
    case "epargne":
      return <PiggyBank className="w-5 h-5 text-violet-500" />;
    case "depot_garantie":
      return <Shield className="w-5 h-5 text-orange-500" />;
    default:
      return <CreditCard className="w-5 h-5 text-muted-foreground" />;
  }
}

function accountLabel(type: BankConnection["account_type"]): string {
  switch (type) {
    case "exploitation":
      return "Compte exploitation";
    case "epargne":
      return "Epargne / Fonds travaux";
    case "depot_garantie":
      return "Depot de garantie";
    default:
      return "Autre";
  }
}

// ── Sync status badge ───────────────────────────────────────────────

function SyncBadge({ status }: { status: BankConnection["sync_status"] }) {
  switch (status) {
    case "active":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Actif
        </span>
      );
    case "syncing":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          Synchronisation
        </span>
      );
    case "expired":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Expire
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400">
          <AlertTriangle className="w-3 h-3" />
          Erreur
        </span>
      );
    default:
      return null;
  }
}

// ── Main content ────────────────────────────────────────────────────

function BankAccountsContent() {
  const { connections, isLoading, error } = useBankConnections();
  const { stats } = useReconciliation();

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-pulse">
        <div className="h-28 bg-muted rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-card rounded-xl border border-border p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-destructive">
            Erreur lors du chargement des comptes bancaires.
          </p>
        </div>
      </div>
    );
  }

  const isEmpty = connections.length === 0;
  const totalBalanceCents = connections.reduce(
    (sum, c) => sum + (c.balance_cents ?? 0),
    0
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
          Comptes bancaires
        </h1>
        <div className="flex gap-2">
          <Link
            href="/owner/accounting/bank/reconciliation"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-[#1B2A6B] transition-colors"
          >
            <Link2 className="w-4 h-4" />
            Rapprochement bancaire
          </Link>
          <Link
            href="/owner/accounting/bank/connect"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter un compte
          </Link>
        </div>
      </div>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {/* Treasury header card */}
          <div className="bg-gradient-to-r from-[#2563EB] to-[#1B2A6B] rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-6 h-6 opacity-80" />
              <span className="text-sm font-medium opacity-80">
                Tresorerie totale
              </span>
            </div>
            <p className="text-3xl font-bold font-[family-name:var(--font-manrope)]">
              {formatCents(totalBalanceCents)}
            </p>
            <p className="text-sm opacity-60 mt-1">
              {connections.length} compte{connections.length > 1 ? "s" : ""} connecte{connections.length > 1 ? "s" : ""}
            </p>
          </div>

          {/* Connection cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {connections.map((conn) => (
              <ConnectionCard key={conn.id} connection={conn} />
            ))}
          </div>

          {/* Reconciliation progress bar */}
          {stats.total > 0 && (
            <ReconciliationProgress stats={stats} />
          )}
        </>
      )}
    </div>
  );
}

// ── Connection card ─────────────────────────────────────────────────

function ConnectionCard({ connection }: { connection: BankConnection }) {
  const c = connection;
  return (
    <div
      className={`bg-card rounded-xl border border-border border-l-4 ${accountBorderColor(
        c.account_type
      )} p-4 space-y-3`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {accountIcon(c.account_type)}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {c.institution_name ?? accountLabel(c.account_type)}
            </p>
            <p className="text-xs text-muted-foreground">
              {maskIban(c.iban)}
            </p>
          </div>
        </div>
        <SyncBadge status={c.sync_status} />
      </div>

      <p className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
        {formatCents(c.balance_cents)}
      </p>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {timeAgo(c.last_sync_at)}
        </p>
        {c.sync_status === "expired" && (
          <Link
            href="/owner/accounting/bank/connect"
            className="text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Reconnecter
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Reconciliation progress ─────────────────────────────────────────

function ReconciliationProgress({
  stats,
}: {
  stats: { total: number; matched: number; suggested: number; orphan: number };
}) {
  const { total, matched, suggested, orphan } = stats;
  if (total === 0) return null;

  const pctMatched = Math.round((matched / total) * 100);
  const pctSuggested = Math.round((suggested / total) * 100);
  const pctOrphan = Math.round((orphan / total) * 100);

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Rapprochement bancaire
        </h3>
        <Link
          href="/owner/accounting/bank/reconciliation"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Voir le detail
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Progress bar */}
      <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
        {pctMatched > 0 && (
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${pctMatched}%` }}
          />
        )}
        {pctSuggested > 0 && (
          <div
            className="h-full bg-orange-500 transition-all"
            style={{ width: `${pctSuggested}%` }}
          />
        )}
        {pctOrphan > 0 && (
          <div
            className="h-full bg-red-500 transition-all"
            style={{ width: `${pctOrphan}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          Rapproches : {matched}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
          A valider : {suggested}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          Non identifies : {orphan}
        </span>
      </div>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="bg-card rounded-xl border border-border p-8 text-center space-y-4">
      <Building2 className="w-12 h-12 text-muted-foreground mx-auto" />
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Aucun compte bancaire connecte
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connectez votre banque pour synchroniser vos transactions et automatiser le rapprochement bancaire.
        </p>
      </div>
      <Link
        href="/owner/accounting/bank/connect"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-white text-sm font-medium hover:bg-[#1B2A6B] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Ajouter un compte bancaire
      </Link>
    </div>
  );
}
