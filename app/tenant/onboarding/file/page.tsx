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
import { tenantFileSchema } from "@/lib/validations/onboarding";
import { FileText, Upload, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SITUATIONS_PRO = [
  "Salarié",
  "Indépendant",
  "Retraité",
  "Étudiant",
  "Sans emploi",
  "Autre",
];

export default function TenantFilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    situation_pro: "",
    revenus_mensuels: "",
    nb_adultes: "1",
    nb_enfants: "0",
    garant_required: false,
  });

  useEffect(() => {
    // Charger le brouillon si disponible
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "tenant") {
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
      const validated = tenantFileSchema.parse({
        situation_pro: formData.situation_pro || null,
        revenus_mensuels: formData.revenus_mensuels ? parseFloat(formData.revenus_mensuels) : null,
        nb_adultes: parseInt(formData.nb_adultes),
        nb_enfants: parseInt(formData.nb_enfants),
        garant_required: formData.garant_required,
      });

      // Sauvegarder le profil locataire
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

      const profileData = profile as any;

      // Créer ou mettre à jour le profil locataire
      const { error: profileError } = await (supabase.from("tenant_profiles") as any).upsert(
        {
          profile_id: profileData.id as any,
          situation_pro: validated.situation_pro,
          revenus_mensuels: validated.revenus_mensuels,
          nb_adultes: validated.nb_adultes,
          nb_enfants: validated.nb_enfants,
          garant_required: validated.garant_required,
        } as any,
        {
          onConflict: "profile_id",
        }
      );

      if (profileError) throw profileError;

      // Sauvegarder le brouillon
      await onboardingService.saveDraft("tenant_file", validated, "tenant");
      await onboardingService.markStepCompleted("tenant_file", "tenant");

      toast({
        title: "Dossier enregistré",
        description: "Vos informations ont été sauvegardées.",
      });

      // Rediriger vers la vérification d'identité
      router.push("/tenant/onboarding/identity");
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
            <FileText className="w-6 h-6 text-primary" />
            <CardTitle>Dossier locataire</CardTitle>
          </div>
          <CardDescription>
            Complétez votre dossier locataire
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="situation_pro">Situation professionnelle</Label>
              <Select
                value={formData.situation_pro}
                onValueChange={(value) => setFormData({ ...formData, situation_pro: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez votre situation" />
                </SelectTrigger>
                <SelectContent>
                  {SITUATIONS_PRO.map((situation) => (
                    <SelectItem key={situation} value={situation}>
                      {situation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="revenus_mensuels">Revenus mensuels (€)</Label>
              <Input
                id="revenus_mensuels"
                type="number"
                min="0"
                step="0.01"
                value={formData.revenus_mensuels}
                onChange={(e) => setFormData({ ...formData, revenus_mensuels: e.target.value })}
                disabled={loading}
                placeholder="2000"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nb_adultes">Nombre d&apos;adultes *</Label>
                <Input
                  id="nb_adultes"
                  type="number"
                  min="1"
                  value={formData.nb_adultes}
                  onChange={(e) => setFormData({ ...formData, nb_adultes: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nb_enfants">Nombre d&apos;enfants</Label>
                <Input
                  id="nb_enfants"
                  type="number"
                  min="0"
                  value={formData.nb_enfants}
                  onChange={(e) => setFormData({ ...formData, nb_enfants: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="garant_required"
                checked={formData.garant_required}
                onChange={(e) => setFormData({ ...formData, garant_required: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="garant_required" className="text-sm font-normal cursor-pointer">
                Un garant est requis
              </Label>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">
                <strong>Note :</strong> Vous pourrez uploader vos pièces justificatives (pièce d&apos;identité, justificatifs de revenus, Visale) dans la prochaine étape.
              </p>
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

