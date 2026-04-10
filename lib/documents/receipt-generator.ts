/**
 * Orchestrateur de génération de quittance de loyer
 *
 * Combine :
 * 1. Génération PDF ALUR-compliant (ensureReceiptDocument)
 * 2. Upload vers Supabase Storage
 * 3. Envoi email au locataire avec PDF en PJ
 * 4. Marquage invoice receipt_generated=true
 *
 * @see Art. 21 loi n°89-462 du 6 juillet 1989
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import {
  ensureReceiptDocument,
  type EnsureReceiptResult,
} from "@/lib/services/final-documents.service";
import { sendReceiptEmail } from "@/lib/emails/send-receipt-email";

export interface GenerateReceiptResult {
  success: boolean;
  /** true si une nouvelle quittance a été créée (false = déjà existante) */
  created: boolean;
  documentId?: string | null;
  storagePath?: string;
  emailSent?: boolean;
  error?: string;
}

/**
 * Génère une quittance de loyer complète pour un paiement donné.
 *
 * - Idempotent : si `invoices.receipt_generated` vaut déjà `true`, ou si
 *   `ensureReceiptDocument` trouve un document existant, on ne régénère
 *   ni le PDF ni l'email.
 * - Envoie l'email au locataire uniquement lors de la première génération
 * - Met à jour `invoices.receipt_generated = true`
 *
 * @param paymentId id du paiement (payments.id)
 * @param supabaseClient client Supabase à réutiliser. Si omis, un client
 *                      service-role est créé en interne (utile pour les
 *                      appels hors contexte requête). Les routes API
 *                      doivent toujours passer le client du contexte.
 */
export async function generateReceipt(
  paymentId: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<GenerateReceiptResult> {
  const supabase = (supabaseClient ?? createServiceRoleClient()) as SupabaseClient<Database>;

  // Idempotence guard: if invoice.receipt_generated is already true, skip
  // the whole pipeline (PDF regeneration and email). This protects against
  // the edge case where the documents row was deleted but the flag stayed.
  try {
    const { data: paymentInvoice } = await supabase
      .from("payments")
      .select("invoice_id")
      .eq("id", paymentId)
      .maybeSingle();

    const invoiceIdGuard = (paymentInvoice as { invoice_id?: string } | null)?.invoice_id;
    if (invoiceIdGuard) {
      const { data: invoiceFlag } = await supabase
        .from("invoices")
        .select("receipt_generated")
        .eq("id", invoiceIdGuard)
        .maybeSingle();

      if ((invoiceFlag as { receipt_generated?: boolean } | null)?.receipt_generated === true) {
        return {
          success: true,
          created: false,
          emailSent: false,
        };
      }
    }
  } catch (guardErr) {
    // Non-fatal: fall through to the normal pipeline if the guard query fails
    console.warn("[generateReceipt] receipt_generated guard check failed:", guardErr);
  }

  // 1. Générer le PDF, uploader, insérer le document
  let receiptResult: EnsureReceiptResult | null;
  try {
    receiptResult = await ensureReceiptDocument(supabase, paymentId);
  } catch (err) {
    console.error("[generateReceipt] PDF generation failed:", err);
    return {
      success: false,
      created: false,
      error: err instanceof Error ? err.message : "Erreur génération PDF",
    };
  }

  if (!receiptResult) {
    return {
      success: false,
      created: false,
      error: "Données insuffisantes pour générer la quittance (paiement/facture introuvable ou non soldée)",
    };
  }

  // Quittance déjà existante — pas d'email, pas d'update
  if (!receiptResult.created) {
    return {
      success: true,
      created: false,
      documentId: receiptResult.documentId,
      storagePath: receiptResult.storagePath,
      emailSent: false,
    };
  }

  // 2. Envoyer l'email au locataire avec le PDF en PJ
  let emailSent = false;
  if (receiptResult.pdfBytes && receiptResult.receiptMeta?.tenantEmail) {
    try {
      const emailResult = await sendReceiptEmail({
        tenantEmail: receiptResult.receiptMeta.tenantEmail,
        tenantName: receiptResult.receiptMeta.tenantName,
        period: receiptResult.receiptMeta.period,
        totalAmount: receiptResult.receiptMeta.totalAmount,
        propertyAddress: receiptResult.receiptMeta.propertyAddress,
        paymentDate: receiptResult.receiptMeta.paymentDate,
        paymentMethod: receiptResult.receiptMeta.paymentMethod,
        pdfBytes: receiptResult.pdfBytes,
        paymentId,
      });

      emailSent = emailResult.success;

      if (emailSent) {
        // Marquer la quittance comme envoyée dans receipts
        await supabase
          .from("receipts" as any)
          .update({ sent_at: new Date().toISOString() })
          .eq("payment_id", paymentId);
      } else {
        console.error("[generateReceipt] Email send failed:", emailResult.error);
      }
    } catch (emailErr) {
      console.error("[generateReceipt] Email error:", emailErr);
    }
  }

  // 3. Marquer la facture comme ayant une quittance générée
  try {
    // Récupérer l'invoice_id depuis le paiement
    const { data: payment } = await supabase
      .from("payments")
      .select("invoice_id")
      .eq("id", paymentId)
      .single();

    if (payment?.invoice_id) {
      await supabase
        .from("invoices")
        .update({ receipt_generated: true } as any)
        .eq("id", payment.invoice_id);
    }
  } catch (updateErr) {
    console.error("[generateReceipt] Invoice update failed:", updateErr);
  }

  return {
    success: true,
    created: true,
    documentId: receiptResult.documentId,
    storagePath: receiptResult.storagePath,
    emailSent,
  };
}
