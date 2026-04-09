"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialKPIs } from "@/components/payments/FinancialKPIs";
import { InvoiceStatusBadge } from "@/components/payments/InvoiceStatusBadge";
import { DepositTracker } from "@/components/payments/DepositTracker";
import {
  FileText,
  Banknote,
  Shield,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface Invoice {
  id: string;
  periode: string;
  montant_total: number;
  statut: string;
  due_date: string | null;
  tenant_id: string | null;
  lease_id: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
}

export function FinancesDashboardClient() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [invoicesRes, depositsRes] = await Promise.all([
          fetch("/api/invoices?limit=20"),
          fetch("/api/deposits"),
        ]);

        if (invoicesRes.ok) {
          const data = await invoicesRes.json();
          setInvoices(data.invoices || []);
        }
        if (depositsRes.ok) {
          const data = await depositsRes.json();
          setDeposits(data.deposits || []);
        }
      } catch (err) {
        console.error("[FinancesDashboard] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Compute KPIs
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthInvoices = invoices.filter((i: Invoice) => i.periode === currentMonth);
  const paidInvoices = monthInvoices.filter(
    (i: Invoice) => i.statut === "paid" || i.statut === "receipt_generated" || i.statut === "succeeded"
  );
  const overdueInvoices = invoices.filter(
    (i: Invoice) =>
      i.statut === "overdue" ||
      i.statut === "late" ||
      i.statut === "reminder_sent" ||
      i.statut === "collection"
  );

  const collectedCents = paidInvoices.reduce(
    (sum: number, i: Invoice) => sum + Math.round(i.montant_total * 100),
    0
  );
  const pendingCents = monthInvoices
    .filter((i: Invoice) => i.statut === "sent" || i.statut === "pending")
    .reduce((sum: number, i: Invoice) => sum + Math.round(i.montant_total * 100), 0);
  const overdueCents = overdueInvoices.reduce(
    (sum: number, i: Invoice) => sum + Math.round(i.montant_total * 100),
    0
  );
  const collectionRate =
    monthInvoices.length > 0
      ? Math.round((paidInvoices.length / monthInvoices.length) * 100)
      : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Finances</h1>
      </div>

      {/* KPIs */}
      <FinancialKPIs
        collectedCents={collectedCents}
        pendingCents={pendingCents}
        overdueCents={overdueCents}
        paidCount={paidInvoices.length}
        overdueCount={overdueInvoices.length}
        collectionRate={collectionRate}
      />

      {/* Tabs */}
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Factures
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5">
            <Banknote className="h-4 w-4" />
            Paiements
          </TabsTrigger>
          <TabsTrigger value="deposits" className="gap-1.5">
            <Shield className="h-4 w-4" />
            Dépôts de garantie
          </TabsTrigger>
        </TabsList>

        {/* Invoices tab */}
        <TabsContent value="invoices" className="space-y-4 mt-4">
          {invoices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
                <FileText className="h-10 w-10 mb-2 opacity-40" />
                <p>Aucune facture pour le moment</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium">Période</th>
                        <th className="px-4 py-3 text-left font-medium">Montant</th>
                        <th className="px-4 py-3 text-left font-medium">Échéance</th>
                        <th className="px-4 py-3 text-left font-medium">Statut</th>
                        <th className="px-4 py-3 text-right font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.slice(0, 20).map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() =>
                            router.push(`/owner/finances/invoices/${invoice.id}`)
                          }
                        >
                          <td className="px-4 py-3 font-medium">
                            {invoice.periode}
                          </td>
                          <td className="px-4 py-3">
                            {formatCurrency(invoice.montant_total)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDate(invoice.due_date)}
                          </td>
                          <td className="px-4 py-3">
                            <InvoiceStatusBadge status={invoice.statut} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ArrowRight className="h-4 w-4 text-muted-foreground inline" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => router.push("/owner/finances/invoices")}
            >
              Voir toutes les factures
            </Button>
          </div>
        </TabsContent>

        {/* Payments tab */}
        <TabsContent value="payments" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique des paiements</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Les paiements sont enregistrés automatiquement lorsque vos locataires
                règlent leurs loyers via prélèvement SEPA.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => router.push("/owner/finances/payments")}
              >
                Voir l'historique complet
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deposits tab */}
        <TabsContent value="deposits" className="space-y-4 mt-4">
          <DepositTracker deposits={deposits} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
