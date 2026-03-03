"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { AddressFields } from "@/components/entities/AddressFields";
import type { EntityFormData } from "@/lib/entities/entity-form-utils";

interface StepAddressProps {
  formData: EntityFormData;
  onChange: (updates: Partial<EntityFormData>) => void;
  errors?: Record<string, string>;
}

export function StepAddress({ formData, onChange, errors }: StepAddressProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Adresse du siège social</h2>
        <p className="text-muted-foreground text-sm">
          L&apos;adresse figurera sur vos baux et quittances
        </p>
      </div>

      <AddressFields
        address={formData.adresseSiege}
        postalCode={formData.codePostalSiege}
        city={formData.villeSiege}
        onAddressChange={(value) => onChange({ adresseSiege: value })}
        onPostalCodeChange={(value) =>
          onChange({ codePostalSiege: value.replace(/\D/g, "").slice(0, 5) })
        }
        onCityChange={(value) => onChange({ villeSiege: value })}
        required
        idPrefix="siege"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Email entité */}
        <div className="space-y-2">
          <Label htmlFor="emailEntite">Email de l&apos;entité (optionnel)</Label>
          <Input
            id="emailEntite"
            type="email"
            value={formData.emailEntite}
            onChange={(e) => onChange({ emailEntite: e.target.value })}
            placeholder="contact@atomgiste.fr"
            className={errors?.emailEntite ? "border-destructive" : ""}
          />
          {errors?.emailEntite && (
            <p className="text-xs text-destructive">{errors.emailEntite}</p>
          )}
        </div>

        {/* Téléphone */}
        <div className="space-y-2">
          <Label htmlFor="telephoneEntite">Téléphone (optionnel)</Label>
          <Input
            id="telephoneEntite"
            type="tel"
            value={formData.telephoneEntite}
            onChange={(e) => onChange({ telephoneEntite: e.target.value })}
            placeholder="+33 6XX XX XX XX"
          />
        </div>
      </div>
    </div>
  );
}
