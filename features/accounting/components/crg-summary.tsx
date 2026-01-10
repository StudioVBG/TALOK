"use client";

/**
 * Composant de résumé du Compte Rendu de Gestion
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileText, TrendingDown, TrendingUp } from "lucide-react";
import { useCRG } from "../hooks/use-accounting";
import { formatCurrency, formatDate } from "@/lib/utils";

interface CRGSummaryProps {
  ownerId?: string;
  startDate: string;
  endDate: string;
  onExportPDF?: () => void;
}

export function CRGSummary({
  ownerId,
  startDate,
  endDate,
  onExportPDF,
}: CRGSummaryProps) {
  const { crgs, isLoading, error } = useCRG(ownerId, startDate, endDate);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Erreur lors du chargement du CRG
        </CardContent>
      </Card>
    );
  }

  if (!crgs || crgs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <p>Aucun CRG disponible pour cette période</p>
          <p className="text-sm mt-2">
            Sélectionnez une période avec des mouvements comptables
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {crgs.map((crg, index) => (
        <Card key={crg.numero || index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-lg">{crg.bien?.adresse}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {crg.bien?.ville} - {crg.periode?.libelle}
              </p>
            </div>
            <Badge variant={crg.solde_fin_periode >= 0 ? "default" : "destructive"}>
              {crg.solde_fin_periode >= 0 ? "Créditeur" : "Débiteur"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-muted-foreground">Encaissements</span>
                </div>
                <p className="text-lg font-semibold text-green-600">
                  {formatCurrency(crg.totaux?.total_credits || 0)}
                </p>
              </div>

              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-xs text-muted-foreground">Débits</span>
                </div>
                <p className="text-lg font-semibold text-red-600">
                  {formatCurrency(crg.totaux?.total_debits || 0)}
                </p>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <span className="text-xs text-muted-foreground">Honoraires</span>
                <p className="text-lg font-semibold">
                  {formatCurrency(crg.recapitulatif?.honoraires_preleves || 0)}
                </p>
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <span className="text-xs text-muted-foreground">Solde fin</span>
                <p
                  className={`text-lg font-semibold ${
                    crg.solde_fin_periode >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(crg.solde_fin_periode || 0)}
                </p>
              </div>
            </div>

            {crg.locataire && (
              <p className="text-sm text-muted-foreground mb-4">
                Locataire: {crg.locataire.prenom} {crg.locataire.nom}
              </p>
            )}

            {/* Liste des mouvements */}
            {crg.mouvements && crg.mouvements.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Libellé</th>
                      <th className="text-right p-2">Débit</th>
                      <th className="text-right p-2">Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crg.mouvements.slice(0, 5).map((mouvement: any) => (
                      <tr key={mouvement.id} className="border-t">
                        <td className="p-2">{formatDate(mouvement.date)}</td>
                        <td className="p-2">{mouvement.libelle}</td>
                        <td className="text-right p-2 text-red-600">
                          {mouvement.type === "debit"
                            ? formatCurrency(mouvement.montant)
                            : "-"}
                        </td>
                        <td className="text-right p-2 text-green-600">
                          {mouvement.type === "credit"
                            ? formatCurrency(mouvement.montant)
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {crg.mouvements.length > 5 && (
                  <p className="p-2 text-center text-xs text-muted-foreground bg-muted">
                    + {crg.mouvements.length - 5} autres mouvements
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <Button variant="outline" size="sm" onClick={onExportPDF}>
                <Download className="h-4 w-4 mr-2" />
                Exporter PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
