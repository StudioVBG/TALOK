/**
 * Service de notifications d'onboarding
 *
 * Gère l'envoi des notifications liées au parcours d'onboarding :
 * - Bienvenue
 * - Progression par étape
 * - Complétion
 * - Rappels
 */

import { createClient } from "@/lib/supabase/client";
import { createNotification } from "@/lib/services/notification-service";
import type { UserRole } from "@/lib/types";

// Types pour les notifications d'onboarding
export interface OnboardingNotificationData {
  profileId: string;
  userName: string;
  role: UserRole;
  step?: string;
  stepName?: string;
  progressPercent?: number;
  remainingSteps?: number;
}

// Configuration des étapes par rôle avec labels
const STEP_LABELS: Record<string, Record<string, string>> = {
  owner: {
    role_choice: "Choix du rôle",
    account_creation: "Création du compte",
    email_verification: "Vérification email",
    owner_profile: "Profil propriétaire",
    owner_finance: "Informations bancaires",
    first_property: "Premier bien",
    automation: "Automatisation",
    invite: "Invitations",
    final_review: "Validation finale",
  },
  tenant: {
    role_choice: "Choix du rôle",
    account_creation: "Création du compte",
    email_verification: "Vérification email",
    tenant_context: "Contexte logement",
    tenant_file: "Dossier locataire",
    tenant_identity: "Vérification identité",
    tenant_payment: "Mode de paiement",
    tenant_sign: "Signature bail",
  },
  provider: {
    role_choice: "Choix du rôle",
    account_creation: "Création du compte",
    email_verification: "Vérification email",
    provider_profile: "Profil prestataire",
    provider_services: "Services proposés",
    provider_ops: "Zone d'intervention",
    provider_review: "Validation finale",
  },
  guarantor: {
    role_choice: "Choix du rôle",
    account_creation: "Création du compte",
    email_verification: "Vérification email",
    guarantor_context: "Informations",
    guarantor_financial: "Capacité financière",
    guarantor_sign: "Signature",
  },
};

export class OnboardingNotificationsService {
  private _supabase: ReturnType<typeof createClient> | null = null;

  // Lazy getter pour éviter la création du client au niveau du module (erreur de build)
  private get supabase() {
    if (!this._supabase) {
      this._supabase = createClient();
    }
    return this._supabase;
  }

  /**
   * Envoie une notification de bienvenue
   */
  async sendWelcomeNotification(data: OnboardingNotificationData): Promise<boolean> {
    try {
      const roleLabels: Record<UserRole, string> = {
        owner: "propriétaire",
        tenant: "locataire",
        provider: "prestataire",
        guarantor: "garant",
        admin: "administrateur",
        syndic: "syndic",
      };

      await createNotification({
        type: "system",
        title: `Bienvenue ${data.userName} !`,
        message: `Nous sommes ravis de vous accueillir sur Talok en tant que ${roleLabels[data.role]}. Complétez votre profil pour commencer à utiliser toutes les fonctionnalités.`,
        recipientId: data.profileId,
        priority: "normal",
        channels: ["in_app"],
        actionUrl: `/${data.role}/onboarding`,
        actionLabel: "Compléter mon profil",
        metadata: {
          notification_type: "onboarding_welcome",
          role: data.role,
        },
      });

      return true;
    } catch (error) {
      console.error("Erreur envoi notification bienvenue:", error);
      return false;
    }
  }

  /**
   * Envoie une notification de progression d'étape
   */
  async sendStepCompletedNotification(data: OnboardingNotificationData): Promise<boolean> {
    if (!data.step || !data.progressPercent) return false;

    try {
      const stepName = STEP_LABELS[data.role]?.[data.step] || data.step;

      await createNotification({
        type: "system",
        title: "Bravo !",
        message: `Vous avez complété l'étape "${stepName}". Votre profil est maintenant à ${data.progressPercent}%.`,
        recipientId: data.profileId,
        priority: "low",
        channels: ["in_app"],
        metadata: {
          notification_type: "onboarding_step_completed",
          step: data.step,
          step_name: stepName,
          progress_percent: data.progressPercent,
        },
      });

      return true;
    } catch (error) {
      console.error("Erreur envoi notification step completed:", error);
      return false;
    }
  }

  /**
   * Envoie une notification "presque terminé" (80%+)
   */
  async sendAlmostDoneNotification(data: OnboardingNotificationData): Promise<boolean> {
    if (!data.remainingSteps || !data.progressPercent) return false;

    try {
      await createNotification({
        type: "system",
        title: "Vous y êtes presque !",
        message: `Plus que ${data.remainingSteps} étape${data.remainingSteps > 1 ? "s" : ""} pour finaliser votre profil. Vous êtes à ${data.progressPercent}% !`,
        recipientId: data.profileId,
        priority: "normal",
        channels: ["in_app", "push"],
        actionUrl: `/${data.role}/onboarding`,
        actionLabel: "Continuer",
        metadata: {
          notification_type: "onboarding_almost_done",
          remaining_steps: data.remainingSteps,
          progress_percent: data.progressPercent,
        },
      });

      return true;
    } catch (error) {
      console.error("Erreur envoi notification almost done:", error);
      return false;
    }
  }

  /**
   * Envoie une notification de complétion d'onboarding
   */
  async sendCompletedNotification(data: OnboardingNotificationData): Promise<boolean> {
    try {
      await createNotification({
        type: "system",
        title: "Profil complété !",
        message: `Félicitations ${data.userName} ! Votre espace est maintenant entièrement configuré. Vous pouvez profiter de toutes les fonctionnalités de Talok.`,
        recipientId: data.profileId,
        priority: "normal",
        channels: ["in_app", "push"],
        actionUrl: `/${data.role}/dashboard`,
        actionLabel: "Accéder à mon espace",
        metadata: {
          notification_type: "onboarding_completed",
          role: data.role,
        },
      });

      return true;
    } catch (error) {
      console.error("Erreur envoi notification completed:", error);
      return false;
    }
  }

  /**
   * Programme les rappels d'onboarding
   */
  async scheduleReminders(
    userId: string,
    profileId: string,
    role: UserRole,
    email: string
  ): Promise<boolean> {
    try {
      const now = new Date();

      // Définir les délais de rappel
      const reminders = [
        { type: "24h", delay: 24 * 60 * 60 * 1000 },
        { type: "72h", delay: 72 * 60 * 60 * 1000 },
        { type: "7d", delay: 7 * 24 * 60 * 60 * 1000 },
      ];

      for (const reminder of reminders) {
        const scheduledAt = new Date(now.getTime() + reminder.delay);

        await this.supabase.from("onboarding_reminders").upsert(
          {
            user_id: userId,
            profile_id: profileId,
            role,
            reminder_type: reminder.type,
            scheduled_at: scheduledAt.toISOString(),
            email_sent_to: email,
            status: "pending",
          },
          {
            onConflict: "user_id,reminder_type",
          }
        );
      }

      return true;
    } catch (error) {
      console.error("Erreur programmation rappels:", error);
      return false;
    }
  }

  /**
   * Annule tous les rappels en attente (après complétion)
   */
  async cancelPendingReminders(userId: string): Promise<boolean> {
    try {
      await this.supabase
        .from("onboarding_reminders")
        .update({ status: "cancelled" })
        .eq("user_id", userId)
        .eq("status", "pending");

      return true;
    } catch (error) {
      console.error("Erreur annulation rappels:", error);
      return false;
    }
  }

  /**
   * Récupère les rappels à envoyer maintenant
   */
  async getPendingRemindersToSend(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from("onboarding_reminders")
      .select(`
        *,
        profiles:profile_id (
          prenom,
          nom,
          email
        )
      `)
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true });

    if (error) {
      console.error("Erreur récupération rappels:", error);
      return [];
    }

    return data || [];
  }

  /**
   * Marque un rappel comme envoyé
   */
  async markReminderSent(reminderId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("onboarding_reminders")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", reminderId);

    if (error) {
      console.error("Erreur marquage rappel envoyé:", error);
      return false;
    }
    return true;
  }

  /**
   * Obtient le label d'une étape
   */
  getStepLabel(role: UserRole, step: string): string {
    return STEP_LABELS[role]?.[step] || step;
  }

  /**
   * Obtient toutes les étapes pour un rôle
   */
  getStepsForRole(role: UserRole): Array<{ key: string; label: string }> {
    const steps = STEP_LABELS[role];
    if (!steps) return [];

    return Object.entries(steps).map(([key, label]) => ({ key, label }));
  }
}

export const onboardingNotificationsService = new OnboardingNotificationsService();
