"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/payments/InvoiceStatusBadge";
import { PaymentButton } from "@/components/payments/PaymentButton";
import { isPayable } from "@/lib/payments/invoice-state-machine";
import {
  Banknote,
  FileText,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface Invoice {
  id: string;
  periode: string;
  montant_total: number;
  montant_loyer: number;
  montant_charges: number;
  statut: string;
  due_date: string | null;
  date_echeance: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function TenantPaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightInvoice = searchParams?.get("invoice");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch("/api/invoices?limit=10");
        if (res.ok) {
          const data = await res.json();
          setInvoices(data.invoices || []);
        }
      } catch (err) {
        console.error("[TenantPayment] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, []);

  const pendingInvoices = invoices.filter((i) => isPayable(i.statut));
  const paidInvoices = invoices.filter(
    (i) =>
      i.statut === "paid" ||
      i.statut === "receipt_generated" ||
      i.statut === "succeeded"
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold">Payer mon loyer</h1>

      {/* Payment success message */}
      {paymentSuccess && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-700 dark:text-green-300">
              Votre paiement a été initié avec succès. Vous recevrez une confirmation par email.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pending invoices — pay now */}
      {pendingInvoices.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Factures en attente
          </h2>

          {pendingInvoices.map((invoice) => {
            const dueDate = invoice.due_date || invoice.date_echeance;
            const isHighlighted = highlightInvoice === invoice.id;

            return (
              <Card
                key={invoice.id}
                className={isHighlighted ? "ring-2 ring-blue-500" : ""}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {invoice.periode}
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(invoice.montant_total)}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>
                          Loyer : {formatCurrency(invoice.montant_loyer)}
                        </span>
                        {invoice.montant_charges > 0 && (
                          <span>
                            Charges :{" "}
                            {formatCurrency(invoice.montant_charges)}
                          </span>
                        )}
                      </div>
                    </div>
                    <InvoiceStatusBadge status={invoice.statut} />
                  </div>

                  {dueDate && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Date d'échéance : {formatDate(dueDate)}
                    </p>
                  )}

                  <PaymentButton
                    invoiceId={invoice.id}
                    invoiceStatus={invoice.statut}
                    amountCents={Math.round(invoice.montant_total * 100)}
                    useConnect={true}
                    onSuccess={(piId) => {
                      setPaymentSuccess(piId);
                      // Refresh invoices
                      setInvoices((prev) =>
                        prev.map((i) =>
                          i.id === invoice.id
                            ? { ...i, statut: "pending" }
                            : i
                        )
                      );
                    }}
                    onError={(err) => alert(err)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
            <p className="font-medium">Vous êtes à jour !</p>
            <p className="text-sm text-muted-foreground">
              Aucune facture en attente de paiement
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent paid invoices */}
      {paidInvoices.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Banknote className="h-5 w-5 text-green-500" />
              Paiements récents
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/tenant/payment/history")}
            >
              Voir tout
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          {paidInvoices.slice(0, 3).map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{invoice.periode}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(invoice.montant_total)}
                  </p>
                </div>
                <InvoiceStatusBadge status={invoice.statut} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
