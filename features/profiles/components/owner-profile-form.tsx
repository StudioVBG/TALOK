"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ownerProfilesService } from "../services/owner-profiles.service";
import type { CreateOwnerProfileData } from "../services/owner-profiles.service";
import type { OwnerProfile, OwnerType } from "@/lib/types";
import { useProfile } from "@/lib/hooks/use-profile";

interface OwnerProfileFormProps {
  onSuccess?: () => void;
}

export function OwnerProfileForm({ onSuccess }: OwnerProfileFormProps) {
  const router = useRouter();
  const { profile, ownerProfile } = useProfile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateOwnerProfileData>({
    type: "particulier",
    siret: null,
    tva: null,
    iban: null,
    adresse_facturation: null,
    raison_sociale: null,
    adresse_siege: null,
    forme_juridique: null,
  });

  useEffect(() => {
    if (ownerProfile) {
      setFormData({
        type: ownerProfile.type,
        siret: ownerProfile.siret,
        tva: ownerProfile.tva,
        iban: ownerProfile.iban,
        adresse_facturation: ownerProfile.adresse_facturation,
        raison_sociale: ownerProfile.raison_sociale,
        adresse_siege: ownerProfile.adresse_siege,
        forme_juridique: ownerProfile.forme_juridique,
      });
    }
  }, [ownerProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);

    try {
      await ownerProfilesService.createOrUpdateOwnerProfile(profile.id, formData);
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été enregistrées.",
      });
      // Forcer le rechargement des données serveur (ex: complétion du profil sur le dashboard)
      router.refresh();
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
        <CardTitle>Profil propriétaire</CardTitle>
        <CardDescription>Complétez vos informations de propriétaire</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type de propriétaire</Label>
            <select
              id="type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as OwnerType })
              }
              required
              disabled={loading}
            >
              <option value="particulier">Particulier</option>
              <option value="societe">Société</option>
            </select>
          </div>

          {formData.type === "societe" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="raison_sociale">Raison sociale</Label>
                <Input
                  id="raison_sociale"
                  value={formData.raison_sociale || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, raison_sociale: e.target.value || null })
                  }
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="forme_juridique">Forme juridique</Label>
                <select
                  id="forme_juridique"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.forme_juridique || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, forme_juridique: e.target.value || null })
                  }
                  required
                  disabled={loading}
                >
                  <option value="">Sélectionner...</option>
                  <option value="SARL">SARL</option>
                  <option value="SAS">SAS</option>
                  <option value="SASU">SASU</option>
                  <option value="SCI">SCI</option>
                  <option value="EURL">EURL</option>
                  <option value="EI">EI</option>
                  <option value="SA">SA</option>
                  <option value="SCPI">SCPI</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="siret">SIRET (14 chiffres)</Label>
                <Input
                  id="siret"
                  value={formData.siret || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, siret: e.target.value || null })
                  }
                  placeholder="12345678901234"
                  maxLength={14}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adresse_siege">Adresse du siège social</Label>
                <textarea
                  id="adresse_siege"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.adresse_siege || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, adresse_siege: e.target.value || null })
                  }
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tva">Numéro TVA (optionnel)</Label>
                <Input
                  id="tva"
                  value={formData.tva || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, tva: e.target.value || null })
                  }
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="iban">IBAN (optionnel)</Label>
            <Input
              id="iban"
              value={formData.iban || ""}
              onChange={(e) =>
                setFormData({ ...formData, iban: e.target.value || null })
              }
              placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adresse_facturation">Adresse de facturation (optionnel)</Label>
            <textarea
              id="adresse_facturation"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={formData.adresse_facturation || ""}
              onChange={(e) =>
                setFormData({ ...formData, adresse_facturation: e.target.value || null })
              }
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

