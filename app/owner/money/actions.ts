"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { z } from "zod";
import { calculateTaxes } from "@/lib/services/tax-engine";
import { sendRentReminderEmail } from "@/lib/services/email-service";
import { ensureReceiptDocument } from "@/lib/services/final-documents.service";
import { syncInvoiceStatusFromPayments } from "@/lib/services/invoice-status.service";

// ============================================
// TYPES
// ============================================

type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================
// SERVER ACTIONS - FACTURES
// ============================================

/**
 * Marque une facture comme payée (paiement manuel owner).
 *
 * IMPORTANT : cette action DOIT créer une row `payments` ET une quittance.
 * Historiquement, elle faisait un UPDATE direct `statut='paid'` sans payment
 * associé, ce qui produisait des factures orphelines que `ensureReceiptDocument`
 * ne pouvait pas régénérer (il part d'un payment_id). Voir migration
 * 20260415230000_enforce_invoice_paid_has_payment.sql qui bloque désormais
 * ce chemin au niveau DB.
 */
export async function markInvoiceAsPaid(
  invoiceId: string,
  paymentDate?: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Non authentifié" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { success: false, error: "Accès non autorisé" };
  }

  // Service client pour bypass RLS sur payments/documents (idem route mark-paid)
  const serviceClient = getServiceClient();

  // Vérifier la facture via service client (cohérent avec mark-paid API route)
  const { data: invoice } = await serviceClient
    .from("invoices")
    .select("id, owner_id, statut, montant_total")
    .eq("id", invoiceId)
    .maybeSingle();

  const invoiceData = invoice as { id: string; owner_id: string; statut: string; montant_total: number } | null;

  if (!invoiceData || invoiceData.owner_id !== profile.id) {
    return { success: false, error: "Facture non trouvée" };
  }

  if (invoiceData.statut === "paid") {
    return { success: false, error: "Cette facture est déjà payée" };
  }

  const effectivePaymentDate = paymentDate || new Date().toISOString().split("T")[0];

  // 1. Créer la row payments — obligatoire pour que ensureReceiptDocument
  //    puisse générer la quittance et pour que le trigger DB accepte le paid.
  const { data: payment, error: paymentError } = await serviceClient
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      montant: invoiceData.montant_total,
      moyen: "autre",
      date_paiement: effectivePaymentDate,
      statut: "succeeded",
    } as any)
    .select("id")
    .single();

  if (paymentError || !payment) {
    console.error("[markInvoiceAsPaid] payment insert failed:", paymentError);
    return { success: false, error: "Erreur lors de l'enregistrement du paiement" };
  }

  // 2. Synchroniser le statut invoice depuis les payments (source de vérité)
  const settlement = await syncInvoiceStatusFromPayments(
    serviceClient as any,
    invoiceId,
    effectivePaymentDate
  );

  if (!settlement) {
    return { success: false, error: "Erreur de synchronisation du statut facture" };
  }

  // 3. Générer la quittance + mettre à jour receipt_generated/document_id/at
  //    (non bloquant : si la génération échoue, le paiement reste enregistré).
  if (settlement.isSettled) {
    try {
      await ensureReceiptDocument(serviceClient as any, (payment as { id: string }).id);
    } catch (receiptError) {
      console.error("[markInvoiceAsPaid] receipt generation failed:", receiptError);
    }
  }

  revalidatePath("/owner/money");
  revalidatePath("/owner/dashboard");

  return { success: true };
}

/**
 * Envoie un rappel de paiement
 */
export async function sendPaymentReminder(
  invoiceId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Non authentifié" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { success: false, error: "Accès non autorisé" };
  }

  // Vérifier la facture et récupérer les infos du locataire
  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      id,
      owner_id,
      statut,
      montant_total,
      periode,
      tenant_id,
      profiles!invoices_tenant_id_fkey(email, prenom, nom)
    `)
    .eq("id", invoiceId)
    .single();

  if (!invoice || invoice.owner_id !== profile.id) {
    return { success: false, error: "Facture non trouvée" };
  }

  if (invoice.statut === "paid") {
    return { success: false, error: "Cette facture est déjà payée" };
  }

  // Enregistrer la relance en DB
  try {
    await supabase.from("invoice_reminders").insert({
      invoice_id: invoiceId,
      sent_at: new Date().toISOString(),
      method: "email",
    });
  } catch {
    // Table invoice_reminders peut ne pas exister encore — non bloquant
    console.warn(`[REMINDER] invoice_reminders table not available for invoice ${invoiceId}`);
  }

  // Envoyer l'email de relance via Resend
  const tenant = (invoice as any).profiles;
  if (tenant?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    try {
      const emailResult = await sendRentReminderEmail(
        tenant.email,
        `${tenant.prenom || ""} ${tenant.nom || ""}`.trim() || "Locataire",
        invoice.periode || "",
        invoice.montant_total,
        invoice.periode || "",
        `${appUrl}/tenant/payments`
      );
      if (!emailResult.success) {
        console.warn(`[REMINDER] Email envoi échoué pour ${tenant.email}:`, emailResult.error);
      }
    } catch (emailError) {
      console.error(`[REMINDER] Erreur envoi email à ${tenant.email}:`, emailError);
    }
  }

  return { success: true };
}

/**
 * Génère les factures mensuelles pour tous les baux actifs
 */
export async function generateMonthlyInvoices(): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Non authentifié" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { success: false, error: "Accès non autorisé" };
  }

  // Récupérer tous les baux actifs du propriétaire
  const { data: activeLeases } = await supabase
    .from("leases")
    .select(`
      id,
      loyer,
      charges_forfaitaires,
      property_id,
      tenant_id,
      properties!inner(owner_id, code_postal)
    `)
    .eq("statut", "active");

  if (!activeLeases || activeLeases.length === 0) {
    return { success: true, data: { count: 0 } };
  }

  // Filtrer par owner_id
  const ownerLeases = activeLeases.filter((lease: any) => {
    return lease.properties?.owner_id === profile.id;
  });

  const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Vérifier les factures déjà générées ce mois
  const { data: existingInvoices } = await supabase
    .from("invoices")
    .select("lease_id")
    .eq("periode", currentPeriod)
    .in("lease_id", ownerLeases.map((l: any) => l.id));

  const existingLeaseIds = new Set(existingInvoices?.map((i: any) => i.lease_id) || []);

  // Générer les factures manquantes
  const newInvoices = ownerLeases
    .filter((lease: any) => !existingLeaseIds.has(lease.id))
    .map((lease: any) => {
      const zipCode = lease.properties?.code_postal || "75000";
      const taxes = calculateTaxes(lease.loyer || 0, zipCode);
      
      return {
        lease_id: lease.id,
        owner_id: profile.id,
        tenant_id: lease.tenant_id,
        periode: currentPeriod,
        montant_loyer: lease.loyer || 0,
        montant_charges: lease.charges_forfaitaires || 0,
        montant_tva: taxes.tvaAmount,
        tva_taux: taxes.tvaRate,
        is_drom: taxes.isDROM,
        montant_total: taxes.totalAmount + (lease.charges_forfaitaires || 0),
        statut: "sent",
        date_echeance: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toISOString().split("T")[0],
      };
    });

  if (newInvoices.length > 0) {
    const { error } = await supabase.from("invoices").insert(newInvoices);
    if (error) {
      console.error("Error generating invoices:", error);
      return { success: false, error: "Erreur lors de la génération des factures" };
    }
  }

  revalidatePath("/owner/money");
  revalidatePath("/owner/dashboard");

  return { success: true, data: { count: newInvoices.length } };
}

/**
 * Annule une facture
 */
export async function cancelInvoice(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Non authentifié" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return { success: false, error: "Accès non autorisé" };
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, owner_id, statut")
    .eq("id", invoiceId)
    .single();

  if (!invoice || invoice.owner_id !== profile.id) {
    return { success: false, error: "Facture non trouvée" };
  }

  if (invoice.statut === "paid") {
    return { success: false, error: "Impossible d'annuler une facture payée" };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ statut: "cancelled" })
    .eq("id", invoiceId);

  if (error) {
    return { success: false, error: "Erreur lors de l'annulation" };
  }

  revalidatePath("/owner/money");

  return { success: true };
}

