"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building, CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { ownerFinanceSchema } from "@/lib/validations/onboarding";
import { apiClient } from "@/lib/api-client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OnboardingStepShell } from "@/components/onboarding/onboarding-step-shell";

export default function OwnerFinancePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    encaissement_prefere: "sepa_sdd" as "sepa_sdd" | "virement_sct" | "virement_inst" | "pay_by_bank" | "carte_wallet",
    encaissement_secondaires: [] as string[],
    sepa_mandat_type: "core" as "core" | "b2b" | undefined,
    sepa_rum: "",
    payout_iban: "",
    payout_frequence: "immediat" as "immediat" | "hebdo" | "mensuel" | "seuil",
    payout_jour: 1,
    payout_seuil: 0,
    payout_rail: "sct" as "sct" | "sct_inst",
  });

  useEffect(() => {
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "owner") {
        setFormData((prev) => ({
          ...prev,
          ...(draft.data as Partial<typeof prev>),
        }));
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = ownerFinanceSchema.parse(formData);

      await apiClient.put("/me/owner-profile", {
        iban: validated.payout_iban,
        encaissement_prefere: validated.encaissement_prefere,
        payout_frequence: validated.payout_frequence,
        payout_rail: validated.payout_rail,
        payout_seuil: validated.payout_seuil,
        payout_jour: validated.payout_jour,
      });

      await onboardingService.saveDraft("owner_finance", validated, "owner");
      await onboardingService.markStepCompleted("owner_finance", "owner");

      toast({
        title: "Paramètres enregistrés",
        description: "Vos préférences financières ont été sauvegardées.",
      });

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
        ? prev.encaissement_secondaires.filter((item) => item !== method)
        : [...prev.encaissement_secondaires, method],
    }));
  };

  return (
    <OnboardingStepShell
      icon={CreditCard}
      step="Etape 2"
      title="Comment souhaitez-vous recevoir vos loyers ?"
      description="Configurez uniquement l'essentiel : comment vos locataires paient et sur quel compte Talok vous reverse les fonds."
      asideTitle="Ce que vous reglez ici"
      asideDescription="Ces choix restent modifiables plus tard. L'objectif est surtout de demarrer avec un circuit simple et lisible."
      tips={[
        "Choisissez d'abord le moyen de paiement principal le plus simple pour vos locataires.",
        "Renseignez le compte bancaire sur lequel vous souhaitez recevoir vos versements.",
        "Si vous hesitez, gardez des reglages simples puis ajustez-les apres votre premiere mise en location.",
      ]}
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Paiement du locataire vers vous</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Définissez le moyen de paiement à privilégier pour éviter les relances et les cas particuliers.
          </p>

          <div className="space-y-2">
            <Label>Moyen de paiement principal *</Label>
            <Select
              value={formData.encaissement_prefere}
              onValueChange={(value: "sepa_sdd" | "virement_sct" | "virement_inst" | "pay_by_bank" | "carte_wallet") =>
                setFormData({ ...formData, encaissement_prefere: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sepa_sdd">Prélèvement SEPA</SelectItem>
                <SelectItem value="virement_sct">Virement bancaire standard</SelectItem>
                <SelectItem value="virement_inst">Virement bancaire instantané</SelectItem>
                <SelectItem value="pay_by_bank">Paiement bancaire guidé</SelectItem>
                <SelectItem value="carte_wallet">Carte ou wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.encaissement_prefere === "sepa_sdd" ? (
            <div className="space-y-4 rounded-2xl border border-border bg-muted/40 p-4">
              <div className="space-y-2">
                <Label>Type de mandat SEPA</Label>
                <Select
                  value={formData.sepa_mandat_type}
                  onValueChange={(value: "core" | "b2b") => setFormData({ ...formData, sepa_mandat_type: value })}
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
                <Label htmlFor="sepa_rum">Référence de mandat (optionnel)</Label>
                <Input
                  id="sepa_rum"
                  value={formData.sepa_rum}
                  onChange={(e) => setFormData({ ...formData, sepa_rum: e.target.value })}
                  placeholder="Ajoutez-la seulement si vous en avez déjà une"
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Solutions de secours (optionnel)</Label>
            <p className="text-xs text-muted-foreground">
              Ajoutez un plan B uniquement si vous souhaitez proposer une alternative au moyen principal.
            </p>
            <div className="flex flex-wrap gap-2">
              {["sepa_sdd", "virement_sct", "virement_inst", "pay_by_bank", "carte_wallet"].map((method) => {
                if (method === formData.encaissement_prefere) return null;

                const labels: Record<string, string> = {
                  sepa_sdd: "SEPA",
                  virement_sct: "Virement",
                  virement_inst: "Virement instantané",
                  pay_by_bank: "Paiement bancaire guidé",
                  carte_wallet: "Carte / wallet",
                };

                return (
                  <Button
                    key={method}
                    type="button"
                    variant={formData.encaissement_secondaires.includes(method) ? "default" : "outline"}
                    onClick={() => toggleSecondaryPayment(method)}
                  >
                    {labels[method]}
                    {formData.encaissement_secondaires.includes(method) ? (
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    ) : null}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-border pt-6">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Versement Talok vers votre compte</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Indiquez sur quel compte vous recevez les fonds et à quel rythme vous préférez être crédité.
          </p>

          <div className="space-y-2">
            <Label htmlFor="payout_iban">Compte bancaire à créditer *</Label>
            <Input
              id="payout_iban"
              value={formData.payout_iban}
              onChange={(e) => setFormData({ ...formData, payout_iban: e.target.value.toUpperCase().replace(/\s/g, "") })}
              placeholder="FR76 1234 5678 9012 3456 7890 123"
              required
              disabled={loading}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Format attendu : IBAN complet sans erreur de saisie.</p>
          </div>

          <div className="space-y-2">
            <Label>À quel rythme voulez-vous recevoir vos fonds ? *</Label>
            <Select
              value={formData.payout_frequence}
              onValueChange={(value: "immediat" | "hebdo" | "mensuel" | "seuil") =>
                setFormData({ ...formData, payout_frequence: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediat">Dès qu'un paiement arrive</SelectItem>
                <SelectItem value="hebdo">Une fois par semaine</SelectItem>
                <SelectItem value="mensuel">Une fois par mois</SelectItem>
                <SelectItem value="seuil">Quand un montant minimum est atteint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.payout_frequence === "mensuel" ? (
            <div className="space-y-2">
              <Label htmlFor="payout_jour">Jour du mois souhaité (1-28)</Label>
              <Input
                id="payout_jour"
                type="number"
                min="1"
                max="28"
                value={formData.payout_jour}
                onChange={(e) => setFormData({ ...formData, payout_jour: parseInt(e.target.value, 10) || 1 })}
                required
              />
            </div>
          ) : null}

          {formData.payout_frequence === "seuil" ? (
            <div className="space-y-2">
              <Label htmlFor="payout_seuil">Montant minimum avant versement (€)</Label>
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
          ) : null}

          <div className="space-y-2">
            <Label>Vitesse de virement *</Label>
            <Select
              value={formData.payout_rail}
              onValueChange={(value: "sct" | "sct_inst") => setFormData({ ...formData, payout_rail: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sct">Virement standard</SelectItem>
                <SelectItem value="sct_inst">Virement instantané (si disponible)</SelectItem>
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
    </OnboardingStepShell>
  );
}

