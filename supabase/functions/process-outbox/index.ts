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
        title: "Paiement confirmé",
        message: `Votre paiement de ${payload.amount}€ a été confirmé`,
        metadata: { payment_id: payload.payment_id },
      });

      // 🔧 Action supplémentaire: Générer la quittance automatiquement
      if (payload.invoice_id) {
        await generateReceiptAutomatically(supabase, payload.invoice_id, payload.payment_id);
      }
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
      // ... (déjà mis à jour au tour précédent)
      break;

    case "EDL.InvitationSent":
      // ...
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

  // Envoyer email selon les préférences utilisateur
  try {
    // Vérifier les préférences de notification
    const { data: settings } = await supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", notification.user_id)
      .maybeSingle();

    // Si l'utilisateur a désactivé les emails, ne pas envoyer
    if (settings?.email_enabled === false) {
      console.log(`[sendNotification] Emails désactivés pour l'utilisateur ${notification.user_id}`);
      return;
    }

    // Récupérer l'email de l'utilisateur
    const { data: authUser } = await supabase.auth.admin.getUserById(notification.user_id);
    const userEmail = authUser?.user?.email;

    if (!userEmail) {
      console.log(`[sendNotification] Pas d'email trouvé pour l'utilisateur ${notification.user_id}`);
      return;
    }

    // Récupérer le nom de l'utilisateur
    const { data: profile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", notification.user_id)
      .single();

    const userName = profile
      ? `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Utilisateur"
      : "Utilisateur";

    // Envoyer l'email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("[sendNotification] RESEND_API_KEY non configurée");
      return;
    }

    const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://app.talok.fr";

    // Générer le contenu de l'email selon le type de notification
    const emailHtml = generateEmailContent(notification, userName, appUrl);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") || "Talok <noreply@talok.fr>",
        to: [userEmail],
        subject: notification.title,
        html: emailHtml,
        tags: [
          { name: "type", value: notification.type },
        ],
      }),
    });

    if (response.ok) {
      console.log(`[sendNotification] Email envoyé à ${userEmail} pour notification ${notification.type}`);
    } else {
      const error = await response.json();
      console.error(`[sendNotification] Erreur Resend:`, error);
    }
  } catch (emailError) {
    // Ne pas bloquer si l'email échoue
    console.error(`[sendNotification] Erreur envoi email:`, emailError);
  }
}

/**
 * Génère le contenu HTML de l'email selon le type de notification
 */
function generateEmailContent(notification: any, userName: string, appUrl: string): string {
  const baseStyle = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
  `;

  const buttonStyle = `
    background: #3b82f6;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    text-decoration: none;
    display: inline-block;
    margin-top: 20px;
  `;

  // Déterminer le lien et le texte du bouton selon le type
  let actionUrl = appUrl;
  let actionText = "Voir sur Talok";

  switch (notification.type) {
    case "invoice_issued":
      actionUrl = `${appUrl}/tenant/payments?invoice=${notification.metadata?.invoice_id}`;
      actionText = "Voir la facture";
      break;
    case "payment_succeeded":
      actionUrl = `${appUrl}/tenant/payments`;
      actionText = "Voir mes paiements";
      break;
    case "ticket_opened":
      actionUrl = `${appUrl}/tickets/${notification.metadata?.ticket_id}`;
      actionText = "Voir le ticket";
      break;
    default:
      actionUrl = `${appUrl}/notifications`;
      actionText = "Voir mes notifications";
  }

  return `
    <div style="${baseStyle}">
      <h2 style="color: #1e293b;">Bonjour ${userName},</h2>

      <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #3b82f6; margin-top: 0;">${notification.title}</h3>
        <p style="color: #475569; margin-bottom: 0;">${notification.message}</p>
      </div>

      <a href="${actionUrl}" style="${buttonStyle}">
        ${actionText}
      </a>

      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />

      <p style="color: #94a3b8; font-size: 12px;">
        Vous recevez cet email car vous avez un compte Talok.
        <br />
        Pour modifier vos préférences de notification, rendez-vous dans les paramètres de votre compte.
      </p>
    </div>
  `;
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





