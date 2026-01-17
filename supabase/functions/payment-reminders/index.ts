// Edge Function : Relances automatiques pour les impayés
// À déployer avec: supabase functions deploy payment-reminders
// À appeler via CRON chaque jour (ex: 9h) ou manuellement

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuration des seuils de relance (en jours)
const REMINDER_THRESHOLDS = [
  { days: 3, level: "friendly", subject: "Rappel paiement loyer" },
  { days: 7, level: "reminder", subject: "Rappel : Loyer en attente" },
  { days: 14, level: "urgent", subject: "⚠️ Impayé : Action requise" },
  { days: 30, level: "final", subject: "🚨 URGENT : Impayé de loyer" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
    
    console.log(`[Payment Reminders] Running for ${today}`);

    // 1. Récupérer toutes les factures non payées
    const { data: unpaidInvoices, error } = await supabase
      .from("invoices")
      .select(`
        id,
        periode,
        montant_total,
        created_at,
        last_reminder_at,
        reminder_count,
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
      .in("statut", ["sent", "late"]);

    if (error) throw error;

    let remindersSent = 0;
    let invoicesMarkedLate = 0;

    for (const invoice of unpaidInvoices || []) {
      // Calculer le nombre de jours depuis la création
      const createdDate = new Date(invoice.created_at);
      const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Calculer le nombre de jours depuis la dernière relance
      const lastReminderDate = invoice.last_reminder_at ? new Date(invoice.last_reminder_at) : null;
      const daysSinceLastReminder = lastReminderDate 
        ? Math.floor((now.getTime() - lastReminderDate.getTime()) / (1000 * 60 * 60 * 24))
        : daysSinceCreation;

      // Trouver le niveau de relance approprié
      const currentReminderCount = invoice.reminder_count || 0;
      const appropriateThreshold = REMINDER_THRESHOLDS.find((t, idx) => 
        daysSinceCreation >= t.days && currentReminderCount <= idx
      );

      // Ne pas relancer si déjà fait récemment (min 3 jours entre relances)
      if (!appropriateThreshold || daysSinceLastReminder < 3) {
        continue;
      }

      // 2. Récupérer les infos du locataire
      const { data: tenantProfile } = await supabase
        .from("profiles")
        .select("user_id, prenom, nom")
        .eq("id", invoice.tenant_id)
        .single();

      if (!tenantProfile?.user_id) continue;

      const propertyAddress = invoice.lease?.property?.adresse_complete || 
                              invoice.lease?.property?.ville || 
                              "votre logement";

      // 3. Créer la notification de relance
      await supabase.from("outbox").insert({
        event_type: "Payment.Reminder",
        payload: {
          invoice_id: invoice.id,
          tenant_id: tenantProfile.user_id,
          tenant_name: `${tenantProfile.prenom || ""} ${tenantProfile.nom || ""}`.trim(),
          montant_total: invoice.montant_total,
          periode: invoice.periode,
          property_address: propertyAddress,
          days_overdue: daysSinceCreation,
          reminder_level: appropriateThreshold.level,
          reminder_subject: appropriateThreshold.subject,
        },
      });

      // 4. Mettre à jour le compteur de relances
      await supabase
        .from("invoices")
        .update({
          last_reminder_at: now.toISOString(),
          reminder_count: currentReminderCount + 1,
          statut: daysSinceCreation >= 7 ? "late" : invoice.statut, // Marquer comme "late" après 7 jours
        } as any)
        .eq("id", invoice.id);

      if (daysSinceCreation >= 7 && invoice.statut !== "late") {
        invoicesMarkedLate++;
      }

      remindersSent++;
      console.log(`[Payment Reminders] Sent ${appropriateThreshold.level} reminder for invoice ${invoice.id}`);

      // 5. Notifier aussi le propriétaire si impayé critique (14+ jours)
      if (daysSinceCreation >= 14) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("user_id, prenom, nom")
          .eq("id", invoice.owner_id)
          .single();

        if (ownerProfile?.user_id) {
          await supabase.from("outbox").insert({
            event_type: "Payment.OverdueAlert",
            payload: {
              invoice_id: invoice.id,
              owner_id: ownerProfile.user_id,
              tenant_name: `${tenantProfile.prenom || ""} ${tenantProfile.nom || ""}`.trim(),
              montant_total: invoice.montant_total,
              periode: invoice.periode,
              property_address: propertyAddress,
              days_overdue: daysSinceCreation,
            },
          });
        }
      }
    }

    // 6. Log audit
    await supabase.from("audit_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000", // System
      action: "payment_reminders_sent",
      entity_type: "system",
      entity_id: today,
      metadata: {
        date: today,
        reminders_sent: remindersSent,
        invoices_marked_late: invoicesMarkedLate,
        total_unpaid_checked: unpaidInvoices?.length || 0,
      },
    } as any);

    console.log(`[Payment Reminders] Completed: ${remindersSent} reminders sent, ${invoicesMarkedLate} marked late`);

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        reminders_sent: remindersSent,
        invoices_marked_late: invoicesMarkedLate,
        total_checked: unpaidInvoices?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[Payment Reminders] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erreur lors des relances" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

