// @ts-nocheck
"use client";
// @ts-nocheck — TODO: remove once database.types.ts is regenerated
import { useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useEntityStore } from "@/stores/useEntityStore";
import Link from "next/link";
import { ArrowLeft, UserPlus, X, Shield } from "lucide-react";

export default function ECManageClient() {
  return (<PlanGate feature="bank_reconciliation" mode="block"><ECManageContent /></PlanGate>);
}
function ECManageContent() {
  const { activeEntityId } = useEntityStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ecEmail: "", ecFirmName: "", accessLevel: "read" });
  const { data, isLoading } = useQuery<any>({ queryKey: ["ec-access", activeEntityId], queryFn: () => apiClient.get(`/accounting/ec/access?entityId=${activeEntityId}`), enabled: !!activeEntityId });
  const inviteMutation = useMutation<any, any, any>({ mutationFn: (body: Record<string, unknown>) => apiClient.post("/accounting/ec/access", body), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ec-access"] }); setShowForm(false); } });
  const revokeMutation = useMutation<any, any, any>({ mutationFn: (id: string) => apiClient.delete(`/accounting/ec/access/${id}`), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ec-access"] }) });
  const ecList = (data?.data ?? data ?? []) as Array<{ id: string; ec_name: string; ec_email: string; access_level: string; granted_at: string }>;
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3"><Link href="/owner/accounting" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link><h1 className="text-xl font-bold text-foreground">Expert-comptable</h1></div>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"><UserPlus className="w-4 h-4" />Inviter</button>
      </div>
      {showForm && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <input placeholder="Email de l'expert-comptable" value={form.ecEmail} onChange={e => setForm({...form, ecEmail: e.target.value})} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <input placeholder="Nom du cabinet" value={form.ecFirmName} onChange={e => setForm({...form, ecFirmName: e.target.value})} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          <select value={form.accessLevel} onChange={e => setForm({...form, accessLevel: e.target.value})} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="read">Lecture seule</option><option value="annotate">Lecture + annotations</option><option value="validate">Validation</option>
          </select>
          <button onClick={() => inviteMutation.mutate({ ...form, entityId: activeEntityId })} disabled={inviteMutation.isPending} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium w-full">{inviteMutation.isPending ? "Envoi..." : "Envoyer l'invitation"}</button>
        </div>
      )}
      {isLoading ? <div className="h-32 bg-muted rounded-xl animate-pulse" /> : ecList.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center"><Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-semibold">Aucun expert-comptable connecte</h3><p className="text-sm text-muted-foreground mt-2">Invitez votre EC pour partager vos donnees comptables en toute securite.</p></div>
      ) : (
        <div className="space-y-3">{ecList.map(ec => (
          <div key={ec.id} className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
            <div><p className="text-sm font-medium">{ec.ec_name}</p><p className="text-xs text-muted-foreground">{ec.ec_email} — {ec.access_level}</p><p className="text-xs text-muted-foreground">Invite le {new Date(ec.granted_at).toLocaleDateString("fr-FR")}</p></div>
            <button onClick={() => revokeMutation.mutate(ec.id)} className="text-destructive hover:text-destructive/80"><X className="w-4 h-4" /></button>
          </div>
        ))}</div>
      )}
    </div>
  );
}
