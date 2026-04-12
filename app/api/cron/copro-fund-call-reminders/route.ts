export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import {
  assertCronAuth,
  loadSyndicInfoForSite,
  daysBetween,
} from "@/lib/helpers/copro-cron-helpers";
import { coproOverdueEmail } from "@/lib/emails/templates/copro-overdue";
import { sendEmail } from "@/lib/emails/resend.service";

type ReminderLevel = "friendly" | "reminder" | "urgent";

function getReminderLevel(daysOverdue: number): ReminderLevel | null {
  if (daysOverdue >= 60) return "urgent";
  if (daysOverdue >= 30) return "reminder";
  if (daysOverdue >= 10) return "friendly";
  return null;
}

function getLevelThreshold(level: ReminderLevel): number {
  switch (level) {
    case "friendly":
      return 1;
    case "reminder":
      return 2;
    case "urgent":
      return 3;
  }
}

export async function GET(request: Request) {
  const authError = assertCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceRoleClient();
  const now = new Date();
  const stats = {
    overdueFound: 0,
    remindersSent: 0,
    syndicNotifications: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    console.log("[CRON copro-fund-call-reminders] Starting...");

    // Find overdue fund call lines by joining with copro_fund_calls
    const { data: overdueLines, error: fetchErr } = await supabase
      .from("copro_fund_call_lines")
      .select(`
        *,
        fund_call:copro_fund_calls!call_id (
          id,
          entity_id,
          due_date,
          period_label,
          status,
          exercise_id
        )
      `)
      .in("payment_status", ["pending", "partial"]);

    if (fetchErr) {
      console.error("[CRON copro-fund-call-reminders] Error fetching overdue lines:", fetchErr);
      return NextResponse.json(
        { success: false, stats, date: now.toISOString(), error: fetchErr.message },
        { status: 500 }
      );
    }

    // Filter to only truly overdue lines (due_date < now)
    const lines = ((overdueLines as any[]) || []).filter((line) => {
      const fc = line.fund_call;
      if (!fc || !fc.due_date) return false;
      return new Date(fc.due_date) < now;
    });

    stats.overdueFound = lines.length;
    console.log(`[CRON copro-fund-call-reminders] Found ${lines.length} overdue fund call lines`);

    for (const line of lines) {
      try {
        const fc = line.fund_call as any;
        const daysOverdue = daysBetween(new Date(fc.due_date), now);
        const level = getReminderLevel(daysOverdue);

        if (!level) {
          stats.skipped++;
          continue;
        }

        // Check if enough time since last reminder (>= 5 days)
        if (line.last_reminder_at) {
          const daysSinceLastReminder = daysBetween(new Date(line.last_reminder_at), now);
          if (daysSinceLastReminder < 5) {
            stats.skipped++;
            continue;
          }
        }

        // Check if reminder_count < threshold for this level
        const threshold = getLevelThreshold(level);
        if ((line.reminder_count || 0) >= threshold && line.last_reminder_at) {
          const daysSinceLastReminder = daysBetween(new Date(line.last_reminder_at), now);
          if (daysSinceLastReminder < 5) {
            stats.skipped++;
            continue;
          }
        }

        // Load the lot owner profile to get recipient email
        const { data: lot, error: lotErr } = await supabase
          .from("copro_lots")
          .select("id, owner_profile_id")
          .eq("id", line.lot_id)
          .single();

        if (lotErr || !lot) {
          console.warn("[CRON copro-fund-call-reminders] Could not find lot for line", line.id);
          stats.errors++;
          continue;
        }

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("id, user_id, prenom, nom, email")
          .eq("id", (lot as any).owner_profile_id)
          .single();

        if (profileErr || !profile) {
          console.warn("[CRON copro-fund-call-reminders] Could not find profile for lot", lot.id);
          stats.errors++;
          continue;
        }

        const recipientProfile = profile as any;
        if (!recipientProfile.email) {
          console.warn("[CRON copro-fund-call-reminders] No email for profile", recipientProfile.id);
          stats.skipped++;
          continue;
        }

        // Compute amounts
        const amountDue = ((line.amount_cents || 0) - (line.paid_cents || 0)) / 100;
        const recipientName = [recipientProfile.prenom, recipientProfile.nom].filter(Boolean).join(" ") || "Copropriétaire";

        // Send overdue email
        const subject =
          level === "urgent"
            ? `URGENT : Appel de fonds impayé — ${daysOverdue} jours de retard`
            : level === "reminder"
              ? `Relance : Appel de fonds en retard de paiement`
              : `Rappel amical : Appel de fonds en attente`;

        const html = coproOverdueEmail({
          recipientName,
          amountDue,
          daysOverdue,
          level,
          periodLabel: fc.period_label || "",
          dueDate: new Date(fc.due_date).toLocaleDateString("fr-FR"),
        });

        await sendEmail({
          to: recipientProfile.email,
          subject,
          html,
        });

        // Update reminder_count and last_reminder_at
        const { error: updateErr } = await supabase
          .from("copro_fund_call_lines")
          .update({
            reminder_count: (line.reminder_count || 0) + 1,
            last_reminder_at: now.toISOString(),
            payment_status: "overdue",
          } as any)
          .eq("id", line.id);

        if (updateErr) {
          console.error("[CRON copro-fund-call-reminders] Error updating line", line.id, updateErr);
          stats.errors++;
        }

        stats.remindersSent++;
        console.log(`[CRON copro-fund-call-reminders] Sent ${level} reminder to ${recipientProfile.email} for line ${line.id} (${daysOverdue} days overdue)`);

        // For 30+ days overdue: also notify the syndic
        if (daysOverdue >= 30) {
          try {
            // Get site_id from the fund call entity — we use the line's site info
            // The fund_call has entity_id which maps to the site
            const { data: fcFull, error: fcFullErr } = await supabase
              .from("copro_fund_calls")
              .select("entity_id")
              .eq("id", fc.id)
              .single();

            if (!fcFullErr && fcFull) {
              const syndic = await loadSyndicInfoForSite(supabase, (fcFull as any).entity_id);
              if (syndic) {
                const { error: syndicNotifErr } = await supabase.from("notifications").insert({
                  profile_id: syndic.profile_id,
                  user_id: syndic.user_id,
                  type: "copro_fund_call_overdue_syndic",
                  title: `Impayé ${daysOverdue}j — ${recipientName}`,
                  message: `${recipientName} a un impayé de ${amountDue.toFixed(2)} € depuis ${daysOverdue} jours (niveau : ${level}). Lot : ${line.lot_id}.`,
                  action_url: `/copropriete/appels-de-fonds/${fc.id}`,
                  is_read: false,
                  priority: level === "urgent" ? "high" : "normal",
                  status: "sent",
                  channels_status: { in_app: "sent" },
                  data: {
                    fund_call_id: fc.id,
                    line_id: line.id,
                    lot_id: line.lot_id,
                    days_overdue: daysOverdue,
                    level,
                    amount_due: amountDue,
                  },
                } as any);

                if (syndicNotifErr) {
                  console.error("[CRON copro-fund-call-reminders] Error inserting syndic notification:", syndicNotifErr);
                } else {
                  stats.syndicNotifications++;
                }
              }
            }
          } catch (syndicErr) {
            console.error("[CRON copro-fund-call-reminders] Error notifying syndic:", syndicErr);
            stats.errors++;
          }
        }
      } catch (err) {
        console.error("[CRON copro-fund-call-reminders] Error processing line:", line.id, err);
        stats.errors++;
      }
    }

    console.log("[CRON copro-fund-call-reminders] Done.", stats);

    return NextResponse.json({
      success: true,
      stats,
      date: now.toISOString(),
    });
  } catch (err) {
    console.error("[CRON copro-fund-call-reminders] Fatal error:", err);
    return NextResponse.json(
      {
        success: false,
        stats,
        date: now.toISOString(),
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
