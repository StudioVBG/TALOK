export const runtime = 'nodejs';

/**
 * GET /api/cron/rent-reminders
 * Cron job pour envoyer des relances de loyers impayés
 * Configuré pour s'exécuter tous les jours à 9h
 */

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Vérifier le secret CRON pour sécuriser l'endpoint
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    console.warn("CRON_SECRET non configuré - accès autorisé en dev");
    return process.env.NODE_ENV === "development";
  }
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: Request) {
  // Vérification sécurité
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = new Date();

  const results = {
    processed: 0,
    j5_sent: 0,
    j10_sent: 0,
    j15_sent: 0,
    j30_sent: 0,
    errors: [] as string[],
  };

  try {
    // Récupérer les factures impayées (statut "sent" = envoyées mais pas payées)
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    
    const { data: overdueInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select(`
        id,
        periode,
        montant_total,
        created_at,
        owner_id,
        tenant_id,
        lease_id,
        tenant:profiles!invoices_tenant_id_fkey(
          id, prenom, nom, user_id
        ),
        owner:profiles!invoices_owner_id_fkey(
          id, prenom, nom, user_id
        ),
        lease:leases(
          id,
          property:properties(adresse_complete)
        )
      `)
      .eq("statut", "sent")
      .lt("created_at", fiveDaysAgo.toISOString());

    if (fetchError) {
      throw new Error(`Erreur récupération factures: ${fetchError.message}`);
    }

    if (!overdueInvoices || overdueInvoices.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Aucune facture en retard",
        ...results,
      });
    }

    // Traiter chaque facture
    for (const invoice of overdueInvoices) {
      const createdAt = new Date(invoice.created_at);
      const daysLate = Math.floor(
        (today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      try {
        let reminderLevel: string | null = null;
        let notificationTitle = "";
        let notificationMessage = "";

        // Déterminer le niveau de relance
        // J+5 à J+9 : Première relance amicale
        if (daysLate >= 5 && daysLate < 10) {
          reminderLevel = "j5";
          notificationTitle = "Rappel de paiement";
          notificationMessage = `Le loyer de ${invoice.periode} (${invoice.montant_total}€) est en attente depuis ${daysLate} jours.`;
          results.j5_sent++;
        }
        // J+10 à J+14 : Seconde relance
        else if (daysLate >= 10 && daysLate < 15) {
          reminderLevel = "j10";
          notificationTitle = "Second rappel de paiement";
          notificationMessage = `Le loyer de ${invoice.periode} (${invoice.montant_total}€) est impayé depuis ${daysLate} jours. Merci de régulariser rapidement.`;
          results.j10_sent++;
        }
        // J+15 à J+29 : Mise en demeure
        else if (daysLate >= 15 && daysLate < 30) {
          reminderLevel = "j15";
          notificationTitle = "Mise en demeure";
          notificationMessage = `IMPORTANT: Le loyer de ${invoice.periode} (${invoice.montant_total}€) est impayé depuis ${daysLate} jours. Veuillez régulariser sous 8 jours.`;
          results.j15_sent++;
        }
        // J+30+ : Dernier avertissement avant procédure
        else if (daysLate >= 30) {
          reminderLevel = "j30";
          notificationTitle = "Dernier avertissement";
          notificationMessage = `URGENT: Le loyer de ${invoice.periode} (${invoice.montant_total}€) est impayé depuis ${daysLate} jours. Procédure de recouvrement imminente.`;
          results.j30_sent++;
        }

        if (reminderLevel) {
          // Créer la notification pour le locataire
          await supabase.from("notifications").insert({
            user_id: invoice.tenant.user_id,
            type: `rent_reminder_${reminderLevel}`,
            title: notificationTitle,
            message: notificationMessage,
            data: {
              invoice_id: invoice.id,
              days_late: daysLate,
              amount: invoice.montant_total,
              periode: invoice.periode,
              reminder_level: reminderLevel,
            },
          });

          // Créer une notification pour le propriétaire
          await supabase.from("notifications").insert({
            user_id: invoice.owner.user_id,
            type: "rent_reminder_sent_to_tenant",
            title: `Relance J+${daysLate} envoyée`,
            message: `Une relance a été envoyée à ${invoice.tenant.prenom} ${invoice.tenant.nom} pour le loyer de ${invoice.periode} (${invoice.montant_total}€).`,
            data: {
              invoice_id: invoice.id,
              tenant_name: `${invoice.tenant.prenom} ${invoice.tenant.nom}`,
              days_late: daysLate,
              reminder_level: reminderLevel,
            },
          });

          // Marquer la facture comme "late" si pas déjà fait
          if (daysLate >= 15) {
            await supabase
              .from("invoices")
              .update({ statut: "late" })
              .eq("id", invoice.id)
              .eq("statut", "sent"); // Ne mettre à jour que si encore en "sent"
          }

          results.processed++;
        }
      } catch (invoiceError: any) {
        results.errors.push(`Invoice ${invoice.id}: ${invoiceError.message}`);
      }
    }

    // Log du résultat dans audit_log
    await supabase.from("audit_log").insert({
      action: "cron_rent_reminders",
      entity_type: "cron",
      metadata: {
        ...results,
        executed_at: new Date().toISOString(),
        total_overdue: overdueInvoices.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${results.processed} relances envoyées`,
      ...results,
    });
  } catch (error: unknown) {
    console.error("Erreur cron rent-reminders:", error);

    // Log l'erreur
    await supabase.from("audit_log").insert({
      action: "cron_rent_reminders_error",
      entity_type: "cron",
      metadata: {
        error: error instanceof Error ? error.message : "Une erreur est survenue",
        executed_at: new Date().toISOString(),
      },
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Une erreur est survenue",
        ...results,
      },
      { status: 500 }
    );
  }
}

// Support POST également (pour flexibilité)
export async function POST(request: Request) {
  return GET(request);
}
