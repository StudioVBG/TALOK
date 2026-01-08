// Edge Function : Worker pour traiter les événements de l'outbox
// À déployer avec: supabase functions deploy process-outbox
// À appeler périodiquement via cron ou webhook

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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Récupérer les événements en attente (max 50 par batch)
    const { data: events, error: fetchError } = await supabaseClient
      .from("outbox")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: "Aucun événement à traiter", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const event of events) {
      try {
        // Marquer comme en traitement
        await supabaseClient
          .from("outbox")
          .update({ status: "processing", processed_at: new Date().toISOString() } as any)
          .eq("id", event.id);

        // Traiter l'événement selon son type
        await processEvent(supabaseClient, event);

        // Marquer comme complété
        await supabaseClient
          .from("outbox")
          .update({ status: "completed" } as any)
          .eq("id", event.id);

        processed++;
      } catch (error) {
        console.error(`Erreur traitement événement ${event.id}:`, error);

        // Incrémenter le compteur de retry
        const retryCount = (event.retry_count || 0) + 1;
        const maxRetries = event.max_retries || 3;

        if (retryCount >= maxRetries) {
          // Marquer comme échoué définitivement
          await supabaseClient
            .from("outbox")
            .update({
              status: "failed",
              error_message: error.message,
            } as any)
            .eq("id", event.id);
        } else {
          // Réessayer plus tard (backoff exponentiel)
          const backoffDelay = Math.pow(2, retryCount) * 60; // 2, 4, 8 minutes
          const nextScheduled = new Date(Date.now() + backoffDelay * 1000).toISOString();

          await supabaseClient
            .from("outbox")
            .update({
              status: "pending",
              retry_count: retryCount,
              scheduled_at: nextScheduled,
              error_message: error.message,
            } as any)
            .eq("id", event.id);
        }

        failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: events.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processEvent(supabase: any, event: any) {
  const { event_type, payload } = event;

  switch (event_type) {
    // Notifications
    case "Rent.InvoiceIssued":
      await sendNotification(supabase, {
        type: "invoice_issued",
        user_id: payload.tenant_id,
        title: "Nouvelle facture de loyer",
        message: `Une facture de ${payload.montant_total}€ a été émise pour ${payload.month}`,
        metadata: { invoice_id: payload.invoice_id },
      });
      break;

    case "Payment.Succeeded":
      await sendNotification(supabase, {
        type: "payment_succeeded",
        user_id: payload.tenant_id,
        title: "✅ Paiement confirmé",
        message: `Votre paiement de ${payload.amount}€ pour ${payload.property_address || "votre loyer"} (${payload.periode}) a été confirmé. Votre quittance est disponible.`,
        metadata: { payment_id: payload.payment_id, invoice_id: payload.invoice_id },
      });

      // La quittance est déjà générée dans le webhook Stripe (processReceiptGeneration)
      // mais on garde un fallback au cas où
      if (payload.invoice_id && !payload.receipt_generated) {
        await generateReceiptAutomatically(supabase, payload.invoice_id, payload.payment_id);
      }
      break;

    // ✅ SOTA 2026: Notifier le propriétaire qu'un paiement a été reçu
    case "Payment.Received":
      await sendNotification(supabase, {
        type: "payment_received",
        user_id: payload.owner_id,
        title: "💰 Paiement reçu !",
        message: `${payload.tenant_name || "Votre locataire"} a payé ${payload.amount}€ pour ${payload.property_address || "le logement"} (${payload.periode}).`,
        metadata: { payment_id: payload.payment_id, invoice_id: payload.invoice_id },
      });
      break;

    case "Ticket.Opened":
      await sendNotification(supabase, {
        type: "ticket_opened",
        user_id: payload.owner_id,
        title: "Nouveau ticket",
        message: `Un nouveau ticket a été ouvert: ${payload.title}`,
        metadata: { ticket_id: payload.ticket_id },
      });
      break;

    case "Lease.Activated":
      // Notifier le locataire que le bail est actif
      if (payload.tenant_user_id) {
        await sendNotification(supabase, {
          type: "lease_activated",
          user_id: payload.tenant_user_id,
          title: "🏠 Bail activé !",
          message: `Votre bail pour ${payload.property_address || "le logement"} est maintenant actif. Bienvenue chez vous !`,
          metadata: { lease_id: payload.lease_id },
        });
      }
      break;

    // ✅ SOTA 2026: Notification quand le locataire signe
    case "Lease.TenantSigned":
      if (payload.owner_user_id) {
        await sendNotification(supabase, {
          type: "lease_tenant_signed",
          user_id: payload.owner_user_id,
          title: "✍️ Signature locataire reçue !",
          message: `${payload.tenant_name} a signé le bail pour ${payload.property_address}. C'est à votre tour !`,
          metadata: { lease_id: payload.lease_id, action: "sign_required" },
        });
        
        // Envoyer aussi un email
        await sendSignatureEmail(supabase, {
          user_id: payload.owner_user_id,
          subject: `✍️ ${payload.tenant_name} a signé le bail !`,
          message: `Le locataire a signé le bail pour ${payload.property_address}. Connectez-vous pour finaliser la signature.`,
          cta_label: "Signer le bail",
          cta_url: `/owner/leases/${payload.lease_id}`,
        });
      }
      break;

    // ✅ SOTA 2026: Notification quand le propriétaire signe
    case "Lease.OwnerSigned":
      if (payload.tenant_user_id) {
        await sendNotification(supabase, {
          type: "lease_owner_signed",
          user_id: payload.tenant_user_id,
          title: "✅ Le propriétaire a signé !",
          message: `${payload.owner_name} a également signé le bail pour ${payload.property_address}.`,
          metadata: { lease_id: payload.lease_id },
        });
      }
      break;

    // ✅ SOTA 2026: Notification quand le bail est entièrement signé
    case "Lease.FullySigned":
      await sendNotification(supabase, {
        type: "lease_fully_signed",
        user_id: payload.user_id,
        title: "🎉 Bail entièrement signé !",
        message: payload.is_owner 
          ? `Toutes les signatures sont complètes pour ${payload.property_address}. Prochaine étape : l'état des lieux.`
          : `Votre bail pour ${payload.property_address} est signé par toutes les parties. L'état des lieux sera bientôt programmé.`,
        metadata: { 
          lease_id: payload.lease_id, 
          next_step: payload.next_step,
          action: payload.is_owner ? "create_edl" : null 
        },
      });

      // Envoyer email avec prochaines étapes
      await sendSignatureEmail(supabase, {
        user_id: payload.user_id,
        subject: "🎉 Bail signé - Prochaines étapes",
        message: payload.is_owner 
          ? `Félicitations ! Le bail pour ${payload.property_address} est maintenant signé. Créez l'état des lieux d'entrée pour finaliser l'emménagement.`
          : `Félicitations ! Votre bail pour ${payload.property_address} est signé. Votre propriétaire va programmer l'état des lieux d'entrée.`,
        cta_label: payload.is_owner ? "Créer l'état des lieux" : "Voir mon bail",
        cta_url: payload.is_owner 
          ? `/owner/inspections/new?lease_id=${payload.lease_id}`
          : `/tenant/lease`,
      });
      break;

    case "EDL.InvitationSent":
      // Notification pour invitation EDL
      if (payload.tenant_user_id) {
        await sendNotification(supabase, {
          type: "edl_invitation",
          user_id: payload.tenant_user_id,
          title: "📋 État des lieux programmé",
          message: `Un état des lieux ${payload.type === "entree" ? "d'entrée" : "de sortie"} a été programmé pour ${payload.property_address}.`,
          metadata: { edl_id: payload.edl_id, type: payload.type },
        });
      }
      break;

    // Calcul d'âge depuis OCR
    case "application.ocr.completed":
      if (payload.extracted_fields?.birthdate) {
        await calculateAndStoreAge(supabase, payload.application_id, payload.extracted_fields.birthdate);
      }
      break;

    // Mise à jour législative - Notification aux propriétaires et locataires
    case "Legislation.Updated":
      await handleLegislationUpdate(supabase, payload);
      break;

    // ✅ SOTA 2026: Relances de paiement automatisées
    case "Payment.Reminder":
      await sendNotification(supabase, {
        type: "payment_reminder",
        user_id: payload.tenant_id,
        title: payload.reminder_subject || "Rappel de paiement",
        message: `Votre loyer de ${payload.montant_total}€ pour ${payload.property_address} (${payload.periode}) n'a pas encore été réglé (${payload.days_overdue} jours).`,
        metadata: { 
          invoice_id: payload.invoice_id, 
          level: payload.reminder_level,
          days_overdue: payload.days_overdue 
        },
      });

      // Envoyer email de relance
      await sendPaymentReminderEmail(supabase, payload);
      break;

    // ✅ SOTA 2026: Alerte propriétaire pour impayé critique
    case "Payment.OverdueAlert":
      await sendNotification(supabase, {
        type: "payment_overdue_alert",
        user_id: payload.owner_id,
        title: "🚨 Impayé détecté",
        message: `${payload.tenant_name} n'a pas réglé son loyer de ${payload.montant_total}€ pour ${payload.property_address} (${payload.days_overdue} jours de retard).`,
        metadata: { 
          invoice_id: payload.invoice_id,
          days_overdue: payload.days_overdue 
        },
      });

      // Email au propriétaire
      await sendOverdueAlertEmail(supabase, payload);
      break;

    // Autres événements (à étendre selon besoins)
    default:
      console.log(`Événement non géré: ${event_type}`);
  }
}

/**
 * Gère les notifications de mise à jour législative
 * Envoie des emails aux propriétaires et locataires concernés
 */
async function handleLegislationUpdate(supabase: any, payload: any) {
  const { user_id, user_name, lease_id, is_owner, version, changes, description } = payload;

  // Récupérer les préférences de notification de l'utilisateur
  const { data: settings } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", user_id)
    .single();

  // Récupérer l'email de l'utilisateur
  const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
  const userEmail = authUser?.user?.email;

  if (!userEmail) {
    console.log(`Pas d'email trouvé pour l'utilisateur ${user_id}`);
    return;
  }

  // Préparer le contenu de l'email
  const emailSubject = is_owner
    ? `📋 Mise à jour législative ${version} - Action requise pour votre bail`
    : `📋 Mise à jour législative ${version} - Information concernant votre location`;

  const changesHtml = changes
    ?.map((c: any) => `<li><strong>${c.field}</strong>: ${c.description}</li>`)
    .join("") || "<li>Mise à jour des clauses légales</li>";

  const emailBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1e293b;">Bonjour ${user_name || ""},</h2>
      
      <p>Une mise à jour législative <strong>(${version})</strong> concerne ${
        is_owner ? "un de vos baux" : "votre bail de location"
      }.</p>
      
      <div style="background: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #92400e;">Changements apportés</h3>
        <p>${description || "Mise à jour conforme aux derniers décrets en vigueur."}</p>
        <ul style="color: #475569;">
          ${changesHtml}
        </ul>
      </div>

      ${is_owner ? `
        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;">
            <strong>⚠️ Action requise :</strong> Ces modifications seront appliquées automatiquement lors du prochain renouvellement de bail. 
            Vous pouvez consulter les détails dans votre espace propriétaire.
          </p>
        </div>
      ` : `
        <p style="color: #64748b;">
          Ces modifications seront appliquées lors du prochain renouvellement de votre bail. 
          Votre propriétaire a été informé de ces changements.
        </p>
      `}

      <p style="margin-top: 30px;">
        <a href="${Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://app.talok.fr"}/leases/${lease_id}" 
           style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">
          Voir les détails du bail
        </a>
      </p>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
      
      <p style="color: #94a3b8; font-size: 12px;">
        Vous recevez cet email car vous êtes ${is_owner ? "propriétaire" : "locataire"} d'un bien géré via notre plateforme.
        <br />
        Pour modifier vos préférences de notification, rendez-vous dans les paramètres de votre compte.
      </p>
    </div>
  `;

  // Si l'utilisateur accepte les emails, envoyer
  const shouldSendEmail = settings?.email_enabled !== false;

  if (shouldSendEmail && userEmail) {
    // Appeler le service d'envoi d'email
    const emailServiceUrl = Deno.env.get("EMAIL_SERVICE_URL");
    
    if (emailServiceUrl) {
      try {
        await fetch(emailServiceUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("EMAIL_SERVICE_API_KEY") || ""}`,
          },
          body: JSON.stringify({
            to: userEmail,
            subject: emailSubject,
            html: emailBody,
          }),
        });
        console.log(`Email de mise à jour législative envoyé à ${userEmail}`);
      } catch (error) {
        console.error(`Erreur envoi email à ${userEmail}:`, error);
      }
    } else {
      console.log(`Email service non configuré. Email à envoyer à ${userEmail}: ${emailSubject}`);
    }
  }

  // Log dans audit_log pour traçabilité
  await supabase.from("audit_log").insert({
    user_id,
    action: "legislation_notification_sent",
    entity_type: "lease",
    entity_id: lease_id,
    metadata: {
      version,
      is_owner,
      email_sent: shouldSendEmail && !!userEmail,
    },
  } as any);
}

async function generateInitialInvoice(supabase: any, leaseId: string) {
  // Récupérer les détails du bail
  const { data: lease, error } = await supabase
    .from("leases")
    .select(`
      *,
      property:properties!leases_property_id_fkey (owner_id, loyer_hc, charges_mensuelles),
      signers:lease_signers(profile_id, role)
    `)
    .eq("id", leaseId)
    .single();

  if (error || !lease) {
    console.error(`[generateInitialInvoice] Erreur récupération bail ${leaseId}:`, error);
    return;
  }

  // SSOT : Utiliser les données du bien par défaut
  const baseRent = lease.property?.loyer_hc ?? lease.loyer ?? 0;
  const baseCharges = lease.property?.charges_mensuelles ?? lease.charges_forfaitaires ?? 0;

  // Identifier le locataire principal
  const tenantId = lease.signers?.find((s: any) => 
    ['locataire_principal', 'tenant', 'principal'].includes(s.role)
  )?.profile_id;
  const ownerId = lease.property?.owner_id;

  if (!tenantId || !ownerId) {
    console.warn(`[generateInitialInvoice] Locataire ou Propriétaire non trouvé pour le bail ${leaseId}`);
    return;
  }

  // Vérifier si une facture initiale existe déjà
  const now = new Date();
  const monthStr = now.toISOString().slice(0, 7);
  
  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("lease_id", leaseId)
    .eq("periode", monthStr)
    .maybeSingle();

  if (existing) {
    console.log(`[generateInitialInvoice] Une facture existe déjà pour ${monthStr} sur le bail ${leaseId}`);
    return;
  }

  // --- CALCUL DU PRORATA SOTA 2026 ---
  const startDate = new Date(lease.date_debut);
  const isMidMonthStart = startDate.getDate() > 1;
  
  let finalRent = baseRent;
  let finalCharges = baseCharges;
  let isProrated = false;

  if (isMidMonthStart) {
    const year = startDate.getFullYear();
    const month = startDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const remainingDays = daysInMonth - startDate.getDate() + 1;
    
    finalRent = (baseRent / daysInMonth) * remainingDays;
    finalCharges = (baseCharges / daysInMonth) * remainingDays;
    isProrated = true;
    
    console.log(`[generateInitialInvoice] Calcul prorata: ${remainingDays}/${daysInMonth} jours. Loyer: ${finalRent}€`);
  }

  const deposit = lease.depot_de_garantie || 0;
  const totalAmount = finalRent + finalCharges + deposit;

  const { error: insertError } = await supabase
    .from("invoices")
    .insert({
      lease_id: leaseId,
      owner_id: ownerId,
      tenant_id: tenantId,
      periode: monthStr,
      montant_loyer: Math.round(finalRent * 100) / 100,
      montant_charges: Math.round(finalCharges * 100) / 100,
      montant_total: Math.round(totalAmount * 100) / 100,
      statut: "sent",
      metadata: {
        type: "initial_invoice",
        includes_deposit: true,
        deposit_amount: deposit,
        is_prorated: isProrated,
        prorata_days: isProrated ? (new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate() - startDate.getDate() + 1) : null,
        generated_automatically: true,
        version: "SOTA-2026"
      }
    } as any);

  if (insertError) {
    console.error(`[generateInitialInvoice] Erreur création facture pour bail ${leaseId}:`, insertError);
  } else {
    console.log(`[generateInitialInvoice] ✅ Facture initiale créée (Prorata: ${isProrated}) pour le bail ${leaseId}`);
  }
}

async function sendNotification(supabase: any, notification: any) {
  // Créer la notification dans la table
  await supabase.from("notifications").insert({
    user_id: notification.user_id,
    type: notification.type,
    title: notification.title,
    body: notification.message,
    metadata: notification.metadata,
    read: false,
  } as any);

  // Envoyer push notification si activée
  try {
    const { data: settings } = await supabase
      .from("notification_settings")
      .select("push_enabled, push_subscription")
      .eq("user_id", notification.user_id)
      .single();

    if (settings?.push_enabled && settings?.push_subscription) {
      // TODO: Envoyer via Web Push API
      console.log(`[Notification] Push notification à envoyer à ${notification.user_id}`);
    }
  } catch (error) {
    console.log(`[Notification] Pas de settings push pour ${notification.user_id}`);
  }
}

/**
 * ✅ SOTA 2026: Envoyer un email transactionnel lié aux signatures
 */
async function sendSignatureEmail(supabase: any, params: {
  user_id: string;
  subject: string;
  message: string;
  cta_label: string;
  cta_url: string;
}) {
  try {
    // Vérifier les préférences email
    const { data: settings } = await supabase
      .from("notification_settings")
      .select("email_enabled")
      .eq("user_id", params.user_id)
      .single();

    if (settings?.email_enabled === false) {
      console.log(`[Email] Emails désactivés pour ${params.user_id}`);
      return;
    }

    // Récupérer l'email de l'utilisateur
    const { data: authUser } = await supabase.auth.admin.getUserById(params.user_id);
    const userEmail = authUser?.user?.email;

    if (!userEmail) {
      console.log(`[Email] Pas d'email trouvé pour ${params.user_id}`);
      return;
    }

    // Récupérer le nom de l'utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", params.user_id)
      .single();

    const userName = profile?.prenom || "Bonjour";
    const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://app.talok.fr";

    const emailHtml = `
      <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 40px 30px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Talok</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">Gestion locative simplifiée</p>
        </div>
        
        <div style="padding: 40px 30px;">
          <h2 style="color: #1e293b; margin: 0 0 20px; font-size: 22px; font-weight: 600;">
            ${params.subject}
          </h2>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
            ${userName},
          </p>
          
          <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 32px;">
            ${params.message}
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${appUrl}${params.cta_url}" 
               style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                      color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; 
                      font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.3);">
              ${params.cta_label}
            </a>
          </div>
        </div>
        
        <div style="background: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
            Vous recevez cet email car vous avez un compte sur Talok.
            <br />
            <a href="${appUrl}/settings/notifications" style="color: #64748b;">Gérer mes préférences</a>
          </p>
        </div>
      </div>
    `;

    // Appeler le service email
    const emailServiceUrl = Deno.env.get("EMAIL_SERVICE_URL");
    
    if (emailServiceUrl) {
      await fetch(emailServiceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("EMAIL_SERVICE_API_KEY") || ""}`,
        },
        body: JSON.stringify({
          to: userEmail,
          subject: params.subject,
          html: emailHtml,
        }),
      });
      console.log(`[Email] ✅ Email envoyé à ${userEmail}: ${params.subject}`);
    } else {
      // En mode dev, log seulement
      console.log(`[Email] Service non configuré. Email à ${userEmail}: ${params.subject}`);
    }
  } catch (error) {
    console.error(`[Email] Erreur envoi:`, error);
  }
}

/**
 * ✅ SOTA 2026: Envoyer un email de relance de paiement
 */
async function sendPaymentReminderEmail(supabase: any, payload: any) {
  const { tenant_id, montant_total, periode, property_address, days_overdue, reminder_level } = payload;

  // Récupérer les infos utilisateur
  const { data: authUser } = await supabase.auth.admin.getUserById(tenant_id);
  const userEmail = authUser?.user?.email;
  if (!userEmail) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, nom")
    .eq("user_id", tenant_id)
    .single();

  const userName = profile?.prenom || "Bonjour";
  const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://app.talok.fr";

  // Style de l'email selon le niveau de relance
  const levelStyles: Record<string, { color: string; bgColor: string; emoji: string }> = {
    friendly: { color: "#3b82f6", bgColor: "#eff6ff", emoji: "📅" },
    reminder: { color: "#f59e0b", bgColor: "#fffbeb", emoji: "⏰" },
    urgent: { color: "#ef4444", bgColor: "#fef2f2", emoji: "⚠️" },
    final: { color: "#dc2626", bgColor: "#fee2e2", emoji: "🚨" },
  };

  const style = levelStyles[reminder_level] || levelStyles.reminder;

  const emailHtml = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Talok</h1>
      </div>
      
      <div style="padding: 40px 30px;">
        <div style="background: ${style.bgColor}; border-left: 4px solid ${style.color}; padding: 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
          <h2 style="color: ${style.color}; margin: 0 0 8px; font-size: 20px;">
            ${style.emoji} ${payload.reminder_subject || "Rappel de paiement"}
          </h2>
          <p style="color: #475569; margin: 0; font-size: 14px;">
            ${days_overdue} jours depuis l'émission de la facture
          </p>
        </div>
        
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          ${userName},
        </p>
        
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          Nous n'avons pas encore reçu votre paiement de loyer pour <strong>${property_address}</strong> (${periode}).
        </p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <p style="color: #64748b; margin: 0 0 8px; font-size: 14px;">Montant dû</p>
          <p style="color: #1e293b; margin: 0; font-size: 32px; font-weight: 700;">${montant_total}€</p>
        </div>
        
        ${reminder_level === "urgent" || reminder_level === "final" ? `
          <div style="background: #fee2e2; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
            <p style="color: #dc2626; margin: 0; font-size: 14px;">
              <strong>⚠️ Important :</strong> Un retard prolongé peut entraîner des frais supplémentaires et affecter votre relation avec votre propriétaire.
            </p>
          </div>
        ` : ""}
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${appUrl}/tenant/invoices" 
             style="display: inline-block; background: ${style.color}; color: #ffffff; text-decoration: none; 
                    padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
            Payer maintenant
          </a>
        </div>
        
        <p style="color: #94a3b8; font-size: 14px; text-align: center;">
          Si vous avez déjà effectué le paiement, ignorez ce message.
        </p>
      </div>
      
      <div style="background: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
          Besoin d'aide ? <a href="${appUrl}/help" style="color: #3b82f6;">Contactez le support</a>
        </p>
      </div>
    </div>
  `;

  const emailServiceUrl = Deno.env.get("EMAIL_SERVICE_URL");
  if (emailServiceUrl) {
    await fetch(emailServiceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("EMAIL_SERVICE_API_KEY") || ""}`,
      },
      body: JSON.stringify({
        to: userEmail,
        subject: `${style.emoji} ${payload.reminder_subject} - ${montant_total}€`,
        html: emailHtml,
      }),
    });
    console.log(`[Email] ✅ Relance ${reminder_level} envoyée à ${userEmail}`);
  }
}

/**
 * ✅ SOTA 2026: Envoyer une alerte impayé au propriétaire
 */
async function sendOverdueAlertEmail(supabase: any, payload: any) {
  const { owner_id, tenant_name, montant_total, periode, property_address, days_overdue } = payload;

  const { data: authUser } = await supabase.auth.admin.getUserById(owner_id);
  const userEmail = authUser?.user?.email;
  if (!userEmail) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, nom")
    .eq("user_id", owner_id)
    .single();

  const userName = profile?.prenom || "Bonjour";
  const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://app.talok.fr";

  const emailHtml = `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 40px 30px; text-align: center;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🚨 Alerte Impayé</h1>
      </div>
      
      <div style="padding: 40px 30px;">
        <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
          ${userName},
        </p>
        
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin-bottom: 24px; border-radius: 0 8px 8px 0;">
          <p style="color: #dc2626; margin: 0 0 8px; font-size: 16px; font-weight: 600;">
            Impayé détecté - ${days_overdue} jours de retard
          </p>
          <p style="color: #7f1d1d; margin: 0;">
            <strong>${tenant_name}</strong> n'a pas réglé son loyer pour <strong>${property_address}</strong> (${periode}).
          </p>
        </div>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px; display: flex; justify-content: space-between;">
          <div>
            <p style="color: #64748b; margin: 0 0 4px; font-size: 14px;">Montant impayé</p>
            <p style="color: #dc2626; margin: 0; font-size: 28px; font-weight: 700;">${montant_total}€</p>
          </div>
          <div style="text-align: right;">
            <p style="color: #64748b; margin: 0 0 4px; font-size: 14px;">Jours de retard</p>
            <p style="color: #ef4444; margin: 0; font-size: 28px; font-weight: 700;">${days_overdue}</p>
          </div>
        </div>
        
        <h3 style="color: #1e293b; margin: 24px 0 12px; font-size: 16px;">Actions recommandées :</h3>
        <ul style="color: #475569; margin: 0 0 24px; padding-left: 20px; line-height: 1.8;">
          <li>Contactez votre locataire pour comprendre la situation</li>
          <li>Vérifiez si un problème technique empêche le paiement</li>
          <li>Envisagez une relance amiable avant toute procédure</li>
        </ul>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${appUrl}/owner/money?filter=late" 
             style="display: inline-block; background: #dc2626; color: #ffffff; text-decoration: none; 
                    padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
            Voir les impayés
          </a>
        </div>
      </div>
      
      <div style="background: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
          Des relances automatiques sont envoyées à votre locataire.
        </p>
      </div>
    </div>
  `;

  const emailServiceUrl = Deno.env.get("EMAIL_SERVICE_URL");
  if (emailServiceUrl) {
    await fetch(emailServiceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("EMAIL_SERVICE_API_KEY") || ""}`,
      },
      body: JSON.stringify({
        to: userEmail,
        subject: `🚨 Impayé: ${tenant_name} - ${montant_total}€ (${days_overdue}j)`,
        html: emailHtml,
      }),
    });
    console.log(`[Email] ✅ Alerte impayé envoyée au propriétaire ${userEmail}`);
  }
}

async function calculateAndStoreAge(supabase: any, applicationId: string, birthdate: string) {
  // Récupérer le profile_id depuis l'application
  const { data: application } = await supabase
    .from("tenant_applications")
    .select("tenant_profile_id")
    .eq("id", applicationId)
    .single();

  if (!application) return;

  // Calculer l'âge
  const birth = new Date(birthdate);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate()) ? age - 1 : age;

  // Stocker dans user_ages
  await supabase.from("user_ages").upsert({
    profile_id: application.tenant_profile_id,
    birthdate: birthdate,
    age: actualAge,
    source: "ocr",
    confidence: 90, // À récupérer depuis l'OCR
    extracted_at: new Date().toISOString(),
  } as any, {
    onConflict: "profile_id",
  });
}

async function generateReceiptAutomatically(supabase: any, invoiceId: string, paymentId: string) {
  // Récupérer les données de la facture
  const { data: invoice } = await supabase
    .from("invoices")
    .select(`
      *,
      lease:leases!inner(id, property:properties(adresse_complete))
    `)
    .eq("id", invoiceId)
    .single();

  if (!invoice) return;

  // Appeler l'Edge Function generate-pdf
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const functionUrl = `${supabaseUrl}/functions/v1/generate-pdf`;

  const response = await fetch(functionUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      type: "receipt",
      data: {
        invoice_id: invoiceId,
        payment_id: paymentId,
        lease_id: invoice.lease_id,
        month: invoice.periode,
        montant_total: invoice.montant_total,
        montant_loyer: invoice.montant_loyer,
        montant_charges: invoice.montant_charges,
      },
    }),
  });

  if (response.ok) {
    const result = await response.json();
    // Créer le document dans la table documents
    await supabase.from("documents").insert({
      type: "quittance",
      lease_id: invoice.lease_id,
      storage_path: result.path,
      metadata: {
        invoice_id: invoiceId,
        payment_id: paymentId,
        month: invoice.periode,
      },
    } as any);
  }
}





