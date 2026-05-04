"use client";

import { Building2, User, Users, ArrowUpDown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepEntityTypeProps {
  value: string;
  onChange: (type: string) => void;
  /** When true, non-particulier types are visually locked and onChange is intercepted */
  gateNonParticulier?: boolean;
  /** Called when a locked type is clicked */
  onGatedTypeAttempt?: () => void;
}

const ENTITY_TYPES = [
  // Sociétés civiles
  {
    id: "sci_ir",
    label: "SCI à l'IR",
    description: "Société Civile Immobilière, transparence fiscale",
    icon: Building2,
    group: "sci",
  },
  {
    id: "sci_is",
    label: "SCI à l'IS",
    description: "Société Civile Immobilière, impôt sur les sociétés",
    icon: Building2,
    group: "sci",
  },
  {
    id: "sci_construction_vente",
    label: "SCCV",
    description: "SCI de construction-vente (promotion immobilière)",
    icon: Building2,
    group: "sci",
  },
  // Sociétés commerciales
  {
    id: "sarl",
    label: "SARL",
    description: "Société à responsabilité limitée",
    icon: Building2,
    group: "company",
  },
  {
    id: "sarl_famille",
    label: "SARL de famille",
    description: "SARL familiale avec option IR possible",
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
    id: "sas",
    label: "SAS",
    description: "Société par actions simplifiée (2+ associés)",
    icon: Building2,
    group: "company",
  },
  {
    id: "sasu",
    label: "SASU",
    description: "SAS unipersonnelle (associé unique)",
    icon: Building2,
    group: "company",
  },
  {
    id: "sa",
    label: "SA",
    description: "Société anonyme",
    icon: Building2,
    group: "company",
  },
  {
    id: "snc",
    label: "SNC",
    description: "Société en nom collectif",
    icon: Building2,
    group: "company",
  },
  {
    id: "holding",
    label: "Holding",
    description: "Société holding de participations",
    icon: Building2,
    group: "company",
  },
  // Structures spéciales
  {
    id: "indivision",
    label: "Indivision",
    description: "Plusieurs copropriétaires d'un même bien",
    icon: Users,
    group: "special",
  },
  {
    id: "demembrement_usufruit",
    label: "Usufruit",
    description: "Usufruit seul (démembrement de propriété)",
    icon: ArrowUpDown,
    group: "special",
  },
  {
    id: "demembrement_nue_propriete",
    label: "Nue-propriété",
    description: "Nue-propriété seule (démembrement de propriété)",
    icon: ArrowUpDown,
    group: "special",
  },
  // Personnel
  {
    id: "particulier",
    label: "En nom propre",
    description: "Détention directe, personne physique",
    icon: User,
    group: "personal",
  },
];

export function StepEntityType({
  value,
  onChange,
  gateNonParticulier = false,
  onGatedTypeAttempt,
}: StepEntityTypeProps) {
  const handleClick = (typeId: string) => {
    if (gateNonParticulier && typeId !== "particulier") {
      onGatedTypeAttempt?.();
      return;
    }
    onChange(typeId);
  };

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
          const isLocked = gateNonParticulier && type.id !== "particulier";
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => handleClick(type.id)}
              className={cn(
                "relative flex items-start gap-3 p-4 rounded-lg border text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/30 hover:bg-muted/30",
                isLocked && "opacity-70"
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
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "font-medium text-sm",
                      isSelected && "text-primary"
                    )}
                  >
                    {type.label}
                  </p>
                  {isLocked && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-600 rounded border border-amber-500/30 uppercase">
                      <Lock className="h-2.5 w-2.5" />
                      Enterprise
                    </span>
                  )}
                </div>
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
