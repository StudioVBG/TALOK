"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PlanGate } from "@/components/subscription/plan-gate";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useEntityStore } from "@/stores/useEntityStore";
import { formatCents } from "@/lib/utils/format-cents";
import { Loader2, Scale } from "lucide-react";
import { HelpHint } from "@/components/accounting/HelpHint";

interface BalanceItem {
  accountNumber: string;
  label: string;
  totalDebitCents: number;
  totalCreditCents: number;
  soldeDebitCents: number;
  soldeCreditCents: number;
}

interface BalanceResponse {
  success: boolean;
  data: { balance: BalanceItem[] };
}

interface ExerciseRow {
  id: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
}

interface ExercisesResponse {
  success?: boolean;
  data?: { exercises: ExerciseRow[] };
}

const ACCOUNT_CLASS_LABELS: Record<string, string> = {
  "1": "Classe 1 — Capitaux",
  "2": "Classe 2 — Immobilisations",
  "3": "Classe 3 — Stocks",
  "4": "Classe 4 — Tiers",
  "5": "Classe 5 — Trésorerie",
  "6": "Classe 6 — Charges",
  "7": "Classe 7 — Produits",
  "8": "Classe 8 — Spéciaux",
};

export default function BalancePageClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <BalanceContent />
    </PlanGate>
  );
}

function BalanceContent() {
  const { profile } = useAuth();
  const { activeEntityId } = useEntityStore();
  const entityId =
    activeEntityId ??
    (profile as { default_entity_id?: string | null } | null)?.default_entity_id ??
    undefined;

  // Resolve the active (or most recent) exercise for this entity.
  const exerciseQuery = useQuery({
    queryKey: ["accounting", "current-exercise", entityId],
    queryFn: async (): Promise<ExerciseRow | null> => {
      if (!entityId) return null;
      const res = await apiClient.get<ExercisesResponse | ExerciseRow[]>(
        `/accounting/exercises?entityId=${entityId}`,
      );
      const list = Array.isArray(res) ? res : res?.data?.exercises ?? [];
      return list.find((e) => e.status === "open") ?? list[0] ?? null;
    },
    enabled: !!entityId,
    staleTime: 5 * 60 * 1000,
  });
  const exercise = exerciseQuery.data ?? null;
  const exerciseId = exercise?.id;

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("");

  const balanceQuery = useQuery({
    queryKey: ["accounting", "balance-generale", entityId, exerciseId],
    queryFn: async (): Promise<BalanceItem[]> => {
      if (!entityId || !exerciseId) return [];
      const res = await apiClient.get<BalanceResponse>(
        `/accounting/exercises/${exerciseId}/balance?entityId=${encodeURIComponent(entityId)}`,
      );
      return res?.data?.balance ?? [];
    },
    enabled: !!entityId && !!exerciseId,
    staleTime: 60 * 1000,
  });

  const balance = balanceQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return balance.filter((b) => {
      if (classFilter && b.accountNumber.charAt(0) !== classFilter) return false;
      if (!q) return true;
      return (
        b.accountNumber.toLowerCase().includes(q) ||
        b.label.toLowerCase().includes(q)
      );
    });
  }, [balance, search, classFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, BalanceItem[]>();
    for (const b of filtered) {
      const cls = b.accountNumber.charAt(0);
      const list = map.get(cls) ?? [];
      list.push(b);
      map.set(cls, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const totals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let soldeDebit = 0;
    let soldeCredit = 0;
    for (const b of filtered) {
      totalDebit += b.totalDebitCents;
      totalCredit += b.totalCreditCents;
      soldeDebit += b.soldeDebitCents;
      soldeCredit += b.soldeCreditCents;
    }
    return { totalDebit, totalCredit, soldeDebit, soldeCredit };
  }, [filtered]);

  if (!entityId) {
    return <NeedsEntityState />;
  }

  if (!exerciseId && !balanceQuery.isLoading) {
    return <NoExerciseState />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)] inline-flex items-center gap-2">
            Balance générale
            <HelpHint
              ariaLabel="Qu'est-ce que la balance générale ?"
              title="Balance générale"
              description={
                <>
                  <p>
                    État qui liste TOUS les comptes mouvementés sur l'exercice
                    avec, pour chacun, le total des débits, le total des crédits
                    et le solde résultant.
                  </p>
                  <p>
                    Chaque compte appartient à une classe (1 à 8 du plan
                    comptable). Les classes 6 (charges) et 7 (produits)
                    déterminent le résultat de l'exercice.
                  </p>
                  <p className="text-muted-foreground/80">
                    Source de la déclaration 2044 et obligatoire en cas de
                    contrôle fiscal.
                  </p>
                </>
              }
            />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {exercise
              ? `Exercice du ${exercise.startDate} au ${exercise.endDate}`
              : "Chargement de l'exercice…"}
          </p>
        </div>
        {balanceQuery.isFetching && !balanceQuery.isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (n° ou libellé)"
          className="flex-1 min-w-[240px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">Toutes classes</option>
          {Object.entries(ACCOUNT_CLASS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      {balanceQuery.isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyBalanceState hasFilters={!!search || !!classFilter} />
      ) : (
        <>
          <div className="space-y-6">
            {grouped.map(([cls, items]) => (
              <section
                key={cls}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <h2 className="text-sm font-semibold text-foreground px-4 py-2.5 border-b border-border bg-muted/30">
                  {ACCOUNT_CLASS_LABELS[cls] ?? `Classe ${cls}`}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({items.length})
                  </span>
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted-foreground bg-muted/10 border-b border-border">
                        <th className="text-left font-medium px-4 py-2">
                          <span className="inline-flex items-center gap-1">
                            N° compte
                            <HelpHint tooltip="Numéro PCG (plan comptable général). Le 1er chiffre indique la classe : 6=charges, 7=produits, 4=tiers, 5=trésorerie." />
                          </span>
                        </th>
                        <th className="text-left font-medium px-4 py-2">Libellé</th>
                        <th className="text-right font-medium px-4 py-2">
                          <span className="inline-flex items-center gap-1 justify-end">
                            Total débit
                            <HelpHint tooltip="Cumul de tous les débits enregistrés sur ce compte au cours de l'exercice." />
                          </span>
                        </th>
                        <th className="text-right font-medium px-4 py-2">
                          <span className="inline-flex items-center gap-1 justify-end">
                            Total crédit
                            <HelpHint tooltip="Cumul de tous les crédits enregistrés sur ce compte au cours de l'exercice." />
                          </span>
                        </th>
                        <th className="text-right font-medium px-4 py-2">
                          <span className="inline-flex items-center gap-1 justify-end">
                            Solde débit
                            <HelpHint tooltip="Différence Débit - Crédit quand elle est positive. Solde des comptes de charges, immobilisations, créances clients." />
                          </span>
                        </th>
                        <th className="text-right font-medium px-4 py-2">
                          <span className="inline-flex items-center gap-1 justify-end">
                            Solde crédit
                            <HelpHint tooltip="Différence Crédit - Débit quand elle est positive. Solde des comptes de produits, capitaux, dettes fournisseurs." />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((b) => (
                        <tr
                          key={b.accountNumber}
                          className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-2.5 font-mono text-xs text-foreground whitespace-nowrap">
                            {b.accountNumber}
                          </td>
                          <td className="px-4 py-2.5 text-foreground">{b.label}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-foreground whitespace-nowrap">
                            {b.totalDebitCents > 0 ? formatCents(b.totalDebitCents) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-foreground whitespace-nowrap">
                            {b.totalCreditCents > 0 ? formatCents(b.totalCreditCents) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-blue-600 whitespace-nowrap">
                            {b.soldeDebitCents > 0 ? formatCents(b.soldeDebitCents) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-rose-600 whitespace-nowrap">
                            {b.soldeCreditCents > 0 ? formatCents(b.soldeCreditCents) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>

          <div className="bg-card rounded-xl border border-border px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Stat label="Total débit" value={formatCents(totals.totalDebit)} />
              <Stat label="Total crédit" value={formatCents(totals.totalCredit)} />
              <Stat
                label="Solde débit"
                value={formatCents(totals.soldeDebit)}
                tone="debit"
              />
              <Stat
                label="Solde crédit"
                value={formatCents(totals.soldeCredit)}
                tone="credit"
              />
            </div>
            {totals.totalDebit !== totals.totalCredit && (
              <p className="mt-2 text-xs text-amber-600">
                ⚠️ Balance déséquilibrée : écart de{" "}
                {formatCents(Math.abs(totals.totalDebit - totals.totalCredit))}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "debit" | "credit";
}) {
  const colorClass =
    tone === "debit" ? "text-blue-600" : tone === "credit" ? "text-rose-600" : "text-foreground";
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}

function NeedsEntityState() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Sélectionnez une entité comptable pour afficher la balance.
        </p>
      </div>
    </div>
  );
}

function NoExerciseState() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center space-y-3">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Scale className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Aucun exercice ouvert. Créez un exercice pour générer la balance.
        </p>
      </div>
    </div>
  );
}

function EmptyBalanceState({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun compte ne correspond aux filtres.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Scale className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Aucune écriture validée sur cet exercice. La balance est vide tant que
        des écritures n'ont pas été validées.
      </p>
    </div>
  );
}
