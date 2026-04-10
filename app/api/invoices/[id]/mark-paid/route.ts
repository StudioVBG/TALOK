export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { AccountingIntegrationService } from "@/features/accounting/services/accounting-integration.service";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { ensureReceiptDocument } from "@/lib/services/final-documents.service";
import { generateReceipt } from "@/lib/documents/receipt-generator";
import { syncInvoiceStatusFromPayments } from "@/lib/services/invoice-status.service";

/**
 * POST /api/invoices/[id]/mark-paid - Marquer une facture comme payée manuellement
 *
 * Utilisé par les propriétaires pour enregistrer un paiement reçu
 * (espèces, chèque, virement manuel, etc.)
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Rate limiting pour les paiements (5 req/min)
    const rateLimitResponse = applyRateLimit(request, "payment");
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const invoiceId = id;

    // Récupérer les données optionnelles du body
    interface MarkPaidBody {
      amount?: number;
      moyen?: string;
      payment_method?: string;
      date_paiement?: string;
      reference?: string;
      bank_name?: string;
      notes?: string;
    }
    
    let body: MarkPaidBody = {};
    try {
      body = await request.json();
    } catch {
      // Body vide, c'est OK
    }
    
    // Support both "moyen" and "payment_method" for backward compatibility
    const paymentMethod = body.moyen || body.payment_method || "autre";
    const { reference, bank_name, notes, date_paiement } = body;

    // Récupérer la facture avec vérification d'accès
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        lease:leases!inner(
          id,
          property:properties!inner(
            owner_id,
            adresse_complete
          )
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    const invoiceData = invoice as any;

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    const isOwner = invoiceData.lease?.property?.owner_id === profileData?.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Seul le propriétaire peut marquer une facture comme payée" },
        { status: 403 }
      );
    }

    // Vérifier que la facture n'est pas déjà payée
    if (invoiceData.statut === "paid") {
      return NextResponse.json(
        { error: "Cette facture est déjà payée" },
        { status: 400 }
      );
    }

    // Vérifier que la facture n'est pas annulée
    if (invoiceData.statut === "cancelled") {
      return NextResponse.json(
        { error: "Impossible de payer une facture annulée" },
        { status: 400 }
      );
    }

    // Déterminer le montant (utiliser celui fourni ou le total de la facture)
    const paymentAmount = body.amount && body.amount > 0 
      ? body.amount 
      : invoiceData.montant_total;
    
    // Créer le paiement avec toutes les métadonnées
    const paymentData: Record<string, unknown> = {
      invoice_id: invoiceId,
      montant: paymentAmount,
      moyen: paymentMethod,
      date_paiement: date_paiement || new Date().toISOString().split("T")[0],
      statut: "succeeded",
    };
    
    // Ajouter les métadonnées optionnelles si présentes
    // Ces données seront stockées dans provider_ref ou un champ metadata
    if (reference || bank_name || notes) {
      paymentData.provider_ref = JSON.stringify({
        reference: reference || null,
        bank_name: bank_name || null,
        notes: notes || null,
      });
    }
    
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert(paymentData)
      .select()
      .single();

    if (paymentError) {
      console.error("[mark-paid] Erreur création payment:", paymentError);
      throw paymentError;
    }

    const settlement = await syncInvoiceStatusFromPayments(
      supabase as any,
      invoiceId,
      paymentData.date_paiement as string
    );

    if (!settlement) {
      throw new Error("Impossible de synchroniser le statut de la facture");
    }

    // =============================================
    // INTÉGRATION COMPTABLE
    // =============================================
    try {
      const accountingService = new AccountingIntegrationService(supabase);

      // Récupérer les informations nécessaires pour la comptabilité
      const { data: leaseDetails } = await supabase
        .from("leases")
        .select(`
          id,
          tenant_id,
          property:properties!inner(
            owner_id,
            code_postal,
            adresse_complete
          )
        `)
        .eq("id", invoiceData.lease_id)
        .single();

      if (leaseDetails) {
        const propertyData = leaseDetails.property as any;

        await accountingService.recordRentPayment({
          invoiceId,
          leaseId: leaseDetails.id,
          ownerId: propertyData.owner_id,
          tenantId: leaseDetails.tenant_id || "",
          periode: invoiceData.periode,
          montantLoyer: invoiceData.montant_loyer || 0,
          montantCharges: invoiceData.montant_charges || 0,
          montantTotal: paymentAmount,
          paymentDate: paymentData.date_paiement as string,
          propertyCodePostal: propertyData.code_postal || "75000",
        });

      }
    } catch (accountingError) {
      // Log mais ne pas bloquer le paiement si la comptabilité échoue
      console.error("[mark-paid] Erreur comptabilité (non bloquante):", accountingError);
    }

    let receiptDocumentId: string | null = null;
    if (settlement.isSettled && payment?.id) {
      try {
        const receiptResult = await generateReceipt(payment.id, supabase as any);
        receiptDocumentId = receiptResult?.documentId || null;
      } catch (receiptError) {
        console.error("[mark-paid] Erreur génération quittance:", receiptError);
      }

      // Off-Stripe receipt → ensure the double-entry `rent_received` is
      // posted to the owner accounting module (the Stripe webhook does
      // this inline; non-Stripe paths were missing it). Idempotent via
      // `reference = payment_id` guard inside the helper.
      try {
        const { ensureReceiptAccountingEntry } = await import(
          "@/lib/accounting/receipt-entry"
        );
        await ensureReceiptAccountingEntry(supabase as any, payment.id);
      } catch (entryError) {
        console.error(
          "[mark-paid] Écriture comptable (non bloquante):",
          entryError,
        );
      }
    }

    const [{ data: tenantProfile }, { data: ownerProfile }] = await Promise.all([
      supabase.from("profiles").select("user_id, prenom, nom").eq("id", invoiceData.tenant_id).maybeSingle(),
      supabase.from("profiles").select("user_id").eq("id", invoiceData.lease?.property?.owner_id).maybeSingle(),
    ]);

    const tenantDisplayName =
      `${tenantProfile?.prenom || ""} ${tenantProfile?.nom || ""}`.trim() || "Le locataire";

    const outboxEvents: Array<Record<string, unknown>> = [
      {
        event_type: "Payment.Succeeded",
        payload: {
          payment_id: payment?.id,
          invoice_id: invoiceId,
          tenant_id: tenantProfile?.user_id || null,
          amount: paymentAmount,
          periode: invoiceData.periode,
          property_address: invoiceData.lease?.property?.adresse_complete || null,
          receipt_generated: !!receiptDocumentId,
        },
      },
      {
        event_type: "Payment.Received",
        payload: {
          payment_id: payment?.id,
          invoice_id: invoiceId,
          owner_id: ownerProfile?.user_id || null,
          tenant_name: tenantDisplayName,
          amount: paymentAmount,
          periode: invoiceData.periode,
          property_address: invoiceData.lease?.property?.adresse_complete || null,
        },
      },
    ];

    if (settlement.isSettled) {
      outboxEvents.push({
        event_type: "Invoice.Paid",
        payload: {
          invoice_id: invoiceId,
          payment_id: payment?.id,
          lease_id: invoiceData.lease_id,
          tenant_id: invoiceData.tenant_id,
          amount: paymentAmount,
          payment_method: paymentMethod,
          reference,
          bank_name,
          marked_by: user.id,
          receipt_document_id: receiptDocumentId,
        },
      });
    }

    await supabase.from("outbox").insert(outboxEvents as any);

    // Journaliser
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "invoice_marked_paid",
      entity_type: "invoice",
      entity_id: invoiceId,
      metadata: {
        lease_id: invoiceData.lease_id,
        payment_id: payment?.id,
        amount: paymentAmount,
        payment_method: paymentMethod,
        reference,
        bank_name,
        notes,
      },
    } as any);

    return NextResponse.json({
      success: true,
      message: settlement.isSettled
        ? "Facture marquée comme payée"
        : "Paiement partiel enregistré",
      payment: payment,
      invoice_status: settlement.status,
      total_paid: settlement.totalPaid,
      remaining: settlement.remaining,
      receipt_document_id: receiptDocumentId,
    });
  } catch (error: unknown) {
    console.error("[mark-paid] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

