"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated

import { useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { formatCents } from "@/lib/utils/format-cents";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useEntityStore } from "@/stores/useEntityStore";
import Link from "next/link";
import { ArrowLeft, Download, Send, FileText, Check, AlertTriangle } from "lucide-react";

export default function DeclarationsClient() {
  return (<PlanGate feature="bank_reconciliation" mode="block"><DeclarationsContent /></PlanGate>);
}

function DeclarationsContent() {
  const { activeEntityId } = useEntityStore();
  const [step, setStep] = useState(1);
  const [regime, setRegime] = useState<string>("reel-2044");
  const [exerciseId, setExerciseId] = useState<string>("");

  const { data: exercises } = useQuery<any>({
    queryKey: ["exercises", activeEntityId],
    queryFn: () => apiClient.get(`/accounting/exercises?entityId=${activeEntityId}`),
    enabled: !!activeEntityId,
  });

  const closedExercises = ((exercises?.data ?? exercises ?? []) as Array<{ id: string; start_date: string; end_date: string; status: string }>).filter(e => e.status === "closed");

  const declarationType = regime === "micro-foncier" ? "micro-foncier" : regime === "reel-2044" ? "2044" : regime === "reel-2072" ? "2072" : "2042-cpro";

  const { data: declaration, isLoading: declLoading } = useQuery<any>({
    queryKey: ["declaration", declarationType, exerciseId],
    queryFn: () => apiClient.get(`/accounting/declarations/${declarationType}?exerciseId=${exerciseId}`),
    enabled: !!exerciseId && step >= 2,
  });

  const declData = (declaration?.data ?? declaration ?? {}) as Record<string, number>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/owner/accounting" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        <h1 className="text-xl font-bold text-foreground">Aide a la declaration fiscale</h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">{[1,2,3,4,5].map(s => (<div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />))}</div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Choix du regime fiscal</h2>
          <div className="space-y-2">
            {[
              { value: "micro-foncier", label: "Micro-foncier", desc: "Revenus <= 15 000 EUR, abattement 30%" },
              { value: "reel-2044", label: "Reel (declaration 2044)", desc: "Deduction charges reelles" },
              { value: "reel-2072", label: "SCI IR (declaration 2072)", desc: "Resultat par associe" },
              { value: "lmnp", label: "LMNP reel (2042 C PRO)", desc: "Amortissements + charges" },
            ].map(r => (
              <button key={r.value} onClick={() => setRegime(r.value)} className={`w-full text-left p-4 rounded-xl border ${regime === r.value ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-xs text-muted-foreground">{r.desc}</p>
              </button>
            ))}
          </div>
          <select value={exerciseId} onChange={e => setExerciseId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">Selectionnez un exercice cloture</option>
            {closedExercises.map((ex: { id: string; start_date: string }) => (<option key={ex.id} value={ex.id}>{ex.start_date.slice(0,4)}</option>))}
          </select>
          <button onClick={() => exerciseId && setStep(2)} disabled={!exerciseId} className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50">Continuer</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Recapitulatif revenus et charges</h2>
          {declLoading ? <div className="h-48 bg-muted rounded-xl animate-pulse" /> : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/50"><th className="px-4 py-2 text-left">Ligne</th><th className="px-4 py-2 text-right">Montant</th></tr></thead>
                <tbody>
                  {Object.entries(declData).filter(([k]) => k.startsWith("ligne_") || k.startsWith("case_")).map(([key, val]) => (
                    <tr key={key} className="border-t border-border"><td className="px-4 py-2">{key.replace(/_/g, " ").toUpperCase()}</td><td className="px-4 py-2 text-right font-medium">{formatCents(val)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-3"><button onClick={() => setStep(1)} className="flex-1 bg-card border border-border rounded-lg px-4 py-2 text-sm">Retour</button><button onClick={() => setStep(3)} className="flex-1 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium">Continuer</button></div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Verification justificatifs</h2>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
            <p className="text-sm text-amber-700">Verifiez que chaque charge a un justificatif avant de continuer.</p>
          </div>
          <button onClick={() => setStep(4)} className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-3 text-sm font-medium">Continuer vers le document</button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Document d&apos;aide a la declaration</h2>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm text-muted-foreground mb-4">Les montants ci-dessous correspondent aux lignes de votre declaration {declarationType.toUpperCase()}.</p>
            <div className="space-y-2">
              {Object.entries(declData).map(([key, val]) => (
                <div key={key} className="flex justify-between text-sm"><span className="text-muted-foreground">{key.replace(/_/g, " ")}</span><span className="font-medium">{formatCents(val)}</span></div>
              ))}
            </div>
          </div>
          <button onClick={() => setStep(5)} className="w-full bg-primary text-primary-foreground rounded-lg px-4 py-3 text-sm font-medium">Exporter</button>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4 text-center">
          <Check className="w-12 h-12 mx-auto text-emerald-500" />
          <h2 className="text-lg font-semibold">Document pret</h2>
          <div className="flex flex-col gap-3">
            <button className="bg-primary text-primary-foreground rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-center gap-2"><Download className="w-4 h-4" />Telecharger le PDF</button>
            <button className="bg-card border border-border rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-center gap-2"><Send className="w-4 h-4" />Envoyer a mon EC</button>
          </div>
          <p className="text-xs text-muted-foreground">Ce document est une aide. Talok ne fournit pas de conseil fiscal. Consultez votre expert-comptable.</p>
        </div>
      )}
    </div>
  );
}
