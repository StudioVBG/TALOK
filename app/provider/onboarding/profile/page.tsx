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
import { providerProfileOnboardingSchema } from "@/lib/validations/onboarding";
import { Building2, Briefcase, Upload, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProviderProfileOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rcProFile, setRcProFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    type: "independant" as "entreprise" | "independant",
    raison_sociale: "",
    siren: "",
    siret: "",
    rc_pro_path: "",
  });

  useEffect(() => {
    // Charger le brouillon si disponible
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "provider") {
        setFormData((prev) => ({
          ...prev,
          ...(draft.data as any),
        }));
      }
    });
  }, []);

  const handleFileUpload = async (file: File) => {
    try {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non authentifié");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-rc-pro-${Date.now()}.${fileExt}`;
      const filePath = `provider-docs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setFormData((prev) => ({
        ...prev,
        rc_pro_path: filePath,
      }));

      toast({
        title: "Fichier uploadé",
        description: "Votre RC Pro a été uploadé avec succès.",
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
      const validated = providerProfileOnboardingSchema.parse({
        ...formData,
        rc_pro_path: formData.rc_pro_path || undefined,
      });

      // Récupérer le profil
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

      // Créer ou mettre à jour le profil prestataire
      // Note: Le schéma provider_profiles n'a pas tous ces champs, on les stocke dans le brouillon pour l'instant
      // TODO: Ajouter ces champs au schéma provider_profiles si nécessaire

      // Sauvegarder le brouillon
      await onboardingService.saveDraft("provider_profile", validated, "provider");
      await onboardingService.markStepCompleted("provider_profile", "provider");

      toast({
        title: "Profil enregistré",
        description: "Vos informations ont été sauvegardées.",
      });

      // Rediriger vers les services
      router.push("/provider/onboarding/services");
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
            <Briefcase className="w-6 h-6 text-primary" />
            <CardTitle>Votre profil professionnel</CardTitle>
          </div>
          <CardDescription>
            Indiquez si vous êtes une entreprise ou un indépendant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label>Type de prestataire *</Label>
              <div className="grid gap-4 md:grid-cols-2">
                <Card
                  className={`cursor-pointer transition-all ${
                    formData.type === "independant"
                      ? "border-primary ring-2 ring-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setFormData({ ...formData, type: "independant" })}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-3">
                      <Briefcase className="w-6 h-6 text-primary" />
                      <div>
                        <h3 className="font-semibold">Indépendant</h3>
                        <p className="text-sm text-muted-foreground">
                          Auto-entrepreneur, artisan
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={`cursor-pointer transition-all ${
                    formData.type === "entreprise"
                      ? "border-primary ring-2 ring-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setFormData({ ...formData, type: "entreprise" })}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center space-x-3">
                      <Building2 className="w-6 h-6 text-primary" />
                      <div>
                        <h3 className="font-semibold">Entreprise</h3>
                        <p className="text-sm text-muted-foreground">
                          SARL, SAS, etc.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="raison_sociale">Raison sociale *</Label>
              <Input
                id="raison_sociale"
                value={formData.raison_sociale}
                onChange={(e) => setFormData({ ...formData, raison_sociale: e.target.value })}
                required
                disabled={loading}
                placeholder="Ma société"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="siren">SIREN (9 chiffres)</Label>
                <Input
                  id="siren"
                  value={formData.siren}
                  onChange={(e) => setFormData({ ...formData, siren: e.target.value.replace(/\D/g, "").slice(0, 9) })}
                  disabled={loading}
                  placeholder="123456789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="siret">SIRET (14 chiffres)</Label>
                <Input
                  id="siret"
                  value={formData.siret}
                  onChange={(e) => setFormData({ ...formData, siret: e.target.value.replace(/\D/g, "").slice(0, 14) })}
                  disabled={loading}
                  placeholder="12345678901234"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rc_pro">RC Pro (Responsabilité Civile Professionnelle)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="rc_pro"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setRcProFile(file);
                      handleFileUpload(file);
                    }
                  }}
                  disabled={loading}
                  className="flex-1"
                />
                {rcProFile && (
                  <span className="text-sm text-muted-foreground">
                    {rcProFile.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Upload de votre attestation RC Pro (PDF, JPG, PNG)
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

