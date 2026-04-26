"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlanGate } from "@/components/subscription/plan-gate";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useEntityStore } from "@/stores/useEntityStore";
import { useChartOfAccounts } from "@/lib/hooks/use-accounting-entries";
import { formatCents } from "@/lib/utils/format-cents";
import { Loader2, ArrowRightLeft, Plus } from "lucide-react";

interface Transfer {
  id: string;
  entity_id: string;
  from_account_number: string;
  to_account_number: string;
  amount_cents: number;
  transfer_date: string;
  label: string | null;
  created_at: string;
}

interface TransfersResponse {
  success: boolean;
  data: { transfers: Transfer[] };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function TransfersPageClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <TransfersContent />
    </PlanGate>
  );
}

function TransfersContent() {
  const { profile } = useAuth();
  const { activeEntityId } = useEntityStore();
  const entityId =
    activeEntityId ??
    (profile as { default_entity_id?: string | null } | null)?.default_entity_id ??
    undefined;

  const [formOpen, setFormOpen] = useState(false);

  const transfersQuery = useQuery({
    queryKey: ["accounting", "transfers", entityId],
    queryFn: async (): Promise<Transfer[]> => {
      if (!entityId) return [];
      const res = await apiClient.get<TransfersResponse>(
        `/accounting/transfers?entityId=${encodeURIComponent(entityId)}`,
      );
      return res?.data?.transfers ?? [];
    },
    enabled: !!entityId,
    staleTime: 60 * 1000,
  });

  const transfers = transfersQuery.data ?? [];

  if (!entityId) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Sélectionnez une entité comptable pour gérer les virements internes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Virements internes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Déplacements entre vos propres comptes bancaires (compte courant ↔
            fonds travaux, etc.)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {transfersQuery.isFetching && !transfersQuery.isLoading && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nouveau virement
          </button>
        </div>
      </div>

      {formOpen && (
        <NewTransferForm
          entityId={entityId}
          onClose={() => setFormOpen(false)}
        />
      )}

      {transfersQuery.isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-lg" />
          ))}
        </div>
      ) : transfers.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground bg-muted/30 border-b border-border">
                  <th className="text-left px-4 py-2.5 font-medium">Date</th>
                  <th className="text-left px-4 py-2.5 font-medium">Source → Destination</th>
                  <th className="text-left px-4 py-2.5 font-medium">Libellé</th>
                  <th className="text-right px-4 py-2.5 font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {formatDate(t.transfer_date)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">
                      <span className="text-foreground">{t.from_account_number}</span>
                      <ArrowRightLeft className="inline-block mx-2 w-3 h-3 text-muted-foreground" />
                      <span className="text-foreground">{t.to_account_number}</span>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">
                      {t.label ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-foreground whitespace-nowrap">
                      {formatCents(t.amount_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function NewTransferForm({
  entityId,
  onClose,
}: {
  entityId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useChartOfAccounts(entityId);

  // Filtre sur les comptes 5xx (trésorerie) — virements internes uniquement
  // entre comptes bancaires/caisse.
  const treasuryAccounts = accounts.filter((a) =>
    a.account_number.startsWith("5"),
  );

  const today = new Date().toISOString().split("T")[0];
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const amountCents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw new Error("Montant invalide");
      }
      return apiClient.post("/accounting/transfers", {
        entity_id: entityId,
        from_account_number: from,
        to_account_number: to,
        amount_cents: amountCents,
        date,
        label: label.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "transfers"] });
      queryClient.invalidateQueries({ queryKey: ["accounting", "entries"] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message ?? "Erreur création virement");
    },
  });

  const canSubmit = from && to && from !== to && amount && date;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        createMutation.mutate();
      }}
      className="bg-card rounded-xl border border-border p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold text-foreground">Nouveau virement</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Compte source
          </span>
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">Sélectionner…</option>
            {treasuryAccounts.map((a) => (
              <option key={a.id} value={a.account_number}>
                {a.account_number} — {a.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Compte destination
          </span>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">Sélectionner…</option>
            {treasuryAccounts
              .filter((a) => a.account_number !== from)
              .map((a) => (
                <option key={a.id} value={a.account_number}>
                  {a.account_number} — {a.label}
                </option>
              ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            Montant (€)
          </span>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="1500,00"
            required
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </label>

        <label className="space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">
            Libellé (optionnel)
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="Ex. Provision fonds travaux T2"
          />
        </label>
      </div>

      {from && to && from === to && (
        <p className="text-xs text-amber-600">
          Les comptes source et destination doivent être différents.
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-muted/50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={!canSubmit || createMutation.isPending}
          className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {createMutation.isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function EmptyState() {
  return (
    <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Aucun virement interne enregistré. Cliquez sur « Nouveau virement »
        pour déclarer un mouvement entre vos comptes bancaires.
      </p>
    </div>
  );
}
