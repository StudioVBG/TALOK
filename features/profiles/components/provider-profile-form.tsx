"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { providerProfilesService } from "../services/provider-profiles.service";
import type { CreateProviderProfileData } from "../services/provider-profiles.service";
import type { ProviderProfile } from "@/lib/types";
import { useProfile } from "@/lib/hooks/use-profile";

interface ProviderProfileFormProps {
  onSuccess?: () => void;
}

const SERVICE_TYPES = [
  "Plomberie",
  "Électricité",
  "Chauffage",
  "Menuiserie",
  "Peinture",
  "Maçonnerie",
  "Élagage",
  "Jardinage",
  "Nettoyage",
  "Serrurerie",
  "Vitrerie",
  "Autre",
];

export function ProviderProfileForm({ onSuccess }: ProviderProfileFormProps) {
  const { profile, providerProfile } = useProfile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateProviderProfileData>({
    type_services: [],
    certifications: null,
    zones_intervention: null,
  });

  useEffect(() => {
    if (providerProfile) {
      setFormData({
        type_services: providerProfile.type_services || [],
        certifications: providerProfile.certifications,
        zones_intervention: providerProfile.zones_intervention,
      });
    }
  }, [providerProfile]);

  const toggleService = (service: string) => {
    setFormData((prev) => ({
      ...prev,
      type_services: prev.type_services.includes(service)
        ? prev.type_services.filter((s) => s !== service)
        : [...prev.type_services, service],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (formData.type_services.length === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner au moins un type de service.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      await providerProfilesService.createOrUpdateProviderProfile(profile.id, formData);
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été enregistrées.",
      });
      onSuccess?.();
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
    <Card>
      <CardHeader>
        <CardTitle>Profil prestataire</CardTitle>
        <CardDescription>Complétez vos informations de prestataire</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Types de services *</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {SERVICE_TYPES.map((service) => (
                <div key={service} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`service-${service}`}
                    checked={formData.type_services.includes(service)}
                    onChange={() => toggleService(service)}
                    disabled={loading}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor={`service-${service}`} className="cursor-pointer text-sm">
                    {service}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="certifications">Certifications (optionnel)</Label>
            <textarea
              id="certifications"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.certifications || ""}
              onChange={(e) =>
                setFormData({ ...formData, certifications: e.target.value || null })
              }
              placeholder="Listez vos certifications, qualifications..."
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zones_intervention">Zones d'intervention (optionnel)</Label>
            <Input
              id="zones_intervention"
              value={formData.zones_intervention || ""}
              onChange={(e) =>
                setFormData({ ...formData, zones_intervention: e.target.value || null })
              }
              placeholder="Ex: Paris, Île-de-France, France entière..."
              disabled={loading}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

