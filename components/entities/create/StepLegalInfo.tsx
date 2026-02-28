"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { isRegimeFiscalLocked } from "@/lib/entities/entity-form-utils";
import { isValidSiret, siretToSiren, formatSiren } from "@/lib/entities/siret-validation";
import type { EntityFormData } from "@/lib/entities/entity-form-utils";

interface StepLegalInfoProps {
  formData: EntityFormData;
  onChange: (updates: Partial<EntityFormData>) => void;
  errors?: Record<string, string>;
}

const FORME_JURIDIQUE_OPTIONS = [
  { value: "SCI", label: "SCI" },
  { value: "SARL", label: "SARL" },
  { value: "SAS", label: "SAS" },
  { value: "SASU", label: "SASU" },
  { value: "EURL", label: "EURL" },
  { value: "SA", label: "SA" },
  { value: "SNC", label: "SNC" },
  { value: "autre", label: "Autre" },
];

const REGIME_FISCAL_OPTIONS = [
  { value: "ir", label: "Impôt sur le Revenu (IR)" },
  { value: "is", label: "Impôt sur les Sociétés (IS)" },
];

export function StepLegalInfo({ formData, onChange, errors }: StepLegalInfoProps) {
  const regimeLocked = isRegimeFiscalLocked(formData.entityType);

  // Auto-derive SIREN from SIRET for display
  const derivedSiren = useMemo(() => {
    const digits = formData.siret.replace(/\D/g, "");
    if (digits.length >= 9) {
      const siren = siretToSiren(digits);
      return siren ? formatSiren(siren) : null;
    }
    return null;
  }, [formData.siret]);

  // Validate SIRET in real-time for visual feedback
  const siretStatus = useMemo(() => {
    const digits = formData.siret.replace(/\D/g, "");
    if (digits.length === 0) return null;
    if (digits.length < 14) return "incomplete";
    return isValidSiret(digits) ? "valid" : "invalid";
  }, [formData.siret]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Informations légales</h2>
        <p className="text-muted-foreground text-sm">
          Renseignez les informations d&apos;immatriculation de votre structure
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Raison sociale */}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="nom">
            Raison sociale <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nom"
            value={formData.nom}
            onChange={(e) => onChange({ nom: e.target.value })}
            placeholder="Ex: ATOMGISTE"
            className={errors?.nom ? "border-destructive" : ""}
          />
          {errors?.nom && (
            <p className="text-xs text-destructive">{errors.nom}</p>
          )}
        </div>

        {/* Forme juridique */}
        <div className="space-y-2">
          <Label htmlFor="formeJuridique">
            Forme juridique <span className="text-destructive">*</span>
          </Label>
          <select
            id="formeJuridique"
            className={`flex h-11 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${errors?.formeJuridique ? "border-destructive" : "border-input"}`}
            value={formData.formeJuridique}
            onChange={(e) => onChange({ formeJuridique: e.target.value })}
          >
            <option value="">Sélectionner...</option>
            {FORME_JURIDIQUE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errors?.formeJuridique && (
            <p className="text-xs text-destructive">{errors.formeJuridique}</p>
          )}
        </div>

        {/* Régime fiscal */}
        <div className="space-y-2">
          <Label htmlFor="regimeFiscal">
            Régime fiscal <span className="text-destructive">*</span>
          </Label>
          <select
            id="regimeFiscal"
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={formData.regimeFiscal}
            onChange={(e) => onChange({ regimeFiscal: e.target.value })}
            disabled={regimeLocked}
          >
            {REGIME_FISCAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {regimeLocked && (
            <p className="text-xs text-muted-foreground">
              Imposé par le type de structure sélectionné
            </p>
          )}
        </div>

        {/* SIRET */}
        <div className="space-y-2">
          <Label htmlFor="siret">SIRET (14 chiffres)</Label>
          <Input
            id="siret"
            value={formData.siret}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d\s]/g, "");
              onChange({ siret: v });
            }}
            placeholder="123 456 789 01234"
            maxLength={17}
            className={errors?.siret ? "border-destructive" : siretStatus === "valid" ? "border-green-500" : ""}
          />
          {errors?.siret && (
            <p className="text-xs text-destructive">{errors.siret}</p>
          )}
          {!errors?.siret && derivedSiren && (
            <p className="text-xs text-muted-foreground">
              SIREN : {derivedSiren}
              {siretStatus === "valid" && " \u2713"}
              {siretStatus === "invalid" && (
                <span className="text-destructive ml-1">(cl\u00e9 de contr\u00f4le invalide)</span>
              )}
            </p>
          )}
        </div>

        {/* Capital social */}
        <div className="space-y-2">
          <Label htmlFor="capitalSocial">Capital social (€)</Label>
          <Input
            id="capitalSocial"
            type="number"
            min="0"
            step="1"
            value={formData.capitalSocial}
            onChange={(e) => onChange({ capitalSocial: e.target.value })}
            placeholder="1000"
          />
        </div>

        {/* Nombre de parts */}
        <div className="space-y-2">
          <Label htmlFor="nombreParts">Nombre de parts sociales</Label>
          <Input
            id="nombreParts"
            type="number"
            min="1"
            step="1"
            value={formData.nombreParts}
            onChange={(e) => onChange({ nombreParts: e.target.value })}
            placeholder="100"
          />
          <p className="text-xs text-muted-foreground">
            Nombre total de parts émises (statuts)
          </p>
        </div>

        {/* RCS Ville */}
        <div className="space-y-2">
          <Label htmlFor="rcsVille">RCS (ville d&apos;immatriculation)</Label>
          <Input
            id="rcsVille"
            value={formData.rcsVille}
            onChange={(e) => onChange({ rcsVille: e.target.value })}
            placeholder="Paris, Lyon, Marseille..."
          />
        </div>

        {/* Date immatriculation */}
        <div className="space-y-2">
          <Label htmlFor="dateCreation">Date d&apos;immatriculation</Label>
          <Input
            id="dateCreation"
            type="date"
            value={formData.dateCreation}
            onChange={(e) => onChange({ dateCreation: e.target.value })}
          />
        </div>

        {/* N° TVA */}
        <div className="space-y-2">
          <Label htmlFor="numeroTva">N° TVA (optionnel)</Label>
          <Input
            id="numeroTva"
            value={formData.numeroTva}
            onChange={(e) => onChange({ numeroTva: e.target.value })}
            placeholder="FR12345678901"
          />
        </div>
      </div>
    </div>
  );
}
