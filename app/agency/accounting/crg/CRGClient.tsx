"use client";
import { useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatCents } from "@/lib/utils/format-cents";
import Link from "next/link";
import { ArrowLeft, FileText, Send, Download, Plus } from "lucide-react";

export default function CRGClient() {
  return (<PlanGate feature="bank_reconciliation" mode="block"><CRGContent /></PlanGate>);
}
function CRGContent() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["crg-list"], queryFn: () => apiClient.get("/accounting/crg") });
  const generateMutation = useMutation({ mutationFn: (body: Record<string, unknown>) => apiClient.post("/accounting/crg", body), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crg-list"] }) });
  const sendMutation = useMutation({ mutationFn: (id: string) => apiClient.post(`/accounting/crg/${id}`, { action: "send" }) });
  const crgs = (data?.data ?? []) as Array<{ id: string; mandant_id: string; period_start: string; period_end: string; total_income_cents: number; commission_cents: number; net_owner_cents: number; status: string }>;
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Link href="/agency/accounting" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link><h1 className="text-xl font-bold text-foreground">Comptes Rendus de Gestion</h1></div>
      <button onClick={() => generateMutation.mutate({})} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" />Generer</button></div>
      {isLoading ? <div className="h-64 bg-muted rounded-xl animate-pulse" /> : crgs.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center"><FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-sm text-muted-foreground">Aucun CRG genere</p></div>
      ) : (
        <div className="space-y-3">{crgs.map(crg => (
          <div key={crg.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
            <div><p className="text-sm font-medium">Periode {crg.period_start} → {crg.period_end}</p><p className="text-xs text-muted-foreground">Loyers: {formatCents(crg.total_income_cents)} | Honoraires: {formatCents(crg.commission_cents)} | Net: {formatCents(crg.net_owner_cents)}</p></div>
            <div className="flex items-center gap-2"><span className={`text-xs px-2 py-1 rounded-full ${crg.status === "sent" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>{crg.status === "sent" ? "Envoye" : "Genere"}</span>
            <button onClick={() => sendMutation.mutate(crg.id)} className="text-muted-foreground hover:text-primary"><Send className="w-4 h-4" /></button></div>
          </div>
        ))}</div>
      )}
    </div>
  );
}
