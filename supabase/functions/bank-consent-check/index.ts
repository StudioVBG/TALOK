/**
 * Edge Function: Bank Consent Check (Cron daily 8h)
 *
 * Checks for bank connections with expiring DSP2 consent.
 * - Expiring within 7 days: sends email notification via Resend
 * - Already expired: updates sync_status to 'expired'
 *
 * Deploy: supabase functions deploy bank-consent-check
 * Schedule: 0 8 * * * (daily at 8:00 UTC)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const RESEND_FROM = Deno.env.get("RESEND_FROM_EMAIL") ?? "Talok <notifications@talok.fr>";
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://talok.fr";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Email helper via Resend API
// ---------------------------------------------------------------------------

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("[Consent Check] RESEND_API_KEY not set, skipping email");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Consent Check] Resend error: ${res.status} ${errText}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Consent Check] Email send error:", err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const sevenDaysFromNow = new Date(
      now.getTime() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    console.log(`[Consent Check] Running for ${today}`);

    // -----------------------------------------------------------------------
    // 1. Find connections expiring within 7 days (still active)
    // -----------------------------------------------------------------------

    const { data: expiringConnections, error: expError } = await supabase
      .from("bank_connections")
      .select("*, entity:entities(id, name)")
      .in("sync_status", ["synced", "active"])
      .eq("is_active", true)
      .lt("consent_expires_at", sevenDaysFromNow)
      .gt("consent_expires_at", now.toISOString());

    if (expError) throw expError;

    let emailsSent = 0;
    let connectionsExpired = 0;

    // -----------------------------------------------------------------------
    // 2. Send warning emails for expiring connections
    // -----------------------------------------------------------------------

    for (const connection of expiringConnections ?? []) {
      try {
        const expiresAt = new Date(connection.consent_expires_at);
        const daysLeft = Math.ceil(
          (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Find the entity owner to send email
        const { data: entity } = await supabase
          .from("entities")
          .select("owner_id")
          .eq("id", connection.entity_id)
          .single();

        if (!entity?.owner_id) continue;

        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, prenom, nom")
          .eq("id", entity.owner_id)
          .single();

        if (!profile?.user_id) continue;

        // Get user email
        const { data: userData } = await supabase.auth.admin.getUserById(
          profile.user_id,
        );

        if (!userData?.user?.email) continue;

        const bankName = connection.bank_name ?? "Votre banque";
        const entityName =
          connection.entity?.name ?? "votre entite";

        const subject = `Connexion ${bankName} expire dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`;

        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1a1a1a;">Connexion bancaire bientot expiree</h2>
            <p>Bonjour ${profile.prenom ?? ""},</p>
            <p>La connexion bancaire <strong>${bankName}</strong> pour <strong>${entityName}</strong> expire dans <strong>${daysLeft} jour${daysLeft > 1 ? "s" : ""}</strong> (le ${expiresAt.toLocaleDateString("fr-FR")}).</p>
            <p>Pour continuer a synchroniser automatiquement vos transactions, veuillez renouveler votre consentement :</p>
            <p style="text-align: center; margin: 24px 0;">
              <a href="${APP_URL}/owner/accounting/bank" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                Renouveler la connexion
              </a>
            </p>
            <p style="color: #6b7280; font-size: 14px;">
              Conformement a la reglementation DSP2, le consentement d'acces a vos donnees bancaires doit etre renouvele tous les 90 jours.
            </p>
            <p style="color: #6b7280; font-size: 12px;">— L'equipe Talok</p>
          </div>
        `;

        const sent = await sendEmail(userData.user.email, subject, html);
        if (sent) emailsSent++;

        console.log(
          `[Consent Check] Warning sent for connection ${connection.id}: ${daysLeft} days left`,
        );
      } catch (emailError) {
        console.error(
          `[Consent Check] Error sending warning for ${connection.id}:`,
          emailError,
        );
        // Non-blocking — continue with other connections
      }
    }

    // -----------------------------------------------------------------------
    // 3. Mark truly expired connections (consent_expires_at < now)
    // -----------------------------------------------------------------------

    const { data: expiredConnections, error: expiredError } = await supabase
      .from("bank_connections")
      .select("id, bank_name, entity_id")
      .in("sync_status", ["synced", "active"])
      .eq("is_active", true)
      .lt("consent_expires_at", now.toISOString());

    if (expiredError) throw expiredError;

    for (const connection of expiredConnections ?? []) {
      try {
        await supabase
          .from("bank_connections")
          .update({
            sync_status: "expired",
            error_message:
              "Consentement DSP2 expire. Veuillez reconnecter votre compte bancaire.",
            updated_at: now.toISOString(),
          })
          .eq("id", connection.id);

        connectionsExpired++;

        console.log(
          `[Consent Check] Connection ${connection.id} (${connection.bank_name}) marked as expired`,
        );
      } catch (updateError) {
        console.error(
          `[Consent Check] Error expiring connection ${connection.id}:`,
          updateError,
        );
      }
    }

    // -----------------------------------------------------------------------
    // 4. Audit log
    // -----------------------------------------------------------------------

    await supabase.from("audit_log").insert({
      user_id: "00000000-0000-0000-0000-000000000000",
      action: "bank_consent_check_cron",
      entity_type: "system",
      entity_id: today,
      metadata: {
        date: today,
        expiring_checked: expiringConnections?.length ?? 0,
        emails_sent: emailsSent,
        connections_expired: connectionsExpired,
      },
    } as any);

    console.log(
      `[Consent Check] Completed: ${emailsSent} emails sent, ${connectionsExpired} connections expired`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        date: today,
        expiringChecked: expiringConnections?.length ?? 0,
        emailsSent,
        connectionsExpired,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[Consent Check] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la verification des consentements",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
