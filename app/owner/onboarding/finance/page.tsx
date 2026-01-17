"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { ownerFinanceSchema } from "@/lib/validations/onboarding";
import { CreditCard, Building, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function OwnerFinancePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    // Encaissements
    encaissement_prefere: "sepa_sdd" as "sepa_sdd" | "virement_sct" | "virement_inst" | "pay_by_bank" | "carte_wallet",
    encaissement_secondaires: [] as string[],
    sepa_mandat_type: "core" as "core" | "b2b" | undefined,
    sepa_rum: "",
    
    // Versements
    payout_iban: "",
    payout_frequence: "immediat" as "immediat" | "hebdo" | "mensuel" | "seuil",
    payout_jour: 1,
    payout_seuil: 0,
    payout_rail: "sct" as "sct" | "sct_inst",
  });

  useEffect(() => {
    // Charger le brouillon si disponible
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "owner") {
        setFormData((prev) => ({
          ...prev,
          ...(draft.data as any),
        }));
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = ownerFinanceSchema.parse(formData);

      // Sauvegarder dans le profil propriétaire
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non authentifié");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profil non trouvé");

      // Mettre à jour le profil propriétaire avec l'IBAN
      const profileData = profile as any;
      const { error: profileError } = await (supabase
        .from("owner_profiles") as any)
        .update({
          iban: validated.payout_iban,
        } as any)
        .eq("profile_id", profileData.id as any);

      if (profileError) throw profileError;

      // Sauvegarder les préférences financières (pourrait être dans une table séparée)
      // Pour l'instant, on sauvegarde dans le brouillon
      await onboardingService.saveDraft("owner_finance", validated, "owner");
      await onboardingService.markStepCompleted("owner_finance", "owner");

      toast({
        title: "Paramètres enregistrés",
        description: "Vos préférences financières ont été sauvegardées.",
      });

      // Rediriger vers l'ajout du premier logement
      router.push("/owner/onboarding/property");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSecondaryPayment = (method: string) => {
    setFormData((prev) => ({
      ...prev,
      encaissement_secondaires: prev.encaissement_secondaires.includes(method)
        ? prev.encaissement_secondaires.filter((m) => m !== method)
        : [...prev.encaissement_secondaires, method],
    }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Paramètres financiers</CardTitle>
          <CardDescription>
            Configurez vos modes d'encaissement et de versement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Encaissements */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Encaissements (locataire → vous)</h3>
              </div>

              <div className="space-y-2">
                <Label>Mode préféré *</Label>
                <Select
                  value={formData.encaissement_prefere}
                  onValueChange={(value: any) => setFormData({ ...formData, encaissement_prefere: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sepa_sdd">Prélèvement SEPA</SelectItem>
                    <SelectItem value="virement_sct">Virement SCT</SelectItem>
                    <SelectItem value="virement_inst">Virement SCT Instantané</SelectItem>
                    <SelectItem value="pay_by_bank">Pay by Bank (PIS)</SelectItem>
                    <SelectItem value="carte_wallet">Carte / Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.encaissement_prefere === "sepa_sdd" && (
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="space-y-2">
                    <Label>Type de mandat SEPA</Label>
                    <Select
                      value={formData.sepa_mandat_type}
                      onValueChange={(value: any) => setFormData({ ...formData, sepa_mandat_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="core">CORE (particuliers)</SelectItem>
                        <SelectItem value="b2b">B2B (entreprises)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sepa_rum">RUM (Référence Unique de Mandat)</Label>
                    <Input
                      id="sepa_rum"
                      value={formData.sepa_rum}
                      onChange={(e) => setFormData({ ...formData, sepa_rum: e.target.value })}
                      placeholder="Optionnel"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Modes secondaires (optionnel)</Label>
                <div className="flex flex-wrap gap-2">
                  {["sepa_sdd", "virement_sct", "virement_inst", "pay_by_bank", "carte_wallet"].map((method) => {
                    if (method === formData.encaissement_prefere) return null;
                    const labels: Record<string, string> = {
                      sepa_sdd: "SEPA",
                      virement_sct: "Virement SCT",
                      virement_inst: "Virement Instantané",
                      pay_by_bank: "Pay by Bank",
                      carte_wallet: "Carte/Wallet",
                    };
                    return (
                      <Button
                        key={method}
                        type="button"
                        variant={formData.encaissement_secondaires.includes(method) ? "default" : "outline"}
                        onClick={() => toggleSecondaryPayment(method)}
                      >
                        {labels[method]}
                        {formData.encaissement_secondaires.includes(method) && (
                          <CheckCircle2 className="ml-2 h-4 w-4" />
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Versements */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Versements (plateforme → vous)</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payout_iban">IBAN bénéficiaire *</Label>
                <Input
                  id="payout_iban"
                  value={formData.payout_iban}
                  onChange={(e) => setFormData({ ...formData, payout_iban: e.target.value.toUpperCase().replace(/\s/g, "") })}
                  placeholder="FR76 1234 5678 9012 3456 7890 123"
                  required
                  disabled={loading}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Format IBAN (ex: FR7612345678901234567890123)
                </p>
              </div>

              <div className="space-y-2">
                <Label>Fréquence de versement *</Label>
                <Select
                  value={formData.payout_frequence}
                  onValueChange={(value: any) => setFormData({ ...formData, payout_frequence: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediat">À chaque encaissement</SelectItem>
                    <SelectItem value="hebdo">Hebdomadaire</SelectItem>
                    <SelectItem value="mensuel">Mensuel (jour X)</SelectItem>
                    <SelectItem value="seuil">Par seuil</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.payout_frequence === "mensuel" && (
                <div className="space-y-2">
                  <Label htmlFor="payout_jour">Jour du mois (1-28)</Label>
                  <Input
                    id="payout_jour"
                    type="number"
                    min="1"
                    max="28"
                    value={formData.payout_jour}
                    onChange={(e) => setFormData({ ...formData, payout_jour: parseInt(e.target.value) || 1 })}
                    required
                  />
                </div>
              )}

              {formData.payout_frequence === "seuil" && (
                <div className="space-y-2">
                  <Label htmlFor="payout_seuil">Seuil (€)</Label>
                  <Input
                    id="payout_seuil"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.payout_seuil}
                    onChange={(e) => setFormData({ ...formData, payout_seuil: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Rail de versement *</Label>
                <Select
                  value={formData.payout_rail}
                  onValueChange={(value: any) => setFormData({ ...formData, payout_rail: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sct">SCT (Standard)</SelectItem>
                    <SelectItem value="sct_inst">SCT Instantané (si disponible)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "Enregistrement..."
              ) : (
                <>
                  Continuer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

