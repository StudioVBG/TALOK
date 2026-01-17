"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reportsService, type ReportData } from "@/features/reports/services/reports.service";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatCurrency } from "@/lib/helpers/format";
import { useToast } from "@/components/ui/use-toast";

function ReportsPageContent() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const generateReport = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const data = await reportsService.generateOwnerReport(
        profile.id,
        startDate || undefined,
        endDate || undefined
      );
      setReportData(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de générer le rapport.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async () => {
    if (!reportData) return;

    try {
      const csv = await reportsService.exportToCSV(reportData);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'exporter le rapport.",
        variant: "destructive",
      });
    }
  };

  const exportToJSON = async () => {
    if (!reportData) return;

    try {
      const json = await reportsService.exportToJSON(reportData);
      const blob = new Blob([json], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'exporter le rapport.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rapports</h1>
        <p className="text-muted-foreground">Générez et exportez vos rapports</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Générer un rapport</CardTitle>
          <CardDescription>Sélectionnez une période pour générer votre rapport</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Date de début (optionnel)</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Date de fin (optionnel)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={generateReport} disabled={loading}>
            {loading ? "Génération..." : "Générer le rapport"}
          </Button>
        </CardContent>
      </Card>

      {reportData && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Résumé</CardTitle>
                  <CardDescription>Vue d'ensemble de votre activité</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={exportToCSV}>
                    Exporter CSV
                  </Button>
                  <Button variant="outline" onClick={exportToJSON}>
                    Exporter JSON
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Logements</p>
                  <p className="text-2xl font-bold">{reportData.summary.totalProperties}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Baux</p>
                  <p className="text-2xl font-bold">{reportData.summary.totalLeases}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Factures</p>
                  <p className="text-2xl font-bold">{reportData.summary.totalInvoices}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Revenus totaux</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(reportData.summary.totalRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Factures payées</p>
                  <p className="text-2xl font-bold text-green-600">
                    {reportData.summary.paidInvoices}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Factures impayées</p>
                  <p className="text-2xl font-bold text-red-600">
                    {reportData.summary.unpaidInvoices}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Détails des factures</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Période</th>
                      <th className="text-right p-2">Montant</th>
                      <th className="text-center p-2">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b">
                        <td className="p-2">{invoice.periode}</td>
                        <td className="text-right p-2">{formatCurrency(invoice.montant_total)}</td>
                        <td className="text-center p-2">
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              invoice.statut === "paid"
                                ? "bg-green-100 text-green-800"
                                : invoice.statut === "late"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {invoice.statut}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "owner"]}>
      <ReportsPageContent />
    </ProtectedRoute>
  );
}

