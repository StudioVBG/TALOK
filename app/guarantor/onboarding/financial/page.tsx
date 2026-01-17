"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { guarantorFinancialSchema } from "@/lib/validations/onboarding";
import { CreditCard, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GuarantorFinancialPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    revenus_mensuels: "",
    type_garantie: "personnelle" as "personnelle" | "visale" | "depot_bancaire",
    justificatif_revenus_path: "",
    visale_path: "",
    depot_bancaire_montant: "",
  });

  useEffect(() => {
    // Charger le brouillon si disponible
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && (draft.role as any) === "guarantor") {
        setFormData((prev) => ({
          ...prev,
          ...(draft.data as any),
        }));
      }
    });
  }, []);

  const handleFileUpload = async (file: File, type: "revenus" | "visale") => {
    try {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non authentifié");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${type}-${Date.now()}.${fileExt}`;
      const filePath = `guarantor-docs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      if (type === "revenus") {
        setFormData((prev) => ({
          ...prev,
          justificatif_revenus_path: filePath,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          visale_path: filePath,
        }));
      }

      toast({
        title: "Fichier uploadé",
        description: "Votre document a été uploadé avec succès.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de l'upload du fichier.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = guarantorFinancialSchema.parse({
        revenus_mensuels: parseFloat(formData.revenus_mensuels),
        type_garantie: formData.type_garantie,
        justificatif_revenus_path: formData.justificatif_revenus_path || undefined,
        visale_path: formData.type_garantie === "visale" ? formData.visale_path || undefined : undefined,
        depot_bancaire_montant: formData.type_garantie === "depot_bancaire" ? parseFloat(formData.depot_bancaire_montant) : undefined,
      });

      // Sauvegarder le brouillon
      await onboardingService.saveDraft("guarantor_financial", validated, "guarantor" as any);
      await onboardingService.markStepCompleted("guarantor_financial", "guarantor" as any);

      toast({
        title: "Informations enregistrées",
        description: "Vos informations financières ont été sauvegardées.",
      });

      // Rediriger vers la signature
      router.push("/guarantor/onboarding/sign");
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
            <CreditCard className="w-6 h-6 text-primary" />
            <CardTitle>Capacité financière</CardTitle>
          </div>
          <CardDescription>
            Renseignez vos informations financières en tant que garant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="revenus_mensuels">Revenus mensuels (€) *</Label>
              <Input
                id="revenus_mensuels"
                type="number"
                min="0"
                step="0.01"
                value={formData.revenus_mensuels}
                onChange={(e) => setFormData({ ...formData, revenus_mensuels: e.target.value })}
                required
                disabled={loading}
                placeholder="3000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type_garantie">Type de garantie *</Label>
              <Select
                value={formData.type_garantie}
                onValueChange={(value: any) => setFormData({ ...formData, type_garantie: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personnelle">Garantie personnelle</SelectItem>
                  <SelectItem value="visale">Visale</SelectItem>
                  <SelectItem value="depot_bancaire">Dépôt bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="justificatif_revenus">Justificatif de revenus</Label>
              <Input
                id="justificatif_revenus"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleFileUpload(file, "revenus");
                  }
                }}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Upload de votre justificatif de revenus (PDF, JPG, PNG)
              </p>
            </div>

            {formData.type_garantie === "visale" && (
              <div className="space-y-2">
                <Label htmlFor="visale">Attestation Visale</Label>
                <Input
                  id="visale"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file, "visale");
                    }
                  }}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Upload de votre attestation Visale (PDF, JPG, PNG)
                </p>
              </div>
            )}

            {formData.type_garantie === "depot_bancaire" && (
              <div className="space-y-2">
                <Label htmlFor="depot_bancaire_montant">Montant du dépôt bancaire (€) *</Label>
                <Input
                  id="depot_bancaire_montant"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.depot_bancaire_montant}
                  onChange={(e) => setFormData({ ...formData, depot_bancaire_montant: e.target.value })}
                  required={formData.type_garantie === "depot_bancaire"}
                  disabled={loading}
                  placeholder="5000"
                />
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

