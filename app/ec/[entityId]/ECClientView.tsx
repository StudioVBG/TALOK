// @ts-nocheck
"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated
import { useState } from "react";
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
} from "lucide-react";

type Exercise = { id: string; status: string; start_date: string; end_date: string };
type Entry = { id: string; entry_date: string; label: string; entry_number: string };
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

  const { data: entries } = useQuery<any>({
    queryKey: ["ec-entries", entityId, activeExerciseId],
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
      return apiClient.get(`/accounting/entries?${params.toString()}`);
    },
    enabled: !!entityId,
  });

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

  const tabs = ["ecritures", "annotations", "exports"];
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
        <div className="space-y-2">
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
