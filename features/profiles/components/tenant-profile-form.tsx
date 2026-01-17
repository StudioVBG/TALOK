"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { tenantProfilesService } from "../services/tenant-profiles.service";
import type { CreateTenantProfileData } from "../services/tenant-profiles.service";
import type { TenantProfile } from "@/lib/types";
import { useProfile } from "@/lib/hooks/use-profile";

interface TenantProfileFormProps {
  onSuccess?: () => void;
}

export function TenantProfileForm({ onSuccess }: TenantProfileFormProps) {
  const { profile, tenantProfile } = useProfile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateTenantProfileData>({
    situation_pro: null,
    revenus_mensuels: null,
    nb_adultes: 1,
    nb_enfants: 0,
    garant_required: false,
  });

  useEffect(() => {
    if (tenantProfile) {
      setFormData({
        situation_pro: tenantProfile.situation_pro,
        revenus_mensuels: tenantProfile.revenus_mensuels,
        nb_adultes: tenantProfile.nb_adultes,
        nb_enfants: tenantProfile.nb_enfants,
        garant_required: tenantProfile.garant_required,
      });
    }
  }, [tenantProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);

    try {
      await tenantProfilesService.createOrUpdateTenantProfile(profile.id, formData);
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
        <CardTitle>Profil locataire</CardTitle>
        <CardDescription>Complétez votre dossier locatif</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="situation_pro">Situation professionnelle (optionnel)</Label>
            <Input
              id="situation_pro"
              value={formData.situation_pro || ""}
              onChange={(e) =>
                setFormData({ ...formData, situation_pro: e.target.value || null })
              }
              placeholder="Ex: Salarié, Indépendant, Retraité..."
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="revenus_mensuels">Revenus mensuels (€) (optionnel)</Label>
            <Input
              id="revenus_mensuels"
              type="number"
              min="0"
              step="0.01"
              value={formData.revenus_mensuels || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  revenus_mensuels: e.target.value ? parseFloat(e.target.value) : null,
                })
              }
              disabled={loading}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nb_adultes">Nombre d'adultes</Label>
              <Input
                id="nb_adultes"
                type="number"
                min="1"
                value={formData.nb_adultes}
                onChange={(e) =>
                  setFormData({ ...formData, nb_adultes: parseInt(e.target.value) || 1 })
                }
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nb_enfants">Nombre d'enfants</Label>
              <Input
                id="nb_enfants"
                type="number"
                min="0"
                value={formData.nb_enfants}
                onChange={(e) =>
                  setFormData({ ...formData, nb_enfants: parseInt(e.target.value) || 0 })
                }
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="garant_required"
              checked={formData.garant_required}
              onChange={(e) =>
                setFormData({ ...formData, garant_required: e.target.checked })
              }
              disabled={loading}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="garant_required" className="cursor-pointer">
              Garant requis
            </Label>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

