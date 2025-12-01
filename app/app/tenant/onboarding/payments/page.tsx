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
import { tenantPaymentSchema } from "@/lib/validations/onboarding";
import { CreditCard, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TenantPaymentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isColocation, setIsColocation] = useState(false);

  const [formData, setFormData] = useState({
    moyen_encaissement: "sepa_sdd" as "sepa_sdd" | "virement_sct" | "virement_inst" | "pay_by_bank" | "carte_wallet",
    sepa_mandat_accepte: false,
    part_percentage: "",
    part_montant: "",
  });

  useEffect(() => {
    // Charger le brouillon si disponible
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "tenant") {
        const data = draft.data as any;
        setFormData((prev) => ({
          ...prev,
          ...data,
        }));
        // Vérifier si c'est une colocation
        if (data.role === "colocataire") {
          setIsColocation(true);
        }
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = tenantPaymentSchema.parse({
        moyen_encaissement: formData.moyen_encaissement,
        sepa_mandat_accepte: formData.moyen_encaissement === "sepa_sdd" ? formData.sepa_mandat_accepte : undefined,
        part_percentage: isColocation && formData.part_percentage ? parseFloat(formData.part_percentage) : undefined,
        part_montant: isColocation && formData.part_montant ? parseFloat(formData.part_montant) : undefined,
      });

      // Sauvegarder les préférences
      await onboardingService.saveDraft("tenant_payment", validated, "tenant");
      await onboardingService.markStepCompleted("tenant_payment", "tenant");

      toast({
        title: "Préférences enregistrées",
        description: "Vos préférences de paiement ont été sauvegardées.",
      });

      // Rediriger vers la signature du bail
      router.push("/app/tenant/onboarding/sign");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
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
            <CreditCard className="w-6 h-6 text-primary" />
            <CardTitle>Paiement & parts</CardTitle>
          </div>
          <CardDescription>
            Configurez votre moyen de paiement{isColocation && " et votre part"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Moyen d&apos;encaissement préféré *</Label>
              <Select
                value={formData.moyen_encaissement}
                onValueChange={(value: any) => setFormData({ ...formData, moyen_encaissement: value })}
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

            {formData.moyen_encaissement === "sepa_sdd" && (
              <div className="flex items-center space-x-2 p-4 border rounded-lg">
                <input
                  type="checkbox"
                  id="sepa_mandat"
                  checked={formData.sepa_mandat_accepte}
                  onChange={(e) => setFormData({ ...formData, sepa_mandat_accepte: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="sepa_mandat" className="text-sm font-normal cursor-pointer">
                  J&apos;accepte le mandat de prélèvement SEPA
                </Label>
              </div>
            )}

            {isColocation && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-semibold">Part de colocation</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="part_percentage">Part en pourcentage (%)</Label>
                    <Input
                      id="part_percentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.part_percentage}
                      onChange={(e) => setFormData({ ...formData, part_percentage: e.target.value })}
                      disabled={loading}
                      placeholder="50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="part_montant">Part en montant (€)</Label>
                    <Input
                      id="part_montant"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.part_montant}
                      onChange={(e) => setFormData({ ...formData, part_montant: e.target.value })}
                      disabled={loading}
                      placeholder="500"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Indiquez soit le pourcentage, soit le montant. La somme des parts doit être égale à 100%.
                </p>
              </div>
            )}

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

