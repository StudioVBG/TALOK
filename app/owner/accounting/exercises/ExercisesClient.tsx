"use client";
import { useMemo, useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useEntityStore } from "@/stores/useEntityStore";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { ArrowLeft, Lock, Unlock, Calendar, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { validateFiscalYearRange } from "@/lib/entities/fiscal-year-defaults";

export default function ExercisesClient() {
  return (<PlanGate feature="bank_reconciliation" mode="block"><ExercisesContent /></PlanGate>);
}
function ExercisesContent() {
  const { activeEntityId } = useEntityStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [closingId, setClosingId] = useState<string | null>(null);

  type ExerciseItem = { id: string; start_date: string; end_date: string; status: string; closed_at?: string };
  type ExercisesResponse =
    | ExerciseItem[]
    | { data?: ExerciseItem[] | { exercises?: ExerciseItem[] }; exercises?: ExerciseItem[] };

  type CloseResponse = {
    success?: boolean;
    data?: {
      closedExercise?: { id: string; year: number };
      newExercise?: { id: string; start_date: string; end_date: string } | null;
      warnings?: string[];
    };
    error?: string;
  };

  const { data, isLoading } = useQuery<ExercisesResponse>({
    queryKey: ["exercises", activeEntityId],
    queryFn: () => apiClient.get<ExercisesResponse>(`/accounting/exercises?entityId=${activeEntityId}`),
    enabled: !!activeEntityId,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const createMutation = useMutation<unknown, Error, { startDate: string; endDate: string }>({
    mutationFn: (payload) =>
      apiClient.post(`/accounting/exercises`, {
        entityId: activeEntityId,
        startDate: payload.startDate,
        endDate: payload.endDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      setCreateOpen(false);
      setCreateError(null);
      toast({
        title: "Exercice créé",
        description: `Période ${newStart} → ${newEnd} ouverte.`,
      });
    },
    onError: (err) => {
      setCreateError(
        err instanceof Error ? err.message : "Création impossible. Réessayez.",
      );
    },
  });

  const closeMutation = useMutation<CloseResponse, Error, string>({
    mutationFn: async (exerciseId) => {
      setClosingId(exerciseId);
      return apiClient.post<CloseResponse>(`/accounting/exercises/${exerciseId}/close`);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      setClosingId(null);
      const warnings = result?.data?.warnings ?? [];
      const newExercise = result?.data?.newExercise;
      const parts: string[] = [];
      if (newExercise) {
        parts.push(
          `Nouvel exercice ouvert : ${newExercise.start_date} → ${newExercise.end_date}.`,
        );
      } else {
        parts.push("Amortissements, déficit et à-nouveaux ont été générés.");
      }
      if (warnings.length > 0) {
        parts.push(`${warnings.length} avertissement(s) : ${warnings.join(" — ")}`);
      }
      toast({
        title: "Exercice clôturé",
        description: parts.join(" "),
      });
    },
    onError: (err) => {
      setClosingId(null);
      toast({
        title: "Erreur lors de la clôture",
        description:
          err instanceof Error ? err.message : "Clôture impossible. Réessayez.",
        variant: "destructive",
      });
    },
  });

  const exercises: ExerciseItem[] = (() => {
    if (Array.isArray(data)) return data;
    const nested = data?.data;
    if (Array.isArray(nested)) return nested;
    if (nested && "exercises" in nested && Array.isArray(nested.exercises)) return nested.exercises;
    if (data?.exercises) return data.exercises;
    return [];
  })();
  const openExercises = exercises.filter(e => e.status === "open");
  const closedExercises = exercises.filter(e => e.status === "closed");

  // Default period for a new exercise: continues right after the latest
  // existing exercise, on a 1-year span. Falls back to current calendar year
  // when no exercise exists.
  const defaultPeriod = useMemo(() => {
    const latest = exercises
      .map((e) => e.end_date)
      .filter((d): d is string => Boolean(d))
      .sort()
      .at(-1);

    if (latest) {
      const next = new Date(`${latest}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      const start = next.toISOString().slice(0, 10);
      const endDate = new Date(next);
      endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
      endDate.setUTCDate(endDate.getUTCDate() - 1);
      return { start, end: endDate.toISOString().slice(0, 10) };
    }

    const year = new Date().getUTCFullYear();
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }, [exercises]);

  function openCreateDialog() {
    setNewStart(defaultPeriod.start);
    setNewEnd(defaultPeriod.end);
    setCreateError(null);
    setCreateOpen(true);
  }

  function submitCreate() {
    const validation = validateFiscalYearRange(newStart, newEnd);
    if (!validation.valid) {
      setCreateError(validation.error ?? "Dates invalides");
      return;
    }
    createMutation.mutate({ startDate: newStart, endDate: newEnd });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/owner/accounting" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Exercices comptables</h1>
        </div>
        <button
          type="button"
          onClick={openCreateDialog}
          disabled={!activeEntityId}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Nouvel exercice
        </button>
      </div>

      {isLoading ? <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div> : (
        <>
          {openExercises.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">En cours</h2>
              {openExercises.map(ex => (
                <div key={ex.id} className="bg-card rounded-xl border border-primary/30 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3"><Unlock className="w-5 h-5 text-primary" /><div><p className="text-sm font-medium">{ex.start_date} → {ex.end_date}</p><p className="text-xs text-muted-foreground">Exercice ouvert</p></div></div>
                  {closingId === ex.id ? (
                    <div
                      className="flex items-center gap-2 text-sm text-primary"
                      role="status"
                      aria-live="polite"
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Clôture en cours...
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => closeMutation.mutate(ex.id)}
                      disabled={closeMutation.isPending}
                      className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                    >
                      Cloturer
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {closedExercises.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">Clotures</h2>
              {closedExercises.map(ex => (
                <div key={ex.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between opacity-75">
                  <div className="flex items-center gap-3"><Lock className="w-5 h-5 text-muted-foreground" /><div><p className="text-sm font-medium">{ex.start_date} → {ex.end_date}</p><p className="text-xs text-muted-foreground">Cloture le {ex.closed_at ? new Date(ex.closed_at).toLocaleDateString("fr-FR") : ""}</p></div></div>
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
          {exercises.length === 0 && (
            <div className="bg-card rounded-xl border border-dashed border-border p-8 text-center">
              <Calendar className="mx-auto w-8 h-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Aucun exercice comptable</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Créez votre premier exercice pour démarrer la comptabilité.
              </p>
            </div>
          )}
        </>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvel exercice comptable</DialogTitle>
            <DialogDescription>
              La période ne doit pas chevaucher un exercice existant. Les dates
              proposées prolongent automatiquement le dernier exercice.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="newStart">Début</Label>
              <Input
                id="newStart"
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newEnd">Fin</Label>
              <Input
                id="newEnd"
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </div>
          </div>
          {createError && (
            <p className="text-sm text-destructive">{createError}</p>
          )}
          <DialogFooter>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={submitCreate}
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {createMutation.isPending && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Créer l&apos;exercice
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
