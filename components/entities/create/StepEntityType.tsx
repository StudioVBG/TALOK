"use client";

import { Building2, User, Users, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepEntityTypeProps {
  value: string;
  onChange: (type: string) => void;
}

const ENTITY_TYPES = [
  {
    id: "sci_ir",
    label: "SCI à l'IR",
    description: "Société Civile Immobilière, transparence fiscale",
    icon: Building2,
    group: "company",
  },
  {
    id: "sci_is",
    label: "SCI à l'IS",
    description: "Société Civile Immobilière, impôt sur les sociétés",
    icon: Building2,
    group: "company",
  },
  {
    id: "sarl",
    label: "SARL",
    description: "Société à responsabilité limitée",
    icon: Building2,
    group: "company",
  },
  {
    id: "sas",
    label: "SAS / SASU",
    description: "Société par actions simplifiée",
    icon: Building2,
    group: "company",
  },
  {
    id: "eurl",
    label: "EURL",
    description: "Entreprise unipersonnelle à responsabilité limitée",
    icon: Building2,
    group: "company",
  },
  {
    id: "indivision",
    label: "Indivision",
    description: "Plusieurs copropriétaires d'un même bien",
    icon: Users,
    group: "special",
  },
  {
    id: "demembrement_usufruit",
    label: "Démembrement",
    description: "Usufruit / Nue-propriété",
    icon: ArrowUpDown,
    group: "special",
  },
  {
    id: "particulier",
    label: "En nom propre",
    description: "Détention directe, personne physique",
    icon: User,
    group: "personal",
  },
];

export function StepEntityType({ value, onChange }: StepEntityTypeProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Type de structure</h2>
        <p className="text-muted-foreground text-sm">
          Quel type de structure juridique détient vos biens ?
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ENTITY_TYPES.map((type) => {
          const isSelected = value === type.id;
          return (
            <button
              key={type.id}
              onClick={() => onChange(type.id)}
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/30 hover:bg-muted/30"
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary/10" : "bg-muted"
                )}
              >
                <type.icon
                  className={cn(
                    "h-5 w-5",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </div>
              <div>
                <p
                  className={cn(
                    "font-medium text-sm",
                    isSelected && "text-primary"
                  )}
                >
                  {type.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {type.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
