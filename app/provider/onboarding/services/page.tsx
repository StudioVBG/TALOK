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
import { providerServicesSchema } from "@/lib/validations/onboarding";
import { Wrench, MapPin, ArrowRight, X, CheckCircle2 } from "lucide-react";

const SPECIALITES = [
  "Plomberie",
  "Électricité",
  "Chauffage",
  "Menuiserie",
  "Peinture",
  "Carrelage",
  "Élagage",
  "Jardinage",
  "Ménage",
  "Vitrerie",
  "Serrurerie",
  "Autre",
];

export default function ProviderServicesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedSpecialites, setSelectedSpecialites] = useState<string[]>([]);
  const [zonesCp, setZonesCp] = useState<string[]>([]);
  const [newCp, setNewCp] = useState("");

  const [formData, setFormData] = useState({
    zones_ville: [] as string[],
    zones_rayon: "",
  });

  useEffect(() => {
    // Charger le brouillon si disponible
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "provider") {
        const data = draft.data as any;
        if (data.specialites) setSelectedSpecialites(data.specialites);
        if (data.zones_cp) setZonesCp(data.zones_cp);
        setFormData((prev) => ({
          ...prev,
          zones_ville: data.zones_ville || [],
          zones_rayon: data.zones_rayon || "",
        }));
      }
    });
  }, []);

  const toggleSpecialite = (specialite: string) => {
    setSelectedSpecialites((prev) =>
      prev.includes(specialite)
        ? prev.filter((s) => s !== specialite)
        : [...prev, specialite]
    );
  };

  const addZoneCp = () => {
    if (newCp && /^[0-9]{5}$/.test(newCp) && !zonesCp.includes(newCp)) {
      setZonesCp([...zonesCp, newCp]);
      setNewCp("");
    }
  };

  const removeZoneCp = (cp: string) => {
    setZonesCp(zonesCp.filter((z) => z !== cp));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = providerServicesSchema.parse({
        specialites: selectedSpecialites,
        zones_cp: zonesCp.length > 0 ? zonesCp : undefined,
        zones_ville: formData.zones_ville.length > 0 ? formData.zones_ville : undefined,
        zones_rayon: formData.zones_rayon ? parseFloat(formData.zones_rayon) : undefined,
      });

      // Sauvegarder dans le profil prestataire
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

      // Mettre à jour le profil prestataire
      // S'assurer que le statut est "pending" si le profil n'existe pas encore
      const { error: profileError } = await (supabase
        .from("provider_profiles") as any)
        .upsert(
          {
            profile_id: profileData.id as any,
            type_services: validated.specialites,
            zones_intervention: validated.zones_cp?.join(", ") || validated.zones_ville?.join(", ") || null,
            status: "pending", // S'assurer que le statut est "pending" lors de la création
          } as any,
          {
            onConflict: "profile_id",
          }
        );

      if (profileError) throw profileError;

      // Sauvegarder le brouillon
      await onboardingService.saveDraft("provider_services", validated, "provider");
      await onboardingService.markStepCompleted("provider_services", "provider");

      toast({
        title: "Services enregistrés",
        description: "Vos services et zones d'intervention ont été sauvegardés.",
      });

      // Rediriger vers les opérations
      router.push("/provider/onboarding/ops");
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
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" />
            <CardTitle>Services & zones d'intervention</CardTitle>
          </div>
          <CardDescription>
            Définissez vos spécialités et vos zones d'intervention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <Label>Spécialités *</Label>
              <div className="flex flex-wrap gap-2">
                {SPECIALITES.map((specialite) => (
                  <Button
                    key={specialite}
                    type="button"
                    variant={selectedSpecialites.includes(specialite) ? "default" : "outline"}
                    onClick={() => toggleSpecialite(specialite)}
                  >
                    {specialite}
                    {selectedSpecialites.includes(specialite) && (
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                    )}
                  </Button>
                ))}
              </div>
              {selectedSpecialites.length === 0 && (
                <p className="text-sm text-destructive">Veuillez sélectionner au moins une spécialité</p>
              )}
            </div>

            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                <Label>Zones d'intervention</Label>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Par code postal</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newCp}
                      onChange={(e) => setNewCp(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      placeholder="75001"
                      maxLength={5}
                      className="font-mono"
                    />
                    <Button type="button" onClick={addZoneCp} variant="outline">
                      Ajouter
                    </Button>
                  </div>
                  {zonesCp.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {zonesCp.map((cp) => (
                        <div
                          key={cp}
                          className="flex items-center gap-1 px-3 py-1 bg-muted rounded-full text-sm"
                        >
                          {cp}
                          <button
                            type="button"
                            onClick={() => removeZoneCp(cp)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zones_rayon">Rayon d'intervention (km)</Label>
                  <Input
                    id="zones_rayon"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.zones_rayon}
                    onChange={(e) => setFormData({ ...formData, zones_rayon: e.target.value })}
                    placeholder="50"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || selectedSpecialites.length === 0}
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

