// @ts-nocheck
"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import Link from "next/link";
import { Building2, FileText, MessageSquare } from "lucide-react";

export default function ECDashboardClient() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["ec-dashboard"], queryFn: () => apiClient.get("/accounting/ec/dashboard") });
  const clients = (data?.data?.clients ?? data?.clients ?? []) as Array<{ entityId: string; entityName: string; exerciseStatus: string; entryCount: number; annotationCount: number }>;
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Portail Expert-Comptable</h1>
      {isLoading ? <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}</div> : clients.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center"><p className="text-muted-foreground">Aucun client connecte.</p></div>
      ) : (
        <div className="grid gap-4">{clients.map(c => (
          <Link key={c.entityId} href={`/ec/${c.entityId}`} className="bg-card rounded-xl border border-border p-4 hover:border-primary transition-colors flex items-center justify-between">
            <div className="flex items-center gap-3"><Building2 className="w-5 h-5 text-primary" /><div><p className="text-sm font-semibold">{c.entityName}</p><p className="text-xs text-muted-foreground">{c.entryCount} ecritures</p></div></div>
            <div className="flex items-center gap-3">
              {c.annotationCount > 0 && <span className="bg-amber-500/10 text-amber-600 text-xs px-2 py-1 rounded-full flex items-center gap-1"><MessageSquare className="w-3 h-3" />{c.annotationCount}</span>}
              <span className={`text-xs px-2 py-1 rounded-full ${c.exerciseStatus === "open" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{c.exerciseStatus === "open" ? "En cours" : "Cloture"}</span>
            </div>
          </Link>
        ))}</div>
      )}
    </div>
  );
}
