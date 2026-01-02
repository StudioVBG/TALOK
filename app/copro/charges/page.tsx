"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Euro,
  Search,
  Download,
  Filter,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

interface Charge {
  id: string;
  site_name: string;
  period: string;
  type: "quarterly" | "annual" | "exceptional";
  amount: number;
  paid_amount: number;
  status: "pending" | "partial" | "paid" | "overdue";
  due_date: string;
}

const statusConfig = {
  pending: { label: "À payer", color: "bg-amber-100 text-amber-700", icon: Clock },
  partial: { label: "Partiel", color: "bg-blue-100 text-blue-700", icon: AlertCircle },
  paid: { label: "Payé", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  overdue: { label: "En retard", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

const typeLabels = {
  quarterly: "Trimestriel",
  annual: "Annuel",
  exceptional: "Exceptionnel",
};

export default function CoproChargesPage() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    async function fetchCharges() {
      try {
        const response = await fetch("/api/copro/charges");
        if (response.ok) {
          const data = await response.json();
          setCharges(data.charges || data || []);
        }
      } catch (error) {
        console.error("Erreur chargement charges:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCharges();
  }, []);

  const filteredCharges = charges.filter((charge) => {
    const matchesSearch =
      !searchQuery ||
      charge.site_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      charge.period?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "pending") return matchesSearch && (charge.status === "pending" || charge.status === "partial");
    if (activeTab === "paid") return matchesSearch && charge.status === "paid";
    if (activeTab === "overdue") return matchesSearch && charge.status === "overdue";
    return matchesSearch;
  });

  const stats = {
    totalDue: charges
      .filter((c) => c.status !== "paid")
      .reduce((sum, c) => sum + (c.amount - c.paid_amount), 0),
    totalPaid: charges.reduce((sum, c) => sum + c.paid_amount, 0),
    pendingCount: charges.filter((c) => c.status === "pending" || c.status === "partial").length,
    overdueCount: charges.filter((c) => c.status === "overdue").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
            Charges de copropriété
          </h1>
          <p className="text-muted-foreground mt-1">
            Suivez et payez vos appels de charges
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exporter
        </Button>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">À régler</p>
                <p className="text-2xl font-bold text-amber-600">
                  {stats.totalDue.toLocaleString("fr-FR")} €
                </p>
              </div>
              <Euro className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Payé cette année</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.totalPaid.toLocaleString("fr-FR")} €
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold">{stats.pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En retard</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdueCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters & Tabs */}
      <motion.div variants={itemVariants} className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white/80 backdrop-blur-sm"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/80 backdrop-blur-sm">
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="pending">À payer</TabsTrigger>
            <TabsTrigger value="paid">Payés</TabsTrigger>
            <TabsTrigger value="overdue">En retard</TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {/* Charges List */}
      <motion.div variants={itemVariants}>
        {filteredCharges.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="py-16 text-center">
              <Euro className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucune charge</h3>
              <p className="text-muted-foreground">
                {charges.length === 0
                  ? "Vous n'avez pas encore de charges de copropriété."
                  : "Aucun résultat ne correspond à vos critères."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredCharges.map((charge) => {
              const status = statusConfig[charge.status];
              const StatusIcon = status.icon;
              const progressPercent = charge.amount > 0
                ? Math.round((charge.paid_amount / charge.amount) * 100)
                : 0;

              return (
                <Card
                  key={charge.id}
                  className="bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
                >
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={status.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                          <Badge variant="outline">{typeLabels[charge.type]}</Badge>
                        </div>
                        
                        <h3 className="font-semibold text-lg">{charge.period}</h3>
                        
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            {charge.site_name}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Échéance: {format(new Date(charge.due_date), "dd/MM/yyyy", { locale: fr })}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            {charge.amount.toLocaleString("fr-FR")} €
                          </p>
                          {charge.paid_amount > 0 && charge.paid_amount < charge.amount && (
                            <p className="text-sm text-muted-foreground">
                              Payé: {charge.paid_amount.toLocaleString("fr-FR")} € ({progressPercent}%)
                            </p>
                          )}
                        </div>

                        {charge.status !== "paid" && (
                          <Button
                            size="sm"
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                          >
                            <Euro className="mr-2 h-4 w-4" />
                            Payer
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar for partial payments */}
                    {charge.paid_amount > 0 && charge.paid_amount < charge.amount && (
                      <div className="mt-4">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

