"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, ArrowRight, Loader2 } from "lucide-react";

interface AgencyProfileData {
  nom_agence: string;
  siret: string;
  adresse: string;
  ville: string;
  code_postal: string;
  telephone: string;
  site_web: string;
}

const INITIAL_DATA: AgencyProfileData = {
  nom_agence: "",
  siret: "",
  adresse: "",
  ville: "",
  code_postal: "",
  telephone: "",
  site_web: "",
};

export default function AgencyProfileOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AgencyProfileData>(INITIAL_DATA);

  useEffect(() => {
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "agency") {
        setFormData((prev) => ({
          ...prev,
          ...(draft.data as Partial<AgencyProfileData>),
        }));
      }
    });
  }, []);

  const handleChange = (field: keyof AgencyProfileData, value: string) => {
    const next = { ...formData, [field]: value };
    setFormData(next);
    onboardingService.saveDraft("agency_profile", next, "agency");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.nom_agence.trim()) {
        toast({ title: "Nom de l'agence requis", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Validation SIRET : 14 chiffres exactement (si fourni)
      const cleanSiret = formData.siret.replace(/\s/g, "");
      if (cleanSiret && !/^\d{14}$/.test(cleanSiret)) {
        toast({
          title: "SIRET invalide",
          description: "Le SIRET doit comporter exactement 14 chiffres.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Validation code postal (si fourni)
      if (formData.code_postal && !/^\d{5}$/.test(formData.code_postal)) {
        toast({
          title: "Code postal invalide",
          description: "Le code postal doit comporter 5 chiffres.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      await apiClient.put("/me/agency-profile", {
        nom_agence: formData.nom_agence,
        siret: cleanSiret || null,
        adresse: formData.adresse || null,
        ville: formData.ville || null,
        code_postal: formData.code_postal || null,
        telephone: formData.telephone || null,
        site_web: formData.site_web || null,
      });

      await onboardingService.markStepCompleted("profile", "agency");

      toast({ title: "Profil agence enregistre" });
      router.push("/agency/onboarding/mandates");
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le profil. Veuillez reessayer.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Building className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Votre agence</CardTitle>
              <CardDescription>Renseignez les informations de votre agence immobiliere</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nom_agence">Nom de l&apos;agence *</Label>
              <Input
                id="nom_agence"
                value={formData.nom_agence}
                onChange={(e) => handleChange("nom_agence", e.target.value)}
                placeholder="Ex: Immobiliere du Centre"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siret">SIRET</Label>
              <Input
                id="siret"
                value={formData.siret}
                onChange={(e) => handleChange("siret", e.target.value)}
                placeholder="123 456 789 00012"
                maxLength={17}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adresse">Adresse</Label>
                <Input
                  id="adresse"
                  value={formData.adresse}
                  onChange={(e) => handleChange("adresse", e.target.value)}
                  placeholder="12 rue de la Paix"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ville">Ville</Label>
                <Input
                  id="ville"
                  value={formData.ville}
                  onChange={(e) => handleChange("ville", e.target.value)}
                  placeholder="Paris"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code_postal">Code postal</Label>
                <Input
                  id="code_postal"
                  value={formData.code_postal}
                  onChange={(e) => handleChange("code_postal", e.target.value)}
                  placeholder="75001"
                  maxLength={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephone">Telephone</Label>
                <Input
                  id="telephone"
                  value={formData.telephone}
                  onChange={(e) => handleChange("telephone", e.target.value)}
                  placeholder="01 23 45 67 89"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="site_web">Site web</Label>
              <Input
                id="site_web"
                value={formData.site_web}
                onChange={(e) => handleChange("site_web", e.target.value)}
                placeholder="https://www.mon-agence.fr"
                type="url"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Continuer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
