"use client";
// @ts-nocheck

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Search, Euro, CheckCircle, AlertCircle, Building2, Loader2, Bell } from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";
import type { InvoicesWithPagination } from "../_data/fetchInvoices";
import { markInvoiceAsPaid, sendPaymentReminder, generateMonthlyInvoices } from "./actions";
import { useToast } from "@/components/ui/use-toast";

// SOTA Imports
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { EmptyState } from "@/components/ui/empty-state";

interface MoneyClientProps {
  data: InvoicesWithPagination;
}

export function MoneyClient({ data }: MoneyClientProps) {
  const { invoices, stats } = data;
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingInvoice, setPendingInvoice] = useState<{ id: string; action: "pay" | "remind" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGenerating, startGenerateTransition] = useTransition();
  const { toast } = useToast();

  // Filtrage côté client
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const address = inv.lease?.property?.adresse_complete?.toLowerCase() || "";
    return address.includes(searchQuery.toLowerCase());
  });

  const chartData = [
    { period: "2024-01", collected: 1200 },
    { period: "2024-02", collected: 1200 },
    { period: "2024-03", collected: 1200 },
    { period: "2024-04", collected: 2400 },
  ];

  const handleMarkPaid = (invoiceId: string) => {
    setPendingInvoice({ id: invoiceId, action: "pay" });
    startTransition(async () => {
      const result = await markInvoiceAsPaid(invoiceId);
      if (result.success) {
        toast({ title: "Facture payée", description: "Le statut a été mis à jour." });
      } else {
        toast({ title: "Impossible de marquer comme payé", description: result.error, variant: "destructive" });
      }
      setPendingInvoice(null);
    });
  };

  const handleReminder = (invoiceId: string) => {
    setPendingInvoice({ id: invoiceId, action: "remind" });
    startTransition(async () => {
      const result = await sendPaymentReminder(invoiceId);
      if (result.success) {
        toast({ title: "Rappel envoyé", description: "Le locataire sera notifié." });
      } else {
        toast({ title: "Erreur lors de l'envoi", description: result.error, variant: "destructive" });
      }
      setPendingInvoice(null);
    });
  };

  const handleGenerateInvoices = () => {
    startGenerateTransition(async () => {
      const result = await generateMonthlyInvoices();
      if (result.success) {
        toast({
          title: "Factures générées",
          description: result.data
            ? `${result.data.count} facture(s) créée(s) pour la période courante.`
            : "Aucune nouvelle facture ce mois-ci.",
        });
      } else {
        toast({ title: "Generation impossible", description: result.error, variant: "destructive" });
      }
    });
  };

  // Définition des colonnes pour ResponsiveTable
  const columns = [
    {
      header: "Période",
      accessorKey: "periode" as const, // Cast to avoid type error
      className: "font-medium",
    },
    {
      header: "Bien",
      cell: (invoice: any) => (
        <span className="text-muted-foreground">
          {invoice.lease?.property?.adresse_complete || "Adresse non dispo"}
        </span>
      ),
    },
    {
      header: "Montant",
      className: "text-right",
      cell: (invoice: any) => (
        <span className="font-bold">{formatCurrency(invoice.montant_total)}</span>
      ),
    },
    {
      header: "Statut",
      className: "text-right",
      cell: (invoice: any) => (
        <div className="flex justify-end">
           <StatusBadge 
            status={invoice.statut === "paid" ? "Payé" : invoice.statut === "sent" ? "Envoyé" : invoice.statut === "late" ? "En retard" : "Brouillon"} 
            type={invoice.statut === "paid" ? "success" : invoice.statut === "late" ? "error" : "neutral"} 
          />
        </div>
      ),
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (invoice: any) => (
        <div className="flex items-center justify-end gap-2">
            {invoice.statut !== "paid" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkPaid(invoice.id);
                  }}
                  disabled={
                    isPending &&
                    pendingInvoice?.id === invoice.id &&
                    pendingInvoice.action === "pay"
                  }
                  className="gap-2"
                >
                  {isPending &&
                  pendingInvoice?.id === invoice.id &&
                  pendingInvoice.action === "pay" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCircle className="h-3 w-3" />
                  )}
                  <span className="hidden md:inline">Payer</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReminder(invoice.id);
                  }}
                  disabled={
                    isPending &&
                    pendingInvoice?.id === invoice.id &&
                    pendingInvoice.action === "remind"
                  }
                  className="gap-2"
                >
                  {isPending &&
                  pendingInvoice?.id === invoice.id &&
                  pendingInvoice.action === "remind" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <AlertCircle className="h-3 w-3" />
                  )}
                  <span className="hidden md:inline">Relancer</span>
                </Button>
              </>
            )}
            <Button size="sm" variant="ghost" asChild onClick={(e) => e.stopPropagation()}>
              <Link href={`/app/owner/invoices/${invoice.id}`}>Détails</Link>
            </Button>
        </div>
      ),
    },
  ];

  return (
    <PageTransition>
      <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header */}
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
                Loyers & revenus
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Suivez vos encaissements et impayés du mois
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                className="gap-2 shadow-lg hover:shadow-xl transition-all"
                onClick={handleGenerateInvoices}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Générer les factures du mois
              </Button>
              <Button asChild variant="outline" className="gap-2 bg-white/50 backdrop-blur-sm">
                <Link href="/app/owner/money/settings">
                  <Building2 className="w-4 h-4" />
                  Connexions Bancaires
                </Link>
              </Button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <GlassCard gradient={true} hoverEffect={true}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total dû (ce mois)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                   <AnimatedCounter value={stats.totalDue} type="currency" />
                </div>
              </CardContent>
            </GlassCard>
            
            <GlassCard gradient={true} hoverEffect={true}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total encaissé</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                   <AnimatedCounter value={stats.totalCollected} type="currency" />
                </div>
              </CardContent>
            </GlassCard>
            
            <GlassCard gradient={true} hoverEffect={true}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Impayés / En attente</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${stats.totalUnpaid > 0 ? "text-red-600" : "text-slate-600"}`}>
                   <AnimatedCounter value={stats.totalUnpaid} type="currency" />
                </div>
              </CardContent>
            </GlassCard>
          </div>

          {/* Onglets */}
          <Tabs defaultValue="current" className="space-y-6">
            <TabsList className="bg-white/50 backdrop-blur-sm border">
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
                   className="pl-10 bg-white/80 backdrop-blur-sm"
                 />
              </div>

              {filteredInvoices.length === 0 ? (
                <EmptyState
                    title="Aucune facture"
                    description="Vos factures et loyers apparaîtront ici."
                    icon={Euro}
                 />
              ) : (
                <GlassCard className="p-0 overflow-hidden">
                   <ResponsiveTable
                      data={filteredInvoices}
                      columns={columns}
                      keyExtractor={(inv) => inv.id}
                    />
                </GlassCard>
              )}
            </TabsContent>

            {/* Historique */}
            <TabsContent value="history">
              <GlassCard>
                <CardHeader>
                  <CardTitle>Historique (Simulé)</CardTitle>
                  <CardDescription>Les données réelles arriveront avec la RPC stats</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                     <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="period" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="collected" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: "#3b82f6" }} activeDot={{ r: 6 }} />
                     </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </GlassCard>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageTransition>
  );
}
