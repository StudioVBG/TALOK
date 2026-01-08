"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { leasesService } from "../services/leases.service";
import { propertiesService } from "@/features/properties/services/properties.service";
import type { CreateLeaseData, UpdateLeaseData } from "../services/leases.service";
import type { Lease, Property, LeaseType } from "@/lib/types";
import { useAuth } from "@/lib/hooks/use-auth";

interface LeaseFormProps {
  propertyId?: string;
  lease?: Lease;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function LeaseForm({ propertyId, lease, onSuccess, onCancel }: LeaseFormProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [formData, setFormData] = useState<CreateLeaseData>({
    property_id: propertyId || null,
    unit_id: null,
    type_bail: "nu",
    loyer: 0,
    charges_forfaitaires: 0,
    depot_de_garantie: 0,
    date_debut: "",
    date_fin: null,
    // ✅ FIX: Champs locataire
    tenant_email: "",
    tenant_name: "",
  });

  useEffect(() => {
    if (lease) {
      setFormData({
        property_id: lease.property_id,
        unit_id: lease.unit_id,
        type_bail: lease.type_bail,
        loyer: lease.loyer,
        charges_forfaitaires: lease.charges_forfaitaires,
        depot_de_garantie: lease.depot_de_garantie,
        date_debut: lease.date_debut,
        date_fin: lease.date_fin,
      });
    }

    // Charger les propriétés du propriétaire
    if (profile) {
      propertiesService
        .getPropertiesByOwner(profile.id)
        .then(setProperties)
        .catch(() => {});
    }
  }, [lease, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (lease) {
        await leasesService.updateLease(lease.id, formData);
        toast({
          title: "Bail mis à jour",
          description: "Les modifications ont été enregistrées.",
        });
      } else {
        await leasesService.createLease(formData);
        toast({
          title: "Bail créé",
          description: "Le bail a été créé avec succès.",
        });
      }
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lease ? "Modifier le bail" : "Nouveau bail"}</CardTitle>
        <CardDescription>
          {lease ? "Modifiez les informations du bail" : "Créez un nouveau bail de location"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="property_id">Logement</Label>
              <select
                id="property_id"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.property_id || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    property_id: e.target.value || null,
                    unit_id: null,
                  })
                }
                required={!formData.unit_id}
                disabled={loading || !!propertyId}
              >
                <option value="">Sélectionner un logement</option>
                {properties.map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.adresse_complete} ({prop.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type_bail">Type de bail</Label>
              <select
                id="type_bail"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formData.type_bail}
                onChange={(e) =>
                  setFormData({ ...formData, type_bail: e.target.value as LeaseType })
                }
                required
                disabled={loading}
              >
                <option value="nu">Bail nu</option>
                <option value="meuble">Bail meublé</option>
                <option value="colocation">Colocation</option>
                <option value="saisonnier">Saisonnier</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="loyer">Loyer mensuel (€)</Label>
              <Input
                id="loyer"
                type="number"
                min="0"
                step="0.01"
                value={formData.loyer}
                onChange={(e) =>
                  setFormData({ ...formData, loyer: parseFloat(e.target.value) || 0 })
                }
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="charges_forfaitaires">Charges forfaitaires (€)</Label>
              <Input
                id="charges_forfaitaires"
                type="number"
                min="0"
                step="0.01"
                value={formData.charges_forfaitaires}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    charges_forfaitaires: parseFloat(e.target.value) || 0,
                  })
                }
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="depot_de_garantie">Dépôt de garantie (€)</Label>
              <Input
                id="depot_de_garantie"
                type="number"
                min="0"
                step="0.01"
                value={formData.depot_de_garantie}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    depot_de_garantie: parseFloat(e.target.value) || 0,
                  })
                }
                required
                disabled={loading}
              />
            </div>
          </div>

          {/* ✅ FIX: Section Locataire */}
          {!lease && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium text-sm text-muted-foreground">Locataire (optionnel)</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tenant_name">Nom complet du locataire</Label>
                  <Input
                    id="tenant_name"
                    type="text"
                    placeholder="Jean Dupont"
                    value={formData.tenant_name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, tenant_name: e.target.value })
                    }
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant_email">Email du locataire</Label>
                  <Input
                    id="tenant_email"
                    type="email"
                    placeholder="locataire@email.com"
                    value={formData.tenant_email || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, tenant_email: e.target.value })
                    }
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Si renseigné, le locataire recevra une invitation pour signer le bail.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date_debut">Date de début</Label>
              <Input
                id="date_debut"
                type="date"
                value={formData.date_debut}
                onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_fin">Date de fin (optionnel)</Label>
              <Input
                id="date_fin"
                type="date"
                value={formData.date_fin || ""}
                onChange={(e) =>
                  setFormData({ ...formData, date_fin: e.target.value || null })
                }
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                Annuler
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Enregistrement..." : lease ? "Modifier" : "Créer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

