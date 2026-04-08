// @ts-nocheck
"use client";
import { useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useEntityStore } from "@/stores/useEntityStore";
import Link from "next/link";
import { ArrowLeft, Lock, Unlock, Calendar, Loader2 } from "lucide-react";

export default function ExercisesClient() {
  return (<PlanGate feature="bank_reconciliation" mode="block"><ExercisesContent /></PlanGate>);
}
function ExercisesContent() {
  const { activeEntityId } = useEntityStore();
  const queryClient = useQueryClient();
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closingStep, setClosingStep] = useState(0);

  const { data, isLoading } = useQuery({ queryKey: ["exercises", activeEntityId], queryFn: () => apiClient.get(`/accounting/exercises?entityId=${activeEntityId}`), enabled: !!activeEntityId });

  const closeMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      setClosingId(exerciseId);
      const steps = ["Verifications", "Amortissements", "Deficit", "A-nouveaux", "Verrouillage", "Exercice suivant"];
      for (let i = 0; i < steps.length; i++) { setClosingStep(i + 1); await new Promise(r => setTimeout(r, 500)); }
      return apiClient.post(`/accounting/exercises/${exerciseId}/close`);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["exercises"] }); setClosingId(null); setClosingStep(0); },
    onError: () => { setClosingId(null); setClosingStep(0); },
  });

  const exercises = (data?.data?.exercises ?? data?.exercises ?? data?.data ?? []) as Array<{ id: string; start_date: string; end_date: string; status: string; closed_at?: string }>;
  const openExercises = exercises.filter(e => e.status === "open");
  const closedExercises = exercises.filter(e => e.status === "closed");

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3"><Link href="/owner/accounting" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link><h1 className="text-xl font-bold text-foreground">Exercices comptables</h1></div>

      {isLoading ? <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div> : (
        <>
          {openExercises.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase">En cours</h2>
              {openExercises.map(ex => (
                <div key={ex.id} className="bg-card rounded-xl border border-primary/30 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3"><Unlock className="w-5 h-5 text-primary" /><div><p className="text-sm font-medium">{ex.start_date} → {ex.end_date}</p><p className="text-xs text-muted-foreground">Exercice ouvert</p></div></div>
                  {closingId === ex.id ? (
                    <div className="flex items-center gap-2 text-sm text-primary"><Loader2 className="w-4 h-4 animate-spin" />Etape {closingStep}/6</div>
                  ) : (
                    <button onClick={() => closeMutation.mutate(ex.id)} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium">Cloturer</button>
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
        </>
      )}
    </div>
  );
}
