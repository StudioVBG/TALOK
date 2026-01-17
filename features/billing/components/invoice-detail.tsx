"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { invoicesService } from "../services/invoices.service";
import { paymentsService } from "../services/payments.service";
import type { Invoice, Payment } from "@/lib/types";
import { formatCurrency, formatPeriod, formatDateShort } from "@/lib/helpers/format";
import Link from "next/link";

interface InvoiceDetailProps {
  invoiceId: string;
}

export function InvoiceDetail({ invoiceId }: InvoiceDetailProps) {
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [invoiceId]);

  async function fetchData() {
    try {
      setLoading(true);
      const [invoiceData, paymentsData] = await Promise.all([
        invoicesService.getInvoiceById(invoiceId),
        paymentsService.getPaymentsByInvoice(invoiceId),
      ]);

      setInvoice(invoiceData);
      setPayments(paymentsData);
      const paid = await paymentsService.getTotalPaidForInvoice(invoiceId);
      setTotalPaid(paid);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Impossible de charger la facture";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleSendInvoice = async () => {
    if (!invoice) return;

    try {
      await invoicesService.sendInvoice(invoice.id);
      toast({
        title: "Facture envoyée",
        description: "La facture a été envoyée au locataire.",
      });
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Impossible d'envoyer la facture";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (loading || !invoice) {
    return <div className="text-center py-4">Chargement...</div>;
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Brouillon",
      sent: "Envoyée",
      paid: "Payée",
      late: "En retard",
    };
    return labels[status] || status;
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cb: "Carte bancaire",
      virement: "Virement",
      prelevement: "Prélèvement",
    };
    return labels[method] || method;
  };

  const getPaymentStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "En attente",
      succeeded: "Réussi",
      failed: "Échoué",
    };
    return labels[status] || status;
  };

  const remaining = invoice.montant_total - totalPaid;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Facture {formatPeriod(invoice.periode)}</CardTitle>
              <CardDescription>Période : {formatPeriod(invoice.periode)}</CardDescription>
            </div>
            <span className="text-sm px-3 py-1 rounded bg-muted">
              {getStatusLabel(invoice.statut)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Loyer</p>
              <p className="font-medium text-lg">{formatCurrency(invoice.montant_loyer)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Charges</p>
              <p className="font-medium text-lg">{formatCurrency(invoice.montant_charges)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="font-bold text-xl">{formatCurrency(invoice.montant_total)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payé</p>
              <p className="font-medium text-lg text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
            {remaining > 0 && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Reste à payer</p>
                <p className="font-bold text-xl text-red-600">{formatCurrency(remaining)}</p>
              </div>
            )}
          </div>

          {invoice.statut === "draft" && (
            <Button onClick={handleSendInvoice} className="w-full">
              Envoyer la facture
            </Button>
          )}

          <div className="pt-4 border-t">
            <Link href={`/leases/${invoice.lease_id}`}>
              <Button variant="outline" className="w-full">
                Voir le bail associé
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Paiements</CardTitle>
            <CardDescription>Historique des paiements pour cette facture</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{formatCurrency(payment.montant)}</p>
                    <p className="text-sm text-muted-foreground">
                      {getPaymentMethodLabel(payment.moyen)} -{" "}
                      {getPaymentStatusLabel(payment.statut)}
                    </p>
                    {payment.date_paiement && (
                      <p className="text-xs text-muted-foreground">
                        Le {formatDateShort(payment.date_paiement)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

