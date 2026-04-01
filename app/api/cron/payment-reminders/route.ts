export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { addDays, format, startOfDay, endOfDay } from "date-fns";
import { notifyPaymentLate } from "@/lib/services/notification-service";

/**
 * GET /api/cron/payment-reminders
 *
 * Cron job pour envoyer des rappels de paiement automatiques.
 * À exécuter quotidiennement via Supabase pg_cron + pg_net.
 *
 * Envoie des rappels:
 * - J-3: Rappel amical avant échéance
 * - J-1: Rappel urgent
 * - J+1: Notification de retard (→ statut "late")
 * - J+7: Relance formelle
 * - J+15: Mise en demeure
 * - J+30: Dernier avertissement avant procédure
 *
 * SYSTÈME CANONIQUE : remplace rent-reminders et l'edge function payment-reminders.
 * Utilise due_date (pas created_at) comme base de calcul.
 *
 * Header requis pour authentification CRON:
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  try {
    // Vérifier l'authentification CRON
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const today = new Date();
    const stats = {
      j_minus_3: 0,
      j_minus_1: 0,
      j_plus_1: 0,
      j_plus_7: 0,
      j_plus_15: 0,
      j_plus_30: 0,
      errors: 0,
    };

    // ===== RAPPEL J-3 (Rappel amical) =====
    const targetDateJ3 = addDays(today, 3);
    const { data: invoicesJ3 } = await supabase
      .from("invoices")
      .select(`
        id,
        montant_total,
        periode,
        due_date,
        lease_id,
        reminder_count,
        lease:leases!inner(
          id,
          property:properties!inner(owner_id, address)
        )
      `)
      .eq("statut", "sent")
      .gte("due_date", format(startOfDay(targetDateJ3), "yyyy-MM-dd"))
      .lte("due_date", format(endOfDay(targetDateJ3), "yyyy-MM-dd"))
      .or("reminder_count.is.null,reminder_count.lt.1");

    if (invoicesJ3) {
      for (const invoice of invoicesJ3) {
        try {
          await sendReminder(supabase, invoice as any, "j_minus_3");
          stats.j_minus_3++;
        } catch (e) {
          console.error(`Erreur rappel J-3 pour ${(invoice as any).id}:`, e);
          stats.errors++;
        }
      }
    }

    // ===== RAPPEL J-1 (Rappel urgent) =====
    const targetDateJ1 = addDays(today, 1);
    const { data: invoicesJ1 } = await supabase
      .from("invoices")
      .select(`
        id,
        montant_total,
        periode,
        due_date,
        lease_id,
        reminder_count,
        lease:leases!inner(
          id,
          property:properties!inner(owner_id, address)
        )
      `)
      .eq("statut", "sent")
      .gte("due_date", format(startOfDay(targetDateJ1), "yyyy-MM-dd"))
      .lte("due_date", format(endOfDay(targetDateJ1), "yyyy-MM-dd"))
      .or("reminder_count.is.null,reminder_count.lt.2");

    if (invoicesJ1) {
      for (const invoice of invoicesJ1) {
        try {
          await sendReminder(supabase, invoice as any, "j_minus_1");
          stats.j_minus_1++;
        } catch (e) {
          console.error(`Erreur rappel J-1 pour ${(invoice as any).id}:`, e);
          stats.errors++;
        }
      }
    }

    // ===== NOTIFICATION J+1 (Retard) =====
    const targetDatePlus1 = addDays(today, -1);
    const { data: invoicesPlus1 } = await supabase
      .from("invoices")
      .select(`
        id,
        montant_total,
        periode,
        due_date,
        lease_id,
        reminder_count,
        lease:leases!inner(
          id,
          property:properties!inner(owner_id, address)
        )
      `)
      .in("statut", ["sent", "late"])
      .gte("due_date", format(startOfDay(targetDatePlus1), "yyyy-MM-dd"))
      .lte("due_date", format(endOfDay(targetDatePlus1), "yyyy-MM-dd"))
      .or("reminder_count.is.null,reminder_count.lt.3");

    if (invoicesPlus1) {
      for (const invoice of invoicesPlus1) {
        try {
          // Marquer comme en retard
          await supabase
            .from("invoices")
            .update({ statut: "late" })
            .eq("id", (invoice as any).id);

          await sendReminder(supabase, invoice as any, "j_plus_1");
          stats.j_plus_1++;
        } catch (e) {
          console.error(`Erreur rappel J+1 pour ${(invoice as any).id}:`, e);
          stats.errors++;
        }
      }
    }

    // ===== RELANCE J+7 (Formelle) =====
    const targetDatePlus7 = addDays(today, -7);
    const { data: invoicesPlus7 } = await supabase
      .from("invoices")
      .select(`
        id,
        montant_total,
        periode,
        due_date,
        lease_id,
        reminder_count,
        lease:leases!inner(
          id,
          property:properties!inner(owner_id, address)
        )
      `)
      .eq("statut", "late")
      .gte("due_date", format(startOfDay(targetDatePlus7), "yyyy-MM-dd"))
      .lte("due_date", format(endOfDay(targetDatePlus7), "yyyy-MM-dd"))
      .or("reminder_count.is.null,reminder_count.lt.4");

    if (invoicesPlus7) {
      for (const invoice of invoicesPlus7) {
        try {
          await sendReminder(supabase, invoice as any, "j_plus_7");
          stats.j_plus_7++;
        } catch (e) {
          console.error(`Erreur rappel J+7 pour ${(invoice as any).id}:`, e);
          stats.errors++;
        }
      }
    }

    // ===== MISE EN DEMEURE J+15 =====
    const targetDatePlus15 = addDays(today, -15);
    const { data: invoicesPlus15 } = await supabase
      .from("invoices")
      .select(`
        id,
        montant_total,
        periode,
        due_date,
        lease_id,
        reminder_count,
        lease:leases!inner(
          id,
          property:properties!inner(owner_id, address)
        )
      `)
      .eq("statut", "late")
      .lte("due_date", format(endOfDay(targetDatePlus15), "yyyy-MM-dd"))
      .or("reminder_count.is.null,reminder_count.lt.5");

    if (invoicesPlus15) {
      for (const invoice of invoicesPlus15) {
        try {
          await sendReminder(supabase, invoice as any, "j_plus_15");
          stats.j_plus_15++;
        } catch (e) {
          console.error(`Erreur mise en demeure J+15 pour ${(invoice as any).id}:`, e);
          stats.errors++;
        }
      }
    }

    // ===== DERNIER AVERTISSEMENT J+30 =====
    const targetDatePlus30 = addDays(today, -30);
    const { data: invoicesPlus30 } = await supabase
      .from("invoices")
      .select(`
        id,
        montant_total,
        periode,
        due_date,
        lease_id,
        reminder_count,
        lease:leases!inner(
          id,
          property:properties!inner(owner_id, address)
        )
      `)
      .eq("statut", "late")
      .lte("due_date", format(endOfDay(targetDatePlus30), "yyyy-MM-dd"))
      .or("reminder_count.is.null,reminder_count.lt.6");

    if (invoicesPlus30) {
      for (const invoice of invoicesPlus30) {
        try {
          await sendReminder(supabase, invoice as any, "j_plus_30");
          stats.j_plus_30++;
        } catch (e) {
          console.error(`Erreur avertissement J+30 pour ${(invoice as any).id}:`, e);
          stats.errors++;
        }
      }
    }

    // Log résumé

    return NextResponse.json({
      success: true,
      timestamp: today.toISOString(),
      stats,
    });

  } catch (error: unknown) {
    console.error("[CRON] Erreur payment-reminders:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * Envoie un rappel de paiement
 */
async function sendReminder(
  supabase: any,
  invoice: {
    id: string;
    montant_total: number;
    periode: string;
    due_date: string;
    lease_id: string;
    reminder_count: number | null;
    lease: {
      id: string;
      property: { owner_id: string; address: string };
    };
  },
  type: "j_minus_3" | "j_minus_1" | "j_plus_1" | "j_plus_7" | "j_plus_15" | "j_plus_30"
) {
  // Récupérer les locataires du bail via lease_signers (pas roommates qui peut être vide)
  const { data: tenantSigners } = await supabase
    .from("lease_signers")
    .select(`
      profile_id,
      profile:profiles!inner(id, user_id, prenom, nom, email)
    `)
    .eq("lease_id", invoice.lease_id)
    .in("role", ["locataire_principal", "locataire", "colocataire"]);

  if (!tenantSigners || tenantSigners.length === 0) {
    return;
  }

  // Déterminer le type d'événement et le message
  const eventConfig = {
    j_minus_3: {
      event_type: "Payment.ReminderFriendly",
      urgency: "low",
      title: "Rappel: Loyer à venir",
    },
    j_minus_1: {
      event_type: "Payment.ReminderUrgent",
      urgency: "medium",
      title: "Rappel urgent: Paiement demain",
    },
    j_plus_1: {
      event_type: "Payment.Late",
      urgency: "high",
      title: "Retard de paiement",
    },
    j_plus_7: {
      event_type: "Payment.LateFormal",
      urgency: "critical",
      title: "Relance formelle - Impayé",
    },
    j_plus_15: {
      event_type: "Payment.MiseEnDemeure",
      urgency: "critical",
      title: "Mise en demeure - Loyer impayé",
    },
    j_plus_30: {
      event_type: "Payment.DernierAvertissement",
      urgency: "critical",
      title: "Dernier avertissement - Procédure de recouvrement",
    },
  };

  const config = eventConfig[type];

  const daysLateMap: Record<string, number> = { j_plus_1: 1, j_plus_7: 7, j_plus_15: 15, j_plus_30: 30 };

  // Émettre un événement pour chaque locataire
  for (const signer of tenantSigners) {
    const signerData = signer as any;

    await supabase.from("outbox").insert({
      event_type: config.event_type,
      payload: {
        invoice_id: invoice.id,
        lease_id: invoice.lease_id,
        tenant_id: signerData.profile?.id,
        tenant_user_id: signerData.profile?.user_id,
        tenant_email: signerData.profile?.email,
        tenant_name: `${signerData.profile?.prenom || ""} ${signerData.profile?.nom || ""}`.trim(),
        amount: invoice.montant_total,
        month: invoice.periode,
        due_date: invoice.due_date,
        property_address: invoice.lease?.property?.address,
        urgency: config.urgency,
        title: config.title,
        reminder_type: type,
      },
    });

    // Créer une notification in-app directe pour les factures en retard
    if (daysLateMap[type] && signerData.profile?.id) {
      try {
        await notifyPaymentLate(
          signerData.profile.id,
          invoice.montant_total,
          daysLateMap[type],
          invoice.id
        );
      } catch (notifErr) {
        console.warn(`[CRON] notifyPaymentLate failed for ${signerData.profile.id}:`, notifErr);
      }
    }
  }

  // Notifier aussi le propriétaire pour J+1, J+7, J+15, J+30
  if (daysLateMap[type]) {
    await supabase.from("outbox").insert({
      event_type: "Owner.TenantPaymentLate",
      payload: {
        invoice_id: invoice.id,
        lease_id: invoice.lease_id,
        owner_id: invoice.lease?.property?.owner_id,
        amount: invoice.montant_total,
        month: invoice.periode,
        due_date: invoice.due_date,
        days_late: daysLateMap[type] ?? 0,
        tenant_count: tenantSigners.length,
      },
    });
  }

  // Mettre à jour le compteur de rappels
  const newCount = (invoice.reminder_count || 0) + 1;
  await supabase
    .from("invoices")
    .update({
      reminder_count: newCount,
      last_reminder_sent_at: new Date().toISOString(),
    })
    .eq("id", invoice.id);
}
