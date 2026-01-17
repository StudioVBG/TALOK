/**
 * Automation: Relances de loyers impayés
 * 
 * Ce module gère les relances automatiques pour les loyers en retard.
 * À appeler via un cron job (Netlify, GitHub Actions, ou autre).
 * 
 * Séquence de relance (configurable):
 * - J+5: Rappel amical par email
 * - J+10: Relance formelle
 * - J+15: Mise en demeure
 * - J+30: Pré-contentieux
 */

import { createServiceRoleClient } from "@/lib/server/service-role-client";
import { emailService } from "@/lib/services/email-service";

export interface ReminderConfig {
  // Délais en jours après l'échéance
  friendlyReminderDays: number;
  formalReminderDays: number;
  formalNoticeDays: number;
  preContentionsDays: number;
  // Activer/désactiver les types
  enableEmail: boolean;
  enableSms: boolean;
  enablePush: boolean;
}

export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  friendlyReminderDays: 5,
  formalReminderDays: 10,
  formalNoticeDays: 15,
  preContentionsDays: 30,
  enableEmail: true,
  enableSms: false,
  enablePush: true,
};

export interface LateInvoice {
  id: string;
  lease_id: string;
  tenant_id: string;
  owner_id: string;
  periode: string;
  montant_total: number;
  due_date: Date;
  days_late: number;
  tenant: {
    email: string;
    prenom: string;
    nom: string;
    telephone?: string;
  };
  owner: {
    email: string;
    prenom: string;
    nom: string;
  };
  property: {
    adresse_complete: string;
  };
}

export async function processRentReminders(
  config: ReminderConfig = DEFAULT_REMINDER_CONFIG
): Promise<{
  processed: number;
  reminders: {
    friendly: number;
    formal: number;
    notice: number;
    preContentious: number;
  };
  errors: string[];
}> {
  const supabase = createServiceRoleClient();
  const errors: string[] = [];
  const reminders = {
    friendly: 0,
    formal: 0,
    notice: 0,
    preContentious: 0,
  };

  try {
    // Récupérer les factures en retard
    const today = new Date();
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select(`
        id,
        lease_id,
        tenant_id,
        owner_id,
        periode,
        montant_total,
        statut,
        created_at,
        tenant:tenant_id (
          user_id,
          prenom,
          nom,
          telephone,
          user:user_id (email)
        ),
        owner:owner_id (
          prenom,
          nom,
          user:user_id (email)
        ),
        lease:lease_id (
          property:property_id (
            adresse_complete
          )
        )
      `)
      .eq("statut", "sent")
      .order("created_at", { ascending: true });

    if (error) throw error;
    if (!invoices || invoices.length === 0) {
      return { processed: 0, reminders, errors: [] };
    }

    // Traiter chaque facture en retard
    for (const invoice of invoices) {
      try {
        // Calculer le nombre de jours de retard
        // Échéance = 5 du mois suivant la période
        const [year, month] = invoice.periode.split("-").map(Number);
        const dueDate = new Date(year, month, 5); // Mois suivant, 5ème jour
        const daysLate = Math.floor(
          (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysLate <= 0) continue; // Pas encore en retard

        const tenantData = invoice.tenant as any;
        const ownerData = invoice.owner as any;
        const leaseData = invoice.lease as any;

        const lateInvoice: LateInvoice = {
          id: invoice.id,
          lease_id: invoice.lease_id,
          tenant_id: invoice.tenant_id,
          owner_id: invoice.owner_id,
          periode: invoice.periode,
          montant_total: invoice.montant_total,
          due_date: dueDate,
          days_late: daysLate,
          tenant: {
            email: tenantData?.user?.email || "",
            prenom: tenantData?.prenom || "",
            nom: tenantData?.nom || "",
            telephone: tenantData?.telephone,
          },
          owner: {
            email: ownerData?.user?.email || "",
            prenom: ownerData?.prenom || "",
            nom: ownerData?.nom || "",
          },
          property: {
            adresse_complete: leaseData?.property?.adresse_complete || "",
          },
        };

        // Vérifier le niveau de relance à envoyer
        const { data: existingReminders } = await supabase
          .from("notifications")
          .select("metadata")
          .eq("metadata->invoice_id", invoice.id)
          .eq("type", "rent_reminder");

        const sentLevels = new Set(
          (existingReminders || []).map((r: any) => r.metadata?.level)
        );

        // Déterminer le niveau de relance approprié
        let reminderLevel: string | null = null;
        
        if (daysLate >= config.preContentionsDays && !sentLevels.has("pre_contentious")) {
          reminderLevel = "pre_contentious";
          reminders.preContentious++;
        } else if (daysLate >= config.formalNoticeDays && !sentLevels.has("formal_notice")) {
          reminderLevel = "formal_notice";
          reminders.notice++;
        } else if (daysLate >= config.formalReminderDays && !sentLevels.has("formal")) {
          reminderLevel = "formal";
          reminders.formal++;
        } else if (daysLate >= config.friendlyReminderDays && !sentLevels.has("friendly")) {
          reminderLevel = "friendly";
          reminders.friendly++;
        }

        if (reminderLevel) {
          await sendReminder(supabase, lateInvoice, reminderLevel, config);
        }
      } catch (err: any) {
        errors.push(`Erreur traitement facture ${invoice.id}: ${err.message}`);
      }
    }

    return {
      processed: invoices.length,
      reminders,
      errors,
    };
  } catch (error: unknown) {
    errors.push(`Erreur globale: ${error.message}`);
    return { processed: 0, reminders, errors };
  }
}

async function sendReminder(
  supabase: any,
  invoice: LateInvoice,
  level: string,
  config: ReminderConfig
): Promise<void> {
  const templates: Record<string, { subject: string; priority: string }> = {
    friendly: {
      subject: `Rappel: Loyer ${formatPeriode(invoice.periode)} en attente`,
      priority: "low",
    },
    formal: {
      subject: `Relance: Loyer ${formatPeriode(invoice.periode)} impayé`,
      priority: "medium",
    },
    formal_notice: {
      subject: `MISE EN DEMEURE: Loyer ${formatPeriode(invoice.periode)}`,
      priority: "high",
    },
    pre_contentious: {
      subject: `URGENT: Procédure de recouvrement - Loyer ${formatPeriode(invoice.periode)}`,
      priority: "urgent",
    },
  };

  const template = templates[level];

  // Envoyer l'email
  if (config.enableEmail && invoice.tenant.email) {
    await emailService.sendRentReminder({
      to: invoice.tenant.email,
      tenantName: `${invoice.tenant.prenom} ${invoice.tenant.nom}`,
      ownerName: `${invoice.owner.prenom} ${invoice.owner.nom}`,
      propertyAddress: invoice.property.adresse_complete,
      periode: formatPeriode(invoice.periode),
      montant: invoice.montant_total,
      daysLate: invoice.days_late,
      level,
      paymentLink: `${process.env.NEXT_PUBLIC_APP_URL}/tenant/payments?invoice=${invoice.id}`,
    });
  }

  // Créer une notification dans la BDD
  await supabase.from("notifications").insert({
    user_id: invoice.tenant_id,
    type: "rent_reminder",
    title: template.subject,
    body: `Votre loyer de ${invoice.montant_total}€ pour ${formatPeriode(invoice.periode)} est en retard de ${invoice.days_late} jours.`,
    priority: template.priority,
    metadata: {
      invoice_id: invoice.id,
      level,
      amount: invoice.montant_total,
      days_late: invoice.days_late,
    },
  });

  // Notifier aussi le propriétaire
  await supabase.from("notifications").insert({
    user_id: invoice.owner_id,
    type: "rent_late_owner",
    title: `Loyer impayé - ${invoice.tenant.prenom} ${invoice.tenant.nom}`,
    body: `Le loyer de ${invoice.montant_total}€ pour ${formatPeriode(invoice.periode)} est en retard de ${invoice.days_late} jours.`,
    priority: template.priority,
    metadata: {
      invoice_id: invoice.id,
      level,
      tenant_name: `${invoice.tenant.prenom} ${invoice.tenant.nom}`,
    },
  });

  // Mettre à jour le statut de la facture si nécessaire
  if (level === "formal_notice" || level === "pre_contentious") {
    await supabase
      .from("invoices")
      .update({ statut: "late" })
      .eq("id", invoice.id);
  }
}

function formatPeriode(periode: string): string {
  const [year, month] = periode.split("-");
  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

// Export pour usage dans les API routes ou cron jobs
export { formatPeriode };

