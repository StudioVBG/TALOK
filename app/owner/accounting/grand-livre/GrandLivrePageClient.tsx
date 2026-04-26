"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { PlanGate } from "@/components/subscription/plan-gate";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useEntityStore } from "@/stores/useEntityStore";
import { formatCents } from "@/lib/utils/format-cents";
import { Loader2, BookOpenCheck, ChevronDown, ChevronRight } from "lucide-react";

interface GrandLivreEntry {
  entryId: string;
  entryNumber: string;
  entryDate: string;
  label: string;
  debitCents: number;
  creditCents: number;
  lettrage: string | null;
}

interface GrandLivreItem {
  accountNumber: string;
  accountLabel: string;
  entries: GrandLivreEntry[];
  totalDebitCents: number;
  totalCreditCents: number;
}

interface GrandLivreResponse {
  success: boolean;
  data: { grandLivre: GrandLivreItem[] };
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function GrandLivrePageClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <GrandLivreContent />
    </PlanGate>
  );
}

function GrandLivreContent() {
  const { profile } = useAuth();
  const { activeEntityId } = useEntityStore();
  const entityId =
    activeEntityId ??
    (profile as { default_entity_id?: string | null } | null)?.default_entity_id ??
    undefined;

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

  const [accountFilter, setAccountFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const glQuery = useQuery({
    queryKey: ["accounting", "grand-livre", entityId, exerciseId, accountFilter],
    queryFn: async (): Promise<GrandLivreItem[]> => {
      if (!entityId || !exerciseId) return [];
      const params = new URLSearchParams({ entityId });
      if (accountFilter) params.set("account", accountFilter);
      const res = await apiClient.get<GrandLivreResponse>(
        `/accounting/exercises/${exerciseId}/grand-livre?${params.toString()}`,
      );
      return res?.data?.grandLivre ?? [];
    },
    enabled: !!entityId && !!exerciseId,
    staleTime: 60 * 1000,
  });

  const items = glQuery.data ?? [];

  const sorted = useMemo(
    () => [...items].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)),
    [items],
  );

  const totals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let entryCount = 0;
    for (const it of items) {
      totalDebit += it.totalDebitCents;
      totalCredit += it.totalCreditCents;
      entryCount += it.entries.length;
    }
    return { totalDebit, totalCredit, entryCount };
  }, [items]);

  const toggle = (accountNumber: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(accountNumber)) next.delete(accountNumber);
      else next.add(accountNumber);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(items.map((i) => i.accountNumber)));
  const collapseAll = () => setExpanded(new Set());

  if (!entityId) {
    return <NeedsEntityState />;
  }

  if (!exerciseId && !glQuery.isLoading) {
    return <NoExerciseState />;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
            Grand livre
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {exercise
              ? `Exercice du ${exercise.startDate} au ${exercise.endDate}`
              : "Chargement de l'exercice…"}
          </p>
        </div>
        {glQuery.isFetching && !glQuery.isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          placeholder="Filtrer par préfixe (ex. 512, 706…)"
          className="flex-1 min-w-[240px] rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
        />
        <button
          type="button"
          onClick={expandAll}
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-muted/50"
        >
          Tout déplier
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-muted/50"
        >
          Tout replier
        </button>
      </div>

      {glQuery.isLoading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-lg" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyGLState hasFilter={!!accountFilter} />
      ) : (
        <>
          <div className="space-y-3">
            {sorted.map((account) => {
              const isOpen = expanded.has(account.accountNumber);
              const solde = account.totalDebitCents - account.totalCreditCents;
              return (
                <section
                  key={account.accountNumber}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggle(account.accountNumber)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-mono text-xs text-muted-foreground shrink-0">
                        {account.accountNumber}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">
                        {account.accountLabel}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({account.entries.length})
                      </span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs">
                      <span className="text-foreground">
                        D <strong className="font-medium">{formatCents(account.totalDebitCents)}</strong>
                      </span>
                      <span className="text-foreground">
                        C <strong className="font-medium">{formatCents(account.totalCreditCents)}</strong>
                      </span>
                      <span
                        className={`font-medium ${solde > 0 ? "text-blue-600" : solde < 0 ? "text-rose-600" : "text-muted-foreground"}`}
                      >
                        {solde > 0
                          ? `Solde D ${formatCents(solde)}`
                          : solde < 0
                            ? `Solde C ${formatCents(-solde)}`
                            : "Soldé"}
                      </span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="overflow-x-auto border-t border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground bg-muted/10 border-b border-border">
                            <th className="text-left font-medium px-4 py-2">Date</th>
                            <th className="text-left font-medium px-4 py-2">N° écriture</th>
                            <th className="text-left font-medium px-4 py-2">Libellé</th>
                            <th className="text-right font-medium px-4 py-2">Débit</th>
                            <th className="text-right font-medium px-4 py-2">Crédit</th>
                            <th className="text-center font-medium px-4 py-2">Lettrage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {account.entries.map((entry, i) => (
                            <tr
                              key={`${entry.entryId}-${i}`}
                              className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                                {formatDate(entry.entryDate)}
                              </td>
                              <td className="px-4 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                                <Link
                                  href={`/owner/accounting/entries/${entry.entryId}`}
                                  className="hover:text-primary transition-colors"
                                >
                                  {entry.entryNumber}
                                </Link>
                              </td>
                              <td className="px-4 py-2 text-foreground">{entry.label}</td>
                              <td className="px-4 py-2 text-right font-medium text-foreground whitespace-nowrap">
                                {entry.debitCents > 0 ? formatCents(entry.debitCents) : "—"}
                              </td>
                              <td className="px-4 py-2 text-right font-medium text-foreground whitespace-nowrap">
                                {entry.creditCents > 0 ? formatCents(entry.creditCents) : "—"}
                              </td>
                              <td className="px-4 py-2 text-center text-xs">
                                {entry.lettrage ? (
                                  <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                    {entry.lettrage}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="bg-card rounded-xl border border-border px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                {sorted.length} compte{sorted.length > 1 ? "s" : ""},{" "}
                {totals.entryCount} ligne{totals.entryCount > 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-6">
                <span className="text-foreground">
                  <span className="text-muted-foreground mr-1">Total débit :</span>
                  <span className="font-medium">{formatCents(totals.totalDebit)}</span>
                </span>
                <span className="text-foreground">
                  <span className="text-muted-foreground mr-1">Total crédit :</span>
                  <span className="font-medium">{formatCents(totals.totalCredit)}</span>
                </span>
              </div>
            </div>
            {totals.totalDebit !== totals.totalCredit && (
              <p className="mt-2 text-xs text-amber-600">
                ⚠️ Grand livre déséquilibré : écart de{" "}
                {formatCents(Math.abs(totals.totalDebit - totals.totalCredit))}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NeedsEntityState() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          Sélectionnez une entité comptable pour afficher le grand livre.
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
          <BookOpenCheck className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Aucun exercice ouvert. Créez un exercice pour générer le grand livre.
        </p>
      </div>
    </div>
  );
}

function EmptyGLState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="bg-card rounded-xl border border-border p-8 sm:p-12 text-center space-y-3">
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <BookOpenCheck className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {hasFilter
          ? "Aucun compte ne correspond à ce préfixe."
          : "Aucune écriture validée sur cet exercice. Le grand livre se remplira à mesure que vous validerez les écritures."}
      </p>
    </div>
  );
}
