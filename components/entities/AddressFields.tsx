"use client";

/**
 * AddressFields — Champs d'adresse DOM-TOM aware
 *
 * Composant réutilisable qui détecte automatiquement les codes postaux
 * DOM-TOM et affiche un badge d'information TVA.
 */

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { isDomTomPostalCode, getTvaRate } from "@/lib/entities/resolveOwnerIdentity";

interface AddressFieldsProps {
  address: string;
  postalCode: string;
  city: string;
  country?: string;
  onAddressChange: (value: string) => void;
  onPostalCodeChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onCountryChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  /** Prefix for input ids to avoid collisions */
  idPrefix?: string;
}

export function AddressFields({
  address,
  postalCode,
  city,
  country = "France",
  onAddressChange,
  onPostalCodeChange,
  onCityChange,
  onCountryChange,
  disabled = false,
  required = false,
  idPrefix = "addr",
}: AddressFieldsProps) {
  const isDom = isDomTomPostalCode(postalCode);
  const tvaRate = getTvaRate(postalCode);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}_address`}>
          Adresse{required && <span className="text-destructive"> *</span>}
        </Label>
        <Input
          id={`${idPrefix}_address`}
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="12 rue de la Paix"
          disabled={disabled}
          aria-required={required}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}_postal_code`}>
            Code postal
            {required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={`${idPrefix}_postal_code`}
            value={postalCode}
            onChange={(e) => onPostalCodeChange(e.target.value)}
            placeholder="75001"
            maxLength={5}
            inputMode="numeric"
            disabled={disabled}
            aria-required={required}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}_city`}>
            Ville{required && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id={`${idPrefix}_city`}
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="Paris"
            disabled={disabled}
            aria-required={required}
          />
        </div>
        {onCountryChange && (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}_country`}>Pays</Label>
            <Input
              id={`${idPrefix}_country`}
              value={country}
              onChange={(e) => onCountryChange(e.target.value)}
              placeholder="France"
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* DOM-TOM banner */}
      {isDom && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/50">
          <Info className="h-4 w-4 text-blue-600 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-blue-800 dark:text-blue-200">
              DOM-TOM détecté
            </span>
            <span className="text-blue-600 dark:text-blue-400 ml-1">
              — TVA applicable : {tvaRate}%
            </span>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {tvaRate === 0
              ? "Exonéré TVA"
              : tvaRate === 8.5
                ? "TVA réduite"
                : `TVA ${tvaRate}%`}
          </Badge>
        </div>
      )}
    </div>
  );
}
