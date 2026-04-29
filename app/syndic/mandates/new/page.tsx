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
import { ArrowLeft, Building2, FileText, Loader2, Save, ShieldCheck, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Site {
  id: string;
  name: string;
  city?: string;
}

export default function NewMandatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const isSubmittingRef = useRef(false);

  const [loadingSites, setLoadingSites] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  const [form, setForm] = useState({
    site_id: "",
    title: "Mandat de syndic",
    mandate_number: "",
    start_date: "",
    end_date: "",
    duration_months: 12,
    tacit_renewal: false,
    notice_period_months: 3,
    honoraires_annuels: "",
    voted_in_assembly_id: "",
    notes: "",
    signed_document_url: "",
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sitesRes, profileRes] = await Promise.all([
          fetch("/api/copro/sites"),
          fetch("/api/me/profile"),
        ]);

        if (sitesRes.ok) {
          const sitesData = await sitesRes.json();
          setSites(Array.isArray(sitesData) ? sitesData : []);
        }

        if (profileRes.ok) {
          const profile = await profileRes.json();
          setMyProfileId(profile.id || null);
        }
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de charger les données",
          variant: "destructive",
        });
      } finally {
        setLoadingSites(false);
      }
    };
    loadData();
  }, [toast]);

  useEffect(() => {
    if (form.start_date && form.duration_months > 0) {
      const start = new Date(form.start_date);
      const end = new Date(start);
      end.setMonth(end.getMonth() + form.duration_months);
      end.setDate(end.getDate() - 1);
      setForm((prev) => ({ ...prev, end_date: end.toISOString().split("T")[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.start_date, form.duration_months]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!form.site_id || !form.start_date || !form.end_date || !form.honoraires_annuels) {
      toast({
        title: "Champs requis",
        description: "Site, dates et honoraires sont obligatoires",
        variant: "destructive",
      });
      return;
    }

    if (!myProfileId) {
      toast({
        title: "Profil introuvable",
        description: "Impossible de créer un mandat sans profil syndic",
        variant: "destructive",
      });
      return;
    }

    const honorairesValue = parseFloat(form.honoraires_annuels);
    if (isNaN(honorairesValue) || honorairesValue < 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }

    if (form.duration_months < 1 || form.duration_months > 36) {
      toast({
        title: "Durée invalide",
        description: "Loi du 10 juillet 1965 : durée entre 1 et 36 mois",
        variant: "destructive",
      });
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const payload = {
        site_id: form.site_id,
        syndic_profile_id: myProfileId,
        title: form.title.trim() || "Mandat de syndic",
        mandate_number: form.mandate_number.trim() || undefined,
        start_date: form.start_date,
        end_date: form.end_date,
        duration_months: form.duration_months,
        tacit_renewal: form.tacit_renewal,
        notice_period_months: form.notice_period_months,
        honoraires_annuels_cents: Math.round(honorairesValue * 100),
        currency: "EUR",
        voted_in_assembly_id: form.voted_in_assembly_id || undefined,
        notes: form.notes.trim() || undefined,
        signed_document_url: form.signed_document_url || undefined,
      };

      const res = await fetch("/api/copro/mandates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la création");
      }

      toast({ title: "Mandat créé", description: "Le mandat a été créé en brouillon" });
      router.push("/syndic/mandates");
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de créer le mandat",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Link href="/syndic/mandates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-violet-600" />
            Nouveau mandat de syndic
          </h1>
          <p className="text-muted-foreground">Loi du 10 juillet 1965 — durée 1 à 36 mois</p>
        </div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-violet-600" />
              Copropriété
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSites ? (
              <p className="text-muted-foreground text-sm">Chargement...</p>
            ) : sites.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Aucune copropriété disponible.
              </div>
            ) : (
              <Select
                value={form.site_id}
                onValueChange={(value) => setForm({ ...form, site_id: value })}
                disabled={submitting}
              >
                <SelectTrigger>
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

        <Card>
          <CardHeader>
            <CardTitle>Durée du mandat</CardTitle>
            <CardDescription>
              La loi impose une durée entre 1 et 36 mois
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Titre du mandat</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label>Numéro de référence (optionnel)</Label>
              <Input
                placeholder="MDS-2026-001"
                value={form.mandate_number}
                onChange={(e) => setForm({ ...form, mandate_number: e.target.value })}
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date début *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label>Durée (mois) *</Label>
                <Input
                  type="number"
                  min="1"
                  max="36"
                  value={form.duration_months}
                  onChange={(e) =>
                    setForm({ ...form, duration_months: parseInt(e.target.value, 10) || 12 })
                  }
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label>Date fin</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="tacit_renewal"
                type="checkbox"
                checked={form.tacit_renewal}
                onChange={(e) => setForm({ ...form, tacit_renewal: e.target.checked })}
                disabled={submitting}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="tacit_renewal" className="cursor-pointer">
                Tacite reconduction
              </Label>
            </div>
            <div className="space-y-2">
              <Label>Préavis de résiliation (mois)</Label>
              <Input
                type="number"
                min="0"
                max="12"
                value={form.notice_period_months}
                onChange={(e) =>
                  setForm({ ...form, notice_period_months: parseInt(e.target.value, 10) || 3 })
                }
                disabled={submitting}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Honoraires</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Honoraires annuels HT (€) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="6000.00"
                value={form.honoraires_annuels}
                onChange={(e) => setForm({ ...form, honoraires_annuels: e.target.value })}
                required
                disabled={submitting}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Document du mandat signé
            </CardTitle>
            <CardDescription>
              Lien vers le PDF signé (signature électronique eIDAS ou paraphe manuel scanné)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL du document signé (optionnel)</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://…"
                  value={form.signed_document_url}
                  onChange={(e) => setForm({ ...form, signed_document_url: e.target.value })}
                  disabled={submitting}
                />
                <Button type="button" variant="outline" disabled className="shrink-0" title="Bibliothèque documents (à venir)">
                  <Upload className="h-4 w-4 mr-1" />
                  Téléverser
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                La signature électronique pourra être lancée depuis la fiche du mandat après création.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Notes internes</Label>
              <Textarea
                placeholder="Notes privées sur le mandat (facultatif)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                disabled={submitting}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Link href="/syndic/mandates">
            <Button type="button" variant="outline" disabled={submitting}>
              Annuler
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={submitting || loadingSites || sites.length === 0}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Créer le mandat
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
