"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { isDomTomPostalCode, getTvaRate } from "@/lib/entities/resolveOwnerIdentity";
import type { EntityFormData } from "@/app/owner/entities/new/page";

interface StepAddressProps {
  formData: EntityFormData;
  onChange: (updates: Partial<EntityFormData>) => void;
}

export function StepAddress({ formData, onChange }: StepAddressProps) {
  const isDom = isDomTomPostalCode(formData.codePostalSiege);
  const tvaRate = getTvaRate(formData.codePostalSiege);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Adresse du siège social</h2>
        <p className="text-muted-foreground text-sm">
          L&apos;adresse figurera sur vos baux et quittances
        </p>
      </div>

      {/* DOM-TOM banner */}
      {isDom && formData.codePostalSiege && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
          <p className="font-medium text-blue-800">
            Zone DOM-TOM détectée
          </p>
          <p className="text-blue-700 mt-0.5">
            {tvaRate === 0
              ? "Exonération de TVA applicable"
              : `TVA réduite à ${tvaRate}% applicable`}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Adresse */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="adresseSiege">
            Adresse <span className="text-destructive">*</span>
          </Label>
          <textarea
            id="adresseSiege"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={formData.adresseSiege}
            onChange={(e) => onChange({ adresseSiege: e.target.value })}
            placeholder="12 rue Victor Schoelcher"
          />
        </div>

        {/* Complément d'adresse */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="complementAdresse">Complément d&apos;adresse</Label>
          <Input
            id="complementAdresse"
            value={formData.complementAdresse}
            onChange={(e) => onChange({ complementAdresse: e.target.value })}
            placeholder="Bâtiment A, 2ème étage"
          />
        </div>

        {/* Code postal */}
        <div className="space-y-2">
          <Label htmlFor="codePostalSiege">
            Code postal <span className="text-destructive">*</span>
          </Label>
          <Input
            id="codePostalSiege"
            value={formData.codePostalSiege}
            onChange={(e) => onChange({ codePostalSiege: e.target.value.replace(/\D/g, "").slice(0, 5) })}
            placeholder="97200"
            maxLength={5}
          />
        </div>

        {/* Ville */}
        <div className="space-y-2">
          <Label htmlFor="villeSiege">
            Ville <span className="text-destructive">*</span>
          </Label>
          <Input
            id="villeSiege"
            value={formData.villeSiege}
            onChange={(e) => onChange({ villeSiege: e.target.value })}
            placeholder="Fort-de-France"
          />
        </div>

      </div>
    </div>
  );
}
