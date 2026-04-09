"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Banknote, Loader2 } from "lucide-react";

interface Payment {
  id: string;
  montant: number;
  moyen: string;
  statut: string;
  date_paiement: string | null;
  created_at: string;
  invoice_id: string;
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

const METHOD_LABELS: Record<string, string> = {
  cb: "Carte bancaire",
  prelevement: "Prélèvement SEPA",
  sepa_debit: "Prélèvement SEPA",
  virement: "Virement",
  especes: "Espèces",
  cheque: "Chèque",
};

const STATUS_COLORS: Record<string, string> = {
  succeeded: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function PaymentsHistoryPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Payments are fetched indirectly — we use the invoices API to get payment info
    // In a full impl this would be a dedicated /api/payments endpoint
    async function fetchPayments() {
      try {
        const res = await fetch("/api/invoices?limit=100");
        if (res.ok) {
          const data = await res.json();
          // For now, show paid invoices as payment history
          const paidInvoices = (data.invoices || []).filter(
            (i: any) =>
              i.statut === "paid" ||
              i.statut === "succeeded" ||
              i.statut === "receipt_generated"
          );
          setPayments(
            paidInvoices.map((inv: any) => ({
              id: inv.id,
              montant: inv.montant_total,
              moyen: "prelevement",
              statut: "succeeded",
              date_paiement: inv.paid_at || inv.updated_at,
              created_at: inv.created_at,
              invoice_id: inv.id,
            }))
          );
        }
      } catch (err) {
        console.error("[PaymentsHistory] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPayments();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Historique des paiements</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <Banknote className="h-10 w-10 mb-2 opacity-40" />
            <p>Aucun paiement enregistré</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Montant</th>
                    <th className="px-4 py-3 text-left font-medium">Moyen</th>
                    <th className="px-4 py-3 text-left font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="px-4 py-3">
                        {formatDate(payment.date_paiement)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatCurrency(payment.montant)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {METHOD_LABELS[payment.moyen] || payment.moyen}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[payment.statut] || ""}`}
                        >
                          {payment.statut === "succeeded" ? "Confirmé" : payment.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
