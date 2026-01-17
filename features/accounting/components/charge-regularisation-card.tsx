"use client";

/**
 * Composant de régularisation des charges
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, CheckCircle, AlertCircle, Plus, FileText } from "lucide-react";
import { useRegularisations } from "../hooks/use-accounting";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface ChargeRegularisationCardProps {
  leaseId: string;
  propertyAddress?: string;
  tenantName?: string;
}

export function ChargeRegularisationCard({
  leaseId,
  propertyAddress,
  tenantName,
}: ChargeRegularisationCardProps) {
  const {
    regularisations,
    isLoading,
    createRegularisation,
    applyRegularisation,
  } = useRegularisations(leaseId);

  const [isCreating, setIsCreating] = useState(false);
  const [selectedYear, setSelectedYear] = useState(
    (new Date().getFullYear() - 1).toString()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i - 1);

  const handleCreate = async () => {
    setIsSubmitting(true);
    try {
      await createRegularisation(parseInt(selectedYear));
      toast.success("Régularisation créée avec succès");
      setIsCreating(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApply = async (id: string) => {
    try {
      await applyRegularisation(id);
      toast.success("Régularisation appliquée");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'application");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Régularisation des charges
          </CardTitle>
          {propertyAddress && (
            <CardDescription>
              {propertyAddress} {tenantName && `- ${tenantName}`}
            </CardDescription>
          )}
        </div>

        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle régularisation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une régularisation</DialogTitle>
              <DialogDescription>
                Calculer la régularisation annuelle des charges pour ce bail
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="year">Année de régularisation</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger id="year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="text-sm text-muted-foreground">
                Le calcul utilisera les provisions versées et les charges réelles
                enregistrées pour cette année.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreate} disabled={isSubmitting}>
                {isSubmitting ? "Calcul en cours..." : "Calculer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {regularisations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Aucune régularisation enregistrée</p>
            <p className="text-sm mt-2">
              Créez une régularisation annuelle pour calculer le solde des charges
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {regularisations.map((regul) => (
              <div
                key={regul.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Année {regul.year}</span>
                    <Badge
                      variant={
                        regul.status === "applied"
                          ? "default"
                          : regul.status === "draft"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {regul.status === "applied"
                        ? "Appliquée"
                        : regul.status === "draft"
                        ? "Brouillon"
                        : regul.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Provisions: {formatCurrency(regul.provisions_received)} | Charges
                    réelles: {formatCurrency(regul.actual_charges)}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Solde</p>
                    <p
                      className={`text-lg font-semibold ${
                        regul.balance >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {regul.balance >= 0 ? "+" : ""}
                      {formatCurrency(regul.balance)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {regul.balance >= 0
                        ? "Trop perçu (à rembourser)"
                        : "Complément dû"}
                    </p>
                  </div>

                  {regul.status === "draft" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApply(regul.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Appliquer
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
