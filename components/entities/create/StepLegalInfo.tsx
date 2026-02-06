"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { EntityFormData } from "@/app/owner/entities/new/page";

interface StepLegalInfoProps {
  formData: EntityFormData;
  onChange: (updates: Partial<EntityFormData>) => void;
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

export function StepLegalInfo({ formData, onChange }: StepLegalInfoProps) {
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
          />
        </div>

        {/* Forme juridique */}
        <div className="space-y-2">
          <Label htmlFor="formeJuridique">
            Forme juridique <span className="text-destructive">*</span>
          </Label>
          <select
            id="formeJuridique"
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        </div>

        {/* Régime fiscal */}
        <div className="space-y-2">
          <Label htmlFor="regimeFiscal">
            Régime fiscal <span className="text-destructive">*</span>
          </Label>
          <select
            id="regimeFiscal"
            className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={formData.regimeFiscal}
            onChange={(e) => onChange({ regimeFiscal: e.target.value })}
          >
            {REGIME_FISCAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
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
          />
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
