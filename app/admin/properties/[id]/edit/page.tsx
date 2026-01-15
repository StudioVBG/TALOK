"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Building2,
  Save,
  Loader2,
} from "lucide-react";

interface PropertyFormData {
  type: string;
  adresse_complete: string;
  ville: string;
  code_postal: string;
  surface: number;
  nb_pieces: number;
  nb_chambres?: number;
  nb_salles_de_bain?: number;
  etage?: number;
  description?: string;
}

const propertyTypes = [
  { value: "appartement", label: "Appartement" },
  { value: "maison", label: "Maison" },
  { value: "studio", label: "Studio" },
  { value: "colocation", label: "Colocation" },
  { value: "commercial", label: "Local commercial" },
  { value: "parking", label: "Parking" },
];

export default function AdminPropertyEditPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const propertyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<PropertyFormData>({
    type: "appartement",
    adresse_complete: "",
    ville: "",
    code_postal: "",
    surface: 0,
    nb_pieces: 1,
  });

  useEffect(() => {
    async function fetchProperty() {
      try {
        const response = await fetch(`/api/admin/properties/${propertyId}`);
        if (response.ok) {
          const data = await response.json();
          const property = data.property;
          setFormData({
            type: property.type || "appartement",
            adresse_complete: property.adresse_complete || "",
            ville: property.ville || "",
            code_postal: property.code_postal || "",
            surface: property.surface || 0,
            nb_pieces: property.nb_pieces || 1,
            nb_chambres: property.nb_chambres,
            nb_salles_de_bain: property.nb_salles_de_bain,
            etage: property.etage,
            description: property.description,
          });
        } else {
          toast({
            title: "Erreur",
            description: "Impossible de charger la propriété",
            variant: "destructive",
          });
          router.push("/admin/properties");
        }
      } catch (error) {
        console.error("Erreur chargement propriété:", error);
        toast({
          title: "Erreur",
          description: "Erreur lors du chargement",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    if (propertyId) fetchProperty();
  }, [propertyId, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: "Succès",
          description: "Propriété mise à jour avec succès",
        });
        router.push(`/admin/properties/${propertyId}`);
      } else {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la mise à jour");
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof PropertyFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6"
    >
      <div className="w-full max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href={`/admin/properties/${propertyId}`}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux détails
          </Link>

          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Modifier la propriété</h1>
              <p className="text-muted-foreground">
                Mise à jour des informations du bien
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="type">Type de bien</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => handleChange("type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Adresse */}
              <div className="space-y-2">
                <Label htmlFor="adresse_complete">Adresse complète</Label>
                <Input
                  id="adresse_complete"
                  value={formData.adresse_complete}
                  onChange={(e) =>
                    handleChange("adresse_complete", e.target.value)
                  }
                  placeholder="123 rue de la République"
                  required
                />
              </div>

              {/* Ville & Code postal */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ville">Ville</Label>
                  <Input
                    id="ville"
                    value={formData.ville}
                    onChange={(e) => handleChange("ville", e.target.value)}
                    placeholder="Paris"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code_postal">Code postal</Label>
                  <Input
                    id="code_postal"
                    value={formData.code_postal}
                    onChange={(e) =>
                      handleChange("code_postal", e.target.value)
                    }
                    placeholder="75001"
                    required
                  />
                </div>
              </div>

              {/* Surface & Pièces */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="surface">Surface (m²)</Label>
                  <Input
                    id="surface"
                    type="number"
                    min="1"
                    value={formData.surface}
                    onChange={(e) =>
                      handleChange("surface", parseFloat(e.target.value) || 0)
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nb_pieces">Nombre de pièces</Label>
                  <Input
                    id="nb_pieces"
                    type="number"
                    min="1"
                    value={formData.nb_pieces}
                    onChange={(e) =>
                      handleChange("nb_pieces", parseInt(e.target.value) || 1)
                    }
                    required
                  />
                </div>
              </div>

              {/* Chambres & SDB */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="nb_chambres">Chambres</Label>
                  <Input
                    id="nb_chambres"
                    type="number"
                    min="0"
                    value={formData.nb_chambres || ""}
                    onChange={(e) =>
                      handleChange(
                        "nb_chambres",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nb_salles_de_bain">Salles de bain</Label>
                  <Input
                    id="nb_salles_de_bain"
                    type="number"
                    min="0"
                    value={formData.nb_salles_de_bain || ""}
                    onChange={(e) =>
                      handleChange(
                        "nb_salles_de_bain",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="etage">Étage</Label>
                  <Input
                    id="etage"
                    type="number"
                    min="0"
                    value={formData.etage || ""}
                    onChange={(e) =>
                      handleChange(
                        "etage",
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (optionnelle)</Label>
                <Textarea
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Description du bien..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/admin/properties/${propertyId}`)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

