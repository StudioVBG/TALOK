"use client";

import { useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { formatCents } from "@/lib/utils/format-cents";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useEntityStore } from "@/stores/useEntityStore";
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import { ArrowLeft, Download, Send, Check, AlertTriangle, Loader2 } from "lucide-react";

export default function DeclarationsClient() {
  return (<PlanGate feature="bank_reconciliation" mode="block"><DeclarationsContent /></PlanGate>);
}

function DeclarationsContent() {
  const { activeEntityId } = useEntityStore();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [regime, setRegime] = useState<string>("reel-2044");
  const [exerciseId, setExerciseId] = useState<string>("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingEc, setSendingEc] = useState(false);

  type ExerciseItem = { id: string; start_date: string; end_date: string; status: string };
  type ExercisesResponse =
    | ExerciseItem[]
    | {
        data?: ExerciseItem[] | { exercises?: ExerciseItem[] | null } | null;
        exercises?: ExerciseItem[] | null;
      }
    | null
    | undefined;
  type DeclarationPayload = Record<string, number>;
  type DeclarationResponse =
    | ({ data?: DeclarationPayload } & DeclarationPayload)
    | null
    | undefined;

  const { data: exercises } = useQuery<ExercisesResponse>({
    queryKey: ["exercises", activeEntityId],
    queryFn: () => apiClient.get<ExercisesResponse>(`/accounting/exercises?entityId=${activeEntityId}`),
    enabled: !!activeEntityId,
  });

  // The API returns `{ success: true, data: { exercises: [...] } }`, but we
  // stay defensive and also accept a bare array or `{ data: [...] }`.
  const exercisesList: ExerciseItem[] = (() => {
    if (Array.isArray(exercises)) return exercises;
    if (!exercises || typeof exercises !== "object") return [];
    const data = (exercises as { data?: unknown }).data;
    if (Array.isArray(data)) return data as ExerciseItem[];
    if (data && typeof data === "object") {
      const nested = (data as { exercises?: unknown }).exercises;
      if (Array.isArray(nested)) return nested as ExerciseItem[];
    }
    const direct = (exercises as { exercises?: unknown }).exercises;
    if (Array.isArray(direct)) return direct as ExerciseItem[];
    return [];
  })();
  const closedExercises = (exercisesList ?? []).filter((e) => e.status === "closed");

  const declarationType = regime === "micro-foncier" ? "micro-foncier" : regime === "reel-2044" ? "2044" : regime === "reel-2072" ? "2072" : "2042-cpro";

  const { data: declaration, isLoading: declLoading } = useQuery<DeclarationResponse>({
    queryKey: ["declaration", declarationType, exerciseId],
    queryFn: () => apiClient.get<DeclarationResponse>(`/accounting/declarations/${declarationType}?exerciseId=${exerciseId}`),
    enabled: !!exerciseId && step >= 2,
  });

  const declData: DeclarationPayload = (() => {
    if (!declaration || typeof declaration !== "object") return {};
    const payload = declaration as { data?: unknown } & Record<string, unknown>;
    if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
      return payload.data as DeclarationPayload;
    }
    const { data: _ignored, ...rest } = payload;
    return rest as DeclarationPayload;
  })();

  // Derive the fiscal year from the selected closed exercise. Fall back to
  // the current calendar year if the exercise cannot be resolved.
  const selectedExercise = (closedExercises ?? []).find((e) => e.id === exerciseId);
  const selectedYear = selectedExercise
    ? parseInt(selectedExercise.start_date.slice(0, 4), 10)
    : new Date().getFullYear();

  const handleDownloadPDF = async () => {
    if (!activeEntityId || !exerciseId) {
      toast({
        title: "Action impossible",
        description: "Sélectionnez une entité et un exercice clôturé.",
        variant: "destructive",
      });
      return;
    }
    setDownloadingPdf(true);
    try {
      const params = new URLSearchParams({
        year: String(selectedYear),
        entityId: activeEntityId,
      });
      const res = await fetch(`/api/accounting/fiscal-summary?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Erreur génération PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `declaration-fiscale-${declarationType}-${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "PDF téléchargé" });
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Téléchargement impossible",
        variant: "destructive",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSendEC = async () => {
    if (!activeEntityId || !exerciseId) {
      toast({
        title: "Action impossible",
        description: "Sélectionnez une entité et un exercice clôturé.",
        variant: "destructive",
      });
      return;
    }
    setSendingEc(true);
    try {
      const res = await fetch("/api/accounting/ec/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_declaration",
          entityId: activeEntityId,
          year: selectedYear,
          declarationType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Erreur envoi");
      }
      const payload = (await res.json()) as { data?: { notified?: number } };
      const notified = payload?.data?.notified ?? 0;
      toast({
        title: "Déclaration envoyée à votre expert-comptable",
        description:
          notified > 1
            ? `${notified} experts-comptables notifiés.`
            : "1 expert-comptable notifié.",
      });
    } catch (err) {
      toast({
        title: "Erreur lors de l'envoi",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de notifier l'expert-comptable.",
        variant: "destructive",
      });
    } finally {
      setSendingEc(false);
    }
  };

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
            {(closedExercises ?? []).map((ex: { id: string; start_date: string }) => (<option key={ex.id} value={ex.id}>{ex.start_date.slice(0,4)}</option>))}
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
                  {Object.entries(declData ?? {}).filter(([k]) => k.startsWith("ligne_") || k.startsWith("case_")).map(([key, val]) => (
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
              {Object.entries(declData ?? {}).map(([key, val]) => (
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
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloadingPdf || sendingEc}
              className="bg-primary text-primary-foreground rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {downloadingPdf ? "Génération..." : "Telecharger le PDF"}
            </button>
            <button
              type="button"
              onClick={handleSendEC}
              disabled={downloadingPdf || sendingEc}
              className="bg-card border border-border rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sendingEc ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sendingEc ? "Envoi..." : "Envoyer a mon expert-comptable"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Ce document est une aide. Talok ne fournit pas de conseil fiscal. Consultez votre expert-comptable.</p>
        </div>
      )}
    </div>
  );
}
