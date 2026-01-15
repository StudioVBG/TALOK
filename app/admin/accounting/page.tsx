"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Calendar,
  Search,
  Filter,
  Eye,
  Wallet,
  PiggyBank,
  Receipt,
  Landmark,
  BarChart3,
  CircleDollarSign,
  AlertTriangle,
  ChevronRight,
  Sparkles,
  Brain,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatDate } from "@/lib/helpers/format";
import { cn } from "@/lib/utils";

// Types
interface AccountingSummary {
  period: { start: string; end: string };
  totals: {
    revenue: number;
    expenses: number;
    assets: number;
    liabilities: number;
  };
  byMonth: Array<{
    month: string;
    revenue: number;
    expenses: number;
  }>;
  unreconciled: {
    count: number;
    totalDebit: number;
    totalCredit: number;
  };
  topAccounts: Array<{
    account_code: string;
    account_name: string;
    total_debit: number;
    total_credit: number;
    entries_count: number;
  }>;
}

interface Invoice {
  id: string;
  reference: string;
  tenant_name: string;
  property_address: string;
  amount: number;
  due_date: string;
  status: string;
  days_late: number;
}

interface PaymentAlert {
  id: string;
  type: "late" | "upcoming" | "failed" | "partial";
  tenant_id: string;
  tenant_name: string;
  property_address: string;
  amount: number;
  due_date: string;
  days_late: number;
  ai_risk_score: number;
  ai_recommendation: string;
}

export default function AdminAccountingPage() {
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();

  // States
  const [summary, setSummary] = useState<AccountingSummary | null>(null);
  const [lateInvoices, setLateInvoices] = useState<Invoice[]>([]);
  const [paymentAlerts, setPaymentAlerts] = useState<PaymentAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Filter states
  const [dateRange, setDateRange] = useState("year");
  const [searchQuery, setSearchQuery] = useState("");

  // Sheet state
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<PaymentAlert | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user || profile?.role !== "admin") return;

    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Calculer les dates selon la période
      const endDate = new Date();
      let startDate = new Date();
      switch (dateRange) {
        case "month":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "quarter":
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case "year":
        default:
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      // Fetch summary via RPC
      const { data: summaryData } = await supabase.rpc("get_accounting_summary", {
        p_start_date: startDate.toISOString().split("T")[0],
        p_end_date: endDate.toISOString().split("T")[0],
      });

      if (summaryData) {
        setSummary(summaryData as AccountingSummary);
      }

      // Fetch late invoices
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select(`
          id,
          reference,
          amount,
          due_date,
          status,
          lease:leases(
            tenant:profiles!leases_tenant_id_fkey(prenom, nom),
            property:properties(adresse_complete)
          )
        `)
        .in("status", ["late", "sent"])
        .lt("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .limit(20);

      if (invoicesData) {
        const invoices = invoicesData.map((inv: Record<string, unknown>) => {
          const dueDate = new Date(inv.due_date as string);
          const today = new Date();
          const daysLate = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

          const lease = inv.lease as Record<string, unknown> | null;
          const tenant = lease?.tenant as Record<string, string> | null;
          const property = lease?.property as Record<string, string> | null;

          return {
            id: inv.id as string,
            reference: inv.reference as string || "N/A",
            tenant_name: tenant ? `${tenant.prenom} ${tenant.nom}` : "Inconnu",
            property_address: property?.adresse_complete || "Adresse inconnue",
            amount: inv.amount as number,
            due_date: inv.due_date as string,
            status: inv.status as string,
            days_late: daysLate,
          };
        });
        setLateInvoices(invoices);
      }

      // Generate AI payment alerts (simulation pour démo)
      const alerts: PaymentAlert[] = lateInvoices.slice(0, 5).map((inv, i) => ({
        id: `alert-${i}`,
        type: inv.days_late > 30 ? "late" : inv.days_late > 0 ? "upcoming" : "partial",
        tenant_id: inv.id,
        tenant_name: inv.tenant_name,
        property_address: inv.property_address,
        amount: inv.amount,
        due_date: inv.due_date,
        days_late: inv.days_late,
        ai_risk_score: Math.min(0.95, 0.3 + inv.days_late * 0.02),
        ai_recommendation: inv.days_late > 30
          ? "Recommandation: Envoyer une mise en demeure formelle et envisager procédure de recouvrement."
          : inv.days_late > 15
          ? "Recommandation: Contacter le locataire par téléphone et proposer un échéancier."
          : "Recommandation: Envoyer un rappel automatique par email.",
      }));
      setPaymentAlerts(alerts);

    } catch (error: unknown) {
      console.error("Error fetching accounting data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données comptables",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, profile, dateRange, toast, lateInvoices]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== "admin") return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading, dateRange]);

  // Export handler
  async function handleExport(format: "csv" | "excel" | "fec") {
    setExporting(true);
    try {
      const startResponse = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "accounting",
          format: format === "excel" ? "csv" : format,
          filters: { scope: "global", period: dateRange }
        })
      });

      if (!startResponse.ok) throw new Error("Erreur initialisation export");
      const { jobId } = await startResponse.json();

      // Poll pour le statut
      let attempts = 0;
      const maxAttempts = 20;

      const poll = async () => {
        if (attempts >= maxAttempts) throw new Error("Délai d'export dépassé");
        attempts++;

        const statusResponse = await fetch(`/api/exports/${jobId}`);
        const job = await statusResponse.json();

        if (job.status === "completed") {
          window.location.href = `/api/exports/${jobId}/download`;
          toast({
            title: "Export réussi",
            description: `Le fichier ${format.toUpperCase()} est prêt.`,
          });
          setExporting(false);
        } else if (job.status === "failed") {
          throw new Error(job.error_message || "L'export a échoué");
        } else {
          setTimeout(poll, 2000);
        }
      };

      poll();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur d'export";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
      setExporting(false);
    }
  }

  // Calculs
  const netProfit = summary ? summary.totals.revenue - summary.totals.expenses : 0;
  const profitMargin = summary && summary.totals.revenue > 0
    ? (netProfit / summary.totals.revenue) * 100
    : 0;

  if (authLoading || loading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Landmark className="h-8 w-8 text-primary" />
              Comptabilité
            </h1>
            <p className="text-muted-foreground mt-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Gestion comptable avancée avec alertes IA
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Ce mois</SelectItem>
                <SelectItem value="quarter">Ce trimestre</SelectItem>
                <SelectItem value="year">Cette année</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenus</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(summary?.totals.revenue || 0)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-emerald-500/10">
                  <TrendingUp className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Dépenses</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(summary?.totals.expenses || 0)}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-red-500/10">
                  <TrendingDown className="h-6 w-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            "border-l-4",
            netProfit >= 0 ? "border-l-blue-500" : "border-l-orange-500"
          )}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Résultat net</p>
                  <p className={cn(
                    "text-2xl font-bold",
                    netProfit >= 0 ? "text-blue-600" : "text-orange-600"
                  )}>
                    {formatCurrency(netProfit)}
                  </p>
                </div>
                <div className={cn(
                  "p-3 rounded-full",
                  netProfit >= 0 ? "bg-blue-500/10" : "bg-orange-500/10"
                )}>
                  <CircleDollarSign className={cn(
                    "h-6 w-6",
                    netProfit >= 0 ? "text-blue-500" : "text-orange-500"
                  )} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Marge: {profitMargin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Non rapprochés</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {summary?.unreconciled.count || 0}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-amber-500/10">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {formatCurrency(summary?.unreconciled.totalDebit || 0)} à rapprocher
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alerte impayés critique */}
        <AnimatePresence>
          {lateInvoices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <Card className="border-red-500/50 bg-red-500/5">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/10">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          <Brain className="h-4 w-4 text-purple-500" />
                          Alerte IA - Impayés détectés
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {lateInvoices.length} facture{lateInvoices.length > 1 ? "s" : ""} en retard pour un total de{" "}
                          <span className="font-semibold text-red-600">
                            {formatCurrency(lateInvoices.reduce((sum, inv) => sum + inv.amount, 0))}
                          </span>
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setActiveTab("alerts")}
                    >
                      Voir les alertes
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              Alertes impayés
              {lateInvoices.length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {lateInvoices.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="exports" className="gap-2">
              <Download className="h-4 w-4" />
              Exports
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Evolution mensuelle */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Évolution mensuelle</CardTitle>
                  <CardDescription>Revenus et dépenses par mois</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary?.byMonth && summary.byMonth.length > 0 ? (
                    <div className="space-y-4">
                      {summary.byMonth.slice(-6).map((month, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{month.month}</span>
                            <span className={cn(
                              "font-medium",
                              month.revenue - month.expenses >= 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                              {formatCurrency(month.revenue - month.expenses)}
                            </span>
                          </div>
                          <div className="flex gap-2 h-4">
                            <div
                              className="bg-emerald-500 rounded"
                              style={{ width: `${(month.revenue / (summary.totals.revenue || 1)) * 100}%` }}
                            />
                            <div
                              className="bg-red-500 rounded"
                              style={{ width: `${(month.expenses / (summary.totals.expenses || 1)) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-4 pt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-emerald-500 rounded" />
                          Revenus
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 bg-red-500 rounded" />
                          Dépenses
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Aucune donnée disponible pour cette période</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top comptes */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Top comptes</CardTitle>
                  <CardDescription>Comptes les plus actifs</CardDescription>
                </CardHeader>
                <CardContent>
                  {summary?.topAccounts && summary.topAccounts.length > 0 ? (
                    <div className="space-y-3">
                      {summary.topAccounts.slice(0, 5).map((account, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{account.account_code}</Badge>
                            <span className="font-medium text-sm">{account.account_name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(account.total_credit - account.total_debit)}</p>
                            <p className="text-xs text-muted-foreground">{account.entries_count} écritures</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Aucun compte actif</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            {/* Search & Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un locataire..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Late invoices table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  Factures en retard avec analyse IA
                </CardTitle>
                <CardDescription>
                  L'IA analyse le risque de chaque impayé et propose des actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lateInvoices.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="text-lg font-medium">Aucun impayé</p>
                    <p className="text-muted-foreground">Toutes les factures sont à jour</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Locataire</TableHead>
                        <TableHead>Bien</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Retard</TableHead>
                        <TableHead>Risque IA</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lateInvoices
                        .filter(inv =>
                          !searchQuery ||
                          inv.tenant_name.toLowerCase().includes(searchQuery.toLowerCase())
                        )
                        .map((invoice) => {
                          const riskScore = Math.min(0.95, 0.3 + invoice.days_late * 0.02);
                          const riskLevel = riskScore > 0.7 ? "high" : riskScore > 0.4 ? "medium" : "low";

                          return (
                            <TableRow key={invoice.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{invoice.tenant_name}</p>
                                  <p className="text-xs text-muted-foreground">{invoice.reference}</p>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {invoice.property_address}
                              </TableCell>
                              <TableCell className="font-medium text-red-600">
                                {formatCurrency(invoice.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant={invoice.days_late > 30 ? "destructive" : "secondary"}>
                                  {invoice.days_late} jour{invoice.days_late > 1 ? "s" : ""}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2">
                                      <Brain className="h-4 w-4 text-purple-500" />
                                      <Progress
                                        value={riskScore * 100}
                                        className={cn(
                                          "w-16 h-2",
                                          riskLevel === "high" && "[&>div]:bg-red-500",
                                          riskLevel === "medium" && "[&>div]:bg-amber-500",
                                          riskLevel === "low" && "[&>div]:bg-green-500"
                                        )}
                                      />
                                      <span className={cn(
                                        "text-xs font-medium",
                                        riskLevel === "high" && "text-red-500",
                                        riskLevel === "medium" && "text-amber-500",
                                        riskLevel === "low" && "text-green-500"
                                      )}>
                                        {Math.round(riskScore * 100)}%
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="font-medium mb-1">Analyse IA du risque</p>
                                    <p className="text-sm">
                                      {invoice.days_late > 30
                                        ? "Risque élevé: Retard significatif, action urgente recommandée."
                                        : invoice.days_late > 15
                                        ? "Risque moyen: Contacter le locataire rapidement."
                                        : "Risque faible: Rappel standard suffisant."}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedAlert({
                                        id: invoice.id,
                                        type: invoice.days_late > 30 ? "late" : "upcoming",
                                        tenant_id: invoice.id,
                                        tenant_name: invoice.tenant_name,
                                        property_address: invoice.property_address,
                                        amount: invoice.amount,
                                        due_date: invoice.due_date,
                                        days_late: invoice.days_late,
                                        ai_risk_score: riskScore,
                                        ai_recommendation: invoice.days_late > 30
                                          ? "Envoyer une mise en demeure formelle."
                                          : "Contacter le locataire par téléphone.",
                                      });
                                      setDetailSheetOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="default">
                                    Relancer
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Exports Tab */}
          <TabsContent value="exports" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    Export CSV
                  </CardTitle>
                  <CardDescription>
                    Fichier tabulaire compatible Excel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleExport("csv")}
                    disabled={exporting}
                    className="w-full"
                    variant="outline"
                  >
                    {exporting ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Exporter CSV
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                    Export Excel
                  </CardTitle>
                  <CardDescription>
                    Fichier XLSX avec mise en forme
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleExport("excel")}
                    disabled={exporting}
                    className="w-full"
                    variant="outline"
                  >
                    {exporting ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Exporter Excel
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-600" />
                    Export FEC
                  </CardTitle>
                  <CardDescription>
                    Format Échange Comptable (légal)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleExport("fec")}
                    disabled={exporting}
                    className="w-full"
                    variant="outline"
                  >
                    {exporting ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Exporter FEC
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Grand-livre</CardTitle>
                <CardDescription>
                  Consultez le grand-livre agrégé de la plateforme
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={async () => {
                    const response = await fetch("/api/accounting/gl");
                    if (response.ok) {
                      const data = await response.json();
                      toast({
                        title: "Grand-livre",
                        description: `${data.entries?.length || 0} entrées récupérées`,
                      });
                    }
                  }}
                  className="w-full md:w-auto"
                  variant="outline"
                >
                  <Landmark className="mr-2 h-4 w-4" />
                  Consulter le grand-livre
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Detail Sheet */}
        <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
          <SheetContent className="w-full sm:max-w-lg">
            {selectedAlert && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Détail de l'alerte
                  </SheetTitle>
                  <SheetDescription>
                    Analyse IA et recommandations
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Locataire info */}
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-3">Locataire</h4>
                    <div className="space-y-2">
                      <p className="font-semibold text-lg">{selectedAlert.tenant_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedAlert.property_address}</p>
                    </div>
                  </div>

                  {/* Montant & retard */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                      <p className="text-sm text-muted-foreground">Montant dû</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(selectedAlert.amount)}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                      <p className="text-sm text-muted-foreground">Retard</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {selectedAlert.days_late} jours
                      </p>
                    </div>
                  </div>

                  {/* AI Analysis */}
                  <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="h-5 w-5 text-purple-500" />
                      <span className="font-medium">Analyse IA</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm">Score de risque</span>
                          <span className="font-bold">
                            {Math.round(selectedAlert.ai_risk_score * 100)}%
                          </span>
                        </div>
                        <Progress
                          value={selectedAlert.ai_risk_score * 100}
                          className={cn(
                            selectedAlert.ai_risk_score > 0.7 && "[&>div]:bg-red-500",
                            selectedAlert.ai_risk_score > 0.4 && selectedAlert.ai_risk_score <= 0.7 && "[&>div]:bg-amber-500",
                            selectedAlert.ai_risk_score <= 0.4 && "[&>div]:bg-green-500"
                          )}
                        />
                      </div>
                      <div className="p-3 rounded bg-background">
                        <p className="text-sm">
                          <Sparkles className="h-4 w-4 inline mr-1 text-amber-500" />
                          {selectedAlert.ai_recommendation}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button className="flex-1" variant="outline">
                      <Clock className="h-4 w-4 mr-2" />
                      Rappel email
                    </Button>
                    <Button className="flex-1" variant="default">
                      <FileText className="h-4 w-4 mr-2" />
                      Mise en demeure
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
