// Edge Function : Worker pour traiter les événements de l'outbox
// À déployer avec: supabase functions deploy process-outbox
// À appeler périodiquement via cron ou webhook

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  signatureEmail as signatureEmailTemplate,
  legislationUpdate as legislationTemplate,
  paymentReminder as paymentReminderTemplate,
  overdueAlert as overdueAlertTemplate,
  visitBookingRequest as visitBookingRequestTemplate,
  visitBookingConfirmed as visitBookingConfirmedTemplate,
  visitBookingCancelled as visitBookingCancelledTemplate,
  visitFeedbackRequest as visitFeedbackRequestTemplate,
  initialInvoiceEmail as initialInvoiceEmailTemplate,
  tenantServiceBooked as tenantServiceBookedTemplate,
  tenantServiceApprovalRequested as tenantServiceApprovalRequestedTemplate,
  tenantServiceRejected as tenantServiceRejectedTemplate,
  workOrderAssignedToProvider as workOrderAssignedToProviderTemplate,
  ticketPartiesCommunesToSyndic as ticketPartiesCommunesToSyndicTemplate,
  workOrderPaymentReceived as workOrderPaymentReceivedTemplate,
} from "../_shared/email-templates.ts";
import { normalizePhoneE164, maskPhone } from "../_shared/phone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendOutboxEmail(params: {
  to: string;
  subject: string;
  html: string;
  tags?: Array<{ name: string; value: string }>;
  reply_to?: string;
}): Promise<boolean> {
  const emailServiceUrl = Deno.env.get("EMAIL_SERVICE_URL");
  if (!emailServiceUrl) {
    console.log(`[Outbox] Email service non configuré. Email à ${params.to}: ${params.subject}`);
    return false;
  }

  try {
    const response = await fetch(emailServiceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("EMAIL_SERVICE_API_KEY") || ""}`,
      },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        html: params.html,
        reply_to: params.reply_to || Deno.env.get("EMAIL_REPLY_TO") || "support@talok.fr",
        tags: params.tags,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[Outbox] Email service error ${response.status}: ${errBody}`);
      return false;
    }

    console.log(`[Outbox] Email envoyé à ${params.to}: ${params.subject}`);
    return true;
  } catch (error) {
    console.error(`[Outbox] Erreur envoi email à ${params.to}:`, error);
    return false;
  }
}

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
              error_message: error instanceof Error ? error.message : "Erreur",
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
              error_message: error instanceof Error ? error.message : "Erreur",
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
    case "Invoice.InitialCreated": {
      let tenantUserId = payload.tenant_user_id || null;

      if (!tenantUserId && payload.tenant_profile_id) {
        const { data: tenantProfile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", payload.tenant_profile_id)
          .maybeSingle();

        tenantUserId = tenantProfile?.user_id || null;
      }

      if (tenantUserId) {
        await sendNotification(supabase, {
          type: "invoice_issued",
          user_id: tenantUserId,
          title: "Facture initiale disponible",
          message: payload.includes_deposit
            ? `Votre facture initiale de ${payload.amount}€ incluant le dépôt de garantie est disponible.`
            : `Votre facture initiale de ${payload.amount}€ est disponible.`,
          metadata: {
            invoice_id: payload.invoice_id,
            lease_id: payload.lease_id,
            deposit_amount: payload.deposit_amount || 0,
          },
        });

        await sendInitialInvoiceEmailToTenant(supabase, {
          tenant_user_id: tenantUserId,
          lease_id: payload.lease_id,
          invoice_id: payload.invoice_id,
          amount: payload.amount,
          deposit_amount: payload.deposit_amount || 0,
          includes_deposit: payload.includes_deposit || false,
        });
      }
      break;
    }

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
        message: payload.receipt_generated
          ? `Votre paiement de ${payload.amount}€ pour ${payload.property_address || "votre loyer"} (${payload.periode}) a été confirmé. Votre quittance est disponible.`
          : `Votre paiement de ${payload.amount}€ pour ${payload.property_address || "votre loyer"} (${payload.periode}) a été confirmé.`,
        metadata: { payment_id: payload.payment_id, invoice_id: payload.invoice_id },
      });
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
      if (payload.owner_id) {
        await sendNotification(supabase, {
          type: "ticket_opened",
          user_id: payload.owner_id,
          title: "Nouveau ticket",
          message: `Un nouveau ticket a été ouvert : ${payload.title || "Demande de maintenance"}`,
          metadata: { ticket_id: payload.ticket_id },
        });
      }
      break;

    case "Ticket.InProgress": {
      // Notifier le créateur du ticket (tenant)
      const inProgressCreator = await resolveTicketCreatorUserId(supabase, payload.ticket_id);
      if (inProgressCreator) {
        await sendNotification(supabase, {
          type: "ticket_in_progress",
          user_id: inProgressCreator,
          title: "Demande en cours de traitement",
          message: "Votre demande de maintenance est prise en charge.",
          metadata: { ticket_id: payload.ticket_id },
        });
      }
      break;
    }

    case "Ticket.Paused": {
      const pausedCreator = await resolveTicketCreatorUserId(supabase, payload.ticket_id);
      if (pausedCreator) {
        await sendNotification(supabase, {
          type: "ticket_paused",
          user_id: pausedCreator,
          title: "Demande en pause",
          message: payload.reason
            ? `Votre demande a été mise en pause : ${payload.reason}`
            : "Votre demande a été temporairement mise en pause.",
          metadata: { ticket_id: payload.ticket_id },
        });
      }
      break;
    }

    case "Ticket.Resolved": {
      const resolvedCreator = await resolveTicketCreatorUserId(supabase, payload.ticket_id);
      if (resolvedCreator) {
        await sendNotification(supabase, {
          type: "ticket_resolved",
          user_id: resolvedCreator,
          title: "Demande résolue",
          message: "Votre demande de maintenance a été résolue. Si le problème persiste, n'hésitez pas à rouvrir un ticket.",
          metadata: { ticket_id: payload.ticket_id },
        });
        // SMS pour les tickets résolus
        try { await sendSmsNotification(supabase, resolvedCreator, "Talok : Votre demande de maintenance a été résolue. Connectez-vous pour voir les détails."); } catch { /* non-blocking */ }
      }
      break;
    }

    case "Ticket.Closed": {
      const closedCreator = await resolveTicketCreatorUserId(supabase, payload.ticket_id);
      if (closedCreator) {
        await sendNotification(supabase, {
          type: "ticket_closed",
          user_id: closedCreator,
          title: "Demande clôturée",
          message: "Votre demande de maintenance a été clôturée.",
          metadata: { ticket_id: payload.ticket_id },
        });
      }
      break;
    }

    case "Ticket.Assigned": {
      const assigneeUserId = await resolveProfileUserId(supabase, payload.assigned_to);
      if (assigneeUserId) {
        await sendNotification(supabase, {
          type: "ticket_assigned",
          user_id: assigneeUserId,
          title: "Nouveau ticket assigné",
          message: "Un ticket de maintenance vous a été assigné.",
          metadata: { ticket_id: payload.ticket_id },
        });
      }
      const assignedCreator = await resolveTicketCreatorUserId(supabase, payload.ticket_id);
      if (assignedCreator && assignedCreator !== assigneeUserId) {
        await sendNotification(supabase, {
          type: "ticket_assigned",
          user_id: assignedCreator,
          title: "Prestataire assigné",
          message: "Un prestataire a été assigné à votre demande.",
          metadata: { ticket_id: payload.ticket_id },
        });
      }
      break;
    }

    case "Ticket.Reopened": {
      const reopenedCreator = await resolveTicketCreatorUserId(supabase, payload.ticket_id);
      if (reopenedCreator) {
        await sendNotification(supabase, {
          type: "ticket_reopened",
          user_id: reopenedCreator,
          title: "Demande rouverte",
          message: "Votre demande de maintenance a été rouverte.",
          metadata: { ticket_id: payload.ticket_id },
        });
      }
      const reopenedAssignee = await resolveTicketAssigneeUserId(supabase, payload.ticket_id);
      if (reopenedAssignee && reopenedAssignee !== reopenedCreator) {
        await sendNotification(supabase, {
          type: "ticket_reopened",
          user_id: reopenedAssignee,
          title: "Ticket rouvert",
          message: "Un ticket que vous suivez a été rouvert.",
          metadata: { ticket_id: payload.ticket_id },
        });
      }
      break;
    }

    case "WorkOrder.Created": {
      const providerUserId = await resolveProfileUserId(supabase, payload.provider_id);
      if (providerUserId) {
        await sendNotification(supabase, {
          type: "work_order_created",
          user_id: providerUserId,
          title: "Nouvelle intervention planifiée",
          message: "Une intervention vous a été confiée.",
          metadata: {
            ticket_id: payload.ticket_id,
            work_order_id: payload.work_order_id,
          },
        });
      }
      break;
    }

    case "ticket.message.created": {
      // Notifier le destinataire : si le sender est owner → notifier le tenant (créateur), et vice versa
      const msgTicket = await resolveTicketForMessage(supabase, payload.ticket_id, payload.sender_user);
      if (msgTicket?.notify_user_id) {
        await sendNotification(supabase, {
          type: "ticket_new_message",
          user_id: msgTicket.notify_user_id,
          title: "Nouvelle réponse sur votre demande",
          message: "Vous avez reçu une réponse sur votre demande de maintenance.",
          metadata: { ticket_id: payload.ticket_id, message_id: payload.message_id },
        });
      }
      break;
    }

    // Ticket sur les parties communes routé vers le syndic
    case "Ticket.OpenedPartiesCommunes": {
      const recipient = payload.recipient_user_id || payload.syndic_user_id;
      if (recipient) {
        const refSuffix = payload.ticket_reference ? ` (${payload.ticket_reference})` : "";
        await sendNotification(supabase, {
          type: "ticket_parties_communes",
          user_id: recipient,
          title: "Signalement parties communes",
          message: `Un locataire a signalé un incident sur les parties communes : ${payload.title || "sans titre"}${refSuffix}`,
          metadata: {
            ticket_id: payload.ticket_id,
            entity_id: payload.entity_id,
            category: payload.category,
          },
        });

        const recipientInfo = await resolveEmailRecipient(supabase, recipient);
        if (recipientInfo) {
          const html = ticketPartiesCommunesToSyndicTemplate({
            syndicName: recipientInfo.name,
            reference: payload.ticket_reference ?? null,
            title: payload.title || "Signalement",
            priority: payload.priority ?? null,
            ticketId: payload.ticket_id,
          });
          await sendOutboxEmail({
            to: recipientInfo.email,
            subject: `Signalement parties communes${refSuffix}`,
            html,
            tags: [{ name: "type", value: "ticket_parties_communes" }],
          });
        }
      }
      break;
    }

    // Réservation self-service locataire → prestataire, pas de validation owner requise
    case "TenantService.Booked": {
      const recipient = payload.recipient_user_id;
      if (recipient) {
        const refSuffix = payload.ticket_reference ? ` (${payload.ticket_reference})` : "";
        await sendNotification(supabase, {
          type: "tenant_service_booked",
          user_id: recipient,
          title: "Votre locataire a réservé un service",
          message: `${payload.provider_company || "Un prestataire"} a été sollicité pour : ${payload.title || "service"}${refSuffix}`,
          metadata: {
            ticket_id: payload.ticket_id,
            work_order_id: payload.work_order_id,
            category: payload.category,
          },
        });

        const recipientInfo = await resolveEmailRecipient(supabase, recipient);
        if (recipientInfo) {
          const html = tenantServiceBookedTemplate({
            ownerName: recipientInfo.name,
            tenantName: payload.tenant_name || "Votre locataire",
            reference: payload.ticket_reference ?? null,
            title: payload.title || "Service",
            category: payload.category ?? null,
            providerCompany: payload.provider_company ?? null,
            preferredDate: payload.preferred_date ?? null,
            ticketId: payload.ticket_id,
          });
          await sendOutboxEmail({
            to: recipientInfo.email,
            subject: `Votre locataire a réservé ${payload.provider_company || "un prestataire"}`,
            html,
            tags: [{ name: "type", value: "tenant_service_booked" }],
          });
        }
      }
      break;
    }

    // Réservation self-service en attente de validation propriétaire
    case "TenantService.ApprovalRequested": {
      const recipient = payload.recipient_user_id;
      if (recipient) {
        const refSuffix = payload.ticket_reference ? ` (${payload.ticket_reference})` : "";
        await sendNotification(supabase, {
          type: "tenant_service_approval_required",
          user_id: recipient,
          title: "Réservation à valider",
          message: `Votre locataire souhaite réserver ${payload.provider_company || "un prestataire"} pour : ${payload.title || "service"}${refSuffix}`,
          metadata: {
            ticket_id: payload.ticket_id,
            work_order_id: payload.work_order_id,
            category: payload.category,
            action: "approval_required",
            action_url: "/owner/approvals",
          },
        });

        const recipientInfo = await resolveEmailRecipient(supabase, recipient);
        if (recipientInfo) {
          const html = tenantServiceApprovalRequestedTemplate({
            ownerName: recipientInfo.name,
            tenantName: payload.tenant_name || "Votre locataire",
            reference: payload.ticket_reference ?? null,
            title: payload.title || "Service",
            category: payload.category ?? null,
            providerCompany: payload.provider_company ?? null,
            preferredDate: payload.preferred_date ?? null,
          });
          await sendOutboxEmail({
            to: recipientInfo.email,
            subject: `Action requise : validation d'une réservation${refSuffix}`,
            html,
            tags: [{ name: "type", value: "tenant_service_approval_required" }],
          });
        }
      }
      break;
    }

    // Propriétaire a refusé la réservation
    case "TenantService.Rejected": {
      const recipient = payload.recipient_user_id;
      if (recipient) {
        const refSuffix = payload.ticket_reference ? ` (${payload.ticket_reference})` : "";
        const reasonSuffix = payload.reason ? ` : « ${payload.reason} »` : ".";
        await sendNotification(supabase, {
          type: "tenant_service_rejected",
          user_id: recipient,
          title: "Réservation refusée",
          message: `Votre propriétaire a refusé la réservation${refSuffix}${reasonSuffix}`,
          metadata: {
            ticket_id: payload.ticket_id,
            work_order_id: payload.work_order_id,
            reason: payload.reason,
          },
        });

        const recipientInfo = await resolveEmailRecipient(supabase, recipient);
        if (recipientInfo) {
          const html = tenantServiceRejectedTemplate({
            tenantName: recipientInfo.name,
            reference: payload.ticket_reference ?? null,
            title: payload.title || "votre réservation",
            reason: payload.reason ?? null,
          });
          await sendOutboxEmail({
            to: recipientInfo.email,
            subject: `Votre réservation a été refusée${refSuffix}`,
            html,
            tags: [{ name: "type", value: "tenant_service_rejected" }],
          });
        }
      }
      break;
    }

    // Work order assigné à un prestataire (post self-service ou post validation owner)
    case "WorkOrder.AssignedToProvider": {
      const recipient = payload.recipient_user_id;
      if (recipient) {
        const refSuffix = payload.ticket_reference ? ` (${payload.ticket_reference})` : "";
        const dateSuffix = payload.preferred_date
          ? ` — souhaité le ${payload.preferred_date}`
          : "";
        await sendNotification(supabase, {
          type: "work_order_assigned",
          user_id: recipient,
          title: "Nouvelle mission",
          message: `${payload.title || "Mission"}${refSuffix}${dateSuffix}`,
          metadata: {
            ticket_id: payload.ticket_id,
            work_order_id: payload.work_order_id,
            action_url: `/provider/tickets`,
          },
        });
        // SMS non-bloquant pour signaler la mission
        try {
          await sendSmsNotification(
            supabase,
            recipient,
            `Talok : nouvelle mission assignée${refSuffix}. Connectez-vous pour répondre.`
          );
        } catch {
          /* non-blocking */
        }

        const recipientInfo = await resolveEmailRecipient(supabase, recipient);
        if (recipientInfo) {
          const html = workOrderAssignedToProviderTemplate({
            providerName: recipientInfo.name,
            reference: payload.ticket_reference ?? null,
            title: payload.title || "Mission",
            category: payload.category ?? null,
            preferredDate: payload.preferred_date ?? null,
            workOrderId: payload.work_order_id,
          });
          await sendOutboxEmail({
            to: recipientInfo.email,
            subject: `Nouvelle mission${refSuffix}`,
            html,
            tags: [{ name: "type", value: "work_order_assigned" }],
          });
        }
      }
      break;
    }

    // Paiement reçu côté prestataire (Stripe Connect a transféré les fonds)
    case "WorkOrder.PaymentReceived": {
      const recipient = payload.recipient_user_id;
      if (recipient) {
        const amountCents = Number(payload.amount_cents || 0);
        const amountEuros = (amountCents / 100).toFixed(2);
        const paymentType = payload.payment_type || "full";
        const label =
          paymentType === "deposit"
            ? "acompte"
            : paymentType === "balance"
              ? "solde"
              : "paiement";

        await sendNotification(supabase, {
          type: "work_order_payment_received",
          user_id: recipient,
          title: "Paiement reçu",
          message: `Le ${label} de ${amountEuros} € a été versé sur votre compte.`,
          metadata: {
            work_order_id: payload.work_order_id,
            payment_type: paymentType,
            amount_cents: amountCents,
          },
        });

        // SMS non-bloquant : le prestataire est souvent sur le terrain
        try {
          await sendSmsNotification(
            supabase,
            recipient,
            `Talok : ${amountEuros}€ versés sur votre compte. Détails dans votre espace.`
          );
        } catch {
          /* non-blocking */
        }

        const recipientInfo = await resolveEmailRecipient(supabase, recipient);
        if (recipientInfo) {
          const html = workOrderPaymentReceivedTemplate({
            providerName: recipientInfo.name,
            amountEuros,
            paymentType: paymentType as "deposit" | "balance" | "full",
            workOrderId: payload.work_order_id,
            ticketReference: payload.ticket_reference ?? null,
          });
          await sendOutboxEmail({
            to: recipientInfo.email,
            subject: `Paiement de ${amountEuros} € reçu`,
            html,
            tags: [{ name: "type", value: "work_order_payment_received" }],
          });
        }
      }
      break;
    }

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

      // SMS pour la signature complète
      try {
        await sendSmsNotification(
          supabase,
          payload.user_id,
          `Talok : Votre bail pour ${payload.property_address || "le logement"} est signé par toutes les parties. Bienvenue chez vous !`
        );
      } catch { /* non-blocking */ }
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

    case "Identity.CniExpiryReminder":
      if (payload.tenant_user_id) {
        const expiryDate = payload.cni_expiry_date ? new Date(payload.cni_expiry_date) : null;
        const isExpired = expiryDate && expiryDate < new Date();
        const title = isExpired
          ? "Pièce d'identité expirée"
          : "Rappel : pièce d'identité à renouveler";
        const message = isExpired
          ? "Votre pièce d'identité a expiré. Merci de la renouveler pour continuer à signer des documents (bail, EDL)."
          : "Votre pièce d'identité arrive à expiration. Pensez à la renouveler depuis votre espace locataire.";
        await sendNotification(supabase, {
          type: "cni_expiry_reminder",
          user_id: payload.tenant_user_id,
          title,
          message,
          metadata: {
            profile_id: payload.profile_id,
            cni_expiry_date: payload.cni_expiry_date,
            expired: isExpired,
          },
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
    case "Payment.ReminderFriendly":
    case "Payment.ReminderUrgent":
    case "Payment.Late":
    case "Payment.LateFormal":
    case "Payment.MiseEnDemeure":
    case "Payment.DernierAvertissement":
      await sendNotification(supabase, {
        type: "payment_reminder",
        user_id: payload.tenant_id,
        title: payload.reminder_subject || payload.title || "Rappel de paiement",
        message: `Votre loyer de ${payload.montant_total || payload.amount}€ pour ${payload.property_address} (${payload.periode || payload.month}) n'a pas encore été réglé (${payload.days_overdue || payload.days_late || 0} jours).`,
        metadata: { 
          invoice_id: payload.invoice_id, 
          level: payload.reminder_level || payload.reminder_type || event_type,
          days_overdue: payload.days_overdue || payload.days_late || 0,
        },
      });

      // Envoyer email de relance
      await sendPaymentReminderEmail(supabase, payload);
      break;

    // ✅ SOTA 2026: Alerte propriétaire pour impayé critique
    case "Payment.OverdueAlert":
    case "Owner.TenantPaymentLate":
      await sendNotification(supabase, {
        type: "payment_overdue_alert",
        user_id: payload.owner_id,
        title: "🚨 Impayé détecté",
        message: `${payload.tenant_name || "Le locataire"} n'a pas réglé son loyer de ${payload.montant_total || payload.amount}€ pour ${payload.property_address || "le logement"} (${payload.days_overdue || payload.days_late || 0} jours de retard).`,
        metadata: { 
          invoice_id: payload.invoice_id,
          days_overdue: payload.days_overdue || payload.days_late || 0,
        },
      });

      // Email au propriétaire
      await sendOverdueAlertEmail(supabase, payload);
      break;

    case "Invoice.Paid":
      if (payload.tenant_id) {
        await sendNotification(supabase, {
          type: "invoice_paid",
          user_id: payload.tenant_id,
          title: "Facture soldée",
          message: "Votre paiement a été enregistré et la facture est maintenant soldée.",
          metadata: {
            invoice_id: payload.invoice_id,
            payment_id: payload.payment_id,
            receipt_document_id: payload.receipt_document_id || null,
          },
        });
      }
      break;

    case "Invoice.Overdue": {
      // Notifier le locataire d'un impayé
      if (payload.tenant_user_id) {
        await sendNotification(supabase, {
          type: "invoice_overdue",
          user_id: payload.tenant_user_id,
          title: "Loyer en retard",
          message: `Votre loyer pour ${payload.property_address || "le logement"} est en retard. Régularisez rapidement pour éviter des frais.`,
          metadata: { invoice_id: payload.invoice_id },
        });
        // SMS pour les impayés (critique)
        try {
          await sendSmsNotification(
            supabase,
            payload.tenant_user_id,
            `Talok : Vous avez un loyer impayé pour ${payload.property_address || "votre logement"}. Connectez-vous pour régulariser.`
          );
        } catch { /* non-blocking */ }
      }
      break;
    }

    case "Invoice.Unpaid": {
      // Impayé critique — notifier le locataire
      if (payload.tenant_user_id) {
        await sendNotification(supabase, {
          type: "invoice_unpaid",
          user_id: payload.tenant_user_id,
          title: "Impayé critique",
          message: `Votre loyer pour ${payload.property_address || "le logement"} reste impayé. Contactez votre propriétaire ou régularisez dès que possible.`,
          metadata: { invoice_id: payload.invoice_id },
        });
      }
      break;
    }

    case "KeyHandover.Confirmed":
      if (payload.tenant_user_id) {
        await sendNotification(supabase, {
          type: "key_handover_confirmed",
          user_id: payload.tenant_user_id,
          title: "Clés remises",
          message: "La remise des clés a été confirmée. Votre attestation est disponible dans vos documents.",
          metadata: {
            lease_id: payload.lease_id,
            handover_id: payload.handover_id,
          },
        });
      }
      break;

    // ============================================
    // ✅ SOTA 2026: Notifications pour création de logement
    // ============================================
    
    case "Property.DraftCreated":
      await sendNotification(supabase, {
        type: "property_draft_created",
        user_id: payload.owner_user_id,
        title: "🏠 Brouillon créé !",
        message: `Votre nouveau bien "${payload.property_type}" a été créé. Continuez la configuration pour le publier.`,
        metadata: { property_id: payload.property_id, step: 1, total_steps: 6 },
      });
      break;

    case "Property.StepCompleted":
      await sendNotification(supabase, {
        type: "property_step_completed",
        user_id: payload.owner_user_id,
        title: `✅ ${payload.step_name} ajouté`,
        message: `Étape ${payload.step}/${payload.total_steps} terminée pour "${payload.property_address}". ${payload.next_step ? `Prochaine étape: ${payload.next_step}` : ""}`,
        metadata: { 
          property_id: payload.property_id, 
          step: payload.step, 
          step_name: payload.step_name,
          total_steps: payload.total_steps 
        },
      });
      break;

    case "Property.PhotosAdded":
      await sendNotification(supabase, {
        type: "property_photos_added",
        user_id: payload.owner_user_id,
        title: "📸 Photos ajoutées !",
        message: `${payload.photo_count} photo(s) ajoutée(s) à "${payload.property_address}". Votre bien est plus attractif !`,
        metadata: { property_id: payload.property_id, photo_count: payload.photo_count },
      });
      break;

    case "Property.ReadyForReview":
      await sendNotification(supabase, {
        type: "property_ready",
        user_id: payload.owner_user_id,
        title: "🎯 Bien prêt à publier !",
        message: `"${payload.property_address}" est complet. Publiez-le pour recevoir des candidatures !`,
        metadata: { property_id: payload.property_id, action: "publish" },
      });
      break;

    case "Property.Published":
      await sendNotification(supabase, {
        type: "property_published",
        user_id: payload.owner_user_id,
        title: "🎉 Bien publié !",
        message: `"${payload.property_address}" est maintenant visible. Les locataires peuvent envoyer leur candidature.`,
        metadata: { property_id: payload.property_id },
      });
      
      // Envoyer aussi un email
      await sendSignatureEmail(supabase, {
        user_id: payload.owner_user_id,
        subject: "🎉 Votre bien est en ligne !",
        message: `Félicitations ! Votre bien "${payload.property_address}" est maintenant publié et visible par les locataires potentiels.`,
        cta_label: "Voir mon bien",
        cta_url: `/owner/properties/${payload.property_id}`,
      });
      break;

    case "Property.InvitationSent":
      // Notifier le propriétaire que l'invitation a été envoyée
      await sendNotification(supabase, {
        type: "property_invitation_sent",
        user_id: payload.owner_user_id,
        title: "📧 Invitation envoyée",
        message: `Une invitation a été envoyée à ${payload.tenant_email} pour "${payload.property_address}".`,
        metadata: { property_id: payload.property_id, invitation_id: payload.invitation_id },
      });
      break;

    case "Property.TenantJoined":
      // Notifier le propriétaire qu'un locataire a rejoint
      await sendNotification(supabase, {
        type: "property_tenant_joined",
        user_id: payload.owner_user_id,
        title: "👋 Nouveau locataire !",
        message: `${payload.tenant_name} a rejoint "${payload.property_address}" avec le code d'invitation.`,
        metadata: { property_id: payload.property_id, tenant_profile_id: payload.tenant_profile_id },
      });
      break;

    // ============================================
    // ✅ SOTA 2026: Visit Scheduling Events
    // ============================================

    case "VisitScheduling.PatternCreated":
      // Notification au propriétaire que le pattern a été créé
      await sendNotification(supabase, {
        type: "visit_pattern_created",
        user_id: payload.owner_user_id,
        title: "📅 Disponibilités configurées",
        message: `Vos créneaux de visite pour "${payload.property_address}" ont été générés avec succès.`,
        metadata: { property_id: payload.property_id, pattern_id: payload.pattern_id },
      });
      break;

    case "VisitScheduling.BookingCreated":
      // Notification + Email au propriétaire pour nouvelle demande
      await sendNotification(supabase, {
        type: "visit_booking_request",
        user_id: payload.owner_user_id,
        title: "📋 Nouvelle demande de visite",
        message: `${payload.tenant_name} souhaite visiter "${payload.property_address}" le ${payload.visit_date} à ${payload.visit_time}.`,
        metadata: {
          booking_id: payload.booking_id,
          property_id: payload.property_id,
          action: "review_booking"
        },
      });

      // Envoyer email au propriétaire
      await sendVisitBookingEmail(supabase, {
        type: "request",
        owner_user_id: payload.owner_user_id,
        tenant_name: payload.tenant_name,
        property_address: payload.property_address,
        visit_date: payload.visit_date,
        visit_time: payload.visit_time,
        tenant_message: payload.tenant_message,
        booking_id: payload.booking_id,
      });
      break;

    case "VisitScheduling.BookingConfirmed":
      // Notification + Email au locataire pour confirmation
      await sendNotification(supabase, {
        type: "visit_booking_confirmed",
        user_id: payload.tenant_user_id,
        title: "✅ Visite confirmée !",
        message: `Votre visite pour "${payload.property_address}" est confirmée le ${payload.visit_date} à ${payload.visit_time}.`,
        metadata: {
          booking_id: payload.booking_id,
          property_id: payload.property_id
        },
      });

      // Envoyer email au locataire
      await sendVisitBookingEmail(supabase, {
        type: "confirmed",
        tenant_user_id: payload.tenant_user_id,
        owner_name: payload.owner_name,
        owner_phone: payload.owner_phone,
        property_address: payload.property_address,
        visit_date: payload.visit_date,
        visit_time: payload.visit_time,
        booking_id: payload.booking_id,
      });
      break;

    case "VisitScheduling.BookingCancelled":
      // Notification à la partie affectée
      const recipientId = payload.cancelled_by === "owner"
        ? payload.tenant_user_id
        : payload.owner_user_id;

      const cancelMessage = payload.cancelled_by === "owner"
        ? `Le propriétaire a annulé la visite pour "${payload.property_address}" prévue le ${payload.visit_date}.`
        : `${payload.tenant_name} a annulé sa visite pour "${payload.property_address}" prévue le ${payload.visit_date}.`;

      await sendNotification(supabase, {
        type: "visit_booking_cancelled",
        user_id: recipientId,
        title: "❌ Visite annulée",
        message: cancelMessage,
        metadata: {
          booking_id: payload.booking_id,
          cancellation_reason: payload.cancellation_reason
        },
      });

      // Envoyer email au locataire si c'est le proprio qui annule
      if (payload.cancelled_by === "owner") {
        await sendVisitBookingEmail(supabase, {
          type: "cancelled",
          tenant_user_id: payload.tenant_user_id,
          property_address: payload.property_address,
          visit_date: payload.visit_date,
          visit_time: payload.visit_time,
          cancellation_reason: payload.cancellation_reason,
          cancelled_by: payload.cancelled_by,
          booking_id: payload.booking_id,
        });
      }
      break;

    case "VisitScheduling.BookingCompleted":
      // Demande de feedback au locataire après visite
      await sendNotification(supabase, {
        type: "visit_feedback_request",
        user_id: payload.tenant_user_id,
        title: "⭐ Comment s'est passée la visite ?",
        message: `Partagez votre avis sur la visite de "${payload.property_address}".`,
        metadata: {
          booking_id: payload.booking_id,
          action: "give_feedback"
        },
      });

      // Envoyer email de demande de feedback
      await sendVisitFeedbackRequestEmail(supabase, payload);
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

  const emailSubject = is_owner
    ? `📋 Mise à jour législative ${version} - Action requise pour votre bail`
    : `📋 Mise à jour législative ${version} - Information concernant votre location`;

  const changesHtml = changes
    ?.map((c: any) => `<li><strong>${c.field}</strong>: ${c.description}</li>`)
    .join("") || "<li>Mise à jour des clauses légales</li>";

  const emailBody = legislationTemplate({
    userName: user_name || "",
    isOwner: is_owner,
    version,
    description: description || "Mise à jour conforme aux derniers décrets en vigueur.",
    changesHtml,
    leaseId: lease_id,
  });

  // Si l'utilisateur accepte les emails, envoyer
  const shouldSendEmail = settings?.email_enabled !== false;

  if (shouldSendEmail && userEmail) {
    const emailSent = await sendOutboxEmail({
      to: userEmail,
      subject: emailSubject,
      html: emailBody,
      tags: [{ name: "type", value: "legislation_update" }],
    });
    if (!emailSent) {
      console.error(`[Legislation] Échec envoi email à ${userEmail}`);
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

/**
 * Résout le user_id du créateur d'un ticket (pour les notifications tenant).
 */
async function resolveTicketCreatorUserId(supabase: any, ticketId: string): Promise<string | null> {
  try {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("created_by_profile_id")
      .eq("id", ticketId)
      .single();
    if (!ticket?.created_by_profile_id) return null;
    return await resolveProfileUserId(supabase, ticket.created_by_profile_id);
  } catch {
    return null;
  }
}

/**
 * Résout le user_id de l'assigné d'un ticket (prestataire).
 */
async function resolveTicketAssigneeUserId(supabase: any, ticketId: string): Promise<string | null> {
  try {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("assigned_to")
      .eq("id", ticketId)
      .single();
    if (!ticket?.assigned_to) return null;
    return await resolveProfileUserId(supabase, ticket.assigned_to);
  } catch {
    return null;
  }
}

/**
 * Convertit un profile.id en auth user_id pour cibler les notifications.
 */
async function resolveProfileUserId(supabase: any, profileId: string | null | undefined): Promise<string | null> {
  if (!profileId) return null;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", profileId)
      .single();
    return profile?.user_id || null;
  } catch {
    return null;
  }
}

/**
 * Résout qui notifier sur un nouveau message ticket.
 * Si le sender est le créateur → notifier le propriétaire du bien.
 * Si le sender est le propriétaire → notifier le créateur.
 */
async function resolveTicketForMessage(
  supabase: any,
  ticketId: string,
  senderUserId: string
): Promise<{ notify_user_id: string } | null> {
  try {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("created_by_profile_id, property_id")
      .eq("id", ticketId)
      .single();
    if (!ticket) return null;

    // Résoudre le user_id du créateur
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", ticket.created_by_profile_id)
      .single();

    const creatorUserId = creatorProfile?.user_id;

    // Si le sender est le créateur → notifier le owner
    if (creatorUserId === senderUserId && ticket.property_id) {
      const { data: property } = await supabase
        .from("properties")
        .select("owner_id")
        .eq("id", ticket.property_id)
        .single();
      if (property?.owner_id) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", property.owner_id)
          .single();
        if (ownerProfile?.user_id) return { notify_user_id: ownerProfile.user_id };
      }
    }

    // Si le sender est le owner → notifier le créateur
    if (creatorUserId && creatorUserId !== senderUserId) {
      return { notify_user_id: creatorUserId };
    }

    return null;
  } catch {
    return null;
  }
}

async function sendNotification(supabase: any, notification: any) {
  // ✅ FIX: Résoudre profile_id depuis user_id pour cohérence avec GET /api/notifications
  let profileId: string | null = null;
  if (notification.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", notification.user_id)
      .maybeSingle();
    profileId = profile?.id || null;
  }

  // Créer la notification dans la table (try/catch indépendant — ne pas bloquer le push/email)
  try {
    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: notification.user_id,
      profile_id: profileId,
      type: notification.type,
      title: notification.title,
      body: notification.message,
      metadata: notification.metadata,
      read: false,
      is_read: false,
    } as any);
    if (insertError) console.error(`[Notification] Insert failed for ${notification.user_id}:`, insertError.message);
  } catch (err) {
    console.error(`[Notification] Insert exception for ${notification.user_id}:`, err);
  }

  // Envoyer push notification si activée
  try {
    const { data: settings } = await supabase
      .from("notification_settings")
      .select("push_enabled, push_subscription")
      .eq("user_id", notification.user_id)
      .single();

    if (settings?.push_enabled && settings?.push_subscription) {
      // Web Push API via VAPID
      const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

      if (vapidPublicKey && vapidPrivateKey) {
        const subscription = typeof settings.push_subscription === "string"
          ? JSON.parse(settings.push_subscription)
          : settings.push_subscription;

        const pushPayload = JSON.stringify({
          title: notification.title,
          body: notification.message,
          icon: "/icons/icon-192x192.png",
          badge: "/icons/badge-72x72.png",
          data: {
            type: notification.type,
            url: notification.metadata?.url || "/",
          },
        });

        // Send push notification via Web Push protocol
        const pushUrl = subscription.endpoint;
        const pushResponse = await fetch(pushUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
          },
          body: pushPayload,
        });

        if (pushResponse.ok || pushResponse.status === 201) {
          console.log(`[Notification] Push envoyée à ${notification.user_id}`);
        } else if (pushResponse.status === 410) {
          // Subscription expired, clean up
          await supabase
            .from("notification_settings")
            .update({ push_enabled: false, push_subscription: null })
            .eq("user_id", notification.user_id);
          console.log(`[Notification] Subscription expirée pour ${notification.user_id}, nettoyée`);
        } else {
          console.error(`[Notification] Push échouée (${pushResponse.status}) pour ${notification.user_id}`);
        }
      } else {
        console.log(`[Notification] VAPID keys non configurées, push ignorée pour ${notification.user_id}`);
      }
    }
  } catch (error) {
    console.log(`[Notification] Pas de settings push pour ${notification.user_id}`);
  }
}

/**
 * ✅ SOTA 2026: Envoyer un email transactionnel lié aux signatures
 */
/**
 * Envoie un SMS via Twilio REST API (Deno-compatible).
 * Non-bloquant : échoue silencieusement si Twilio non configuré.
 */
async function sendSmsNotification(supabase: any, userId: string, message: string): Promise<void> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const fromNumber = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || Deno.env.get("TWILIO_PHONE_NUMBER");

  if (!accountSid || !authToken || !fromNumber) return;

  try {
    // Résoudre le profil + téléphone
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, telephone, phone_verified")
      .eq("user_id", userId)
      .single();

    if (!profile?.telephone || !profile?.phone_verified) return;

    // Vérifier les préférences SMS
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("sms_enabled")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (prefs && prefs.sms_enabled === false) return;

    // Normalisation E.164 avec support DROM (MQ/GP/GF/RE/YT/PM)
    const phone = normalizePhoneE164(profile.telephone);
    if (!phone) {
      console.error(`[Outbox] Numéro invalide pour user ${userId} : ${profile.telephone}`);
      return;
    }

    // Envoyer via Twilio REST API
    const formData = new URLSearchParams();
    formData.append("To", phone);
    formData.append("Body", message);
    if (fromNumber.startsWith("MG")) {
      formData.append("MessagingServiceSid", fromNumber);
    } else {
      formData.append("From", fromNumber);
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        },
        body: formData.toString(),
      }
    );

    if (response.ok) {
      console.log(`[Outbox] SMS envoyé à ${maskPhone(phone)}`);
    } else {
      const err = await response.text();
      console.error(`[Outbox] SMS échoué (${response.status}):`, err);
    }
  } catch (err) {
    console.error("[Outbox] SMS exception:", err);
  }
}

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

    const emailHtml = signatureEmailTemplate({
      userName,
      subject: params.subject,
      message: params.message,
      ctaLabel: params.cta_label,
      ctaUrl: params.cta_url,
    });

    const emailSent = await sendOutboxEmail({
      to: userEmail,
      subject: params.subject,
      html: emailHtml,
      tags: [{ name: "type", value: "signature_request" }],
    });
    if (!emailSent) {
      console.error(`[Email] Échec envoi signature email à ${userEmail}`);
    }
  } catch (error) {
    console.error(`[Email] Erreur envoi:`, error);
  }
}

/**
 * Résout l'email + prénom d'un user_id pour l'envoi d'email transactionnel.
 * Honore la préférence notification_settings.email_enabled.
 * Retourne null si l'email ne peut pas être envoyé.
 */
async function resolveEmailRecipient(
  supabase: any,
  userId: string
): Promise<{ email: string; name: string } | null> {
  try {
    const { data: settings } = await supabase
      .from("notification_settings")
      .select("email_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (settings?.email_enabled === false) return null;

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;
    if (!email) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", userId)
      .maybeSingle();

    const name =
      profile?.prenom || profile?.nom || email.split("@")[0];
    return { email, name };
  } catch (error) {
    console.error(`[Email] resolveEmailRecipient failed for ${userId}:`, error);
    return null;
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

  const emailHtml = paymentReminderTemplate({
    userName,
    montantTotal: String(montant_total),
    periode,
    propertyAddress: property_address,
    daysOverdue: days_overdue,
    reminderLevel: reminder_level,
    reminderSubject: payload.reminder_subject || "Rappel de paiement",
  });

  const levelEmojis: Record<string, string> = {
    friendly: "📅",
    reminder: "⏰",
    urgent: "⚠️",
    final: "🚨",
  };
  const emoji = levelEmojis[reminder_level] || "⏰";

  const emailSent = await sendOutboxEmail({
    to: userEmail,
    subject: `${emoji} ${payload.reminder_subject} - ${montant_total}€`,
    html: emailHtml,
    tags: [
      { name: "type", value: "payment_reminder" },
      { name: "level", value: reminder_level },
    ],
  });
  if (!emailSent) {
    console.error(`[PaymentReminder] Échec envoi relance à ${userEmail}`);
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

  const emailHtml = overdueAlertTemplate({
    userName,
    tenantName: tenant_name,
    montantTotal: String(montant_total),
    periode,
    propertyAddress: property_address,
    daysOverdue: days_overdue,
  });

  const emailSent = await sendOutboxEmail({
    to: userEmail,
    subject: `🚨 Impayé: ${tenant_name} - ${montant_total}€ (${days_overdue}j)`,
    html: emailHtml,
    tags: [
      { name: "type", value: "overdue_alert" },
      { name: "days_overdue", value: String(days_overdue) },
    ],
  });
  if (!emailSent) {
    console.error(`[OverdueAlert] Échec envoi alerte à ${userEmail}`);
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

// ============================================
// ✅ SOTA 2026: Visit Scheduling Email Helpers
// ============================================

/**
 * Envoie un email lié aux réservations de visite
 */
async function sendVisitBookingEmail(supabase: any, params: any) {
  const emailServiceUrl = Deno.env.get("EMAIL_SERVICE_URL");

  if (!emailServiceUrl) {
    console.log(`[Email] Service non configuré pour visit booking ${params.type}`);
    return;
  }

  let recipientEmail: string | null = null;
  let recipientName: string = "";
  let emailSubject: string = "";
  let emailHtml: string = "";

  if (params.type === "request") {
    const { data: authUser } = await supabase.auth.admin.getUserById(params.owner_user_id);
    recipientEmail = authUser?.user?.email;

    const { data: profile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", params.owner_user_id)
      .single();

    recipientName = profile?.prenom || "Bonjour";
    emailSubject = `📋 Nouvelle demande de visite - ${params.property_address}`;
    emailHtml = visitBookingRequestTemplate({
      recipientName,
      tenantName: params.tenant_name,
      propertyAddress: params.property_address,
      visitDate: params.visit_date,
      visitTime: params.visit_time,
      tenantMessage: params.tenant_message,
    });
  } else if (params.type === "confirmed") {
    const { data: authUser } = await supabase.auth.admin.getUserById(params.tenant_user_id);
    recipientEmail = authUser?.user?.email;

    const { data: profile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", params.tenant_user_id)
      .single();

    recipientName = profile?.prenom || "Bonjour";
    emailSubject = `✅ Visite confirmée - ${params.property_address}`;
    emailHtml = visitBookingConfirmedTemplate({
      recipientName,
      propertyAddress: params.property_address,
      visitDate: params.visit_date,
      visitTime: params.visit_time,
      ownerName: params.owner_name,
      ownerPhone: params.owner_phone,
      bookingId: params.booking_id,
    });
  } else if (params.type === "cancelled") {
    const { data: authUser } = await supabase.auth.admin.getUserById(params.tenant_user_id);
    recipientEmail = authUser?.user?.email;

    const { data: profile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", params.tenant_user_id)
      .single();

    recipientName = profile?.prenom || "Bonjour";
    emailSubject = `❌ Visite annulée - ${params.property_address}`;
    emailHtml = visitBookingCancelledTemplate({
      recipientName,
      propertyAddress: params.property_address,
      visitDate: params.visit_date,
      visitTime: params.visit_time,
      cancellationReason: params.cancellation_reason,
    });
  }

  if (!recipientEmail) {
    console.log(`[Email] Pas d'email trouvé pour visit booking ${params.type}`);
    return;
  }

  const emailSent = await sendOutboxEmail({
    to: recipientEmail,
    subject: emailSubject,
    html: emailHtml,
    tags: [
      { name: "type", value: `visit_booking_${params.type}` },
    ],
  });
  if (!emailSent) {
    console.error(`[VisitBooking] Échec envoi email ${params.type} à ${recipientEmail}`);
  }
}

/**
 * Envoie un email de demande de feedback après visite
 */
/**
 * Envoie un email au locataire pour la facture initiale (post-signature)
 */
async function sendInitialInvoiceEmailToTenant(supabase: any, params: {
  tenant_user_id: string;
  lease_id: string;
  invoice_id: string;
  amount: number;
  deposit_amount: number;
  includes_deposit: boolean;
}) {
  try {
    const { data: settings } = await supabase
      .from("notification_settings")
      .select("email_enabled")
      .eq("user_id", params.tenant_user_id)
      .single();

    if (settings?.email_enabled === false) {
      console.log(`[Email] Emails désactivés pour ${params.tenant_user_id}`);
      return;
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(params.tenant_user_id);
    const userEmail = authUser?.user?.email;
    if (!userEmail) {
      console.log(`[InitialInvoice] Pas d'email trouvé pour ${params.tenant_user_id}`);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("prenom, nom")
      .eq("user_id", params.tenant_user_id)
      .single();

    const tenantName = profile?.prenom || "Bonjour";

    const { data: invoice } = await supabase
      .from("invoices")
      .select("montant_loyer, montant_charges, montant_total, date_echeance, metadata")
      .eq("id", params.invoice_id)
      .single();

    const { data: lease } = await supabase
      .from("leases")
      .select("property:properties!leases_property_id_fkey(adresse_complete, ville)")
      .eq("id", params.lease_id)
      .single();

    const propertyAddress = lease?.property?.adresse_complete || lease?.property?.ville || "le logement";
    const rentAmount = invoice?.montant_loyer ?? 0;
    const chargesAmount = invoice?.montant_charges ?? 0;
    const totalAmount = invoice?.montant_total ?? params.amount;
    const dueDate = invoice?.date_echeance
      ? new Date(invoice.date_echeance).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "Dès que possible";

    const emailHtml = initialInvoiceEmailTemplate({
      tenantName,
      amount: String(totalAmount),
      rentAmount: String(rentAmount),
      chargesAmount: String(chargesAmount),
      depositAmount: String(params.deposit_amount),
      includesDeposit: params.includes_deposit,
      propertyAddress,
      dueDate,
      leaseId: params.lease_id,
    });

    const emailSent = await sendOutboxEmail({
      to: userEmail,
      subject: `🧾 Facture initiale - ${totalAmount}€ pour ${propertyAddress}`,
      html: emailHtml,
      tags: [
        { name: "type", value: "initial_invoice" },
        { name: "lease_id", value: params.lease_id },
      ],
    });

    if (!emailSent) {
      console.error(`[InitialInvoice] Échec envoi email à ${userEmail}`);
    } else {
      console.log(`[InitialInvoice] Email envoyé à ${userEmail} pour ${totalAmount}€`);
    }
  } catch (error) {
    console.error(`[InitialInvoice] Erreur envoi email:`, error);
  }
}

async function sendVisitFeedbackRequestEmail(supabase: any, payload: any) {
  const emailServiceUrl = Deno.env.get("EMAIL_SERVICE_URL");

  if (!emailServiceUrl) return;

  const { data: authUser } = await supabase.auth.admin.getUserById(payload.tenant_user_id);
  const recipientEmail = authUser?.user?.email;

  if (!recipientEmail) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("prenom, nom")
    .eq("user_id", payload.tenant_user_id)
    .single();

  const recipientName = profile?.prenom || "Bonjour";

  const emailHtml = visitFeedbackRequestTemplate({
    recipientName,
    propertyAddress: payload.property_address,
    visitDate: payload.visit_date,
    bookingId: payload.booking_id,
  });

  const emailSent = await sendOutboxEmail({
    to: recipientEmail,
    subject: `⭐ Comment s'est passée votre visite ? - ${payload.property_address}`,
    html: emailHtml,
    tags: [{ name: "type", value: "visit_feedback_request" }],
  });
  if (!emailSent) {
    console.error(`[VisitFeedback] Échec envoi email feedback à ${recipientEmail}`);
  }
}

