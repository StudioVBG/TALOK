// Edge Function : Génération mensuelle automatique des factures de loyer
// À déployer avec: supabase functions deploy monthly-invoicing
// À appeler via CRON le 1er de chaque mois ou manuellement

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

    // Récupérer le mois cible depuis le body ou utiliser le mois courant
    let targetMonth: string;
    
    try {
      const body = await req.json();
      targetMonth = body.month;
    } catch {
      // Pas de body, utiliser le mois courant
      const now = new Date();
      targetMonth = now.toISOString().slice(0, 7); // YYYY-MM
    }

    console.log(`[Monthly Invoicing] Generating invoices for ${targetMonth}`);

    // 1. Appeler la fonction SQL pour générer les factures
    const { data: result, error: genError } = await supabase.rpc(
      "generate_monthly_invoices",
      { p_target_month: targetMonth }
    );

    if (genError) {
      console.error("[Monthly Invoicing] Error:", genError);
      throw genError;
    }

    console.log(`[Monthly Invoicing] Generated ${result?.generated_count || 0} invoices`);

    // 2. Récupérer les factures créées pour envoyer les notifications
    const { data: newInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select(`
        id,
        periode,
        montant_total,
        montant_loyer,
        montant_charges,
        tenant_id,
        owner_id,
        lease:leases (
          id,
          property:properties (
            adresse_complete,
            ville
          )
        )
      `)
      .eq("periode", targetMonth)
      .eq("statut", "sent")
      .gte("created_at", new Date(Date.now() - 60000).toISOString()); // Créées dans la dernière minute

    if (fetchError) {
      console.error("[Monthly Invoicing] Error fetching invoices:", fetchError);
    }

    // 3. Émettre les événements pour notifier les locataires
    const notificationPromises = (newInvoices || []).map(async (invoice: any) => {
      // Récupérer le user_id du locataire
      const { data: tenantProfile } = await supabase
        .from("profiles")
        .select("user_id, prenom, nom")
        .eq("id", invoice.tenant_id)
        .single();

      if (tenantProfile?.user_id) {
        const propertyAddress = invoice.lease?.property?.adresse_complete || 
                                invoice.lease?.property?.ville || 
                                "votre logement";

        // Créer un événement dans l'outbox
        await supabase.from("outbox").insert({
          event_type: "Rent.InvoiceIssued",
          payload: {
            invoice_id: invoice.id,
            tenant_id: tenantProfile.user_id,
            tenant_name: `${tenantProfile.prenom || ""} ${tenantProfile.nom || ""}`.trim(),
            montant_total: invoice.montant_total,
            month: invoice.periode,
            property_address: propertyAddress,
          },
        });

        console.log(`[Monthly Invoicing] Notification queued for tenant ${tenantProfile.user_id}`);
      }
    });

    await Promise.all(notificationPromises);

    // 4. Log audit pour traçabilité
    await supabase.from("audit_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000", // System
      action: "monthly_invoicing_completed",
      entity_type: "system",
      entity_id: targetMonth,
      metadata: {
        month: targetMonth,
        generated_count: result?.generated_count || 0,
        notifications_queued: newInvoices?.length || 0,
        timestamp: new Date().toISOString(),
      },
    } as any);

    return new Response(
      JSON.stringify({
        success: true,
        month: targetMonth,
        generated_count: result?.generated_count || 0,
        notifications_sent: newInvoices?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[Monthly Invoicing] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erreur lors de la génération des factures" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

