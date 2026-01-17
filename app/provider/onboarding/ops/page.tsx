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
import { providerOpsSchema } from "@/lib/validations/onboarding";
import { Clock, Calendar, CreditCard, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export default function ProviderOpsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [joursDisponibles, setJoursDisponibles] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    horaires_debut: "09:00",
    horaires_fin: "18:00",
    sla_souhaite: "48h" as "24h" | "48h" | "72h" | "semaine",
    payout_iban: "",
  });

  useEffect(() => {
    // Charger le brouillon si disponible
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "provider") {
        const data = draft.data as any;
        if (data.jours_disponibles) setJoursDisponibles(data.jours_disponibles);
        setFormData((prev) => ({
          ...prev,
          ...data,
        }));
      }
    });
  }, []);

  const toggleJour = (jour: string) => {
    setJoursDisponibles((prev) =>
      prev.includes(jour)
        ? prev.filter((j) => j !== jour)
        : [...prev, jour]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = providerOpsSchema.parse({
        jours_disponibles: joursDisponibles,
        horaires_debut: formData.horaires_debut,
        horaires_fin: formData.horaires_fin,
        sla_souhaite: formData.sla_souhaite,
        payout_iban: formData.payout_iban,
        kyc_complete: false, // À compléter plus tard
      });

      // Sauvegarder les préférences
      await onboardingService.saveDraft("provider_ops", validated, "provider");
      await onboardingService.markStepCompleted("provider_ops", "provider");

      toast({
        title: "Préférences enregistrées",
        description: "Vos disponibilités et préférences ont été sauvegardées.",
      });

      // Rediriger vers la validation
      router.push("/provider/onboarding/review");
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

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            <CardTitle>Disponibilités & paiements</CardTitle>
          </div>
          <CardDescription>
            Configurez vos disponibilités et vos préférences de paiement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label>Jours disponibles *</Label>
              <div className="flex flex-wrap gap-2">
                {JOURS.map((jour) => (
                  <Button
                    key={jour}
                    type="button"
                    variant={joursDisponibles.includes(jour) ? "default" : "outline"}
                    onClick={() => toggleJour(jour)}
                  >
                    {jour.charAt(0).toUpperCase() + jour.slice(1)}
                    {joursDisponibles.includes(jour) && (
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    )}
                  </Button>
                ))}
              </div>
              {joursDisponibles.length === 0 && (
                <p className="text-sm text-destructive">Veuillez sélectionner au moins un jour</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="horaires_debut">Heure de début *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="horaires_debut"
                    type="time"
                    value={formData.horaires_debut}
                    onChange={(e) => setFormData({ ...formData, horaires_debut: e.target.value })}
                    required
                    disabled={loading}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="horaires_fin">Heure de fin *</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="horaires_fin"
                    type="time"
                    value={formData.horaires_fin}
                    onChange={(e) => setFormData({ ...formData, horaires_fin: e.target.value })}
                    required
                    disabled={loading}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sla_souhaite">SLA souhaité *</Label>
              <Select
                value={formData.sla_souhaite}
                onValueChange={(value: any) => setFormData({ ...formData, sla_souhaite: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">24 heures</SelectItem>
                  <SelectItem value="48h">48 heures</SelectItem>
                  <SelectItem value="72h">72 heures</SelectItem>
                  <SelectItem value="semaine">1 semaine</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 border-t pt-6">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <Label htmlFor="payout_iban">IBAN pour les versements *</Label>
              </div>
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

            <Button
              type="submit"
              className="w-full"
              disabled={loading || joursDisponibles.length === 0}
            >
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

