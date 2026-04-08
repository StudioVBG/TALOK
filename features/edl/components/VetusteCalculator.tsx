"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

interface VetusteGridEntry {
  element_type: string;
  duree_vie_ans: number;
  taux_abattement_annuel: number;
  valeur_residuelle_min: number;
  notes: string | null;
}

interface VetusteCalculation {
  element_type: string;
  duree_occupation_ans: number;
  duree_vie_ans: number;
  coefficient: number;
  cout_reparation_cents: number;
  retenue_nette_cents: number;
}

interface VetusteCalculatorProps {
  grid: VetusteGridEntry[];
  dureeOccupationAns: number;
}

/**
 * Calculate vetuste coefficient for an element type
 */
export function calculateVetuste(
  elementType: string,
  dureeOccupationAns: number,
  grid: VetusteGridEntry[]
): { coefficient: number; dureeVieAns: number; applicable: boolean } {
  const entry = grid.find((g) => g.element_type === elementType);
  if (!entry || dureeOccupationAns <= 0) {
    return { coefficient: 1.0, dureeVieAns: 0, applicable: false };
  }

  const coefficient = Math.max(
    entry.valeur_residuelle_min,
    1 - dureeOccupationAns / entry.duree_vie_ans
  );

  return {
    coefficient: Math.round(coefficient * 100) / 100,
    dureeVieAns: entry.duree_vie_ans,
    applicable: true,
  };
}

/**
 * Calculate net retenue after vetuste
 */
export function calculateRetenueNette(
  coutReparationCents: number,
  coefficient: number
): number {
  return Math.round(coutReparationCents * coefficient);
}

/**
 * Display the vetuste grid with calculations for the current duration
 */
export function VetusteCalculator({
  grid,
  dureeOccupationAns,
}: VetusteCalculatorProps) {
  const dureeFormatted = dureeOccupationAns.toFixed(1);

  return (
    <Card className="border-purple-100">
      <CardHeader className="py-3 bg-purple-50/50 border-b border-purple-100">
        <CardTitle className="text-sm font-semibold text-purple-900 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Grille de vétusté — {dureeFormatted} ans d&apos;occupation
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 font-semibold">Élément</th>
                <th className="text-center px-3 py-2 font-semibold">
                  Durée de vie
                </th>
                <th className="text-center px-3 py-2 font-semibold">
                  Abattement / an
                </th>
                <th className="text-center px-3 py-2 font-semibold">
                  Coefficient applicable
                </th>
                <th className="text-center px-3 py-2 font-semibold">
                  Part locataire
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {grid.map((entry) => {
                const { coefficient } = calculateVetuste(
                  entry.element_type,
                  dureeOccupationAns,
                  grid
                );
                const partLocataire = Math.round(coefficient * 100);
                const isReduced = partLocataire < 100;

                return (
                  <tr key={entry.element_type} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <span className="font-medium capitalize">
                        {entry.element_type.replace(/_/g, " ")}
                      </span>
                      {entry.notes && (
                        <span className="block text-muted-foreground text-[10px]">
                          {entry.notes}
                        </span>
                      )}
                    </td>
                    <td className="text-center px-3 py-2">
                      {entry.duree_vie_ans} ans
                    </td>
                    <td className="text-center px-3 py-2">
                      {entry.taux_abattement_annuel}%
                    </td>
                    <td className="text-center px-3 py-2">
                      <Badge
                        variant="outline"
                        className={
                          isReduced
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-muted"
                        }
                      >
                        {coefficient.toFixed(2)}
                      </Badge>
                    </td>
                    <td className="text-center px-3 py-2">
                      <span
                        className={
                          isReduced
                            ? "font-bold text-green-700"
                            : "text-muted-foreground"
                        }
                      >
                        {partLocataire}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
