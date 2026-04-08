"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/payments/InvoiceStatusBadge";
import { ArrowLeft, FileDown, Loader2, Receipt } from "lucide-react";

interface PaymentHistoryItem {
  id: string;
  periode: string;
  montant_total: number;
  statut: string;
  paid_at: string | null;
  receipt_generated: boolean;
  receipt_document_id: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR");
}

export default function TenantPaymentHistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/invoices?limit=50");
        if (res.ok) {
          const data = await res.json();
          // Show all invoices that have been paid or have receipts
          setItems(
            (data.invoices || []).filter(
              (i: any) =>
                i.statut === "paid" ||
                i.statut === "receipt_generated" ||
                i.statut === "succeeded"
            )
          );
        }
      } catch (err) {
        console.error("[TenantHistory] Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
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
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-muted-foreground">
            <Receipt className="h-10 w-10 mb-2 opacity-40" />
            <p>Aucun paiement enregistré</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{item.periode}</p>
                    <InvoiceStatusBadge status={item.statut} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>{formatCurrency(item.montant_total)}</span>
                    {item.paid_at && <span>Payé le {formatDate(item.paid_at)}</span>}
                  </div>
                </div>

                {item.receipt_generated && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      // Download receipt from documents
                      if (item.receipt_document_id) {
                        window.open(
                          `/api/documents/${item.receipt_document_id}/download`,
                          "_blank"
                        );
                      }
                    }}
                  >
                    <FileDown className="mr-1 h-3 w-3" />
                    Quittance
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
