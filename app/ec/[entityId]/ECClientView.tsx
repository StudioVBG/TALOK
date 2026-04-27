"use client";
import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";
import {
  ArrowLeft,
  MessageSquare,
  Download,
  Check,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { formatCents } from "@/lib/utils/format-cents";

type Exercise = { id: string; status: string; start_date: string; end_date: string };
type Entry = {
  id: string;
  entry_date: string;
  label: string;
  entry_number: string;
  is_validated?: boolean;
  source?: string | null;
};
type EntryStatusFilter = "all" | "validated" | "draft";
type BalanceItem = {
  accountNumber: string;
  label: string;
  soldeDebitCents: number;
  soldeCreditCents: number;
};
type GrandLivreEntry = {
  lineId: string;
  entryId: string;
  entryNumber: string;
  entryDate: string;
  label: string;
  debitCents: number;
  creditCents: number;
  lettrage: string | null;
};
type GrandLivreAccount = {
  accountNumber: string;
  accountLabel: string;
  entries: GrandLivreEntry[];
  totalDebitCents: number;
  totalCreditCents: number;
};
type Annotation = {
  id: string;
  content: string;
  annotation_type: string;
  is_resolved: boolean;
  created_at: string;
};

export default function ECClientView() {
  const { entityId } = useParams<{ entityId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("ecritures");
  const [annotationContent, setAnnotationContent] = useState("");
  const [showAnnotationForm, setShowAnnotationForm] = useState<string | null>(null);
  const [packDownloading, setPackDownloading] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  // Filtres sur l'onglet Écritures. Côté serveur via query params (la
  // route /accounting/entries supporte déjà status & search) — moins
  // de bruit côté client.
  const [entryStatusFilter, setEntryStatusFilter] =
    useState<EntryStatusFilter>("all");
  const [entrySearch, setEntrySearch] = useState("");
  const [entrySearchDebounced, setEntrySearchDebounced] = useState("");
  // Debounce 300ms sur la recherche pour ne pas hammer l'API à chaque
  // frappe. La query useQuery dépend de la version débouncée.
  useEffect(() => {
    const t = setTimeout(() => setEntrySearchDebounced(entrySearch), 300);
    return () => clearTimeout(t);
  }, [entrySearch]);
  // Exercice piloté par l'utilisateur EC. null = "auto" → exercice ouvert
  // (ou plus récent à défaut). Les écritures ET le pack export sont
  // scopés à cet exercice.
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );

  // Liste des exercices de l'entité — alimente le selector + détermine
  // l'exercice courant pour le pack export.
  const { data: exercises } = useQuery<any>({
    queryKey: ["ec-exercises", entityId],
    queryFn: () =>
      apiClient.get(`/accounting/exercises?entityId=${entityId}`),
    enabled: !!entityId,
  });

  const exerciseList = (exercises?.data?.exercises ?? exercises?.data ?? []) as Exercise[];
  const defaultExercise: Exercise | undefined =
    exerciseList.find((e) => e.status === "open") ?? exerciseList[0];
  const activeExerciseId = selectedExerciseId ?? defaultExercise?.id ?? null;
  const activeExercise = exerciseList.find((e) => e.id === activeExerciseId);

  const { data: entries, isFetching: entriesFetching } = useQuery<any>({
    queryKey: [
      "ec-entries",
      entityId,
      activeExerciseId,
      entryStatusFilter,
      entrySearchDebounced,
    ],
    queryFn: () => {
      // La route /api/accounting/entries lit `entity_id` (snake_case)
      // pas `entityId` — l'envoi en camelCase, comme c'était le cas
      // avant, faisait silencieusement tomber sur le filtre fallback
      // owner_id=profile.id et l'EC voyait zéro écriture.
      const params = new URLSearchParams({
        entity_id: entityId as string,
        limit: "100",
      });
      if (activeExerciseId) params.set("exercise_id", activeExerciseId);
      if (entryStatusFilter !== "all") {
        params.set("status", entryStatusFilter);
      }
      if (entrySearchDebounced.trim()) {
        params.set("search", entrySearchDebounced.trim());
      }
      return apiClient.get(`/accounting/entries?${params.toString()}`);
    },
    enabled: !!entityId,
  });

  // Balance de l'exercice actif, scopée à l'entité. Sert à dériver
  // recettes / dépenses / résultat affichés en KPIs au-dessus des tabs.
  // Note : la route balance vient d'être ouverte aux EC dans le commit
  // P2.2 follow-up suivant (auth: ec_access lookup + gating sur owner).
  const { data: balanceData, isLoading: balanceLoading } = useQuery<any>({
    queryKey: ["ec-balance", entityId, activeExerciseId],
    queryFn: () =>
      apiClient.get(
        `/accounting/exercises/${activeExerciseId}/balance?entityId=${encodeURIComponent(entityId as string)}`,
      ),
    enabled: !!entityId && !!activeExerciseId,
  });

  // Grand-livre — chargé seulement quand l'onglet est activé pour
  // éviter le coût d'un fetch sur tous les comptes inutilement.
  const { data: glData, isLoading: glLoading } = useQuery<any>({
    queryKey: ["ec-grand-livre", entityId, activeExerciseId],
    queryFn: () =>
      apiClient.get(
        `/accounting/exercises/${activeExerciseId}/grand-livre?entityId=${encodeURIComponent(entityId as string)}`,
      ),
    enabled:
      !!entityId && !!activeExerciseId && activeTab === "grand-livre",
    staleTime: 60 * 1000,
  });
  const grandLivre: GrandLivreAccount[] =
    glData?.data?.grandLivre ?? glData?.grandLivre ?? [];

  // Agrégats classes 6 / 7. On ne fait pas de calcul "métier" ici —
  // juste un sum direct sur la balance déjà calculée par l'engine.
  const kpis = useMemo(() => {
    const items: BalanceItem[] =
      balanceData?.data?.balance ?? balanceData?.balance ?? [];
    let revenuesCents = 0;
    let expensesCents = 0;
    for (const it of items) {
      const cls = it.accountNumber?.charAt(0);
      if (cls === "7") {
        revenuesCents += (it.soldeCreditCents ?? 0) - (it.soldeDebitCents ?? 0);
      } else if (cls === "6") {
        expensesCents += (it.soldeDebitCents ?? 0) - (it.soldeCreditCents ?? 0);
      }
    }
    return {
      revenuesCents,
      expensesCents,
      resultCents: revenuesCents - expensesCents,
    };
  }, [balanceData]);

  const { data: annotations } = useQuery<any>({
    queryKey: ["ec-annotations", entityId],
    queryFn: () =>
      apiClient.get(`/accounting/ec/annotations?entityId=${entityId}`),
    enabled: !!entityId,
  });

  const addAnnotation = useMutation<any, any, any>({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post("/accounting/ec/annotations", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ec-annotations"] });
      setShowAnnotationForm(null);
      setAnnotationContent("");
    },
  });

  const resolveAnnotation = useMutation<any, any, string>({
    mutationFn: (id) => apiClient.patch(`/accounting/ec/annotations/${id}`, {}),
    // Optimistic UI : on patche le cache local immédiatement, l'invalidation
    // dans onSuccess sert de réconciliation au cas où le serveur diverge.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["ec-annotations", entityId] });
      const previous = queryClient.getQueryData<any>([
        "ec-annotations",
        entityId,
      ]);
      queryClient.setQueryData<any>(["ec-annotations", entityId], (old: any) => {
        if (!old) return old;
        const list = old?.data ?? old;
        const next = (Array.isArray(list) ? list : []).map((a: any) =>
          a.id === id ? { ...a, is_resolved: true } : a,
        );
        return Array.isArray(old) ? next : { ...old, data: next };
      });
      return { previous };
    },
    onError: (_err, _id, ctx: any) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["ec-annotations", entityId], ctx.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ec-annotations", entityId] });
    },
  });

  // Téléchargement pack export — pas via apiClient car on veut le blob brut.
  // Scope sur l'exercice actuellement sélectionné dans le header.
  async function downloadPack() {
    if (!activeExercise || !entityId) return;
    setPackError(null);
    setPackDownloading(true);
    try {
      const res = await fetch(
        `/api/accounting/exports/pack?entityId=${encodeURIComponent(entityId as string)}&exerciseId=${encodeURIComponent(activeExercise.id)}`,
      );
      if (!res.ok) {
        let msg = `Erreur ${res.status}`;
        try {
          const json = await res.json();
          if (json?.error) msg = json.error;
        } catch {
          /* binary response */
        }
        throw new Error(msg);
      }
      // Filename depuis Content-Disposition (renvoyé par l'API), fallback
      // sur un nom générique daté.
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename =
        match?.[1] ??
        `pack-comptable-${new Date().toISOString().slice(0, 10)}.zip`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setPackError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setPackDownloading(false);
    }
  }

  const tabs = ["ecritures", "grand-livre", "annotations", "exports"];
  const entryList = (entries?.data?.entries ?? entries?.data ?? entries?.entries ?? []) as Entry[];
  const annotationList = (annotations?.data ?? annotations ?? []) as Annotation[];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/ec"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-foreground">
          Client {(entityId as string).slice(0, 8)}
        </h1>
        {exerciseList.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <label
              htmlFor="ec-exercise-select"
              className="text-xs text-muted-foreground"
            >
              Exercice
            </label>
            <select
              id="ec-exercise-select"
              value={activeExerciseId ?? ""}
              onChange={(e) => setSelectedExerciseId(e.target.value || null)}
              className="text-xs rounded-md border border-border bg-background px-2 py-1"
            >
              {exerciseList.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.start_date.slice(0, 4)}
                  {ex.status === "open" ? " — en cours" : " — clôturé"}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPIs synthétiques pour l'exercice sélectionné. Reste visible
          quel que soit l'onglet — repère permanent pour l'EC. */}
      {activeExerciseId && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard
            label="Recettes"
            valueCents={kpis.revenuesCents}
            icon={<TrendingUp className="w-4 h-4" />}
            tone="green"
            loading={balanceLoading}
          />
          <KpiCard
            label="Dépenses"
            valueCents={kpis.expensesCents}
            icon={<TrendingDown className="w-4 h-4" />}
            tone="red"
            loading={balanceLoading}
          />
          <KpiCard
            label="Résultat"
            valueCents={kpis.resultCents}
            icon={<Wallet className="w-4 h-4" />}
            tone={kpis.resultCents >= 0 ? "blue" : "red"}
            loading={balanceLoading}
          />
        </div>
      )}

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${
              activeTab === t
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === "ecritures" && (
        <div className="space-y-3">
          {/* Barre de filtres : statut + recherche libellé/référence.
              Côté serveur via params status + search. Recherche
              débouncée 300ms pour ne pas hammer l'API. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
              {(["all", "validated", "draft"] as EntryStatusFilter[]).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setEntryStatusFilter(s)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      entryStatusFilter === s
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {s === "all"
                      ? "Toutes"
                      : s === "validated"
                        ? "Validées"
                        : "Brouillons"}
                  </button>
                ),
              )}
            </div>
            <input
              type="text"
              value={entrySearch}
              onChange={(e) => setEntrySearch(e.target.value)}
              placeholder="Rechercher (libellé ou n° pièce)…"
              className="flex-1 min-w-[200px] rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
            {entriesFetching && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {entryList.map((e) => (
            <div
              key={e.id}
              className="bg-card rounded-lg border border-border p-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">{e.label}</p>
                <p className="text-xs text-muted-foreground">
                  {e.entry_date} — {e.entry_number}
                </p>
              </div>
              <button
                onClick={() => setShowAnnotationForm(e.id)}
                className="text-muted-foreground hover:text-primary"
                aria-label="Annoter cette écriture"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          ))}
          {entryList.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucune écriture pour cette entité.
            </p>
          )}
          {showAnnotationForm && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <textarea
                value={annotationContent}
                onChange={(e) => setAnnotationContent(e.target.value)}
                placeholder="Votre remarque..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-20"
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    addAnnotation.mutate({
                      entityId,
                      entryId: showAnnotationForm,
                      annotationType: "comment",
                      content: annotationContent,
                    })
                  }
                  disabled={
                    annotationContent.trim().length === 0 ||
                    addAnnotation.isPending
                  }
                  className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                >
                  Envoyer
                </button>
                <button
                  onClick={() => {
                    setShowAnnotationForm(null);
                    setAnnotationContent("");
                  }}
                  className="bg-card border border-border rounded-lg px-4 py-2 text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "grand-livre" && (
        <div className="space-y-3">
          {glLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-muted rounded-xl" />
              ))}
            </div>
          ) : grandLivre.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucune écriture comptable pour cet exercice.
            </p>
          ) : (
            <>
              {[...grandLivre]
                .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber))
                .map((account) => {
                  const solde =
                    account.totalDebitCents - account.totalCreditCents;
                  const lastDate =
                    account.entries.length > 0
                      ? new Date(
                          account.entries[
                            account.entries.length - 1
                          ].entryDate,
                        ).toLocaleDateString("fr-FR")
                      : "";
                  return (
                    <section
                      key={account.accountNumber}
                      className="bg-card rounded-xl border border-border overflow-hidden"
                    >
                      <header className="px-4 py-2 bg-muted/30 border-b border-border">
                        <span className="font-mono text-sm font-semibold">
                          Compte {account.accountNumber}
                        </span>
                        <span className="ml-2 text-sm font-semibold">
                          {account.accountLabel}
                        </span>
                      </header>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground bg-muted/10 border-b border-border">
                              <th className="text-left font-medium px-4 py-2">
                                Date
                              </th>
                              <th className="text-left font-medium px-4 py-2">
                                Libellé
                              </th>
                              <th className="text-right font-medium px-4 py-2">
                                Débit
                              </th>
                              <th className="text-right font-medium px-4 py-2">
                                Crédit
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {account.entries.map((e) => (
                              <tr
                                key={e.lineId}
                                className="border-b border-border last:border-b-0"
                              >
                                <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                                  {new Date(e.entryDate).toLocaleDateString(
                                    "fr-FR",
                                  )}
                                </td>
                                <td className="px-4 py-2">{e.label}</td>
                                <td className="px-4 py-2 text-right tabular-nums">
                                  {e.debitCents > 0
                                    ? formatCents(e.debitCents)
                                    : "—"}
                                </td>
                                <td className="px-4 py-2 text-right tabular-nums">
                                  {e.creditCents > 0
                                    ? formatCents(e.creditCents)
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-muted/40 border-t-2 border-border font-semibold">
                              <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                                {lastDate}
                              </td>
                              <td className="px-4 py-2">Total</td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {formatCents(account.totalDebitCents)}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {formatCents(account.totalCreditCents)}
                              </td>
                            </tr>
                            <tr className="bg-muted/30 font-semibold">
                              <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                                {lastDate}
                              </td>
                              <td className="px-4 py-2">Solde</td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {solde > 0
                                  ? formatCents(solde)
                                  : solde === 0
                                    ? formatCents(0)
                                    : ""}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {solde < 0
                                  ? formatCents(-solde)
                                  : solde === 0
                                    ? formatCents(0)
                                    : ""}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })}

              {/* Pied : TOTAL GRAND-LIVRE — somme D = somme C en double-partie */}
              <section className="bg-card rounded-xl border-2 border-border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="bg-muted/60 font-bold">
                      <td className="px-4 py-3" colSpan={2}>
                        TOTAL GRAND-LIVRE
                        <span className="ml-3 text-xs font-normal text-muted-foreground">
                          ({grandLivre.length} compte
                          {grandLivre.length > 1 ? "s" : ""})
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCents(
                          grandLivre.reduce(
                            (s, a) => s + a.totalDebitCents,
                            0,
                          ),
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCents(
                          grandLivre.reduce(
                            (s, a) => s + a.totalCreditCents,
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </>
          )}
        </div>
      )}

      {activeTab === "annotations" && (
        <div className="space-y-2">
          {annotationList.map((a) => (
            <div
              key={a.id}
              className={`bg-card rounded-lg border p-3 ${
                a.is_resolved
                  ? "border-border opacity-60"
                  : "border-amber-500/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm flex-1">{a.content}</p>
                {a.is_resolved ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 text-xs shrink-0">
                    <Check className="w-3.5 h-3.5" />
                    Résolue
                  </span>
                ) : (
                  <button
                    onClick={() => resolveAnnotation.mutate(a.id)}
                    disabled={resolveAnnotation.isPending}
                    className="shrink-0 text-xs px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {resolveAnnotation.isPending &&
                    resolveAnnotation.variables === a.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    Marquer résolue
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {a.annotation_type} —{" "}
                {new Date(a.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
          ))}
          {annotationList.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucune annotation pour ce client.
            </p>
          )}
        </div>
      )}

      {activeTab === "exports" && (
        <div className="space-y-3">
          <button
            onClick={downloadPack}
            disabled={packDownloading || !activeExercise}
            className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {packDownloading ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : (
              <Download className="w-5 h-5 text-primary" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">
                {packDownloading ? "Préparation du pack…" : "Tout télécharger"}
              </p>
              <p className="text-xs text-muted-foreground">
                FEC + Balance + Grand livre + Journal{" "}
                {activeExercise
                  ? `(exercice ${activeExercise.start_date.slice(0, 4)})`
                  : "— aucun exercice disponible"}
              </p>
            </div>
          </button>
          {packError && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{packError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Carte KPI simple — volontairement locale au composant. Si on en a
// besoin ailleurs côté EC, à extraire dans components/accounting/.
function KpiCard({
  label,
  valueCents,
  icon,
  tone,
  loading,
}: {
  label: string;
  valueCents: number;
  icon: React.ReactNode;
  tone: "green" | "red" | "blue";
  loading?: boolean;
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-600"
      : tone === "red"
        ? "text-destructive"
        : "text-blue-600";
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className={toneClass}>{icon}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums mt-1 ${toneClass}`}>
        {loading ? (
          <span className="inline-block h-6 w-24 bg-muted rounded animate-pulse" />
        ) : (
          formatCents(valueCents)
        )}
      </p>
    </div>
  );
}
