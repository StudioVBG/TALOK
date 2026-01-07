"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
  AreaChart,
  ComposedChart,
} from "recharts";
import { Search, Euro, CheckCircle, AlertCircle, Building2, Loader2, Bell, Download, Info } from "lucide-react";
import { exportInvoices } from "@/lib/services/export-service";
import { formatCurrency } from "@/lib/helpers/format";
import type { InvoicesWithPagination, InvoiceRow } from "../_data/fetchInvoices";
import { markInvoiceAsPaid, sendPaymentReminder, generateMonthlyInvoices } from "./actions";
import { useToast } from "@/components/ui/use-toast";
import { calculateTaxes } from "@/lib/services/tax-engine";

// SOTA Imports
import { PageTransition } from "@/components/ui/page-transition";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlanGateInline, UsageLimitBanner } from "@/components/subscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ManualPaymentDialog } from "@/components/payments";

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
  
  // État pour le dialogue de paiement manuel
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<InvoiceRow | null>(null);

  // Détection des biens en DROM pour alerte fiscale SOTA 2026
  const dromProperties = useMemo(() => {
    const dromPrefixes = ["971", "972", "973", "974", "976"];
    const uniqueDromPrefixes = new Set<string>();
    
    invoices.forEach(inv => {
      const zip = inv.lease?.property?.code_postal;
      if (zip && dromPrefixes.includes(zip.substring(0, 3))) {
        uniqueDromPrefixes.add(zip.substring(0, 3));
      }
    });
    
    return Array.from(uniqueDromPrefixes);
  }, [invoices]);

  // Filtrage côté client
  const filteredInvoices = invoices.filter((inv) => {
    if (!searchQuery) return true;
    const address = inv.lease?.property?.adresse_complete?.toLowerCase() || "";
    return address.includes(searchQuery.toLowerCase());
  });

  // Générer les données du graphique à partir des factures réelles
  const chartData = useMemo(() => {
    // Grouper les factures par mois (derniers 12 mois)
    const monthlyData: Record<string, { paid: number; pending: number; late: number }> = {};
    
    // Initialiser les 12 derniers mois
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[key] = { paid: 0, pending: 0, late: 0 };
    }
    
    // Remplir avec les données réelles
    invoices.forEach((inv: any) => {
      if (!inv.periode) return;
      const period = inv.periode.substring(0, 7); // Format YYYY-MM
      if (monthlyData[period]) {
        const amount = Number(inv.montant_total) || 0;
        if (inv.statut === "paid") {
          monthlyData[period].paid += amount;
        } else if (inv.statut === "late") {
          monthlyData[period].late += amount;
        } else {
          monthlyData[period].pending += amount;
        }
      }
    });
    
    // Convertir en tableau pour Recharts
    return Object.entries(monthlyData).map(([period, data]) => ({
      period: period,
      periodLabel: new Date(period + "-01").toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
      collected: data.paid,
      pending: data.pending,
      late: data.late,
      total: data.paid + data.pending + data.late,
    }));
  }, [invoices]);

  // Ouvrir le dialogue de paiement manuel
  const handleOpenPaymentDialog = (invoice: InvoiceRow) => {
    setSelectedInvoiceForPayment(invoice);
    setPaymentDialogOpen(true);
  };
  
  // Callback après paiement
  const handlePaymentComplete = () => {
    setPaymentDialogOpen(false);
    setSelectedInvoiceForPayment(null);
    // Refresh la page pour mettre à jour les données
    window.location.reload();
  };

  const handleMarkPaid = (invoiceId: string) => {
    // Trouver la facture pour ouvrir le dialogue
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      handleOpenPaymentDialog(invoice);
    }
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
              <Link href={`/owner/invoices/${invoice.id}`}>Détails</Link>
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
              {/* Bouton Export CSV */}
              <Button
                variant="outline"
                className="gap-2 bg-white/50 backdrop-blur-sm"
                onClick={() => exportInvoices(filteredInvoices.map(inv => ({
                  ...inv,
                  tenant_name: inv.lease?.signers?.[0]?.profile?.prenom + ' ' + inv.lease?.signers?.[0]?.profile?.nom || 'N/A',
                  property_address: inv.lease?.property?.adresse_complete || 'N/A',
                })), "csv")}
                disabled={filteredInvoices.length === 0}
              >
                <Download className="h-4 w-4" />
                Exporter
              </Button>
              
              <Button
                variant="default"
                className="gap-2 shadow-lg hover:shadow-xl transition-all"
                onClick={handleGenerateInvoices}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                Générer les factures du mois
              </Button>
              {/* PlanGate SOTA 2025 - Open Banking */}
              <PlanGateInline feature="open_banking">
                <Button asChild variant="outline" className="gap-2 bg-white/50 backdrop-blur-sm">
                  <Link href="/owner/money/settings">
                    <Building2 className="w-4 h-4" />
                    Connexions Bancaires
                  </Link>
                </Button>
              </PlanGateInline>
            </div>
          </div>

          {/* Usage Limit Banner SOTA 2025 */}
          <div className="mb-6 space-y-4">
            <UsageLimitBanner
              resource="leases"
              variant="inline"
              threshold={80}
              dismissible={true}
            />

            {dromProperties.length > 0 && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800 font-semibold">Configuration Fiscale DROM active</AlertTitle>
                <AlertDescription className="text-blue-700">
                  Certains de vos biens sont situés dans les DROM ({dromProperties.join(", ")}). 
                  Le taux de TVA réduit (8.5%) est automatiquement appliqué sur vos factures conformément au standard SOTA 2026.
                </AlertDescription>
              </Alert>
            )}
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

            {/* Historique et Statistiques */}
            <TabsContent value="history">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Graphique des encaissements */}
                <GlassCard>
                  <CardHeader>
                    <CardTitle className="text-lg">Évolution des encaissements</CardTitle>
                    <CardDescription>12 derniers mois</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                       <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="periodLabel" stroke="#94a3b8" fontSize={12} />
                          <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
                          <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: number) => [`${value.toLocaleString('fr-FR')} €`, '']}
                              labelFormatter={(label) => `Période: ${label}`}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="collected" 
                            name="Encaissé"
                            stroke="#10b981" 
                            strokeWidth={2} 
                            fill="url(#colorCollected)"
                          />
                       </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </GlassCard>

                {/* Graphique répartition par statut */}
                <GlassCard>
                  <CardHeader>
                    <CardTitle className="text-lg">Répartition par statut</CardTitle>
                    <CardDescription>Comparaison mensuelle</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                       <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="periodLabel" stroke="#94a3b8" fontSize={12} />
                          <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k€`} />
                          <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: number) => [`${value.toLocaleString('fr-FR')} €`, '']}
                          />
                          <Legend />
                          <Bar dataKey="collected" name="Payé" fill="#10b981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="pending" name="En attente" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="late" name="En retard" fill="#ef4444" radius={[4, 4, 0, 0]} />
                       </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </GlassCard>

                {/* Statistiques rapides */}
                <GlassCard className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-lg">Statistiques de paiement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-emerald-50 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600">
                          {stats.totalCollected > 0 ? Math.round((stats.totalCollected / (stats.totalDue || 1)) * 100) : 0}%
                        </p>
                        <p className="text-sm text-muted-foreground">Taux encaissement</p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">
                          {invoices.filter((i: any) => i.statut === "paid").length}
                        </p>
                        <p className="text-sm text-muted-foreground">Factures payées</p>
                      </div>
                      <div className="text-center p-4 bg-amber-50 rounded-lg">
                        <p className="text-2xl font-bold text-amber-600">
                          {invoices.filter((i: any) => i.statut === "sent" || i.statut === "draft").length}
                        </p>
                        <p className="text-sm text-muted-foreground">En attente</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <p className="text-2xl font-bold text-red-600">
                          {invoices.filter((i: any) => i.statut === "late").length}
                        </p>
                        <p className="text-sm text-muted-foreground">En retard</p>
                      </div>
                    </div>
                  </CardContent>
                </GlassCard>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialogue de paiement manuel */}
      {selectedInvoiceForPayment && (
        <ManualPaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          invoiceId={selectedInvoiceForPayment.id}
          invoiceReference={selectedInvoiceForPayment.reference || ""}
          amount={Number(selectedInvoiceForPayment.montant_total) || 0}
          tenantName={
            selectedInvoiceForPayment.lease?.signers?.[0]?.profile
              ? `${selectedInvoiceForPayment.lease.signers[0].profile.prenom || ""} ${selectedInvoiceForPayment.lease.signers[0].profile.nom || ""}`.trim()
              : "Locataire"
          }
          ownerName="Propriétaire"
          propertyAddress={selectedInvoiceForPayment.lease?.property?.adresse_complete || ""}
          periode={selectedInvoiceForPayment.periode || ""}
          onPaymentComplete={handlePaymentComplete}
        />
      )}
    </PageTransition>
  );
}
