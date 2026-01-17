/**
 * API Route - Cron job pour envoyer les rappels d'onboarding
 *
 * Cette route est appelée périodiquement (via Vercel Cron ou un service externe)
 * pour envoyer les emails de rappel aux utilisateurs qui n'ont pas terminé leur onboarding.
 *
 * Configuration recommandée : exécuter toutes les heures
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { emailTemplates } from "@/lib/emails/templates";
import { Resend } from "resend";

// Créer un client Supabase avec la clé service (pour contourner RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Client Resend pour l'envoi d'emails
const resend = new Resend(process.env.RESEND_API_KEY);

// Vérifier l'autorisation (clé secrète pour le cron)
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn("CRON_SECRET non configuré");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Vérification de l'autorisation
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // 1. Récupérer les rappels à envoyer
    const { data: reminders, error: fetchError } = await supabase
      .from("onboarding_reminders")
      .select(`
        id,
        user_id,
        profile_id,
        role,
        reminder_type,
        email_sent_to,
        profiles:profile_id (
          id,
          prenom,
          nom,
          email
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .limit(100); // Traiter par lots de 100

    if (fetchError) {
      console.error("Erreur récupération rappels:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch reminders", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({
        message: "No reminders to process",
        results,
        duration: Date.now() - startTime,
      });
    }

    // 2. Vérifier que l'utilisateur n'a pas complété l'onboarding entre-temps
    for (const reminder of reminders) {
      results.processed++;

      try {
        const profile = reminder.profiles as any;
        if (!profile) {
          results.skipped++;
          await markReminderFailed(reminder.id, "Profile not found");
          continue;
        }

        // Vérifier si l'onboarding est complété
        const { data: profileData } = await supabase
          .from("profiles")
          .select("onboarding_completed_at")
          .eq("id", reminder.profile_id)
          .single();

        if (profileData?.onboarding_completed_at) {
          // Onboarding complété, annuler les rappels
          results.skipped++;
          await markReminderCancelled(reminder.id, "Onboarding completed");
          continue;
        }

        // 3. Calculer la progression actuelle
        const { data: progressData } = await supabase
          .from("onboarding_progress")
          .select("*")
          .eq("user_id", reminder.user_id)
          .eq("role", reminder.role);

        const completedSteps = progressData?.filter((p: any) => p.completed).length || 0;
        const totalSteps = getTotalSteps(reminder.role);
        const progressPercent = Math.round((completedSteps / totalSteps) * 100);

        // 4. Préparer et envoyer l'email
        const userName = profile.prenom || "Utilisateur";
        const email = reminder.email_sent_to || profile.email;
        const onboardingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/${reminder.role}/onboarding`;

        let emailData;
        switch (reminder.reminder_type) {
          case "24h":
            const nextStep = getNextStepLabel(reminder.role, progressData);
            emailData = emailTemplates.onboardingReminder24h({
              userName,
              role: reminder.role as any,
              progressPercent,
              nextStepLabel: nextStep,
              onboardingUrl,
            });
            break;

          case "72h":
            emailData = emailTemplates.onboardingReminder72h({
              userName,
              role: reminder.role as any,
              progressPercent,
              onboardingUrl,
            });
            break;

          case "7d":
            emailData = emailTemplates.onboardingReminder7d({
              userName,
              role: reminder.role as any,
              onboardingUrl,
            });
            break;

          default:
            results.skipped++;
            await markReminderFailed(reminder.id, `Unknown reminder type: ${reminder.reminder_type}`);
            continue;
        }

        // Envoyer l'email
        const { error: sendError } = await resend.emails.send({
          from: process.env.EMAIL_FROM || "Talok <noreply@talok.fr>",
          to: email,
          subject: emailData.subject,
          html: emailData.html,
        });

        if (sendError) {
          results.failed++;
          results.errors.push(`Failed to send to ${email}: ${sendError.message}`);
          await markReminderFailed(reminder.id, sendError.message);
        } else {
          results.sent++;
          await markReminderSent(reminder.id);
        }
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Error processing reminder ${reminder.id}: ${err.message}`);
        await markReminderFailed(reminder.id, err.message);
      }
    }

    return NextResponse.json({
      message: "Reminders processed",
      results,
      duration: Date.now() - startTime,
    });
  } catch (error: unknown) {
    console.error("Erreur cron onboarding-reminders:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// Helpers

function getTotalSteps(role: string): number {
  const stepsCount: Record<string, number> = {
    owner: 7,
    tenant: 5,
    provider: 4,
    guarantor: 3,
  };
  return stepsCount[role] || 5;
}

function getNextStepLabel(role: string, progressData: any[]): string {
  const stepLabels: Record<string, Record<string, string>> = {
    owner: {
      role_choice: "Choix du rôle",
      account_creation: "Création du compte",
      email_verification: "Vérification email",
      owner_profile: "Profil",
      owner_finance: "Informations bancaires",
      first_property: "Premier bien",
      final_review: "Validation",
    },
    tenant: {
      role_choice: "Choix du rôle",
      account_creation: "Création du compte",
      email_verification: "Vérification email",
      tenant_context: "Contexte",
      tenant_file: "Dossier",
      tenant_identity: "Identité",
      tenant_payment: "Paiement",
    },
    provider: {
      role_choice: "Choix du rôle",
      account_creation: "Création du compte",
      provider_profile: "Profil",
      provider_services: "Services",
      provider_ops: "Zone",
    },
    guarantor: {
      role_choice: "Choix du rôle",
      account_creation: "Création du compte",
      guarantor_context: "Informations",
      guarantor_financial: "Finances",
      guarantor_sign: "Signature",
    },
  };

  const labels = stepLabels[role] || {};
  const completedSteps = new Set(
    progressData?.filter((p: any) => p.completed).map((p: any) => p.step) || []
  );

  for (const [step, label] of Object.entries(labels)) {
    if (!completedSteps.has(step)) {
      return label;
    }
  }

  return "Finalisation";
}

async function markReminderSent(reminderId: string) {
  await supabase
    .from("onboarding_reminders")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", reminderId);
}

async function markReminderFailed(reminderId: string, errorMessage: string) {
  await supabase
    .from("onboarding_reminders")
    .update({
      status: "failed",
      error_message: errorMessage,
    })
    .eq("id", reminderId);
}

async function markReminderCancelled(reminderId: string, reason: string) {
  await supabase
    .from("onboarding_reminders")
    .update({
      status: "cancelled",
      metadata: { cancellation_reason: reason },
    })
    .eq("id", reminderId);
}

// Configuration Vercel Cron (ajouter dans vercel.json)
// {
//   "crons": [{
//     "path": "/api/cron/onboarding-reminders",
//     "schedule": "0 * * * *"
//   }]
// }
