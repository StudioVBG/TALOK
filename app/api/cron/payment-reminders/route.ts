export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { addDays, format, startOfDay, endOfDay } from "date-fns";

/**
 * GET /api/cron/payment-reminders
 *
 * Cron job pour envoyer des rappels de paiement automatiques.
 * À exécuter quotidiennement via Vercel Cron ou un service externe.
 *
 * Envoie des rappels:
 * - J-3: Rappel amical avant échéance
 * - J-1: Rappel urgent
 * - J+1: Notification de retard
 * - J+7: Relance formelle
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
      .eq("statut", "pending")
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
      .eq("statut", "pending")
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
      .in("statut", ["pending", "late"])
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

    // Log résumé
    console.log(`[CRON] Rappels envoyés: J-3=${stats.j_minus_3}, J-1=${stats.j_minus_1}, J+1=${stats.j_plus_1}, J+7=${stats.j_plus_7}, Erreurs=${stats.errors}`);

    return NextResponse.json({
      success: true,
      timestamp: today.toISOString(),
      stats,
    });

  } catch (error: any) {
    console.error("[CRON] Erreur payment-reminders:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
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
  type: "j_minus_3" | "j_minus_1" | "j_plus_1" | "j_plus_7"
) {
  // Récupérer les locataires du bail
  const { data: roommates } = await supabase
    .from("roommates")
    .select(`
      profile_id,
      profile:profiles!inner(id, user_id, first_name, last_name, email)
    `)
    .eq("lease_id", invoice.lease_id)
    .is("left_on", null);

  if (!roommates || roommates.length === 0) {
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
  };

  const config = eventConfig[type];

  // Émettre un événement pour chaque locataire
  for (const roommate of roommates) {
    const roommateData = roommate as any;

    await supabase.from("outbox").insert({
      event_type: config.event_type,
      payload: {
        invoice_id: invoice.id,
        lease_id: invoice.lease_id,
        tenant_id: roommateData.profile?.id,
        tenant_user_id: roommateData.profile?.user_id,
        tenant_email: roommateData.profile?.email,
        tenant_name: `${roommateData.profile?.first_name || ""} ${roommateData.profile?.last_name || ""}`.trim(),
        amount: invoice.montant_total,
        month: invoice.periode,
        due_date: invoice.due_date,
        property_address: invoice.lease?.property?.address,
        urgency: config.urgency,
        title: config.title,
        reminder_type: type,
      },
    });
  }

  // Notifier aussi le propriétaire pour J+1 et J+7
  if (type === "j_plus_1" || type === "j_plus_7") {
    await supabase.from("outbox").insert({
      event_type: "Owner.TenantPaymentLate",
      payload: {
        invoice_id: invoice.id,
        lease_id: invoice.lease_id,
        owner_id: invoice.lease?.property?.owner_id,
        amount: invoice.montant_total,
        month: invoice.periode,
        due_date: invoice.due_date,
        days_late: type === "j_plus_1" ? 1 : 7,
        tenant_count: roommates.length,
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
