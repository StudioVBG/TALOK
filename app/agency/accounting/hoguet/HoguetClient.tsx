"use client";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useEntityStore } from "@/stores/useEntityStore";
import Link from "next/link";
import { ArrowLeft, Shield, Check, X, AlertTriangle } from "lucide-react";

export default function HoguetClient() { return (<PlanGate feature="bank_reconciliation" mode="block"><HoguetContent /></PlanGate>); }
function HoguetContent() {
  const { activeEntityId } = useEntityStore();
  const { data, isLoading } = useQuery({ queryKey: ["hoguet", activeEntityId], queryFn: () => apiClient.get(`/accounting/agency/hoguet-report?entityId=${activeEntityId}`), enabled: !!activeEntityId });
  const report = data?.data as { checks: Array<{ name: string; status: boolean; detail: string }>; score: number; total: number; alerts: Array<{ id: string; amount_cents: number; transaction_date: string; label: string }> } | undefined;
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3"><Link href="/agency/accounting" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link><h1 className="text-xl font-bold text-foreground">Conformite Hoguet</h1></div>
      {isLoading ? <div className="h-64 bg-muted rounded-xl animate-pulse" /> : report ? (
        <>
          <div className="bg-card rounded-xl border border-border p-4 text-center"><Shield className="w-8 h-8 mx-auto text-primary mb-2" /><p className="text-2xl font-bold">{report.score}/{report.total}</p><p className="text-sm text-muted-foreground">Points de conformite</p></div>
          <div className="space-y-2">{report.checks.map((c, i) => (
            <div key={i} className="bg-card rounded-lg border border-border p-3 flex items-center gap-3">{c.status ? <Check className="w-5 h-5 text-emerald-500 shrink-0" /> : <X className="w-5 h-5 text-red-500 shrink-0" />}<div className="flex-1"><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.detail}</p></div></div>
          ))}</div>
          {report.alerts.length > 0 && (
            <div className="space-y-2"><h3 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" />Alertes TRACFIN</h3>
            {report.alerts.map(a => (<div key={a.id} className="bg-amber-500/10 rounded-lg p-3 text-sm"><p>{a.label} — {a.transaction_date}</p><p className="font-medium">{(a.amount_cents / 100).toFixed(2)} EUR</p></div>))}</div>
          )}
        </>
      ) : <p className="text-muted-foreground">Chargement...</p>}
    </div>
  );
}
