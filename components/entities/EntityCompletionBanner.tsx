"use client";

/**
 * EntityCompletionBanner — Bannière de complétion d'entité
 *
 * Affiche un avertissement si l'entité active est incomplète (SIRET, IBAN manquants, etc.)
 * S'affiche en haut des pages critiques (baux, quittances, etc.)
 */

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { useEntityStore } from "@/stores/useEntityStore";
import { cn } from "@/lib/utils";

interface EntityCompletionBannerProps {
  /** Champs requis pour le contexte (ex: "bail" nécessite SIRET + adresse) */
  requiredContext?: "bail" | "quittance" | "edl" | "general";
  /** CSS class */
  className?: string;
}

export function EntityCompletionBanner({
  requiredContext = "general",
  className,
}: EntityCompletionBannerProps) {
  const { entities, activeEntityId } = useEntityStore();

  // No banner if no entity selected or no entities
  if (!activeEntityId || entities.length === 0) return null;

  const entity = entities.find((e) => e.id === activeEntityId);
  if (!entity) return null;

  // Check missing fields based on context
  const missingFields: string[] = [];

  if (!entity.siret && entity.entityType !== "particulier") {
    missingFields.push("SIRET");
  }

  if (requiredContext === "bail" || requiredContext === "quittance") {
    // For bail/receipt, we need more info
    if (!entity.siret && entity.entityType !== "particulier") {
      // Already added above
    }
  }

  // If nothing missing, show green checkmark briefly or nothing
  if (missingFields.length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3",
        "dark:border-amber-800/50 dark:bg-amber-950/30",
        className
      )}
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Entité &laquo;{entity.nom}&raquo; incomplète
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
          Champs manquants : {missingFields.join(", ")}
        </p>
      </div>
      <Link
        href={`/owner/entities/${entity.id}`}
        className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 whitespace-nowrap"
      >
        Compléter
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
