"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building, CheckCircle2, ChevronDown, CreditCard } from "lucide-react";
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
import { cn } from "@/lib/utils";

const PAYMENT_LABELS: Record<string, { label: string; desc: string }> = {
  sepa_sdd: { label: "Prélèvement automatique", desc: "Le plus fiable — le loyer est prélevé directement" },
  virement_sct: { label: "Virement bancaire", desc: "Le locataire fait un virement chaque mois" },
  virement_inst: { label: "Virement instantané", desc: "Comme un virement, mais reçu en quelques secondes" },
  pay_by_bank: { label: "Paiement en ligne guidé", desc: "Le locataire paie via un lien sécurisé" },
  carte_wallet: { label: "Carte bancaire", desc: "Paiement par carte ou portefeuille numérique" },
};

export default function OwnerFinancePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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
      description="Seulement 2 choses à renseigner : le mode de paiement de vos locataires et votre compte bancaire."
      asideTitle="Pourquoi ces informations ?"
      asideDescription="Talok gère les paiements entre vos locataires et vous. Il faut juste savoir comment collecter et où vous reverser."
      tips={[
        "Le prélèvement automatique est le plus fiable : le loyer est prélevé sans action du locataire.",
        "Tout est modifiable plus tard dans vos paramètres.",
        "Vos coordonnées bancaires sont chiffrées et sécurisées.",
      ]}
      embedded
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Comment le locataire vous paie */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Comment vos locataires vous paient</h3>
          </div>

          <div className="space-y-2">
            <Label>Mode de paiement principal *</Label>
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
                {Object.entries(PAYMENT_LABELS).map(([key, { label, desc }]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <span>{label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{desc}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.encaissement_prefere === "sepa_sdd" && (
              <p className="text-xs text-green-600 font-medium">
                Recommandé — réduit les impayés et les oublis
              </p>
            )}
          </div>
        </div>

        {/* Section 2: Votre compte bancaire */}
        <div className="space-y-4 border-t border-border pt-6">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Votre compte bancaire</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Le compte sur lequel Talok vous reverse les loyers encaissés.
          </p>

          <div className="space-y-2">
            <Label htmlFor="payout_iban">IBAN *</Label>
            <Input
              id="payout_iban"
              value={formData.payout_iban}
              onChange={(e) => setFormData({ ...formData, payout_iban: e.target.value.toUpperCase().replace(/\s/g, "") })}
              placeholder="FR76 1234 5678 9012 3456 7890 123"
              required
              disabled={loading}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">Vous le trouverez sur votre RIB ou dans votre espace bancaire en ligne.</p>
          </div>

          <div className="space-y-2">
            <Label>Quand recevoir vos fonds ? *</Label>
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
                <SelectItem value="immediat">Dès réception du paiement</SelectItem>
                <SelectItem value="hebdo">Chaque semaine</SelectItem>
                <SelectItem value="mensuel">Une fois par mois</SelectItem>
                <SelectItem value="seuil">Quand un montant minimum est atteint</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.payout_frequence === "mensuel" && (
            <div className="space-y-2">
              <Label htmlFor="payout_jour">Quel jour du mois ?</Label>
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
          )}

          {formData.payout_frequence === "seuil" && (
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
          )}
        </div>

        {/* Section 3: Options avancées (masquées par défaut) */}
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAdvanced && "rotate-180")} />
            Options avancées
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-6 rounded-xl border border-border bg-muted/30 p-4">
              {formData.encaissement_prefere === "sepa_sdd" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type de mandat</Label>
                    <Select
                      value={formData.sepa_mandat_type}
                      onValueChange={(value: "core" | "b2b") => setFormData({ ...formData, sepa_mandat_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="core">Particuliers (par défaut)</SelectItem>
                        <SelectItem value="b2b">Entreprises</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sepa_rum">Référence de mandat existante</Label>
                    <Input
                      id="sepa_rum"
                      value={formData.sepa_rum}
                      onChange={(e) => setFormData({ ...formData, sepa_rum: e.target.value })}
                      placeholder="Uniquement si vous en avez déjà une"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Moyens de paiement alternatifs</Label>
                <p className="text-xs text-muted-foreground">
                  En plus du mode principal, proposez des alternatives à vos locataires.
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(PAYMENT_LABELS).map(([method, { label }]) => {
                    if (method === formData.encaissement_prefere) return null;
                    return (
                      <Button
                        key={method}
                        type="button"
                        size="sm"
                        variant={formData.encaissement_secondaires.includes(method) ? "default" : "outline"}
                        onClick={() => toggleSecondaryPayment(method)}
                      >
                        {label}
                        {formData.encaissement_secondaires.includes(method) && (
                          <CheckCircle2 className="ml-1.5 h-3.5 w-3.5" />
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rapidité des versements</Label>
                <Select
                  value={formData.payout_rail}
                  onValueChange={(value: "sct" | "sct_inst") => setFormData({ ...formData, payout_rail: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sct">Standard (1-2 jours ouvrés)</SelectItem>
                    <SelectItem value="sct_inst">Instantané (quelques secondes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
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

