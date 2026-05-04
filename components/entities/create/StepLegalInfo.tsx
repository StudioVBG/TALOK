"use client";

import { SiretInput } from "@/components/siret/SiretInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EntityFormData } from "@/lib/entities/entity-form-utils";
import { isRegimeFiscalLocked } from "@/lib/entities/entity-form-utils";
import { deriveDateCloture } from "@/lib/entities/fiscal-year-defaults";
import type { ResolvedLegalIdentity } from "@/lib/siret/types";

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

  /**
   * Auto-fill du formulaire à partir des données INSEE.
   * On ne remplit que les champs vides (pas d'écrasement de saisie manuelle).
   */
  const handleSiretResolve = (data: ResolvedLegalIdentity) => {
    const updates: Partial<EntityFormData> = { siret: data.siret };
    if (!formData.nom && data.raison_sociale) {
      updates.nom = data.raison_sociale;
    }
    if (!formData.formeJuridique && data.forme_juridique) {
      updates.formeJuridique = data.forme_juridique;
    }
    if (!formData.capitalSocial && data.capital_social != null) {
      updates.capitalSocial = String(data.capital_social);
    }
    if (!formData.dateCreation && data.date_creation) {
      updates.dateCreation = data.date_creation;
    }
    if (!formData.numeroTva && data.tva_intra) {
      updates.numeroTva = data.tva_intra;
    }
    if (!formData.rcsVille && data.ville) {
      updates.rcsVille = data.ville;
    }
    if (!formData.adresseSiege && data.adresse) {
      updates.adresseSiege = data.adresse;
    }
    if (!formData.codePostalSiege && data.code_postal) {
      updates.codePostalSiege = data.code_postal;
    }
    if (!formData.villeSiege && data.ville) {
      updates.villeSiege = data.ville;
    }
    onChange(updates);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Informations légales</h2>
        <p className="text-muted-foreground text-sm">
          Saisissez votre SIRET pour pré-remplir automatiquement vos informations d&apos;immatriculation depuis le
          répertoire INSEE.
        </p>
      </div>

      <SiretInput
        value={formData.siret}
        onChange={(next) => onChange({ siret: next })}
        onResolve={handleSiretResolve}
        label="SIRET de la structure"
      />

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
          {errors?.nom && <p className="text-xs text-destructive">{errors.nom}</p>}
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
          {errors?.formeJuridique && <p className="text-xs text-destructive">{errors.formeJuridique}</p>}
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
          {regimeLocked && <p className="text-xs text-muted-foreground">Imposé par le type de structure sélectionné</p>}
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
          <p className="text-xs text-muted-foreground">Nombre total de parts émises (statuts)</p>
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

      {/* Exercice fiscal — obligatoire pour la comptabilité */}
      <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <div>
          <h3 className="text-base font-semibold">
            Exercice fiscal <span className="text-destructive">*</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {isRegimeFiscalLocked(formData.entityType)
              ? "Régime IS : par défaut année civile, modifiable."
              : "Régime IR : exercice = année civile (01/01 → 31/12)."}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="premierExerciceDebut">Début du 1er exercice</Label>
            <Input
              id="premierExerciceDebut"
              type="date"
              value={formData.premierExerciceDebut}
              onChange={(e) => onChange({ premierExerciceDebut: e.target.value })}
              className={errors?.premierExerciceDebut ? "border-destructive" : ""}
            />
            {errors?.premierExerciceDebut && <p className="text-xs text-destructive">{errors.premierExerciceDebut}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="premierExerciceFin">Fin du 1er exercice</Label>
            <Input
              id="premierExerciceFin"
              type="date"
              value={formData.premierExerciceFin}
              onChange={(e) => {
                const fin = e.target.value;
                onChange({
                  premierExerciceFin: fin,
                  dateClotureExercice: fin ? deriveDateCloture(fin) : "",
                });
              }}
              className={errors?.premierExerciceFin ? "border-destructive" : ""}
            />
            {errors?.premierExerciceFin && <p className="text-xs text-destructive">{errors.premierExerciceFin}</p>}
          </div>
        </div>

        {formData.dateClotureExercice && (
          <p className="text-xs text-muted-foreground">Date de clôture annuelle : {formData.dateClotureExercice}</p>
        )}
      </div>
    </div>
  );
}
