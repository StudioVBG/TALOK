export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { AccountingIntegrationService } from "@/features/accounting/services/accounting-integration.service";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { ensureReceiptDocument } from "@/lib/services/final-documents.service";
import { syncInvoiceStatusFromPayments } from "@/lib/services/invoice-status.service";

/**
 * POST /api/invoices/[id]/mark-paid - Marquer une facture comme payée manuellement
 *
 * Utilisé par les propriétaires pour enregistrer un paiement reçu
 * (espèces, chèque, virement manuel, etc.)
 *
 * Auth via user-scoped client, DB reads/writes via service client pour
 * éviter la récursion RLS 42P17 sur profiles/leases/properties qui faisait
 * remonter `!inner` joins à vide → 404 "Facture non trouvée" pour des
 * factures pourtant existantes.
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

    const serviceClient = getServiceClient();

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

    // Récupérer la facture — service client pour bypasser RLS ; l'autorisation
    // est vérifiée manuellement ci-dessous via owner_id.
    //
    // Étape 1 : lecture "plate" de l'invoice. Si le résultat est null, c'est
    // que l'id n'existe pas — 404 légitime. Si une erreur est renvoyée, on
    // remonte un 500 détaillé plutôt que de masquer la cause derrière un
    // faux 404 (bug historique : un échec schema-cache / RLS / FK cassé
    // donnait un 404 "Facture non trouvée" impossible à diagnostiquer côté
    // front).
    const { data: invoice, error: invoiceError } = await serviceClient
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError) {
      console.error("[mark-paid] Erreur lecture facture:", invoiceError);
      return NextResponse.json(
        {
          error: `Erreur lecture facture: ${invoiceError.message}`,
          code: invoiceError.code ?? null,
        },
        { status: 500 }
      );
    }

    if (!invoice) {
      return NextResponse.json(
        { error: "Facture non trouvée" },
        { status: 404 }
      );
    }

    // Étape 2 : résoudre l'owner + l'adresse via lease→property en
    // requête séparée. Si le bail ou la property sont orphelins, on retombe
    // sur `invoice.owner_id` dénormalisé sans renvoyer de 500. Le champ
    // d'adresse alimente les événements outbox plus bas.
    let ownerFromLease: string | null = null;
    let propertyAddress: string | null = null;
    const invoiceData = invoice as any;
    if (invoiceData.lease_id) {
      const { data: leaseRow } = await serviceClient
        .from("leases")
        .select("property:properties(owner_id, adresse_complete)")
        .eq("id", invoiceData.lease_id)
        .maybeSingle();
      ownerFromLease = (leaseRow as any)?.property?.owner_id ?? null;
      propertyAddress = (leaseRow as any)?.property?.adresse_complete ?? null;
    }

    // Vérifier les permissions via service client (évite 42P17 sur profiles)
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    const profileData = profile as any;
    const isAdmin = profileData?.role === "admin";
    // `owner_id` est dénormalisé sur invoices — le chemin lease→property sert
    // de defense-in-depth au cas où la dénormalisation n'aurait pas eu lieu.
    const invoiceOwnerId = invoiceData.owner_id ?? ownerFromLease;
    const isOwner = !!profileData?.id && invoiceOwnerId === profileData.id;

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

    const { data: payment, error: paymentError } = await serviceClient
      .from("payments")
      .insert(paymentData as any)
      .select()
      .single();

    if (paymentError) {
      console.error("[mark-paid] Erreur création payment:", paymentError);
      throw paymentError;
    }

    const settlement = await syncInvoiceStatusFromPayments(
      serviceClient as any,
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
      const accountingService = new AccountingIntegrationService(serviceClient as any);

      // Récupérer les informations nécessaires pour la comptabilité
      const { data: leaseDetails } = await serviceClient
        .from("leases")
        .select(`
          id,
          tenant_id,
          property:properties(
            owner_id,
            code_postal,
            adresse_complete
          )
        `)
        .eq("id", invoiceData.lease_id)
        .single();

      if (leaseDetails) {
        const propertyData = (leaseDetails as any).property;

        await accountingService.recordRentPayment({
          invoiceId,
          leaseId: (leaseDetails as any).id,
          ownerId: propertyData?.owner_id,
          tenantId: (leaseDetails as any).tenant_id || "",
          periode: invoiceData.periode,
          montantLoyer: invoiceData.montant_loyer || 0,
          montantCharges: invoiceData.montant_charges || 0,
          montantTotal: paymentAmount,
          paymentDate: paymentData.date_paiement as string,
          propertyCodePostal: propertyData?.code_postal || "75000",
        });

      }
    } catch (accountingError) {
      // Log mais ne pas bloquer le paiement si la comptabilité échoue
      console.error("[mark-paid] Erreur comptabilité (non bloquante):", accountingError);
    }

    let receiptDocumentId: string | null = null;
    if (settlement.isSettled && payment?.id) {
      try {
        const receiptResult = await ensureReceiptDocument(serviceClient as any, payment.id);
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
        await ensureReceiptAccountingEntry(serviceClient as any, payment.id);
      } catch (entryError) {
        console.error(
          "[mark-paid] Écriture comptable (non bloquante):",
          entryError,
        );
      }
    }

    const [{ data: tenantProfile }, { data: ownerProfile }] = await Promise.all([
      serviceClient.from("profiles").select("user_id, prenom, nom").eq("id", invoiceData.tenant_id).maybeSingle(),
      serviceClient.from("profiles").select("user_id").eq("id", invoiceOwnerId).maybeSingle(),
    ]);

    const tenantDisplayName =
      `${(tenantProfile as any)?.prenom || ""} ${(tenantProfile as any)?.nom || ""}`.trim() || "Le locataire";

    const outboxEvents: Array<Record<string, unknown>> = [
      {
        event_type: "Payment.Succeeded",
        payload: {
          payment_id: payment?.id,
          invoice_id: invoiceId,
          tenant_id: (tenantProfile as any)?.user_id || null,
          amount: paymentAmount,
          periode: invoiceData.periode,
          property_address: propertyAddress,
          receipt_generated: !!receiptDocumentId,
        },
      },
      {
        event_type: "Payment.Received",
        payload: {
          payment_id: payment?.id,
          invoice_id: invoiceId,
          owner_id: (ownerProfile as any)?.user_id || null,
          tenant_name: tenantDisplayName,
          amount: paymentAmount,
          periode: invoiceData.periode,
          property_address: propertyAddress,
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

    // Outbox + audit_log : non bloquants. Une insertion échouée ne doit
    // JAMAIS faire retourner 500 alors que le paiement est déjà enregistré
    // en base (sinon le front affiche "Erreur serveur" et l'utilisateur
    // retente → doublon).
    const { error: outboxError } = await serviceClient
      .from("outbox")
      .insert(outboxEvents as any);
    if (outboxError) {
      console.error(
        "[mark-paid] Outbox insert failed (non bloquant):",
        outboxError,
      );
    }

    const { error: auditError } = await serviceClient
      .from("audit_log")
      .insert({
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
    if (auditError) {
      console.error(
        "[mark-paid] Audit log insert failed (non bloquant):",
        auditError,
      );
    }

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

