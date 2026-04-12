"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/payments/InvoiceStatusBadge";
import { ReminderTimeline } from "@/components/payments/ReminderTimeline";
import { ArrowLeft, Send, FileDown, Loader2 } from "lucide-react";

interface InvoiceDetail {
  id: string;
  lease_id: string | null;
  periode: string;
  montant_loyer: number;
  montant_charges: number;
  montant_total: number;
  statut: string;
  due_date: string | null;
  date_echeance: string | null;
  paid_at: string | null;
  receipt_generated: boolean;
  reminder_count: number | null;
  last_reminder_sent_at: string | null;
  last_reminder_at: string | null;
  stripe_payment_intent_id: string | null;
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

export function InvoiceDetailClient() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<{ status: number; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function fetchInvoice() {
      setFetchError(null);
      try {
        const res = await fetch(`/api/invoices/${invoiceId}`);
        if (res.ok) {
          const data = await res.json();
          setInvoice(data.invoice || data);
          return;
        }
        // Capture real error so user sees 403/404/500 instead of a blank "not found".
        const body = await res.json().catch(() => ({}));
        setFetchError({
          status: res.status,
          message: body.error || `Erreur HTTP ${res.status}`,
        });
        console.error("[InvoiceDetail] API error:", res.status, body);
      } catch (err) {
        console.error("[InvoiceDetail] Fetch error:", err);
        setFetchError({
          status: 0,
          message: err instanceof Error ? err.message : "Erreur réseau",
        });
      } finally {
        setLoading(false);
      }
    }
    if (invoiceId) fetchInvoice();
  }, [invoiceId]);

  async function handleSend() {
    if (!invoice || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
      });
      if (res.ok) {
        setInvoice({ ...invoice, statut: "sent" });
      }
    } catch (err) {
      console.error("[InvoiceDetail] Send error:", err);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    const isForbidden = fetchError?.status === 403;
    const isNotFound = fetchError?.status === 404 || !fetchError;
    const title = isForbidden
      ? "Accès refusé"
      : isNotFound
        ? "Facture introuvable"
        : "Erreur de chargement";
    const description = isForbidden
      ? "Vous n'avez pas la permission d'accéder à cette facture."
      : isNotFound
        ? "Cette facture n'existe pas ou vous n'y avez pas accès."
        : fetchError?.message ?? "Une erreur est survenue lors du chargement.";

    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
            {fetchError && fetchError.status > 0 && (
              <p className="text-xs text-muted-foreground/70 font-mono">
                HTTP {fetchError.status} — Facture ID : {invoiceId}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const dueDate = invoice.due_date || invoice.date_echeance;
  const dueDateParsed = dueDate ? new Date(dueDate) : null;
  const daysOverdue = dueDateParsed && !isNaN(dueDateParsed.getTime())
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - dueDateParsed.getTime()) / (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Facture {invoice.periode}</h1>
          <p className="text-sm text-muted-foreground">
            {invoice.id.slice(0, 8)}
          </p>
        </div>
        <InvoiceStatusBadge status={invoice.statut} size="md" />
      </div>

      {/* Detail card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Loyer</p>
              <p className="font-semibold">
                {formatCurrency(invoice.montant_loyer)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Charges</p>
              <p className="font-semibold">
                {formatCurrency(invoice.montant_charges)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="text-lg font-bold">
                {formatCurrency(invoice.montant_total)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Échéance</p>
              <p className="font-medium">{formatDate(dueDate)}</p>
            </div>
            {invoice.paid_at && (
              <div>
                <p className="text-muted-foreground">Payée le</p>
                <p className="font-medium text-green-600 dark:text-green-400">
                  {formatDate(invoice.paid_at)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        {invoice.statut === "draft" && (
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Envoyer au locataire
          </Button>
        )}

        {(invoice.statut === "paid" || invoice.statut === "receipt_generated") && (
          <Button
            variant="outline"
            onClick={() => {
              // Route invoice-scoped : pas de dépendance sur lease_id, fonctionne
              // même pour les factures dont le bail a été archivé/supprimé.
              // Le endpoint GET /api/invoices/[id]/receipt :
              //   - génère le PDF à la volée,
              //   - déclenche ensureReceiptDocument en fire-and-forget pour la persistance,
              //   - retourne le PDF en téléchargement direct.
              window.open(`/api/invoices/${invoice.id}/receipt`, "_blank");
            }}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Télécharger la quittance
          </Button>
        )}
      </div>

      {/* Reminders timeline */}
      {daysOverdue > 0 && (
        <Card>
          <CardContent className="pt-6">
            <ReminderTimeline
              reminderCount={invoice.reminder_count || 0}
              daysOverdue={daysOverdue}
              lastReminderAt={
                invoice.last_reminder_at || invoice.last_reminder_sent_at
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
