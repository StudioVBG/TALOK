"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Euro,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  CreditCard,
  Clock,
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
const mockTransactions = [
  { id: "1", type: "loyer", description: "Loyer - Sophie Bernard", amount: 1450, date: "05/12/2024", status: "completed" },
  { id: "2", type: "loyer", description: "Loyer - Lucas Petit", amount: 650, date: "04/12/2024", status: "completed" },
  { id: "3", type: "commission", description: "Commission - Jean Dupont", amount: -224, date: "03/12/2024", status: "completed" },
  { id: "4", type: "loyer", description: "Loyer - Emma Durand", amount: 1100, date: "02/12/2024", status: "pending" },
  { id: "5", type: "loyer", description: "Loyer - Marc Dubois", amount: 750, date: "01/12/2024", status: "completed" },
  { id: "6", type: "commission", description: "Commission - Marie Martin", amount: -377, date: "30/11/2024", status: "completed" },
  { id: "7", type: "virement", description: "Virement vers propriétaire - Jean Dupont", amount: -2976, date: "28/11/2024", status: "completed" },
];

export default function AgencyFinancesPage() {
  const [period, setPeriod] = useState("month");

  const stats = {
    loyersEncaisses: 52800,
    loyersEnAttente: 3200,
    commissionsGenerees: 3696,
    virementsEffectues: 49104,
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
            Finances
          </h1>
          <p className="text-muted-foreground mt-1">
            Vue d'ensemble des flux financiers
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[150px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="quarter">Ce trimestre</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Loyers encaissés</p>
                <p className="text-3xl font-bold mt-1">{stats.loyersEncaisses.toLocaleString("fr-FR")}€</p>
                <div className="flex items-center gap-1 mt-2 text-emerald-200 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  +8% vs mois dernier
                </div>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <ArrowDownRight className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">En attente</p>
                <p className="text-3xl font-bold mt-1">{stats.loyersEnAttente.toLocaleString("fr-FR")}€</p>
                <p className="text-amber-200 text-sm mt-2">4 paiements</p>
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
                <p className="text-sm text-white/80">Commissions</p>
                <p className="text-3xl font-bold mt-1">{stats.commissionsGenerees.toLocaleString("fr-FR")}€</p>
                <div className="flex items-center gap-1 mt-2 text-indigo-200 text-sm">
                  <TrendingUp className="w-4 h-4" />
                  +12% vs mois dernier
                </div>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <PiggyBank className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-slate-600 to-slate-700 text-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80">Virements effectués</p>
                <p className="text-3xl font-bold mt-1">{stats.virementsEffectues.toLocaleString("fr-FR")}€</p>
                <p className="text-slate-300 text-sm mt-2">Vers propriétaires</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <ArrowUpRight className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Dernières transactions</CardTitle>
          <CardDescription>Mouvements financiers récents</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Date</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Description</th>
                  <th className="text-left py-4 px-4 text-sm font-medium text-muted-foreground">Type</th>
                  <th className="text-right py-4 px-4 text-sm font-medium text-muted-foreground">Montant</th>
                  <th className="text-center py-4 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                </tr>
              </thead>
              <tbody>
                {mockTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-4 px-6 text-sm">{transaction.date}</td>
                    <td className="py-4 px-4 font-medium">{transaction.description}</td>
                    <td className="py-4 px-4">
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        transaction.type === "loyer" && "border-emerald-500 text-emerald-600",
                        transaction.type === "commission" && "border-indigo-500 text-indigo-600",
                        transaction.type === "virement" && "border-slate-500 text-slate-600"
                      )}>
                        {transaction.type === "loyer" ? "Loyer" : 
                         transaction.type === "commission" ? "Commission" : "Virement"}
                      </Badge>
                    </td>
                    <td className={cn(
                      "py-4 px-4 text-right font-bold",
                      transaction.amount > 0 ? "text-emerald-600" : "text-slate-600"
                    )}>
                      {transaction.amount > 0 ? "+" : ""}{transaction.amount.toLocaleString("fr-FR")}€
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          transaction.status === "completed" 
                            ? "border-emerald-500 text-emerald-600 bg-emerald-50"
                            : "border-amber-500 text-amber-600 bg-amber-50"
                        )}
                      >
                        {transaction.status === "completed" ? "Effectué" : "En attente"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="border-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold">Résumé du mois</h3>
              <p className="text-white/80 text-sm mt-1">
                Vous avez encaissé {stats.loyersEncaisses.toLocaleString("fr-FR")}€ de loyers et généré{" "}
                {stats.commissionsGenerees.toLocaleString("fr-FR")}€ de commissions.
              </p>
            </div>
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-3xl font-bold">98%</p>
                <p className="text-xs text-white/70">Taux recouvrement</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">2j</p>
                <p className="text-xs text-white/70">Délai moyen paiement</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

