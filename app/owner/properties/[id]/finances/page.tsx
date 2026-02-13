"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Euro, TrendingUp, TrendingDown,
  Receipt, Calendar, Loader2, BarChart3,
} from "lucide-react";

export default function FinancesPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;

  // Placeholder data - will be populated from leases/invoices
  const [loading, setLoading] = useState(false);

  const stats = useMemo(() => ({
    monthlyRent: 0,
    monthlyCharges: 0,
    annualRevenue: 0,
    occupancyRate: 0,
    unpaidCount: 0,
    unpaidAmount: 0,
  }), []);

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> Finances
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Euro className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats.monthlyRent} €</p>
            <p className="text-xs text-muted-foreground">Loyer mensuel</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Receipt className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats.monthlyCharges} €</p>
            <p className="text-xs text-muted-foreground">Charges</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats.annualRevenue} €</p>
            <p className="text-xs text-muted-foreground">Revenus annuels</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Calendar className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold">{stats.occupancyRate}%</p>
            <p className="text-xs text-muted-foreground">Taux d'occupation</p>
          </CardContent>
        </Card>
      </div>

      {/* Unpaid Alert */}
      {stats.unpaidCount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 flex items-center gap-4">
            <TrendingDown className="h-8 w-8 text-red-600" />
            <div>
              <p className="font-semibold text-red-800">
                {stats.unpaidCount} loyer(s) impayé(s)
              </p>
              <p className="text-sm text-red-700">
                Montant total : {stats.unpaidAmount} €
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue History placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Historique des revenus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-4 opacity-30" />
            <p className="font-medium">Aucun historique disponible</p>
            <p className="text-sm mt-1">
              Les revenus apparaîtront ici une fois un bail actif créé.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Expenses placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Charges et dépenses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Receipt className="h-12 w-12 mb-4 opacity-30" />
            <p className="font-medium">Aucune dépense enregistrée</p>
            <p className="text-sm mt-1">
              Enregistrez vos dépenses (travaux, taxe foncière, assurance...)
              pour suivre la rentabilité de votre bien.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
