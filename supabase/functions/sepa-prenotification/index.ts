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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://app.talok.fr";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const PRENOTIFICATION_DAYS = 14;

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

        // Send email via Resend
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "Talok <noreply@talok.fr>",
              to: [tenant.email],
              subject: `Prélèvement SEPA prévu le ${collectionDate}`,
              html: `
                <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #1e293b;">Avis de prélèvement SEPA</h2>
                  <p>Bonjour ${tenant.prenom},</p>
                  <p>Conformément à votre mandat SEPA <strong>${mandate.mandate_reference}</strong>, 
                  un prélèvement sera effectué sur votre compte bancaire :</p>
                  
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Montant</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px; color: #1e293b;">${mandate.amount.toFixed(2)} €</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Date de prélèvement</td>
                        <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #1e293b;">${collectionDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Compte débité</td>
                        <td style="padding: 8px 0; text-align: right; font-family: monospace; color: #1e293b;">${maskedIban}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Logement</td>
                        <td style="padding: 8px 0; text-align: right; color: #1e293b;">${propertyAddress}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Réf. mandat</td>
                        <td style="padding: 8px 0; text-align: right; font-family: monospace; color: #64748b; font-size: 12px;">${mandate.mandate_reference}</td>
                      </tr>
                    </table>
                  </div>

                  <p style="font-size: 14px; color: #475569;">
                    Assurez-vous que votre compte dispose des fonds nécessaires à cette date.
                    En cas de question ou de contestation, vous disposez d'un droit de remboursement 
                    de <strong>8 semaines</strong> après le prélèvement (mandat SEPA Core).
                  </p>

                  <a href="${APP_URL}/tenant/settings/payments" 
                     style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; 
                            text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 12px;">
                    Gérer mes moyens de paiement
                  </a>

                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                  <p style="font-size: 12px; color: #94a3b8;">
                    Cet email est envoyé conformément à la réglementation SEPA (notification D-14 minimum).
                    Identifiant créancier : Talok SAS.
                  </p>
                </div>
              `,
            }),
          });
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

        // Update mandate
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
