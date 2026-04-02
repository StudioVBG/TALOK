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
 * - Idempotent : si la quittance existe déjà, retourne sans re-générer
 * - Envoie l'email au locataire uniquement lors de la première génération
 * - Met à jour `invoices.receipt_generated = true`
 */
export async function generateReceipt(
  paymentId: string
): Promise<GenerateReceiptResult> {
  const supabase = createServiceRoleClient();

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
