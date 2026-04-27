"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PlanGate } from "@/components/subscription/plan-gate";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { useEntityStore } from "@/stores/useEntityStore";
import { formatCents } from "@/lib/utils/format-cents";
import { HelpHint } from "@/components/accounting/HelpHint";
import {
  Loader2,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  Link2,
  Link2Off,
  X,
} from "lucide-react";

interface GrandLivreEntry {
  lineId: string;
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

  const queryClient = useQueryClient();
  const [accountFilter, setAccountFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ── Lettrage selection ────────────────────────────────────────────
  // On stocke les lineId sélectionnés (cross-account possible mais
  // typiquement on lettré sur un même compte 411 pour un même tiers).
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [lettrageModalOpen, setLettrageModalOpen] = useState(false);
  const [lettrageCode, setLettrageCode] = useState("");
  const [lettrageError, setLettrageError] = useState<string | null>(null);

  const toggleLine = (lineId: string) =>
    setSelectedLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(lineId)) next.delete(lineId);
      else next.add(lineId);
      return next;
    });
  const clearSelection = () => setSelectedLineIds(new Set());

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

  // Aggregate stats sur la sélection courante (pour valider le lettrage)
  const selectionStats = useMemo(() => {
    let debit = 0;
    let credit = 0;
    let lettered = 0;
    let unlettered = 0;
    for (const account of items) {
      for (const entry of account.entries) {
        if (selectedLineIds.has(entry.lineId)) {
          debit += entry.debitCents;
          credit += entry.creditCents;
          if (entry.lettrage) lettered++;
          else unlettered++;
        }
      }
    }
    return {
      count: selectedLineIds.size,
      debit,
      credit,
      balanced: debit === credit,
      lettered,
      unlettered,
    };
  }, [items, selectedLineIds]);

  // Mutations
  const applyMutation = useMutation({
    mutationFn: async (code: string) =>
      apiClient.post("/accounting/entries/lettrage", {
        line_ids: Array.from(selectedLineIds),
        lettrage_code: code,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "grand-livre"] });
      queryClient.invalidateQueries({ queryKey: ["accounting", "balance-generale"] });
      clearSelection();
      setLettrageModalOpen(false);
      setLettrageCode("");
      setLettrageError(null);
    },
    onError: (err: Error) => {
      setLettrageError(err.message ?? "Erreur lors du lettrage");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () =>
      apiClient.post("/accounting/entries/lettrage", {
        line_ids: Array.from(selectedLineIds),
        lettrage_code: null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "grand-livre"] });
      clearSelection();
    },
  });

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
          <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)] inline-flex items-center gap-2">
            Grand livre
            <HelpHint
              ariaLabel="Qu'est-ce que le grand livre ?"
              title="Grand livre"
              description={
                <>
                  <p>
                    Détail ligne par ligne de TOUTES les écritures comptables
                    de l'exercice, regroupées par compte. Chaque mouvement
                    affiche sa date, son n° de pièce, son libellé et son
                    sens (débit ou crédit).
                  </p>
                  <p>
                    Cochez plusieurs lignes (par ex. une facture et son
                    paiement) pour les <strong>lettrer</strong> ensemble :
                    elles sont marquées comme soldées et n'apparaîtront plus
                    comme dues.
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
                            <th className="w-8 px-2 py-2"></th>
                            <th className="text-left font-medium px-4 py-2">Date</th>
                            <th className="text-left font-medium px-4 py-2">
                              <span className="inline-flex items-center gap-1">
                                N° écriture
                                <HelpHint tooltip="Numéro séquentiel attribué à l'écriture par son journal (ex. BQ000123 pour la 123e écriture du journal Banque)." />
                              </span>
                            </th>
                            <th className="text-left font-medium px-4 py-2">Libellé</th>
                            <th className="text-right font-medium px-4 py-2">Débit</th>
                            <th className="text-right font-medium px-4 py-2">Crédit</th>
                            <th className="text-center font-medium px-4 py-2">
                              <span className="inline-flex items-center gap-1 justify-center">
                                Lettrage
                                <HelpHint tooltip="Code (A, B, C…) qui relie une facture à son paiement. La somme des lignes lettrées doit toujours être nulle (D = C)." />
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {account.entries.map((entry, i) => {
                            const isSelected = selectedLineIds.has(entry.lineId);
                            return (
                              <tr
                                key={`${entry.lineId}-${i}`}
                                className={`border-b border-border last:border-b-0 transition-colors ${
                                  isSelected
                                    ? "bg-primary/5"
                                    : "hover:bg-muted/30"
                                }`}
                              >
                                <td className="px-2 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleLine(entry.lineId)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded border-border"
                                    aria-label={`Sélectionner ligne ${entry.entryNumber}`}
                                  />
                                </td>
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
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* Action bar lettrage — fixed bottom quand sélection > 0 */}
          {selectionStats.count > 0 && (
            <LettrageActionBar
              stats={selectionStats}
              onLettrer={() => {
                setLettrageError(null);
                setLettrageCode("");
                setLettrageModalOpen(true);
              }}
              onDelettrer={() => removeMutation.mutate()}
              onClear={clearSelection}
              isPending={removeMutation.isPending}
            />
          )}

          {lettrageModalOpen && (
            <LettrageModal
              stats={selectionStats}
              code={lettrageCode}
              onCodeChange={setLettrageCode}
              error={lettrageError}
              onClose={() => {
                setLettrageModalOpen(false);
                setLettrageCode("");
                setLettrageError(null);
              }}
              onSubmit={() => applyMutation.mutate(lettrageCode)}
              isPending={applyMutation.isPending}
            />
          )}

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

function LettrageActionBar({
  stats,
  onLettrer,
  onDelettrer,
  onClear,
  isPending,
}: {
  stats: {
    count: number;
    debit: number;
    credit: number;
    balanced: boolean;
    lettered: number;
    unlettered: number;
  };
  onLettrer: () => void;
  onDelettrer: () => void;
  onClear: () => void;
  isPending: boolean;
}) {
  return (
    <div className="sticky bottom-4 z-20 mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
        <button
          type="button"
          onClick={onClear}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Désélectionner"
        >
          <X className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium text-foreground">
          {stats.count} ligne{stats.count > 1 ? "s" : ""} sélectionnée
          {stats.count > 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">D :</span>
          <span className="font-medium">{formatCents(stats.debit)}</span>
          <span className="text-muted-foreground ml-2">C :</span>
          <span className="font-medium">{formatCents(stats.credit)}</span>
          {stats.balanced ? (
            <span className="ml-1 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
              équilibré
            </span>
          ) : (
            <span className="ml-1 inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
              ≠
            </span>
          )}
        </div>
        <div className="flex-1" />
        {stats.unlettered > 0 && stats.balanced && stats.count >= 2 && (
          <button
            type="button"
            onClick={onLettrer}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Link2 className="w-3.5 h-3.5" />
            Lettrer
          </button>
        )}
        {stats.lettered > 0 && (
          <button
            type="button"
            onClick={onDelettrer}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/40 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Link2Off className="w-3.5 h-3.5" />
            )}
            Délettrer
          </button>
        )}
      </div>
    </div>
  );
}

function LettrageModal({
  stats,
  code,
  onCodeChange,
  error,
  onClose,
  onSubmit,
  isPending,
}: {
  stats: {
    count: number;
    debit: number;
    credit: number;
    balanced: boolean;
  };
  code: string;
  onCodeChange: (v: string) => void;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const isValid =
    code.trim().length >= 1 &&
    code.trim().length <= 8 &&
    /^[A-Z0-9]+$/i.test(code.trim()) &&
    stats.balanced;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={() => !isPending && onClose()}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (isValid) onSubmit();
        }}
        className="bg-card rounded-xl border border-border w-full max-w-md mx-4 p-5 space-y-4 shadow-xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Lettrer les lignes sélectionnées
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Le lettrage marque ces {stats.count} lignes avec un code commun
              pour signifier qu'elles se compensent (créance ↔ encaissement).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-lg bg-muted/30 border border-border px-3 py-2 text-xs space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lignes</span>
            <span>{stats.count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Débit total</span>
            <span className="font-medium">{formatCents(stats.debit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Crédit total</span>
            <span className="font-medium">{formatCents(stats.credit)}</span>
          </div>
        </div>

        <label className="space-y-1 block">
          <span className="text-xs font-medium text-muted-foreground">
            Code de lettrage <span className="text-rose-600">*</span>
          </span>
          <input
            type="text"
            value={code}
            onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
            placeholder="A, AB, L1, 2026M01…"
            maxLength={8}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono uppercase"
            autoFocus
            required
          />
          <span className="text-[11px] text-muted-foreground">
            Alphanumérique, 1 à 8 caractères. Convention française : lettres
            seules (A, B, AA…) ou lettre + numéro de période (M01, T1…).
          </span>
        </label>

        {!stats.balanced && (
          <p className="text-xs text-amber-600">
            ⚠️ Le débit ne correspond pas au crédit (écart{" "}
            {formatCents(Math.abs(stats.debit - stats.credit))}). Le lettrage
            sera rejeté par le serveur.
          </p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-muted/50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={!isValid || isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Lettrer
          </button>
        </div>
      </form>
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
