"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { calculateTaxes } from "@/lib/services/tax-engine";

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
 * Marque une facture comme payée
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

  // Vérifier la facture
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, owner_id, statut")
    .eq("id", invoiceId)
    .single();

  if (!invoice || invoice.owner_id !== profile.id) {
    return { success: false, error: "Facture non trouvée" };
  }

  if (invoice.statut === "paid") {
    return { success: false, error: "Cette facture est déjà payée" };
  }

  // Mettre à jour
  const { error } = await supabase
    .from("invoices")
    .update({
      statut: "paid",
      date_paiement: paymentDate || new Date().toISOString().split("T")[0],
    })
    .eq("id", invoiceId);

  if (error) {
    return { success: false, error: "Erreur lors de la mise à jour" };
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

  // TODO: Intégrer avec un service d'email (Resend, SendGrid, etc.)
  // Pour l'instant, on simule l'envoi
  console.log(`[REMINDER] Sending payment reminder for invoice ${invoiceId}`);

  // Enregistrer le rappel dans l'historique
  // await supabase.from("invoice_reminders").insert({ ... });

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

