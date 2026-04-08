"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated

import { useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { formatCents } from "@/lib/utils/format-cents";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useEntityStore } from "@/stores/useEntityStore";
import Link from "next/link";
import { ArrowLeft, Plus, Building2, ChevronDown, ChevronUp } from "lucide-react";

export default function AmortizationClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <AmortizationContent />
    </PlanGate>
  );
}

function AmortizationContent() {
  const { activeEntityId } = useEntityStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedProperty, setExpandedProperty] = useState<string | null>(null);
  const [form, setForm] = useState({
    propertyId: "",
    acquisitionDate: "",
    acquisitionAmountCents: 0,
    terrainPercentage: 15,
  });

  const { data, isLoading } = useQuery<any>({
    queryKey: ["amortization", activeEntityId],
    queryFn: () => apiClient.get(`/accounting/amortization?entityId=${activeEntityId}`),
    enabled: !!activeEntityId,
  });

  const createMutation = useMutation<any, any, any>({
    mutationFn: (body: Record<string, unknown>) => apiClient.post("/accounting/amortization", body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["amortization"] }); setShowForm(false); },
  });

  const schedules = (data?.data ?? data ?? []) as Array<{
    id: string; property_id: string; component: string; total_amount_cents: number;
    duration_years: number; terrain_percent: number; depreciable_amount_cents: number;
    amortization_lines: Array<{ annual_amount_cents: number; cumulated_amount_cents: number; net_book_value_cents: number }>;
  }>;

  // Group by property
  const byProperty = new Map<string, typeof schedules>();
  for (const s of schedules) {
    const list = byProperty.get(s.property_id) ?? [];
    list.push(s);
    byProperty.set(s.property_id, list);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/owner/accounting" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-xl font-bold text-foreground">Amortissements</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" /> Ajouter un bien
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold">Nouveau plan d&apos;amortissement</h3>
          <input type="number" placeholder="Prix acquisition (centimes)" value={form.acquisitionAmountCents || ""} onChange={(e) => setForm({ ...form, acquisitionAmountCents: parseInt(e.target.value) || 0 })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input type="date" value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Terrain %</label>
            <input type="number" min={0} max={50} value={form.terrainPercentage} onChange={(e) => setForm({ ...form, terrainPercentage: parseInt(e.target.value) || 15 })} className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <button onClick={() => createMutation.mutate({ entityId: activeEntityId, ...form })} disabled={createMutation.isPending} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium">
            {createMutation.isPending ? "Creation..." : "Creer le plan"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : byProperty.size === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground">Aucun amortissement</h3>
          <p className="text-sm text-muted-foreground mt-2">Ajoutez un bien pour commencer a amortir.</p>
        </div>
      ) : (
        Array.from(byProperty.entries()).map(([propertyId, propertySchedules]) => {
          const expanded = expandedProperty === propertyId;
          const totalVNC = propertySchedules.reduce((s, sc) => {
            const lastLine = sc.amortization_lines?.[sc.amortization_lines.length - 1];
            return s + (lastLine?.net_book_value_cents ?? sc.depreciable_amount_cents);
          }, 0);
          return (
            <div key={propertyId} className="bg-card rounded-xl border border-border overflow-hidden">
              <button onClick={() => setExpandedProperty(expanded ? null : propertyId)} className="w-full flex items-center justify-between p-4 hover:bg-accent">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary" />
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">Bien {propertyId.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{propertySchedules.length} composants</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right"><p className="text-xs text-muted-foreground">VNC</p><p className="text-sm font-bold text-foreground">{formatCents(totalVNC)}</p></div>
                  {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {expanded && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/50"><th className="px-4 py-2 text-left">Composant</th><th className="px-4 py-2 text-right">Valeur</th><th className="px-4 py-2 text-right">Duree</th><th className="px-4 py-2 text-right">Dotation/an</th><th className="px-4 py-2 text-right">Cumule</th><th className="px-4 py-2 text-right">VNC</th></tr></thead>
                    <tbody>
                      {propertySchedules.map((sc) => {
                        const lastLine = sc.amortization_lines?.[sc.amortization_lines.length - 1];
                        const annualCents = sc.duration_years > 0 ? Math.round(sc.depreciable_amount_cents / sc.duration_years) : 0;
                        return (
                          <tr key={sc.id} className="border-t border-border">
                            <td className="px-4 py-2 capitalize">{sc.component.replace(/_/g, " ")}</td>
                            <td className="px-4 py-2 text-right">{formatCents(sc.total_amount_cents)}</td>
                            <td className="px-4 py-2 text-right">{sc.duration_years > 0 ? `${sc.duration_years} ans` : "-"}</td>
                            <td className="px-4 py-2 text-right">{annualCents > 0 ? formatCents(annualCents) : "-"}</td>
                            <td className="px-4 py-2 text-right">{formatCents(lastLine?.cumulated_amount_cents ?? 0)}</td>
                            <td className="px-4 py-2 text-right font-medium">{formatCents(lastLine?.net_book_value_cents ?? sc.depreciable_amount_cents)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
