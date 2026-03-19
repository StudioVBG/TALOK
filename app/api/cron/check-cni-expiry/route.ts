export const runtime = 'nodejs';

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/services/email-service";

/**
 * CRON: GET /api/cron/check-cni-expiry
 * 
 * Vérifie quotidiennement les CNI expirant dans 30, 15, 7 jours ou expirées.
 * Envoie des notifications au locataire et au propriétaire.
 * 
 */
export async function GET(request: Request) {
  try {
    // Vérifier le token CRON (sécurité)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // En dev, on autorise sans token
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
    }

    const serviceClient = getServiceClient();
    
    // Appeler la fonction SQL qui trouve les CNI expirant
    const { data: expiringCNIsRaw, error: queryError } = await serviceClient
      .rpc("check_expiring_cni");
    const expiringCNIs = expiringCNIsRaw as any[] | null;

    if (queryError) {
      console.error("[CRON CNI] Erreur requête:", queryError);
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!expiringCNIs || expiringCNIs.length === 0) {
      console.log("[CRON CNI] Aucune CNI expirant bientôt");
      return NextResponse.json({ 
        success: true, 
        message: "Aucune CNI expirant", 
        processed: 0 
      });
    }

    console.log(`[CRON CNI] ${expiringCNIs.length} CNI(s) à notifier`);

    const results = {
      processed: 0,
      tenantNotifications: 0,
      ownerNotifications: 0,
      errors: [] as string[],
    };

    for (const cni of expiringCNIs) {
      try {
        // Récupérer les infos du propriétaire
        const { data: ownerProfile } = await serviceClient
          .from("profiles")
          .select("id, prenom, nom, user_id")
          .eq("id", cni.owner_profile_id)
          .single();

        // Récupérer l'email du propriétaire via auth.users
        let ownerEmail = null;
        if (ownerProfile?.user_id) {
          const { data: ownerUser } = await serviceClient.auth.admin.getUserById(
            ownerProfile.user_id
          );
          ownerEmail = ownerUser?.user?.email;
        }

        // Récupérer les infos du locataire (via lease_signers)
        const { data: tenantSigner } = await serviceClient
          .from("lease_signers")
          .select(`
            profile_id,
            profiles (
              id,
              prenom,
              nom,
              user_id
            )
          `)
          .eq("lease_id", cni.lease_id)
          .eq("role", "locataire_principal")
          .single();

        const tenantProfile = tenantSigner?.profiles;
        let tenantEmailAddress = cni.tenant_email;

        // Si le locataire a un compte, récupérer son email
        if (tenantProfile?.user_id) {
          const { data: tenantUser } = await serviceClient.auth.admin.getUserById(
            tenantProfile.user_id
          );
          if (tenantUser?.user?.email) {
            tenantEmailAddress = tenantUser.user.email;
          }
        }

        // Créer l'enregistrement de notification
        const { error: insertError } = await serviceClient
          .from("cni_expiry_notifications")
          .insert({
            document_id: cni.document_id,
            lease_id: cni.lease_id,
            tenant_profile_id: tenantProfile?.id || null,
            owner_profile_id: cni.owner_profile_id,
            notification_type: cni.notification_type,
          });

        if (insertError) {
          // Si doublon, c'est OK (déjà notifié)
          if (insertError.code === "23505") {
            continue;
          }
          throw insertError;
        }

        // Préparer le message selon le type
        const messages = getNotificationMessages(cni.notification_type, cni.days_until_expiry);

        // Envoyer notification au locataire
        if (tenantEmailAddress) {
          try {
            await sendCniExpiryEmail({
              to: tenantEmailAddress,
              recipientName: tenantProfile 
                ? `${tenantProfile.prenom} ${tenantProfile.nom}` 
                : "Locataire",
              subject: messages.tenantSubject,
              message: messages.tenantMessage,
              daysUntilExpiry: cni.days_until_expiry,
              notificationType: cni.notification_type,
            });

            // Marquer comme envoyé
            await serviceClient
              .from("cni_expiry_notifications")
              .update({ 
                tenant_notified_at: new Date().toISOString(),
                tenant_email_sent: true,
              })
              .eq("document_id", cni.document_id)
              .eq("notification_type", cni.notification_type);

            results.tenantNotifications++;
          } catch (emailErr) {
            console.error("[CRON CNI] Erreur email locataire:", emailErr);
          }
        }

        // Créer notification in-app pour le locataire
        if (tenantProfile?.id) {
          await createInAppNotification(serviceClient, {
            profile_id: tenantProfile.id,
            type: "cni_expiry",
            title: messages.tenantSubject,
            message: messages.tenantMessage,
            data: {
              document_id: cni.document_id,
              lease_id: cni.lease_id,
              days_until_expiry: cni.days_until_expiry,
              notification_type: cni.notification_type,
            },
          });
        }

        // Envoyer notification au propriétaire
        if (ownerEmail) {
          try {
            await sendCniExpiryEmail({
              to: ownerEmail,
              recipientName: ownerProfile 
                ? `${ownerProfile.prenom} ${ownerProfile.nom}` 
                : "Propriétaire",
              subject: messages.ownerSubject,
              message: messages.ownerMessage,
              daysUntilExpiry: cni.days_until_expiry,
              notificationType: cni.notification_type,
              tenantName: tenantProfile 
                ? `${tenantProfile.prenom} ${tenantProfile.nom}` 
                : tenantEmailAddress,
            });

            // Marquer comme envoyé
            await serviceClient
              .from("cni_expiry_notifications")
              .update({ 
                owner_notified_at: new Date().toISOString(),
                owner_email_sent: true,
              })
              .eq("document_id", cni.document_id)
              .eq("notification_type", cni.notification_type);

            results.ownerNotifications++;
          } catch (emailErr) {
            console.error("[CRON CNI] Erreur email propriétaire:", emailErr);
          }
        }

        // Créer notification in-app pour le propriétaire
        if (cni.owner_profile_id) {
          await createInAppNotification(serviceClient, {
            profile_id: cni.owner_profile_id,
            type: "cni_expiry_owner",
            title: messages.ownerSubject,
            message: messages.ownerMessage,
            data: {
              document_id: cni.document_id,
              lease_id: cni.lease_id,
              days_until_expiry: cni.days_until_expiry,
              notification_type: cni.notification_type,
              tenant_name: tenantProfile 
                ? `${tenantProfile.prenom} ${tenantProfile.nom}` 
                : tenantEmailAddress,
            },
          });
        }

        // Mettre à jour le document si demande de renouvellement
        if (cni.notification_type === "j30") {
          await serviceClient
            .from("documents")
            .update({ renewal_requested_at: new Date().toISOString() })
            .eq("id", cni.document_id);
        }

        // Marquer comme expiré si nécessaire
        if (cni.notification_type === "expired") {
          await serviceClient
            .from("documents")
            .update({ verification_status: "expired" })
            .eq("id", cni.document_id);

          // Révoquer la certification du profil locataire
          if (tenantProfile?.id) {
            await serviceClient
              .from("tenant_profiles")
              .update({ cni_verified_at: null })
              .eq("profile_id", tenantProfile.id);
          }
        }

        results.processed++;

      } catch (err: any) {
        console.error("[CRON CNI] Erreur traitement:", err);
        results.errors.push(`CNI ${cni.document_id}: ${err.message}`);
      }
    }

    console.log("[CRON CNI] Terminé:", results);

    return NextResponse.json({
      success: true,
      ...results,
    });

  } catch (error: unknown) {
    console.error("[CRON CNI] Erreur globale:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Messages de notification selon le type
 */
function getNotificationMessages(type: string, daysLeft: number) {
  switch (type) {
    case "j30":
      return {
        tenantSubject: "⚠️ Votre CNI expire dans 30 jours",
        tenantMessage: `Votre carte d'identité expire dans ${daysLeft} jours. Veuillez la renouveler et mettre à jour votre dossier locatif.`,
        ownerSubject: "📋 CNI locataire - Expiration dans 30 jours",
        ownerMessage: `La carte d'identité de votre locataire expire dans ${daysLeft} jours. Une demande de renouvellement lui a été envoyée.`,
      };
    case "j15":
      return {
        tenantSubject: "⚠️ Urgent : Votre CNI expire dans 15 jours",
        tenantMessage: `Votre carte d'identité expire dans ${daysLeft} jours. Merci de procéder au renouvellement rapidement.`,
        ownerSubject: "📋 CNI locataire - Expiration dans 15 jours",
        ownerMessage: `Rappel : La carte d'identité de votre locataire expire dans ${daysLeft} jours.`,
      };
    case "j7":
      return {
        tenantSubject: "🚨 Dernière alerte : CNI expire dans 7 jours",
        tenantMessage: `Votre carte d'identité expire dans ${daysLeft} jours. Action urgente requise.`,
        ownerSubject: "🚨 CNI locataire - Expiration imminente",
        ownerMessage: `Alerte : La carte d'identité de votre locataire expire dans ${daysLeft} jours.`,
      };
    case "expired":
      return {
        tenantSubject: "❌ Votre CNI a expiré",
        tenantMessage: "Votre carte d'identité a expiré. Veuillez la renouveler immédiatement pour maintenir votre dossier à jour.",
        ownerSubject: "❌ CNI locataire expirée",
        ownerMessage: "La carte d'identité de votre locataire a expiré. Un renouvellement est nécessaire.",
      };
    default:
      return {
        tenantSubject: "Mise à jour CNI requise",
        tenantMessage: "Veuillez mettre à jour votre carte d'identité.",
        ownerSubject: "Mise à jour CNI locataire",
        ownerMessage: "La carte d'identité de votre locataire nécessite une mise à jour.",
      };
  }
}

/**
 * Envoyer un email de notification CNI
 */
async function sendCniExpiryEmail(params: {
  to: string;
  recipientName: string;
  subject: string;
  message: string;
  daysUntilExpiry: number;
  notificationType: string;
  tenantName?: string;
}) {
  const { emailTemplates } = await import("@/lib/emails/templates");
  const template = emailTemplates.cniExpiryNotification({
    recipientName: params.recipientName,
    message: params.message,
    subject: params.subject,
    daysUntilExpiry: params.daysUntilExpiry,
    urgencyLevel: params.notificationType,
    tenantName: params.tenantName,
  });

  const result = await sendEmail({
    to: params.to,
    subject: template.subject,
    html: template.html,
    tags: [{ name: "type", value: `cni_expiry_${params.notificationType}` }],
  });

  if (!result.success) {
    console.error(`[CNI Expiry] Échec envoi email à ${params.to}:`, result.error);
  }
}

/**
 * Créer une notification in-app
 */
async function createInAppNotification(
  supabase: any,
  params: {
    profile_id: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
  }
) {
  try {
    await supabase.from("notifications").insert({
      profile_id: params.profile_id,
      type: params.type,
      title: params.title,
      message: params.message,
      data: params.data || {},
      read: false,
    });
  } catch (err) {
    console.warn("[CRON CNI] Erreur création notification in-app:", err);
  }
}

