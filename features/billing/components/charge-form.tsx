"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { chargesService } from "@/features/billing/services/charges.service";
import type { Charge, ChargeType, ChargePeriodicity } from "@/lib/types";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";

interface ChargeFormProps {
  charge?: Charge;
  propertyId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ChargeForm({ charge, propertyId, onSuccess, onCancel }: ChargeFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    property_id: propertyId || charge?.property_id || "",
    type: (charge?.type || "autre") as ChargeType,
    montant: charge?.montant || 0,
    periodicite: (charge?.periodicite || "mensuelle") as ChargePeriodicity,
    refacturable_locataire: charge?.refacturable_locataire || false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (charge) {
        await chargesService.updateCharge(charge.id, formData);
        toast({
          title: "Charge mise à jour",
          description: "La charge a été mise à jour avec succès.",
        });
      } else {
        await chargesService.createCharge(formData);
        toast({
          title: "Charge créée",
          description: "La charge a été créée avec succès.",
        });
      }

      if (onSuccess) {
        onSuccess();
      } else if (propertyId) {
        router.push(`/owner/properties/${propertyId}`);
      } else {
        router.push("/owner/money");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{charge ? "Modifier la charge" : "Nouvelle charge"}</CardTitle>
        <CardDescription>
          {charge ? "Modifiez les informations de la charge" : "Ajoutez une nouvelle charge récurrente"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type de charge</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value as ChargeType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eau">Eau</SelectItem>
                <SelectItem value="electricite">Électricité</SelectItem>
                <SelectItem value="copro">Copropriété</SelectItem>
                <SelectItem value="taxe">Taxe</SelectItem>
                <SelectItem value="ordures">Ordures ménagères</SelectItem>
                <SelectItem value="assurance">Assurance</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="montant">Montant (€)</Label>
            <Input
              id="montant"
              type="number"
              step="0.01"
              min="0"
              value={formData.montant}
              onChange={(e) => setFormData({ ...formData, montant: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="periodicite">Périodicité</Label>
            <Select
              value={formData.periodicite}
              onValueChange={(value) => setFormData({ ...formData, periodicite: value as ChargePeriodicity })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensuelle">Mensuelle</SelectItem>
                <SelectItem value="trimestrielle">Trimestrielle</SelectItem>
                <SelectItem value="annuelle">Annuelle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="refacturable"
              checked={formData.refacturable_locataire}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, refacturable_locataire: checked as boolean })
              }
            />
            <Label htmlFor="refacturable" className="cursor-pointer">
              Refacturable au locataire
            </Label>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {charge ? "Mettre à jour" : "Créer"}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Annuler
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

