export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { generateReceipt } from "@/lib/documents/receipt-generator";

/**
 * POST /api/leases/[id]/generate-receipt
 *
 * Génère manuellement une quittance de loyer pour une facture payée.
 * Réservé au propriétaire du bail.
 *
 * Body: { invoice_id: string, send_email?: boolean }
 *
 * Cas d'usage :
 * - Régénération après échec de la génération automatique
 * - Génération pour un paiement manuel (espèces, virement)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;

  try {
    // 1. Auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = createServiceRoleClient();

    // 2. Vérifier le profil propriétaire
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Accès réservé aux propriétaires" },
        { status: 403 }
      );
    }

    // 3. Vérifier que le bail appartient au propriétaire
    const { data: lease } = await serviceClient
      .from("leases")
      .select("id, property:properties!inner(owner_id)")
      .eq("id", leaseId)
      .single();

    if (!lease) {
      return NextResponse.json(
        { error: "Bail non trouvé" },
        { status: 404 }
      );
    }

    const leaseData = lease as any;
    if (leaseData.property?.owner_id !== profile.id) {
      return NextResponse.json(
        { error: "Vous n'êtes pas propriétaire de ce bail" },
        { status: 403 }
      );
    }

    // 4. Parse body
    // NOTE: `send_email` was historically accepted as an opt-out flag but
    // is now ignored — the orchestrator `generateReceipt()` always sends
    // the receipt email to the tenant when a new quittance is created
    // (and is idempotent when one already exists).
    const body = await request.json();
    const { invoice_id } = body as {
      invoice_id: string;
      send_email?: boolean;
    };

    if (!invoice_id) {
      return NextResponse.json(
        { error: "invoice_id est requis" },
        { status: 400 }
      );
    }

    // 5. Vérifier que la facture appartient au bail
    const { data: invoice } = await serviceClient
      .from("invoices")
      .select("id, lease_id")
      .eq("id", invoice_id)
      .eq("lease_id", leaseId)
      .single();

    if (!invoice) {
      return NextResponse.json(
        { error: "Facture non trouvée pour ce bail" },
        { status: 404 }
      );
    }

    // 6. Trouver le dernier paiement succeeded pour cette facture
    const { data: payment } = await serviceClient
      .from("payments")
      .select("id")
      .eq("invoice_id", invoice_id)
      .eq("statut", "succeeded")
      .order("date_paiement", { ascending: false })
      .limit(1)
      .single();

    if (!payment) {
      return NextResponse.json(
        {
          error: "Aucun paiement validé trouvé pour cette facture",
          code: "NO_SUCCEEDED_PAYMENT",
        },
        { status: 409 }
      );
    }

    // 7. Générer la quittance (PDF + storage + DB + email au locataire)
    const result = await generateReceipt(payment.id, serviceClient);

    if (!result.success) {
      return NextResponse.json(
        {
          error:
            result.error ||
            "Impossible de générer la quittance (facture non réglée ou données manquantes)",
          code: "GENERATION_FAILED",
        },
        { status: 422 }
      );
    }

    // 7-bis. Post the matching `rent_received` double-entry for off-Stripe
    // payments. Idempotent: the helper skips if an entry with
    // reference=payment_id already exists (so Stripe-originated payments
    // stay untouched).
    try {
      const { ensureReceiptAccountingEntry } = await import(
        "@/lib/accounting/receipt-entry"
      );
      await ensureReceiptAccountingEntry(serviceClient, payment.id);
    } catch (entryError) {
      console.error(
        "[generate-receipt] Écriture comptable (non bloquante):",
        entryError,
      );
    }

    return NextResponse.json({
      success: true,
      created: result.created,
      document_id: result.documentId,
      storage_path: result.storagePath,
      email_sent: result.emailSent ?? false,
    });
  } catch (error) {
    console.error("[generate-receipt] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}
