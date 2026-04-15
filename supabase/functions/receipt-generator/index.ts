// @deprecated 2026-04 — Conservé pour rétro-compatibilité d'un éventuel
// déploiement antérieur côté Supabase, mais la génération de quittance
// passe désormais par le pipeline Node :
//   lib/services/final-documents.service.ts :: ensureReceiptDocument()
// Appelé en fire-and-forget depuis app/api/webhooks/stripe/route.ts
// (case payment_intent.succeeded, checkout.session.completed, invoice.paid)
// et en await depuis app/api/invoices/[id]/mark-paid/route.ts.
// → NE PAS ÉTENDRE. Toute nouvelle logique va dans final-documents.service.ts.
//
// Conformité : Art. 21 de la loi du 6 juillet 1989

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { invoice_id, payment_id } = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Receipt Generator] Processing invoice ${invoice_id}, payment ${payment_id}`);

    // 1. Récupérer la facture avec toutes les données associées
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id,
        lease_id,
        tenant_id,
        owner_id,
        periode,
        montant_loyer,
        montant_charges,
        montant_total,
        period_start,
        period_end,
        date_echeance,
        paid_at,
        notes
      `)
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error("[Receipt Generator] Invoice not found:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Facture non trouvée" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Vérifier qu'une quittance n'existe pas déjà
    const { data: existingReceipt } = await supabase
      .from("receipts")
      .select("id")
      .eq("invoice_id", invoice_id)
      .maybeSingle();

    if (existingReceipt) {
      console.log(`[Receipt Generator] Receipt already exists for invoice ${invoice_id}`);
      return new Response(
        JSON.stringify({ success: true, receipt_id: existingReceipt.id, status: "already_exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Récupérer les profils tenant + owner
    const [tenantResult, ownerResult] = await Promise.all([
      supabase.from("profiles").select("id, prenom, nom, email").eq("id", invoice.tenant_id).single(),
      supabase.from("profiles").select("id, prenom, nom, email").eq("id", invoice.owner_id).single(),
    ]);

    const tenant = tenantResult.data;
    const owner = ownerResult.data;

    // 3. Récupérer les infos du bail et de la propriété
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id,
        type_bail,
        date_debut,
        property:properties (
          id,
          adresse_complete,
          ville,
          code_postal
        )
      `)
      .eq("id", invoice.lease_id)
      .single();

    // 4. Calculer la période
    const periodStart = invoice.period_start || `${invoice.periode}-01`;
    const periodEnd = invoice.period_end ||
      new Date(new Date(`${invoice.periode}-01`).getFullYear(), new Date(`${invoice.periode}-01`).getMonth() + 1, 0)
        .toISOString().split("T")[0];

    // 5. Appeler generate-pdf pour créer le PDF de la quittance
    const pdfPayload = {
      type: "receipt",
      data: {
        lease_id: invoice.lease_id,
        month: invoice.periode,
        tenant_name: `${tenant?.prenom || ""} ${tenant?.nom || ""}`.trim(),
        owner_name: `${owner?.prenom || ""} ${owner?.nom || ""}`.trim(),
        property_address: (lease?.property as any)?.adresse_complete || "",
        city: (lease?.property as any)?.ville || "",
        postal_code: (lease?.property as any)?.code_postal || "",
        rent_amount: invoice.montant_loyer,
        charges_amount: invoice.montant_charges,
        total_amount: invoice.montant_total,
        period_start: periodStart,
        period_end: periodEnd,
        payment_date: invoice.paid_at || new Date().toISOString(),
        lease_type: lease?.type_bail || "meuble",
      },
    };

    // Appel à la fonction generate-pdf
    const generatePdfUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-pdf`;
    const pdfResponse = await fetch(generatePdfUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(pdfPayload),
    });

    let pdfUrl: string | null = null;
    let pdfStoragePath: string | null = null;

    if (pdfResponse.ok) {
      const pdfResult = await pdfResponse.json();
      pdfUrl = pdfResult.public_url || pdfResult.url || null;
      pdfStoragePath = pdfResult.storage_path || `receipts/${invoice.lease_id}/${invoice.periode}/quittance.pdf`;
    } else {
      console.error("[Receipt Generator] PDF generation failed:", await pdfResponse.text());
      // On continue quand même — la quittance sera créée sans PDF
    }

    // 6. Insérer dans la table receipts
    const { data: receipt, error: receiptError } = await supabase
      .from("receipts")
      .insert({
        payment_id: payment_id || null,
        lease_id: invoice.lease_id,
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id,
        owner_id: invoice.owner_id,
        period: invoice.periode,
        period_start: periodStart,
        period_end: periodEnd,
        montant_loyer: invoice.montant_loyer,
        montant_charges: invoice.montant_charges,
        montant_total: invoice.montant_total,
        pdf_url: pdfUrl,
        pdf_storage_path: pdfStoragePath,
        generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (receiptError) {
      console.error("[Receipt Generator] Error creating receipt:", receiptError);
      throw receiptError;
    }

    // 7. Mettre à jour le credit score du locataire
    await updateCreditScore(supabase, invoice.tenant_id, invoice);

    // 8. Émettre un événement pour notification (email au locataire)
    await supabase.from("outbox").insert({
      event_type: "Receipt.Generated",
      payload: {
        receipt_id: receipt.id,
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id,
        owner_id: invoice.owner_id,
        tenant_email: tenant?.email,
        tenant_name: `${tenant?.prenom || ""} ${tenant?.nom || ""}`.trim(),
        montant_total: invoice.montant_total,
        periode: invoice.periode,
        pdf_url: pdfUrl,
      },
    });

    console.log(`[Receipt Generator] Receipt ${receipt.id} created for invoice ${invoice_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        receipt_id: receipt.id,
        pdf_url: pdfUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[Receipt Generator] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erreur lors de la génération de quittance",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Met à jour le score de ponctualité du locataire
 * Algorithme SOTA 2026 :
 *   - Paiement à temps (J ou avant) : +10 pts
 *   - Paiement en avance (> 3j avant) : +12 pts
 *   - Score = (points obtenus / points max possibles) × 100
 */
async function updateCreditScore(
  supabase: any,
  tenantId: string,
  invoice: any
): Promise<void> {
  try {
    // Déterminer si le paiement est à temps, en avance, ou en retard
    const paidAt = invoice.paid_at ? new Date(invoice.paid_at) : new Date();
    const dueDate = invoice.date_echeance ? new Date(invoice.date_echeance) : null;

    let isOnTime = true;
    let isEarly = false;

    if (dueDate) {
      const diffDays = Math.floor((dueDate.getTime() - paidAt.getTime()) / (1000 * 60 * 60 * 24));
      isOnTime = diffDays >= 0;
      isEarly = diffDays > 3;
    }

    // Upsert le credit score
    const { data: existing } = await supabase
      .from("tenant_credit_score")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const onTimeCount = (existing?.on_time_count || 0) + (isOnTime ? 1 : 0);
    const earlyCount = (existing?.early_count || 0) + (isEarly ? 1 : 0);
    const lateCount = (existing?.late_count || 0) + (!isOnTime ? 1 : 0);
    const totalPayments = (existing?.total_payments || 0) + 1;

    // Calcul du score : pondération des paiements
    const points = (onTimeCount - earlyCount) * 10 + earlyCount * 12;
    const maxPoints = totalPayments * 12;
    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : null;

    if (existing) {
      await supabase
        .from("tenant_credit_score")
        .update({
          score,
          on_time_count: onTimeCount,
          early_count: earlyCount,
          late_count: lateCount,
          total_payments: totalPayments,
          last_updated: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId);
    } else {
      await supabase
        .from("tenant_credit_score")
        .insert({
          tenant_id: tenantId,
          score,
          on_time_count: onTimeCount,
          early_count: earlyCount,
          late_count: lateCount,
          total_payments: totalPayments,
        });
    }
  } catch (error) {
    console.error("[Receipt Generator] Error updating credit score:", error);
    // Ne pas faire échouer la génération de quittance pour un échec de score
  }
}
