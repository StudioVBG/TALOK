"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Building2, Users, Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Site {
  id: string;
  name: string;
  city?: string;
}

export default function NewCouncilPage() {
  const router = useRouter();
  const { toast } = useToast();
  const isSubmittingRef = useRef(false);

  const [loadingSites, setLoadingSites] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);

  const [form, setForm] = useState({
    site_id: "",
    mandate_start: "",
    mandate_end: "",
    duration_years: 1,
    notes: "",
  });

  useEffect(() => {
    const loadSites = async () => {
      try {
        const res = await fetch("/api/copro/sites");
        if (res.ok) {
          const data = await res.json();
          setSites(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        toast({
          title: "Erreur",
          description: "Impossible de charger les sites",
          variant: "destructive",
        });
      } finally {
        setLoadingSites(false);
      }
    };
    loadSites();
  }, [toast]);

  // Auto-calc end date from start + duration
  useEffect(() => {
    if (form.mandate_start && form.duration_years > 0) {
      const start = new Date(form.mandate_start);
      const end = new Date(start);
      end.setFullYear(end.getFullYear() + form.duration_years);
      end.setDate(end.getDate() - 1);
      setForm((prev) => ({ ...prev, mandate_end: end.toISOString().split("T")[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.mandate_start, form.duration_years]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!form.site_id || !form.mandate_start || !form.mandate_end) {
      toast({ title: "Champs requis", variant: "destructive" });
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const payload = {
        site_id: form.site_id,
        mandate_start: form.mandate_start,
        mandate_end: form.mandate_end,
        members: [], // Membres ajoutés en édition après création
        notes: form.notes.trim() || undefined,
      };

      const res = await fetch("/api/copro/councils", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la création");
      }

      toast({
        title: "Conseil créé",
        description: "Ajoutez maintenant les membres depuis la page de détail",
      });
      router.push("/syndic/councils");
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de créer le conseil",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Link href="/syndic/councils">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-white/10">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="h-6 w-6 text-violet-400" />
              Nouveau conseil syndical
            </h1>
            <p className="text-slate-400">Élu en assemblée générale (loi du 10 juillet 1965, art. 21)</p>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Building2 className="h-5 w-5 text-violet-400" />
                Copropriété
              </CardTitle>
              <CardDescription className="text-slate-400">
                Un seul conseil actif par copropriété à la fois
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSites ? (
                <p className="text-slate-400 text-sm">Chargement...</p>
              ) : sites.length === 0 ? (
                <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                  Aucune copropriété disponible.
                </div>
              ) : (
                <Select
                  value={form.site_id}
                  onValueChange={(value) => setForm({ ...form, site_id: value })}
                  disabled={submitting}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Sélectionner une copropriété" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name}
                        {site.city && ` — ${site.city}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Durée du mandat</CardTitle>
              <CardDescription className="text-slate-400">
                Typiquement 1 à 3 ans (renouvelable par AG)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Début *</Label>
                  <Input
                    type="date"
                    value={form.mandate_start}
                    onChange={(e) => setForm({ ...form, mandate_start: e.target.value })}
                    required
                    disabled={submitting}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Durée (années)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="3"
                    value={form.duration_years}
                    onChange={(e) =>
                      setForm({ ...form, duration_years: parseInt(e.target.value, 10) || 1 })
                    }
                    disabled={submitting}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Fin *</Label>
                  <Input
                    type="date"
                    value={form.mandate_end}
                    onChange={(e) => setForm({ ...form, mandate_end: e.target.value })}
                    required
                    disabled={submitting}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Notes (optionnel)</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  disabled={submitting}
                  placeholder="Contexte, circonstances d'élection..."
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="rounded-lg border border-blue-400/30 bg-blue-500/10 p-3 text-sm text-blue-100">
                <p>
                  💡 <strong>Étape suivante</strong> : après création, vous pourrez ajouter les membres
                  du conseil, désigner le président et le vice-président.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Link href="/syndic/councils">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Annuler
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={submitting || loadingSites || sites.length === 0}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Créer le conseil
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
