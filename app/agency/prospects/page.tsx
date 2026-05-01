"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Search,
  Mail,
  Phone,
  Trash2,
  Loader2,
  Users,
  Sparkles,
  CheckCircle2,
  XCircle,
  Calendar,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProspectStatus =
  | "new"
  | "contacted"
  | "visit_scheduled"
  | "visited"
  | "applied"
  | "signed"
  | "lost";

type ProspectSource =
  | "manual"
  | "website"
  | "leboncoin"
  | "seloger"
  | "pap"
  | "recommandation"
  | "other";

interface Prospect {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: ProspectSource;
  status: ProspectStatus;
  property_id: string | null;
  notes: string | null;
  last_action_at: string;
  next_action_at: string | null;
  lease_id: string | null;
  created_at: string;
  property: { id: string; adresse_complete: string; ville: string } | null;
}

// Pipeline (5 colonnes actives + sortie en pied)
const PIPELINE: Array<{
  status: ProspectStatus;
  label: string;
  description: string;
  bg: string;
  text: string;
  icon: typeof Users;
}> = [
  {
    status: "new",
    label: "Nouveau",
    description: "Contact initial",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    icon: Sparkles,
  },
  {
    status: "contacted",
    label: "Contacté",
    description: "Premier contact effectué",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-400",
    icon: Phone,
  },
  {
    status: "visit_scheduled",
    label: "Visite planifiée",
    description: "Rendez-vous fixé",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-400",
    icon: Calendar,
  },
  {
    status: "visited",
    label: "Visité",
    description: "Visite effectuée",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-400",
    icon: ClipboardList,
  },
  {
    status: "applied",
    label: "Candidature",
    description: "Dossier déposé",
    bg: "bg-indigo-100 dark:bg-indigo-900/30",
    text: "text-indigo-700 dark:text-indigo-400",
    icon: ClipboardList,
  },
];

const OUTCOMES: Array<{
  status: ProspectStatus;
  label: string;
  bg: string;
  text: string;
  icon: typeof CheckCircle2;
}> = [
  {
    status: "signed",
    label: "Bail signé",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
    icon: CheckCircle2,
  },
  {
    status: "lost",
    label: "Perdu",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    icon: XCircle,
  },
];

const SOURCE_LABELS: Record<ProspectSource, string> = {
  manual: "Saisi manuellement",
  website: "Site agence",
  leboncoin: "Le Bon Coin",
  seloger: "SeLoger",
  pap: "PAP",
  recommandation: "Recommandation",
  other: "Autre",
};

const ALL_STATUSES: ProspectStatus[] = [
  ...PIPELINE.map((p) => p.status),
  ...OUTCOMES.map((o) => o.status),
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Hier";
  if (days < 7) return `${days}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function AgencyProspectsPage() {
  const { toast } = useToast();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    email: string;
    phone: string;
    source: ProspectSource;
    notes: string;
  }>({
    name: "",
    email: "",
    phone: "",
    source: "manual",
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/agency/prospects");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProspects(data.prospects ?? []);
    } catch (err) {
      toast({
        title: "Erreur de chargement",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return prospects;
    const q = search.toLowerCase();
    return prospects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.phone && p.phone.toLowerCase().includes(q)),
    );
  }, [prospects, search]);

  const grouped = useMemo(() => {
    const map = new Map<ProspectStatus, Prospect[]>();
    ALL_STATUSES.forEach((s) => map.set(s, []));
    filtered.forEach((p) => {
      const bucket = map.get(p.status);
      if (bucket) bucket.push(p);
    });
    return map;
  }, [filtered]);

  const handleCreate = async () => {
    if (form.name.trim().length < 2) {
      toast({ title: "Nom requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/agency/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          source: form.source,
          notes: form.notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Erreur ${res.status}`);
      toast({ title: "Prospect créé", description: form.name });
      setForm({ name: "", email: "", phone: "", source: "manual", notes: "" });
      setCreateOpen(false);
      load();
    } catch (err) {
      toast({
        title: "Échec",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (
    prospectId: string,
    newStatus: ProspectStatus,
  ) => {
    try {
      const res = await fetch(`/api/agency/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || `Erreur ${res.status}`);
      }
      // Optimistic update
      setProspects((prev) =>
        prev.map((p) =>
          p.id === prospectId
            ? { ...p, status: newStatus, last_action_at: new Date().toISOString() }
            : p,
        ),
      );
    } catch (err) {
      toast({
        title: "Échec mise à jour",
        description: err instanceof Error ? err.message : "Erreur",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (prospectId: string, name: string) => {
    if (!window.confirm(`Supprimer le prospect "${name}" ?`)) return;
    try {
      const res = await fetch(`/api/agency/prospects/${prospectId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error || `Erreur ${res.status}`);
      }
      setProspects((prev) => prev.filter((p) => p.id !== prospectId));
      toast({ title: "Prospect supprimé" });
    } catch (err) {
      toast({
        title: "Échec suppression",
        description: err instanceof Error ? err.message : "Erreur",
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Prospects
          </h1>
          <p className="text-muted-foreground mt-1">
            Suivi commercial des candidats locataires
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau prospect
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau prospect</DialogTitle>
              <DialogDescription>
                Enregistrez un candidat locataire pour le suivre dans votre pipeline.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prospect-name">Nom complet *</Label>
                <Input
                  id="prospect-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jean Dupont"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="prospect-email">Email</Label>
                  <Input
                    id="prospect-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="contact@example.fr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prospect-phone">Téléphone</Label>
                  <Input
                    id="prospect-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="06 12 34 56 78"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-source">Source</Label>
                <Select
                  value={form.source}
                  onValueChange={(v) =>
                    setForm({ ...form, source: v as ProspectSource })
                  }
                >
                  <SelectTrigger id="prospect-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SOURCE_LABELS) as ProspectSource[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {SOURCE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-notes">Notes</Label>
                <Textarea
                  id="prospect-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Recherche un T2, budget 800€, dispo dès le 15..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {PIPELINE.map((step) => {
          const count = grouped.get(step.status)?.length ?? 0;
          const Icon = step.icon;
          return (
            <div
              key={step.status}
              className={cn("p-3 rounded-lg flex items-center gap-3", step.bg)}
            >
              <Icon className={cn("h-5 w-5", step.text)} />
              <div>
                <p className={cn("text-lg font-bold", step.text)}>{count}</p>
                <p className="text-xs text-muted-foreground">{step.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, email ou téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pipeline kanban */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PIPELINE.map((step) => {
            const items = grouped.get(step.status) ?? [];
            const Icon = step.icon;
            return (
              <div key={step.status} className="space-y-3">
                <div
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 border-dashed",
                    step.bg,
                  )}
                >
                  <Icon className={cn("w-4 h-4", step.text)} />
                  <span className={cn("font-semibold text-sm flex-1", step.text)}>
                    {step.label}
                  </span>
                  <Badge variant="outline" className="bg-card">
                    {items.length}
                  </Badge>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {items.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      Aucun prospect ici.
                    </p>
                  ) : (
                    items.map((p) => (
                      <ProspectCard
                        key={p.id}
                        prospect={p}
                        onStatusChange={(s) => handleStatusChange(p.id, s)}
                        onDelete={() => handleDelete(p.id, p.name)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Outcomes (signed/lost) en pied */}
      {!loading &&
        OUTCOMES.some((o) => (grouped.get(o.status)?.length ?? 0) > 0) && (
          <div className="grid gap-4 md:grid-cols-2">
            {OUTCOMES.map((step) => {
              const items = grouped.get(step.status) ?? [];
              if (items.length === 0) return null;
              const Icon = step.icon;
              return (
                <Card key={step.status}>
                  <CardHeader className="pb-3">
                    <CardTitle
                      className={cn("text-base flex items-center gap-2", step.text)}
                    >
                      <Icon className="w-5 h-5" />
                      {step.label} ({items.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {items.map((p) => (
                      <ProspectCard
                        key={p.id}
                        prospect={p}
                        onStatusChange={(s) => handleStatusChange(p.id, s)}
                        onDelete={() => handleDelete(p.id, p.name)}
                        compact
                      />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
    </motion.div>
  );
}

function ProspectCard({
  prospect,
  onStatusChange,
  onDelete,
  compact,
}: {
  prospect: Prospect;
  onStatusChange: (status: ProspectStatus) => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  return (
    <Card className="border bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
      <CardContent className={cn("p-3 space-y-2", compact && "p-2")}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{prospect.name}</p>
            <p className="text-xs text-muted-foreground">
              {SOURCE_LABELS[prospect.source]} · {formatDate(prospect.last_action_at)}
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onDelete}
            title="Supprimer"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        {(prospect.email || prospect.phone) && !compact && (
          <div className="space-y-1 text-xs text-muted-foreground">
            {prospect.email && (
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{prospect.email}</span>
              </div>
            )}
            {prospect.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3 shrink-0" />
                <span>{prospect.phone}</span>
              </div>
            )}
          </div>
        )}

        {prospect.notes && !compact && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {prospect.notes}
          </p>
        )}

        <Select
          value={prospect.status}
          onValueChange={(v) => onStatusChange(v as ProspectStatus)}
        >
          <SelectTrigger className="h-7 text-xs">
            <ArrowRight className="w-3 h-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[...PIPELINE, ...OUTCOMES].map((step) => (
              <SelectItem key={step.status} value={step.status}>
                {step.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}
