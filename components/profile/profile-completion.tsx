"use client";

import { cn } from "@/lib/utils";
import type { ProfileFormData } from "@/lib/hooks/use-profile-form";

interface ProfileCompletionProps {
  data: ProfileFormData;
}

interface WeightedField {
  filled: boolean;
  weight: number;
}

function calculateCompletion(data: ProfileFormData): number {
  const fields: WeightedField[] = [
    // Required fields (weight 2)
    { filled: !!data.prenom.trim(), weight: 2 },
    { filled: !!data.nom.trim(), weight: 2 },
    // Optional identity fields (weight 1)
    { filled: !!data.telephone.trim(), weight: 1 },
    { filled: !!data.date_naissance, weight: 1 },
    { filled: !!data.lieu_naissance.trim(), weight: 1 },
    // Company fields (conditional, weight 2)
    ...(data.owner_type === "societe"
      ? [
          { filled: !!data.raison_sociale.trim(), weight: 2 },
          { filled: !!data.forme_juridique.trim(), weight: 2 },
          { filled: !!data.siret.replace(/\s/g, "").trim(), weight: 2 },
          { filled: !!data.adresse_siege.trim(), weight: 2 },
        ]
      : []),
    // Optional finance fields (weight 1)
    { filled: !!data.iban.trim(), weight: 1 },
    { filled: !!data.adresse_facturation.trim(), weight: 1 },
  ];

  const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
  const filledWeight = fields
    .filter((f) => f.filled)
    .reduce((sum, f) => sum + f.weight, 0);

  return totalWeight > 0 ? Math.round((filledWeight / totalWeight) * 100) : 0;
}

export function ProfileCompletion({ data }: ProfileCompletionProps) {
  const completion = calculateCompletion(data);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        Profil complété à {completion}%
      </span>
      <div className="w-32 h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            completion === 100
              ? "bg-emerald-500"
              : completion >= 70
                ? "bg-primary"
                : "bg-amber-500"
          )}
          style={{ width: `${completion}%` }}
          role="progressbar"
          aria-valuenow={completion}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Profil complété à ${completion}%`}
        />
      </div>
    </div>
  );
}
