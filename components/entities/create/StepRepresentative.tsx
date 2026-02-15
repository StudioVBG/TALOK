"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { EntityFormData } from "@/lib/entities/entity-form-utils";

interface StepRepresentativeProps {
  formData: EntityFormData;
  onChange: (updates: Partial<EntityFormData>) => void;
  errors?: Record<string, string>;
}

const QUALITE_OPTIONS: Record<string, string[]> = {
  SCI: ["Gérant(e)", "Co-gérant(e)"],
  SARL: ["Gérant(e)", "Co-gérant(e)"],
  SAS: ["Président(e)", "Directeur(trice) Général(e)"],
  SASU: ["Président(e)", "Directeur(trice) Général(e)"],
  EURL: ["Gérant(e)"],
  SA: ["Président(e) du CA", "Directeur(trice) Général(e)"],
  SNC: ["Gérant(e)"],
};

export function StepRepresentative({
  formData,
  onChange,
  errors,
}: StepRepresentativeProps) {
  const qualiteOptions =
    QUALITE_OPTIONS[formData.formeJuridique] || ["Gérant(e)", "Président(e)"];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Représentant légal</h2>
        <p className="text-muted-foreground text-sm">
          Qui représente légalement cette entité ?
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-3">
        <button
          onClick={() => onChange({ representantMode: "self" })}
          className={cn(
            "flex-1 p-4 rounded-lg border text-left transition-all",
            formData.representantMode === "self"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border hover:border-primary/30"
          )}
        >
          <p className="font-medium text-sm">Moi-même</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Vous êtes le représentant légal
          </p>
        </button>
        <button
          onClick={() => onChange({ representantMode: "other" })}
          className={cn(
            "flex-1 p-4 rounded-lg border text-left transition-all",
            formData.representantMode === "other"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "border-border hover:border-primary/30"
          )}
        >
          <p className="font-medium text-sm">Autre personne</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Un tiers représente l&apos;entité
          </p>
        </button>
      </div>

      {/* Qualité */}
      <div className="space-y-2">
        <Label htmlFor="representantQualite">Qualité</Label>
        <select
          id="representantQualite"
          className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={formData.representantQualite}
          onChange={(e) =>
            onChange({ representantQualite: e.target.value })
          }
        >
          {qualiteOptions.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </div>

      {/* Other person fields */}
      {formData.representantMode === "other" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="representantPrenom">
              Prénom <span className="text-destructive">*</span>
            </Label>
            <Input
              id="representantPrenom"
              value={formData.representantPrenom}
              onChange={(e) =>
                onChange({ representantPrenom: e.target.value })
              }
              placeholder="Marie-Line"
              className={errors?.representantPrenom ? "border-destructive" : ""}
            />
            {errors?.representantPrenom && (
              <p className="text-xs text-destructive">
                {errors.representantPrenom}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="representantNom">
              Nom <span className="text-destructive">*</span>
            </Label>
            <Input
              id="representantNom"
              value={formData.representantNom}
              onChange={(e) =>
                onChange({ representantNom: e.target.value })
              }
              placeholder="VOLBERG"
              className={errors?.representantNom ? "border-destructive" : ""}
            />
            {errors?.representantNom && (
              <p className="text-xs text-destructive">
                {errors.representantNom}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="representantDateNaissance">
              Date de naissance
            </Label>
            <Input
              id="representantDateNaissance"
              type="date"
              value={formData.representantDateNaissance}
              onChange={(e) =>
                onChange({ representantDateNaissance: e.target.value })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
