// @ts-nocheck
"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatCents } from "@/lib/utils/format-cents";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Download, Check } from "lucide-react";

export default function ECClientView() {
  const { entityId } = useParams<{ entityId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("ecritures");
  const [annotationContent, setAnnotationContent] = useState("");
  const [showAnnotationForm, setShowAnnotationForm] = useState<string | null>(null);

  const { data: entries } = useQuery({ queryKey: ["ec-entries", entityId], queryFn: () => apiClient.get(`/accounting/entries?entityId=${entityId}&limit=100`), enabled: !!entityId });
  const { data: annotations } = useQuery({ queryKey: ["ec-annotations", entityId], queryFn: () => apiClient.get(`/accounting/ec/annotations?entityId=${entityId}`), enabled: !!entityId });

  const addAnnotation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.post("/accounting/ec/annotations", body),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["ec-annotations"] }); setShowAnnotationForm(null); setAnnotationContent(""); },
  });

  const tabs = ["ecritures", "annotations", "exports"];
  const entryList = (entries?.data?.entries ?? entries?.entries ?? []) as Array<{ id: string; entry_date: string; label: string; entry_number: string }>;
  const annotationList = (annotations?.data ?? annotations ?? []) as Array<{ id: string; content: string; annotation_type: string; is_resolved: boolean; created_at: string }>;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3"><Link href="/ec" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></Link><h1 className="text-xl font-bold text-foreground">Client {(entityId as string).slice(0, 8)}</h1></div>
      <div className="flex gap-2">{tabs.map(t => (<button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${activeTab === t ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>{t}</button>))}</div>

      {activeTab === "ecritures" && (
        <div className="space-y-2">{entryList.map(e => (
          <div key={e.id} className="bg-card rounded-lg border border-border p-3 flex items-center justify-between">
            <div><p className="text-sm font-medium">{e.label}</p><p className="text-xs text-muted-foreground">{e.entry_date} — {e.entry_number}</p></div>
            <button onClick={() => setShowAnnotationForm(e.id)} className="text-muted-foreground hover:text-primary"><MessageSquare className="w-4 h-4" /></button>
          </div>
        ))}
        {showAnnotationForm && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <textarea value={annotationContent} onChange={e => setAnnotationContent(e.target.value)} placeholder="Votre remarque..." className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm h-20" />
            <div className="flex gap-2"><button onClick={() => addAnnotation.mutate({ entityId, entryId: showAnnotationForm, annotationType: "comment", content: annotationContent })} className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm">Envoyer</button><button onClick={() => setShowAnnotationForm(null)} className="bg-card border border-border rounded-lg px-4 py-2 text-sm">Annuler</button></div>
          </div>
        )}</div>
      )}

      {activeTab === "annotations" && (
        <div className="space-y-2">{annotationList.map(a => (
          <div key={a.id} className={`bg-card rounded-lg border p-3 ${a.is_resolved ? "border-border opacity-60" : "border-amber-500/30"}`}>
            <div className="flex items-start justify-between"><p className="text-sm">{a.content}</p>{a.is_resolved && <Check className="w-4 h-4 text-emerald-500" />}</div>
            <p className="text-xs text-muted-foreground mt-1">{a.annotation_type} — {new Date(a.created_at).toLocaleDateString("fr-FR")}</p>
          </div>
        ))}</div>
      )}

      {activeTab === "exports" && (
        <div className="space-y-3">
          <button className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary flex items-center gap-3"><Download className="w-5 h-5 text-primary" /><div><p className="text-sm font-medium">Tout telecharger</p><p className="text-xs text-muted-foreground">FEC + Balance + Grand livre + Justificatifs</p></div></button>
        </div>
      )}
    </div>
  );
}
