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
import { firstPropertySchema } from "@/lib/validations/onboarding";
import { propertiesService } from "@/features/properties/services/properties.service";
import { Home, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function FirstPropertyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    adresse_complete: "",
    code_postal: "",
    ville: "",
    departement: "",
    type: "appartement" as "appartement" | "maison" | "immeuble",
    surface: "",
    nb_pieces: "",
    is_colocation: false,
    unit_nom: "",
    unit_capacite_max: "1",
    unit_surface: "",
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
      const validated = firstPropertySchema.parse({
        ...formData,
        surface: parseFloat(formData.surface),
        nb_pieces: parseInt(formData.nb_pieces),
        unit_capacite_max: formData.is_colocation ? parseInt(formData.unit_capacite_max) : undefined,
        unit_surface: formData.is_colocation && formData.unit_surface ? parseFloat(formData.unit_surface) : undefined,
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

      // Créer la propriété (owner_id est récupéré automatiquement par le service)
      const property = await propertiesService.createProperty({
        type: validated.type === "immeuble" ? "appartement" : validated.type,
        adresse_complete: validated.adresse_complete,
        code_postal: validated.code_postal,
        ville: validated.ville,
        departement: validated.departement,
        surface: validated.surface,
        nb_pieces: validated.nb_pieces,
        etage: null,
        ascenseur: false,
        energie: null,
        ges: null,
      } as any);

      // Si colocation, créer l'unité
      if (validated.is_colocation && validated.unit_nom) {
        const propertyData = property as any;
        const { error: unitError } = await (supabase.from("units") as any).insert({
          property_id: propertyData.id as any,
          nom: validated.unit_nom,
          capacite_max: validated.unit_capacite_max || 1,
          surface: validated.unit_surface || null,
        } as any);

        if (unitError) throw unitError;
      }

      // Marquer l'étape comme complétée
      const propertyData = property as any;
      await onboardingService.saveDraft("final_review", { property_id: propertyData.id }, "owner");
      await onboardingService.markStepCompleted("first_property", "owner");

      toast({
        title: "Logement créé",
        description: "Votre premier logement a été ajouté avec succès !",
      });

      // Rediriger vers la revue finale
      router.push("/owner/onboarding/review");
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
            <Home className="w-6 h-6 text-primary" />
            <CardTitle>Ajouter votre premier logement</CardTitle>
          </div>
          <CardDescription>
            Commencez par ajouter un logement à votre portefeuille
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="adresse_complete">Adresse complète *</Label>
              <Input
                id="adresse_complete"
                value={formData.adresse_complete}
                onChange={(e) => setFormData({ ...formData, adresse_complete: e.target.value })}
                required
                disabled={loading}
                placeholder="123 Rue de la République"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="code_postal">Code postal *</Label>
                <Input
                  id="code_postal"
                  value={formData.code_postal}
                  onChange={(e) => setFormData({ ...formData, code_postal: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                  required
                  disabled={loading}
                  placeholder="75001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ville">Ville *</Label>
                <Input
                  id="ville"
                  value={formData.ville}
                  onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                  required
                  disabled={loading}
                  placeholder="Paris"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="departement">Département *</Label>
                <Input
                  id="departement"
                  value={formData.departement}
                  onChange={(e) => setFormData({ ...formData, departement: e.target.value.toUpperCase().slice(0, 2) })}
                  required
                  disabled={loading}
                  placeholder="75"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Type de logement *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appartement">Appartement</SelectItem>
                    <SelectItem value="maison">Maison</SelectItem>
                    <SelectItem value="immeuble">Immeuble</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nb_pieces">Nombre de pièces *</Label>
                <Input
                  id="nb_pieces"
                  type="number"
                  min="1"
                  value={formData.nb_pieces}
                  onChange={(e) => setFormData({ ...formData, nb_pieces: e.target.value })}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="surface">Surface (m²) *</Label>
              <Input
                id="surface"
                type="number"
                min="0"
                step="0.01"
                value={formData.surface}
                onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                required
                disabled={loading}
                placeholder="50"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_colocation"
                checked={formData.is_colocation}
                onChange={(e) => setFormData({ ...formData, is_colocation: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_colocation" className="text-sm font-normal cursor-pointer">
                C'est une colocation
              </Label>
            </div>

            {formData.is_colocation && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-semibold">Informations de l'unité</h4>
                <div className="space-y-2">
                  <Label htmlFor="unit_nom">Nom de l'unité (ex: Chambre 1) *</Label>
                  <Input
                    id="unit_nom"
                    value={formData.unit_nom}
                    onChange={(e) => setFormData({ ...formData, unit_nom: e.target.value })}
                    required={formData.is_colocation}
                    disabled={loading}
                    placeholder="Chambre 1"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="unit_capacite_max">Capacité max (1-10) *</Label>
                    <Input
                      id="unit_capacite_max"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.unit_capacite_max}
                      onChange={(e) => setFormData({ ...formData, unit_capacite_max: e.target.value })}
                      required={formData.is_colocation}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit_surface">Surface de l'unité (m²)</Label>
                    <Input
                      id="unit_surface"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.unit_surface}
                      onChange={(e) => setFormData({ ...formData, unit_surface: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "Création..."
              ) : (
                <>
                  Créer le logement
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

