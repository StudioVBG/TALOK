/**
 * SOTA 2026 : SEPA Pre-notification Edge Function
 *
 * Conformité SEPA Core : Le débiteur doit être prévenu au minimum
 * 14 jours (D-14) avant la date de prélèvement.
 *
 * CRON Schedule: 0 8 * * * (tous les jours à 8h UTC)
 *
 * Actions :
 * 1. Recherche les mandats SEPA actifs avec prélèvement dans 14 jours
 * 2. Envoie un email + notification in-app au locataire
 * 3. Enregistre dans l'audit log (conformité PSD3)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sepaPrenotification as sepaTemplate } from "../_shared/email-templates.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || Deno.env.get("EMAIL_API_KEY");
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://talok.fr";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || Deno.env.get("RESEND_FROM_EMAIL") || "Talok <noreply@talok.fr>";
const EMAIL_REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") || Deno.env.get("RESEND_REPLY_TO") || undefined;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PRENOTIFICATION_DAYS = 14;

function normalizeResendFromAddress(fromAddress: string): string {
  let normalized = fromAddress.trim();

  if (normalized.includes("@send.")) {
    normalized = normalized.replace(/@send\./i, "@");
  }

  if (!normalized.includes("<") && !normalized.includes(">")) {
    if (/@(gmail|hotmail|outlook|yahoo)\./i.test(normalized)) {
      console.warn(`[SEPA] Consumer mailbox detected (${normalized}), using default from`);
      return "Talok <noreply@talok.fr>";
    }

    return `Talok <${normalized}>`;
  }

  return normalized;
}

interface ActiveMandate {
  id: string;
  mandate_reference: string;
  tenant_profile_id: string;
  debtor_name: string;
  debtor_iban: string;
  amount: number;
  next_collection_date: string;
  last_prenotification_sent_at: string | null;
  lease: {
    id: string;
    loyer: number;
    charges_forfaitaires: number;
    property: {
      adresse_complete: string;
      ville: string;
    };
  };
  tenant: {
    user_id: string;
    email: string;
    prenom: string;
    nom: string;
  };
}

Deno.serve(async () => {
  try {
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + PRENOTIFICATION_DAYS);
    const targetDateStr = targetDate.toISOString().split("T")[0];

    console.log(`[SEPA Prenotif] Checking for collections on ${targetDateStr} (D-${PRENOTIFICATION_DAYS})`);

    // Find mandates with collection in PRENOTIFICATION_DAYS days
    // that haven't been notified yet for this cycle
    const { data: mandates, error } = await supabase
      .from("sepa_mandates")
      .select(`
        id, mandate_reference, tenant_profile_id,
        debtor_name, debtor_iban, amount,
        next_collection_date, last_prenotification_sent_at
      `)
      .eq("status", "active")
      .eq("next_collection_date", targetDateStr);

    if (error) throw error;

    const toNotify = (mandates ?? []).filter((m) => {
      if (!m.last_prenotification_sent_at) return true;
      const lastSent = new Date(m.last_prenotification_sent_at);
      const daysSinceLastNotif = Math.floor((today.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24));
      return daysSinceLastNotif >= 25; // At least 25 days since last notification (monthly cycle)
    });

    console.log(`[SEPA Prenotif] ${toNotify.length} mandates to notify`);

    let sent = 0;
    let failed = 0;

    for (const mandate of toNotify) {
      try {
        // Get tenant profile and lease info
        const { data: tenant } = await supabase
          .from("profiles")
          .select("user_id, email, prenom, nom")
          .eq("id", mandate.tenant_profile_id)
          .single();

        if (!tenant) {
          console.warn(`[SEPA Prenotif] No tenant found for ${mandate.tenant_profile_id}`);
          continue;
        }

        // Get lease info for context
        const { data: leaseSigners } = await supabase
          .from("lease_signers")
          .select("lease_id")
          .eq("profile_id", mandate.tenant_profile_id)
          .limit(1);

        let propertyAddress = "votre logement";
        if (leaseSigners?.[0]?.lease_id) {
          const { data: lease } = await supabase
            .from("leases")
            .select("properties(adresse_complete, ville)")
            .eq("id", leaseSigners[0].lease_id)
            .single();
          if (lease?.properties) {
            propertyAddress = `${(lease.properties as any).adresse_complete}, ${(lease.properties as any).ville}`;
          }
        }

        const collectionDate = new Date(mandate.next_collection_date).toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        const maskedIban = `${mandate.debtor_iban.slice(0, 4)} •••• •••• ${mandate.debtor_iban.slice(-4)}`;

        if (RESEND_API_KEY) {
          const emailHtml = sepaTemplate({
            tenantName: tenant.prenom,
            mandateReference: mandate.mandate_reference,
            amount: mandate.amount.toFixed(2),
            collectionDate,
            maskedIban,
            propertyAddress,
          });

          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: normalizeResendFromAddress(EMAIL_FROM),
              to: [tenant.email],
              subject: `Prélèvement SEPA prévu le ${collectionDate}`,
              reply_to: EMAIL_REPLY_TO || "support@talok.fr",
              tags: [
                { name: "type", value: "sepa_prenotification" },
                { name: "mandate_id", value: mandate.id },
              ],
              html: emailHtml,
            }),
          });

          if (!emailRes.ok) {
            const errBody = await emailRes.text();
            console.error(`[SEPA] Resend error ${emailRes.status}: ${errBody}`);
            failed++;
            continue;
          }
        } else {
          console.warn(`[SEPA] RESEND_API_KEY absent, email non envoyé pour ${tenant.email}`);
          failed++;
          continue;
        }

        // In-app notification
        if (tenant.user_id) {
          await supabase.rpc("create_notification", {
            p_recipient_id: mandate.tenant_profile_id,
            p_type: "payment_reminder",
            p_title: "Prélèvement SEPA prévu",
            p_message: `Un prélèvement de ${mandate.amount.toFixed(2)}€ est prévu le ${collectionDate}.`,
            p_link: "/tenant/settings/payments",
          });
        }

        // Update mandate only after successful email
        await supabase
          .from("sepa_mandates")
          .update({ last_prenotification_sent_at: new Date().toISOString() })
          .eq("id", mandate.id);

        // Audit log
        await supabase.from("payment_method_audit_log").insert({
          tenant_profile_id: mandate.tenant_profile_id,
          action: "prenotification_sent",
          details: {
            mandate_reference: mandate.mandate_reference,
            amount: mandate.amount,
            collection_date: mandate.next_collection_date,
            notification_date: today.toISOString(),
          },
        });

        sent++;
        console.log(`[SEPA Prenotif] Sent to ${tenant.email} for mandate ${mandate.mandate_reference}`);
      } catch (err) {
        failed++;
        console.error(`[SEPA Prenotif] Failed for mandate ${mandate.id}:`, err);
      }
    }

    const summary = { date: today.toISOString(), total: toNotify.length, sent, failed };
    console.log("[SEPA Prenotif] Complete:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SEPA Prenotif] Fatal:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
