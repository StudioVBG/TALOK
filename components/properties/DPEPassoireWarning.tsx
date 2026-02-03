"use client";

import { AlertTriangle, ThermometerSnowflake, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DPEPassoireWarningProps {
  /** DPE energy class (A-G or NC) */
  dpeClasse: string | null | undefined;
  /** Type of lease - colocation has temporary exemption */
  typeBail?: string | null;
  /** Show as inline message or full alert */
  variant?: "alert" | "inline" | "badge";
  /** Additional CSS classes */
  className?: string;
}

/**
 * SOTA 2026: Warning component for DPE G (passoire energetique)
 *
 * Since January 1, 2025, properties classified as DPE G are forbidden
 * for rental in France. Colocations have a temporary exemption.
 *
 * DPE F will be forbidden starting January 1, 2028.
 */
export function DPEPassoireWarning({
  dpeClasse,
  typeBail,
  variant = "alert",
  className,
}: DPEPassoireWarningProps) {
  // Normalize class
  const classe = dpeClasse?.toUpperCase() || null;

  // Check if it's a passoire (G)
  const isPassoireG = classe === "G";
  const isPassoireF = classe === "F";
  const isColocation = typeBail === "colocation";

  // G is blocked (except colocation), F is warning
  if (!isPassoireG && !isPassoireF) {
    return null;
  }

  // For colocation with DPE G, show softer warning
  if (isPassoireG && isColocation) {
    if (variant === "badge") {
      return (
        <Badge variant="outline" className={cn("bg-amber-50 text-amber-700 border-amber-300", className)}>
          DPE G - Derogation colocation
        </Badge>
      );
    }

    if (variant === "inline") {
      return (
        <div className={cn("flex items-center gap-2 text-amber-700 text-sm", className)}>
          <AlertTriangle className="h-4 w-4" />
          <span>
            DPE G : Derogation temporaire pour colocation.
            <a
              href="https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049058684"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 underline inline-flex items-center gap-1"
            >
              En savoir plus <ExternalLink className="h-3 w-3" />
            </a>
          </span>
        </div>
      );
    }

    return (
      <Alert variant="default" className={cn("border-amber-300 bg-amber-50", className)}>
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">Derogation colocation</AlertTitle>
        <AlertDescription className="text-amber-700">
          Ce logement est classe DPE G mais beneficie d'une derogation temporaire
          pour les colocations. Cette derogation prendra fin le 1er janvier 2028.
        </AlertDescription>
      </Alert>
    );
  }

  // DPE G blocked
  if (isPassoireG) {
    if (variant === "badge") {
      return (
        <Badge variant="destructive" className={cn("", className)}>
          DPE G - Interdit a la location
        </Badge>
      );
    }

    if (variant === "inline") {
      return (
        <div className={cn("flex items-center gap-2 text-red-700 text-sm font-medium", className)}>
          <ThermometerSnowflake className="h-4 w-4" />
          <span>
            Passoire thermique (DPE G) : Interdit a la location depuis le 1er janvier 2025.
          </span>
        </div>
      );
    }

    return (
      <Alert variant="destructive" className={cn("", className)}>
        <ThermometerSnowflake className="h-4 w-4" />
        <AlertTitle>Passoire thermique - Location interdite</AlertTitle>
        <AlertDescription>
          <p>
            Les logements classes G (passoires thermiques) sont interdits a la location
            depuis le 1er janvier 2025 en France metropolitaine.
          </p>
          <ul className="mt-2 text-sm list-disc list-inside space-y-1">
            <li>Seules les colocations beneficient d'une derogation temporaire</li>
            <li>Des travaux de renovation energetique sont necessaires</li>
            <li>
              <a
                href="https://www.service-public.fr/particuliers/vosdroits/F35608"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-1"
              >
                Consulter les aides disponibles <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  // DPE F warning (forbidden starting 2028)
  if (isPassoireF) {
    if (variant === "badge") {
      return (
        <Badge variant="outline" className={cn("bg-amber-50 text-amber-700 border-amber-300", className)}>
          DPE F - Interdit en 2028
        </Badge>
      );
    }

    if (variant === "inline") {
      return (
        <div className={cn("flex items-center gap-2 text-amber-700 text-sm", className)}>
          <AlertTriangle className="h-4 w-4" />
          <span>
            DPE F : Sera interdit a la location a partir du 1er janvier 2028.
          </span>
        </div>
      );
    }

    return (
      <Alert variant="default" className={cn("border-amber-300 bg-amber-50", className)}>
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">Attention - DPE F</AlertTitle>
        <AlertDescription className="text-amber-700">
          <p>
            Les logements classes F seront interdits a la location a partir du
            1er janvier 2028. Anticipez les travaux de renovation energetique.
          </p>
          <p className="mt-2 text-sm">
            <a
              href="https://www.service-public.fr/particuliers/vosdroits/F35608"
              target="_blank"
              rel="noopener noreferrer"
              className="underline inline-flex items-center gap-1"
            >
              Decouvrir les aides a la renovation <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

/**
 * Helper function to check if a DPE class is a passoire
 */
export function isDPEPassoire(dpeClasse: string | null | undefined): boolean {
  const classe = dpeClasse?.toUpperCase();
  return classe === "G" || classe === "F";
}

/**
 * Helper function to check if a DPE class blocks rental
 */
export function isDPEBloquant(
  dpeClasse: string | null | undefined,
  typeBail?: string | null
): boolean {
  const classe = dpeClasse?.toUpperCase();
  // G is blocked except for colocation
  if (classe === "G" && typeBail !== "colocation") {
    return true;
  }
  return false;
}

/**
 * Get DPE color for display
 */
export function getDPEColor(dpeClasse: string | null | undefined): string {
  const colors: Record<string, string> = {
    A: "bg-emerald-500",
    B: "bg-green-500",
    C: "bg-lime-500",
    D: "bg-yellow-500",
    E: "bg-orange-500",
    F: "bg-red-400",
    G: "bg-red-600",
    NC: "bg-slate-400",
  };
  const classe = dpeClasse?.toUpperCase() || "NC";
  return colors[classe] || "bg-slate-400";
}
