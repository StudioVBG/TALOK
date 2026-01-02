"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Euro,
  TrendingUp,
  Calendar,
  Download,
  CheckCircle,
  Clock,
  PiggyBank,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Données de démonstration
const mockCommissions = [
  {
    id: "1",
    periode: "2024-12",
    owner: "Jean Dupont",
    loyerEncaisse: 3200,
    tauxCommission: 7,
    montantHT: 224,
    tva: 44.80,
    montantTTC: 268.80,
    status: "pending",
  },
  {
    id: "2",
    periode: "2024-12",
    owner: "Marie Martin",
    loyerEncaisse: 5800,
    tauxCommission: 6.5,
    montantHT: 377,
    tva: 75.40,
    montantTTC: 452.40,
    status: "pending",
  },
  {
    id: "3",
    periode: "2024-11",
    owner: "Jean Dupont",
    loyerEncaisse: 3200,
    tauxCommission: 7,
    montantHT: 224,
    tva: 44.80,
    montantTTC: 268.80,
    status: "paid",
  },
  {
    id: "4",
    periode: "2024-11",
    owner: "Marie Martin",
    loyerEncaisse: 5800,
    tauxCommission: 6.5,
    montantHT: 377,
    tva: 75.40,
    montantTTC: 452.40,
    status: "paid",
  },
  {
    id: "5",
    periode: "2024-11",
    owner: "SCI Les Oliviers",
    loyerEncaisse: 9500,
    tauxCommission: 6,
    montantHT: 570,
    tva: 114,
    montantTTC: 684,
    status: "paid",
  },
];

const months = [
  { value: "2024-12", label: "Décembre 2024" },
  { value: "2024-11", label: "Novembre 2024" },
  { value: "2024-10", label: "Octobre 2024" },
  { value: "2024-09", label: "Septembre 2024" },
];

export default function CommissionsPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const filteredCommissions = mockCommissions.filter(
    (c) => selectedMonth === "all" || c.periode === selectedMonth
  );

  const stats = {
    totalEncaisse: mockCommissions
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + c.montantTTC, 0),
    enAttente: mockCommissions
      .filter((c) => c.status === "pending")
      .reduce((sum, c) => sum + c.montantTTC, 0),
    moyenneMensuelle: 1405.20,
    croissance: 12,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Commissions
          </h1>
          <p className="text-muted-foreground mt-1">
            Suivi de vos honoraires de gestion
          </p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Total encaissé</p>
                <p className="text-3xl font-bold mt-1">{stats.totalEncaisse.toFixed(2)}€</p>
                <div className="flex items-center gap-1 mt-2 text-emerald-200 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  +{stats.croissance}% ce mois
                </div>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <PiggyBank className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">En attente</p>
                <p className="text-3xl font-bold mt-1">{stats.enAttente.toFixed(2)}€</p>
                <p className="text-amber-200 text-sm mt-2">Ce mois</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Moyenne mensuelle</p>
                <p className="text-3xl font-bold mt-1">{stats.moyenneMensuelle.toFixed(2)}€</p>
                <p className="text-indigo-200 text-sm mt-2">Sur 12 mois</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <BarChart3 className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-pink-500 to-rose-500 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Taux moyen</p>
                <p className="text-3xl font-bold mt-1">6.5%</p>
                <p className="text-pink-200 text-sm mt-2">Commission</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <Euro className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les périodes</SelectItem>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Commissions Table */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Détail des commissions</CardTitle>
          <CardDescription>Commissions par propriétaire et par période</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Période</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Propriétaire</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Loyers encaissés</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Taux</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Commission HT</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">TVA</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Total TTC</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody>
                {filteredCommissions.map((commission) => (
                  <tr
                    key={commission.id}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-4 px-6">
                      <span className="font-medium">
                        {months.find((m) => m.value === commission.periode)?.label || commission.periode}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-medium">{commission.owner}</span>
                    </td>
                    <td className="py-4 px-4 text-right font-medium">
                      {commission.loyerEncaisse.toLocaleString("fr-FR")}€
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge variant="outline" className="border-indigo-500 text-indigo-600">
                        {commission.tauxCommission}%
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-right">
                      {commission.montantHT.toFixed(2)}€
                    </td>
                    <td className="py-4 px-4 text-right text-muted-foreground">
                      {commission.tva.toFixed(2)}€
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-indigo-600">
                      {commission.montantTTC.toFixed(2)}€
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          commission.status === "paid"
                            ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                            : "border-amber-500 text-amber-600 bg-amber-50"
                        )}
                      >
                        {commission.status === "paid" ? (
                          <><CheckCircle className="w-3 h-3 mr-1" /> Encaissé</>
                        ) : (
                          <><Clock className="w-3 h-3 mr-1" /> En attente</>
                        )}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
                  <td className="py-4 px-6" colSpan={4}>Total</td>
                  <td className="py-4 px-4 text-right">
                    {filteredCommissions.reduce((sum, c) => sum + c.montantHT, 0).toFixed(2)}€
                  </td>
                  <td className="py-4 px-4 text-right">
                    {filteredCommissions.reduce((sum, c) => sum + c.tva, 0).toFixed(2)}€
                  </td>
                  <td className="py-4 px-4 text-right text-indigo-600">
                    {filteredCommissions.reduce((sum, c) => sum + c.montantTTC, 0).toFixed(2)}€
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

