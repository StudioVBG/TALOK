"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  Hammer,
  Loader2,
  Save,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface Site {
  id: string;
  name: string;
  city?: string;
}

const EXEMPT_REASONS = [
  {
    value: "copropriete_neuve_moins_5_ans",
    label: "Copropriété neuve < 5 ans",
    description: "Exemption automatique pour les copropriétés neuves",
  },
  {
    value: "unanimite_dispense",
    label: "Dispense votée à l'unanimité",
    description: "Votée en AG à l'unanimité des copropriétaires",
  },
  {
    value: "dtg_pas_de_travaux_prevus",
    label: "DTG — aucun travaux prévu",
    description: "Diagnostic technique global concluant à l'absence de travaux",
  },
];

export default function NewFondsTravauxPage() {
  const router = useRouter();
  const { toast } = useToast();
  const isSubmittingRef = useRef(false);

  const [loadingSites, setLoadingSites] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);

  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    site_id: "",
    fiscal_year: currentYear.toString(),
    budget_reference: "",
    cotisation_taux_percent: "5.00",
    solde_initial: "0",
    dedicated_bank_account: "",
    bank_name: "",
    loi_alur_exempt: false,
    exempt_reason: "" as "" | "copropriete_neuve_moins_5_ans" | "unanimite_dispense" | "dtg_pas_de_travaux_prevus",
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

  // Auto-calcule le montant annuel à partir du budget de référence et du taux
  const cotisationAmountCents = (() => {
    const budget = parseFloat(form.budget_reference) || 0;
    const rate = parseFloat(form.cotisation_taux_percent) || 0;
    return Math.round((budget * rate) / 100 * 100); // En centimes
  })();

  const cotisationAmountEuros = (cotisationAmountCents / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;

    if (!form.site_id || !form.fiscal_year) {
      toast({ title: "Champs requis", variant: "destructive" });
      return;
    }

    const rate = parseFloat(form.cotisation_taux_percent);
    if (!form.loi_alur_exempt && (isNaN(rate) || rate < 5)) {
      toast({
        title: "Taux insuffisant",
        description: "Loi ALUR : minimum 5% du budget prévisionnel (sauf exemption)",
        variant: "destructive",
      });
      return;
    }

    if (form.loi_alur_exempt && !form.exempt_reason) {
      toast({
        title: "Raison d'exemption requise",
        description: "Sélectionnez une raison d'exemption loi ALUR",
        variant: "destructive",
      });
      return;
    }

    if (cotisationAmountCents <= 0 && !form.loi_alur_exempt) {
      toast({
        title: "Montant invalide",
        description: "Renseignez un budget de référence pour calculer la cotisation",
        variant: "destructive",
      });
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const budgetRefCents = form.budget_reference
        ? Math.round(parseFloat(form.budget_reference) * 100)
        : undefined;
      const soldeInitialCents = form.solde_initial
        ? Math.round(parseFloat(form.solde_initial) * 100)
        : 0;

      const payload: Record<string, any> = {
        site_id: form.site_id,
        fiscal_year: parseInt(form.fiscal_year, 10),
        cotisation_taux_percent: rate,
        cotisation_montant_annual_cents: cotisationAmountCents,
        solde_initial_cents: soldeInitialCents,
        loi_alur_exempt: form.loi_alur_exempt,
      };

      if (budgetRefCents !== undefined) payload.budget_reference_cents = budgetRefCents;
      if (form.dedicated_bank_account) payload.dedicated_bank_account = form.dedicated_bank_account.trim();
      if (form.bank_name) payload.bank_name = form.bank_name.trim();
      if (form.loi_alur_exempt && form.exempt_reason) payload.exempt_reason = form.exempt_reason;

      const res = await fetch("/api/copro/fonds-travaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de la création");
      }

      toast({ title: "Fonds travaux créé", description: `Exercice ${form.fiscal_year}` });
      router.push("/syndic/fonds-travaux");
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de créer le fonds",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Link href="/syndic/fonds-travaux">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Hammer className="h-6 w-6 text-cyan-600" />
              Nouveau fonds travaux
            </h1>
            <p className="text-sm text-muted-foreground">
              Loi ALUR 2014 (art. 58) — obligatoire pour copropriétés &gt; 5 ans
            </p>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-cyan-600" />
                Copropriété et exercice
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingSites ? (
                <p className="text-sm text-muted-foreground">Chargement...</p>
              ) : sites.length === 0 ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100">
                  Aucune copropriété disponible.
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Copropriété *</Label>
                  <Select
                    value={form.site_id}
                    onValueChange={(value) => setForm({ ...form, site_id: value })}
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
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
                </div>
              )}

              <div className="space-y-2">
                <Label>Exercice fiscal *</Label>
                <Input
                  type="number"
                  min="2017"
                  max="2100"
                  value={form.fiscal_year}
                  onChange={(e) => setForm({ ...form, fiscal_year: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-cyan-600" />
                Cotisation (loi ALUR)
              </CardTitle>
              <CardDescription>
                Cotisation minimale légale : 5% du budget prévisionnel annuel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Budget prévisionnel de référence (€ HT)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 25000.00"
                  value={form.budget_reference}
                  onChange={(e) => setForm({ ...form, budget_reference: e.target.value })}
                  disabled={submitting || form.loi_alur_exempt}
                />
                <p className="text-xs text-muted-foreground">
                  Budget annuel de la copropriété sur lequel est calculée la cotisation
                </p>
              </div>

              <div className="space-y-2">
                <Label>Taux de cotisation (%) *</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.cotisation_taux_percent}
                  onChange={(e) => setForm({ ...form, cotisation_taux_percent: e.target.value })}
                  required
                  disabled={submitting || form.loi_alur_exempt}
                />
                {!form.loi_alur_exempt && parseFloat(form.cotisation_taux_percent) < 5 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Taux inférieur au minimum légal de 5%
                  </p>
                )}
              </div>

              {cotisationAmountCents > 0 && !form.loi_alur_exempt && (
                <div className="rounded-xl bg-cyan-50 dark:bg-cyan-500/10 p-4 border border-cyan-200 dark:border-cyan-400/30">
                  <p className="text-sm text-cyan-900 dark:text-cyan-100">
                    <strong>Cotisation annuelle calculée</strong> : {cotisationAmountEuros} €
                  </p>
                  <p className="text-xs text-cyan-700 dark:text-cyan-300 mt-1">
                    = {form.budget_reference} € × {form.cotisation_taux_percent}%
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Solde initial (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.solde_initial}
                  onChange={(e) => setForm({ ...form, solde_initial: e.target.value })}
                  disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">
                  Solde reporté de l'exercice précédent (si applicable)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compte bancaire dédié</CardTitle>
              <CardDescription>
                Obligatoire loi ALUR : le fonds travaux doit être placé sur un compte séparé
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>IBAN</Label>
                <Input
                  placeholder="FR76 XXXX XXXX XXXX"
                  value={form.dedicated_bank_account}
                  onChange={(e) => setForm({ ...form, dedicated_bank_account: e.target.value.toUpperCase() })}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label>Nom de la banque</Label>
                <Input
                  placeholder="Crédit Mutuel, BNP, etc."
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  disabled={submitting}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exemption (cas particuliers)</CardTitle>
              <CardDescription>
                Certaines copropriétés sont dispensées de la cotisation obligatoire
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <input
                  id="loi_alur_exempt"
                  type="checkbox"
                  checked={form.loi_alur_exempt}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      loi_alur_exempt: e.target.checked,
                      exempt_reason: e.target.checked ? form.exempt_reason : "",
                    })
                  }
                  disabled={submitting}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <div>
                  <Label htmlFor="loi_alur_exempt" className="cursor-pointer">
                    Copropriété exemptée du fonds travaux
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    À cocher si la copropriété bénéficie d'une exemption légale
                  </p>
                </div>
              </div>

              {form.loi_alur_exempt && (
                <div className="space-y-2 pl-7">
                  <Label>Raison de l'exemption *</Label>
                  <Select
                    value={form.exempt_reason}
                    onValueChange={(value: typeof form.exempt_reason) =>
                      setForm({ ...form, exempt_reason: value })
                    }
                    disabled={submitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une raison" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXEMPT_REASONS.map((reason) => (
                        <SelectItem key={reason.value} value={reason.value}>
                          <div>
                            <div className="font-medium">{reason.label}</div>
                            <div className="text-xs text-muted-foreground">{reason.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Link href="/syndic/fonds-travaux">
              <Button type="button" variant="outline" disabled={submitting}>
                Annuler
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={submitting || loadingSites || sites.length === 0}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Créer le fonds travaux
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
