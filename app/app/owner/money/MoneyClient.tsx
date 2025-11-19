"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Search, Euro, CheckCircle, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";
import type { InvoicesWithPagination } from "../_data/fetchInvoices";

interface MoneyClientProps {
  data: InvoicesWithPagination;
}

export function MoneyClient({ data }: MoneyClientProps) {
  const { invoices, stats } = data;
  const [searchQuery, setSearchQuery] = useState("");

  // Filtrage côté client pour la recherche rapide (puisqu'on charge les 50 premières)
  // Idéalement, la recherche devrait être côté serveur, mais pour < 50 items ça va.
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const address = inv.lease?.property?.adresse_complete?.toLowerCase() || "";
    return address.includes(searchQuery.toLowerCase());
  });

  // Données graphiques simulées (car fetchInvoices ne renvoie pas l'historique 12 mois)
  // TODO: Créer une RPC stats_financieres(owner_id) pour avoir l'historique réel
  const chartData = [
    { period: "2024-01", collected: 1200 },
    { period: "2024-02", collected: 1200 },
    { period: "2024-03", collected: 1200 },
    { period: "2024-04", collected: 2400 }, // Simulation augmentation
  ];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      paid: "default",
      sent: "secondary",
      draft: "outline",
      late: "destructive",
    };
    const labels: Record<string, string> = {
      paid: "Payé",
      sent: "Envoyé",
      draft: "Brouillon",
      late: "En retard",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
            Loyers & revenus
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Suivez vos encaissements et impayés du mois
          </p>
        </div>

        {/* KPIs */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card className="hover:shadow-lg transition-all duration-300 hover:scale-105">
            <CardHeader>
              <CardTitle className="text-sm">Total dû (ce mois)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                {formatCurrency(stats.totalDue)}
              </p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-all duration-300 hover:scale-105">
            <CardHeader>
              <CardTitle className="text-sm">Total encaissé</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {formatCurrency(stats.totalCollected)}
              </p>
            </CardContent>
          </Card>
          <Card className="hover:shadow-lg transition-all duration-300 hover:scale-105">
            <CardHeader>
              <CardTitle className="text-sm">Impayés / En attente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${stats.totalUnpaid > 0 ? "text-red-600" : "text-slate-600"}`}>
                {formatCurrency(stats.totalUnpaid)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Onglets */}
        <Tabs defaultValue="current" className="space-y-6">
          <TabsList>
            <TabsTrigger value="current">Qui me doit combien ?</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          {/* Qui me doit combien */}
          <TabsContent value="current">
            <div className="mb-6 max-w-md relative">
               <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                 placeholder="Rechercher par adresse..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="pl-10"
               />
            </div>

            {filteredInvoices.length === 0 ? (
              <EmptyStateInvoices />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Période</th>
                          <th className="px-4 py-3 text-left font-medium">Bien</th>
                          <th className="px-4 py-3 text-right font-medium">Montant</th>
                          <th className="px-4 py-3 text-right font-medium">Statut</th>
                          <th className="px-4 py-3 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map((invoice) => (
                          <tr key={invoice.id} className="border-b hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-medium">{invoice.periode}</td>
                            <td className="px-4 py-3 text-muted-foreground">
                                {invoice.lease?.property?.adresse_complete || "Adresse non dispo"}
                            </td>
                            <td className="px-4 py-3 text-right font-bold">
                                {formatCurrency(invoice.montant_total)}
                            </td>
                            <td className="px-4 py-3 text-right">
                                {getStatusBadge(invoice.statut)}
                            </td>
                            <td className="px-4 py-3 text-right">
                                <Button size="sm" variant="ghost" asChild>
                                    <Link href={`/app/owner/invoices/${invoice.id}`}>Détails</Link>
                                </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Historique & performance (Placeholder pour l'instant) */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historique (Simulé)</CardTitle>
                <CardDescription>Les données réelles arriveront avec la RPC stats</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                   <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="collected" stroke="#8884d8" />
                   </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function EmptyStateInvoices() {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        <Euro className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Aucune facture trouvée</h2>
        <p className="text-muted-foreground mb-6">
          Vos factures et loyers apparaîtront ici.
        </p>
      </CardContent>
    </Card>
  );
}

