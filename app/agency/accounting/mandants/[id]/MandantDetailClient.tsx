"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useMandantDetail } from "@/lib/hooks/use-mandant-detail";
import { formatCents } from "@/lib/utils/format-cents";
import Link from "next/link";
import { ArrowLeft, Building2, FileText, CreditCard } from "lucide-react";

export default function MandantDetailClient() { return (<PlanGate feature="bank_reconciliation" mode="block"><MandantContent /></PlanGate>); }
function MandantContent() {
  const { id } = useParams<{ id: string }>();
  const { mandant, entries, crgs, isLoading } = useMandantDetail(id);
  const [tab, setTab] = useState("ecritures");
  if (isLoading) return <div className="p-6 animate-pulse"><div className="h-64 bg-muted rounded-xl" /></div>;
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3"><Link href="/agency/accounting" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link><h1 className="text-xl font-bold">{mandant?.mandant_name ?? "Mandant"}</h1></div>
      {mandant && <div className="bg-card rounded-xl border border-border p-4"><p className="text-sm text-muted-foreground">Commission: {mandant.commission_rate}%</p></div>}
      <div className="flex gap-2">{["ecritures","crg"].map(t => (<button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>{t === "crg" ? "CRG" : t}</button>))}</div>
      {tab === "ecritures" && (<div className="space-y-2">{(entries ?? []).map((e: { id: string; entry_date: string; label: string }) => (<div key={e.id} className="bg-card rounded-lg border border-border p-3"><p className="text-sm">{e.label}</p><p className="text-xs text-muted-foreground">{e.entry_date}</p></div>))}</div>)}
      {tab === "crg" && (<div className="space-y-2">{(crgs ?? []).map((c: { id: string; period_start: string; period_end: string; net_owner_cents: number; status: string }) => (<div key={c.id} className="bg-card rounded-lg border border-border p-3 flex justify-between"><div><p className="text-sm">{c.period_start} → {c.period_end}</p></div><p className="text-sm font-medium">{formatCents(c.net_owner_cents)}</p></div>))}</div>)}
    </div>
  );
}
