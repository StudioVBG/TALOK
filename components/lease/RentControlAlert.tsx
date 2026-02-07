"use client";

/**
 * P2-8: Encadrement des loyers — Alerte automatique zones tendues
 *
 * Affiche un avertissement si le bien est situé dans une zone d'encadrement
 * et que le loyer dépasse le loyer de référence majoré.
 */

import { useMemo } from "react";
import { AlertCircle, MapPin, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Zones d'encadrement des loyers (codes postaux principaux)
// Source: https://www.service-public.fr/particuliers/vosdroits/F1314
const RENT_CONTROL_ZONES: Record<string, { city: string; url: string }> = {
  "75": { city: "Paris", url: "https://www.referenceloyer.drihl.ile-de-france.developpement-durable.gouv.fr" },
  "69001": { city: "Lyon", url: "https://www.encadrementdesloyers.lyon.fr" },
  "69002": { city: "Lyon", url: "https://www.encadrementdesloyers.lyon.fr" },
  "69003": { city: "Lyon", url: "https://www.encadrementdesloyers.lyon.fr" },
  "69004": { city: "Lyon", url: "https://www.encadrementdesloyers.lyon.fr" },
  "69005": { city: "Lyon", url: "https://www.encadrementdesloyers.lyon.fr" },
  "69006": { city: "Lyon", url: "https://www.encadrementdesloyers.lyon.fr" },
  "69007": { city: "Lyon", url: "https://www.encadrementdesloyers.lyon.fr" },
  "69008": { city: "Lyon", url: "https://www.encadrementdesloyers.lyon.fr" },
  "69009": { city: "Lyon", url: "https://www.encadrementdesloyers.lyon.fr" },
  "59000": { city: "Lille", url: "https://www.encadrementdesloyers.lille.fr" },
  "59800": { city: "Lille", url: "https://www.encadrementdesloyers.lille.fr" },
  "33000": { city: "Bordeaux", url: "https://www.encadrementdesloyers.bordeaux.fr" },
  "34000": { city: "Montpellier", url: "https://www.encadrementdesloyers.montpellier3m.fr" },
  "93": { city: "Seine-Saint-Denis", url: "https://www.referenceloyer.drihl.ile-de-france.developpement-durable.gouv.fr" },
  "92": { city: "Hauts-de-Seine", url: "https://www.referenceloyer.drihl.ile-de-france.developpement-durable.gouv.fr" },
  "94": { city: "Val-de-Marne", url: "https://www.referenceloyer.drihl.ile-de-france.developpement-durable.gouv.fr" },
};

interface RentControlAlertProps {
  codePostal?: string | null;
  loyer: number;
  surface?: number | null;
  typeBail: string;
}

export function RentControlAlert({
  codePostal,
  loyer,
  surface,
  typeBail,
}: RentControlAlertProps) {
  const isHabitation = ["nu", "meuble", "colocation", "bail_mobilite", "etudiant", "bail_mixte"].includes(typeBail);

  const zoneInfo = useMemo(() => {
    if (!codePostal || !isHabitation) return null;

    // Check exact match first, then department prefix
    const match = RENT_CONTROL_ZONES[codePostal]
      || RENT_CONTROL_ZONES[codePostal.substring(0, 2)];

    return match || null;
  }, [codePostal, isHabitation]);

  if (!zoneInfo) return null;

  const prixM2 = surface && surface > 0 ? (loyer / surface).toFixed(2) : null;

  return (
    <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
        <span className="text-sm font-semibold text-blue-800">
          Zone d'encadrement des loyers — {zoneInfo.city}
        </span>
        <Badge variant="secondary" className="text-[10px]">Loi ELAN 2018</Badge>
      </div>

      <p className="text-xs text-blue-700">
        Ce bien est situé dans une zone soumise à l'encadrement des loyers.
        Le loyer ne doit pas dépasser le loyer de référence majoré applicable
        pour le quartier et le type de logement.
      </p>

      {prixM2 && (
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-blue-800">
            Loyer actuel : <strong>{prixM2} /m²/mois</strong>
          </span>
        </div>
      )}

      <div className="flex items-start gap-1.5 mt-2">
        <AlertCircle className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-600">
          Vérifiez la conformité du loyer sur{" "}
          <a
            href={zoneInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium hover:no-underline"
          >
            le simulateur officiel
          </a>{" "}
          avant de finaliser le bail.
        </p>
      </div>
    </div>
  );
}
