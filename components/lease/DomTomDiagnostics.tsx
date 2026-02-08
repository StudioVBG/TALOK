"use client";

/**
 * P2-5: Diagnostics obligatoires DOM-TOM
 *
 * Affiche les diagnostics spécifiques requis pour les biens situés en Outre-Mer:
 * - Termites: obligatoire dans tous les DOM
 * - Risques naturels (cyclones, séismes, volcanisme)
 * - État des Risques et Pollutions (ERP) adapté
 * - Normes parasismiques
 */

import { useMemo } from "react";
import { AlertTriangle, Bug, Mountain, Shield, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// DOM-TOM department codes
const DOM_TOM_DEPARTMENTS: Record<string, {
  name: string;
  termites: boolean;
  cyclones: boolean;
  seismic_zone: number; // 1-5
  volcanic: boolean;
  extra_diagnostics: string[];
}> = {
  "971": {
    name: "Guadeloupe",
    termites: true,
    cyclones: true,
    seismic_zone: 5,
    volcanic: true,
    extra_diagnostics: ["Risque sismique zone 5", "Risque cyclonique", "Risque volcanique (La Soufrière)"],
  },
  "972": {
    name: "Martinique",
    termites: true,
    cyclones: true,
    seismic_zone: 5,
    volcanic: true,
    extra_diagnostics: ["Risque sismique zone 5", "Risque cyclonique", "Risque volcanique (Montagne Pelée)"],
  },
  "973": {
    name: "Guyane",
    termites: true,
    cyclones: false,
    seismic_zone: 2,
    volcanic: false,
    extra_diagnostics: ["Risque sismique zone 2", "Risque d'inondation"],
  },
  "974": {
    name: "La Réunion",
    termites: true,
    cyclones: true,
    seismic_zone: 2,
    volcanic: true,
    extra_diagnostics: ["Risque sismique zone 2", "Risque cyclonique", "Risque volcanique (Piton de la Fournaise)"],
  },
  "976": {
    name: "Mayotte",
    termites: true,
    cyclones: true,
    seismic_zone: 4,
    volcanic: false,
    extra_diagnostics: ["Risque sismique zone 4", "Risque cyclonique", "Risque d'activité sismique en essaim"],
  },
};

interface DomTomDiagnosticsProps {
  codePostal?: string | null;
}

export function DomTomDiagnostics({ codePostal }: DomTomDiagnosticsProps) {
  const domInfo = useMemo(() => {
    if (!codePostal) return null;
    const dept = codePostal.substring(0, 3);
    return DOM_TOM_DEPARTMENTS[dept] || null;
  }, [codePostal]);

  if (!domInfo) return null;

  return (
    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-sm font-semibold text-amber-800">
          Diagnostics spécifiques — {domInfo.name}
        </span>
        <Badge variant="secondary" className="text-[10px]">DOM-TOM</Badge>
      </div>

      <div className="space-y-2">
        {/* Termites */}
        {domInfo.termites && (
          <div className="flex items-center gap-2 text-sm">
            <Bug className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-amber-800">
              <strong>Diagnostic termites obligatoire</strong> — Arrêté préfectoral en vigueur
            </span>
          </div>
        )}

        {/* Risques naturels */}
        {domInfo.extra_diagnostics.map((diag, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            {diag.includes("sismique") ? (
              <Mountain className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            ) : diag.includes("volcanique") ? (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            ) : (
              <FileWarning className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            )}
            <span className="text-amber-800">{diag}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-amber-600 pt-1 border-t border-amber-200">
        Ces diagnostics doivent figurer en annexe du bail. L'État des Risques et Pollutions (ERP) doit être
        mis à jour tous les 6 mois et remis au locataire avant signature.
      </p>
    </div>
  );
}
