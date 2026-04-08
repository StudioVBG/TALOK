"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, AlertTriangle, ArrowDown, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RetenueItem {
  item_id: string;
  room_name: string;
  item_name: string;
  element_type: string | null;
  entry_condition: string | null;
  exit_condition: string | null;
  cout_reparation_cents: number;
  vetuste_applicable: boolean;
  vetuste_coefficient: number;
  retenue_cents: number;
}

interface RetenueSummaryData {
  total_retenue_cents: number;
  depot_garantie_cents: number;
  montant_restitue_cents: number;
  nb_degradations: number;
  duree_occupation_ans: number;
}

interface RetenueSummaryProps {
  retenues: RetenueItem[];
  summary: RetenueSummaryData;
}

function formatCents(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}

export function RetenueSummary({ retenues, summary }: RetenueSummaryProps) {
  const hasRetenues = summary.total_retenue_cents > 0;

  return (
    <div className="space-y-4">
      {/* Tableau détaillé des retenues */}
      {retenues.length > 0 && (
        <Card className="border-orange-100">
          <CardHeader className="py-3 bg-orange-50/50 border-b border-orange-100">
            <CardTitle className="text-sm font-semibold text-orange-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Détail des retenues — {retenues.length} dégradation
              {retenues.length > 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2 font-semibold">Pièce</th>
                    <th className="text-left px-3 py-2 font-semibold">
                      Élément
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      État entrée
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      État sortie
                    </th>
                    <th className="text-right px-3 py-2 font-semibold">
                      Coût réparation
                    </th>
                    <th className="text-center px-3 py-2 font-semibold">
                      Vétusté
                    </th>
                    <th className="text-right px-3 py-2 font-semibold">
                      Retenue nette
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {retenues.map((r) => (
                    <tr key={r.item_id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium">{r.room_name}</td>
                      <td className="px-3 py-2">
                        {r.item_name}
                        {r.element_type && (
                          <span className="text-muted-foreground ml-1">
                            ({r.element_type})
                          </span>
                        )}
                      </td>
                      <td className="text-center px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">
                          {r.entry_condition || "—"}
                        </Badge>
                      </td>
                      <td className="text-center px-3 py-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-red-200 text-red-700"
                        >
                          {r.exit_condition || "—"}
                        </Badge>
                      </td>
                      <td className="text-right px-3 py-2 font-mono">
                        {formatCents(r.cout_reparation_cents)}
                      </td>
                      <td className="text-center px-3 py-2">
                        {r.vetuste_applicable ? (
                          <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">
                            ×{r.vetuste_coefficient.toFixed(2)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-right px-3 py-2 font-mono font-bold text-red-700">
                        {formatCents(r.retenue_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/50">
                    <td
                      colSpan={6}
                      className="px-3 py-2 text-right font-bold text-sm"
                    >
                      Total retenues
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-red-700 text-sm">
                      {formatCents(summary.total_retenue_cents)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résumé restitution dépôt */}
      <Card
        className={cn(
          "border-2",
          hasRetenues ? "border-orange-200" : "border-green-200"
        )}
      >
        <CardHeader className="py-3 border-b">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Restitution du dépôt de garantie
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm">Dépôt de garantie</span>
            <span className="font-mono font-bold text-base">
              {formatCents(summary.depot_garantie_cents)}
            </span>
          </div>

          {hasRetenues && (
            <>
              <div className="flex justify-between items-center text-red-700">
                <span className="text-sm flex items-center gap-1">
                  <ArrowDown className="h-3 w-3" />
                  Retenues ({summary.nb_degradations} dégradation
                  {summary.nb_degradations > 1 ? "s" : ""})
                </span>
                <span className="font-mono font-bold text-base">
                  − {formatCents(summary.total_retenue_cents)}
                </span>
              </div>
              <div className="border-t pt-3" />
            </>
          )}

          <div className="flex justify-between items-center">
            <span className="text-base font-bold flex items-center gap-2">
              {hasRetenues ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Montant à restituer
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Restitution intégrale
                </>
              )}
            </span>
            <span
              className={cn(
                "font-mono font-bold text-xl",
                hasRetenues ? "text-orange-700" : "text-green-700"
              )}
            >
              {formatCents(summary.montant_restitue_cents)}
            </span>
          </div>

          {hasRetenues && (
            <p className="text-xs text-muted-foreground mt-2">
              Restitution sous 2 mois (article 22 loi n° 89-462).
              Durée d&apos;occupation : {summary.duree_occupation_ans.toFixed(1)} ans.
            </p>
          )}
          {!hasRetenues && (
            <p className="text-xs text-muted-foreground mt-2">
              Aucune dégradation constatée. Restitution sous 1 mois
              (article 22 loi n° 89-462).
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
