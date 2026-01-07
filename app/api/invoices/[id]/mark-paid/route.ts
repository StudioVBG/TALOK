export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/invoices/[id]/mark-paid - Marquer une facture comme payée manuellement
 * 
 * Utilisé par les propriétaires pour enregistrer un paiement reçu
 * (espèces, chèque, virement manuel, etc.)
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const invoiceId = params.id;

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
          property:properties!inner(owner_id)
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

    // Mettre à jour le statut de la facture
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ statut: "paid" })
      .eq("id", invoiceId);

    if (updateError) {
      console.error("[mark-paid] Erreur update invoice:", updateError);
      throw updateError;
    }

    // Émettre un événement
    await supabase.from("outbox").insert({
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
      },
    } as any);

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
      message: "Facture marquée comme payée",
      payment: payment,
    });
  } catch (error: any) {
    console.error("[mark-paid] Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

