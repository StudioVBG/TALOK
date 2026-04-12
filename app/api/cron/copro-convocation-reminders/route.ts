export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import {
  assertCronAuth,
  loadSyndicInfoForSite,
  findCoproprietairesForSite,
} from "@/lib/helpers/copro-cron-helpers";
import { coproAgConvocationEmail } from "@/lib/emails/templates/copro-ag-convocation";
import { sendEmail } from "@/lib/emails/resend.service";

export async function GET(request: Request) {
  const authError = assertCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceRoleClient();
  const now = new Date();
  const stats = {
    syndicNotifications: 0,
    remindersSent: 0,
    errors: 0,
  };

  try {
    console.log("[CRON copro-convocation-reminders] Starting...");

    // Calculate date windows
    const in7days = new Date(now);
    in7days.setDate(in7days.getDate() + 7);
    const in7daysStart = new Date(in7days);
    in7daysStart.setHours(0, 0, 0, 0);
    const in7daysEnd = new Date(in7days);
    in7daysEnd.setHours(23, 59, 59, 999);

    const in21days = new Date(now);
    in21days.setDate(in21days.getDate() + 21);
    const in21daysStart = new Date(in21days);
    in21daysStart.setHours(0, 0, 0, 0);
    const in21daysEnd = new Date(in21days);
    in21daysEnd.setHours(23, 59, 59, 999);

    // ── 21 days: find assemblies with pending convocations ──
    const { data: assemblies21, error: err21 } = await supabase
      .from("copro_assemblies")
      .select("*")
      .eq("status", "convened")
      .gte("scheduled_at", in21daysStart.toISOString())
      .lte("scheduled_at", in21daysEnd.toISOString());

    if (err21) {
      console.error("[CRON copro-convocation-reminders] Error fetching 21-day assemblies:", err21);
    }

    for (const assembly of (assemblies21 as any[]) || []) {
      try {
        // Check for pending (unsent) convocations
        const { data: pendingConvos, error: pendingErr } = await supabase
          .from("copro_convocations")
          .select("id")
          .eq("assembly_id", assembly.id)
          .eq("status", "pending")
          .is("sent_at", null);

        if (pendingErr) {
          console.error("[CRON copro-convocation-reminders] Error checking pending convocations:", pendingErr);
          stats.errors++;
          continue;
        }

        const pendingCount = (pendingConvos as any[] || []).length;
        if (pendingCount === 0) continue;

        // Load syndic info for this site
        const syndic = await loadSyndicInfoForSite(supabase, assembly.site_id);
        if (!syndic) {
          console.warn("[CRON copro-convocation-reminders] No syndic found for site", assembly.site_id);
          stats.errors++;
          continue;
        }

        const scheduledDate = new Date(assembly.scheduled_at).toLocaleDateString("fr-FR");
        const title = `${pendingCount} convocation(s) non envoyée(s) pour l'AG du ${scheduledDate}`;
        const message = `Il reste ${pendingCount} convocation(s) en attente d'envoi pour l'assemblée générale "${assembly.title || assembly.reference_number}" prévue le ${scheduledDate}. Veuillez les envoyer dans les plus brefs délais.`;

        // Insert notification for the syndic
        const { error: notifErr } = await supabase.from("notifications").insert({
          profile_id: syndic.profile_id,
          user_id: syndic.user_id,
          type: "copro_convocation_pending",
          title,
          message,
          action_url: `/copropriete/assemblees/${assembly.id}`,
          is_read: false,
          priority: "high",
          status: "sent",
          channels_status: { in_app: "sent" },
          data: {
            assembly_id: assembly.id,
            site_id: assembly.site_id,
            pending_count: pendingCount,
          },
        } as any);

        if (notifErr) {
          console.error("[CRON copro-convocation-reminders] Error inserting syndic notification:", notifErr);
          stats.errors++;
        } else {
          stats.syndicNotifications++;
          console.log(`[CRON copro-convocation-reminders] Notified syndic for assembly ${assembly.id}: ${pendingCount} pending`);
        }
      } catch (err) {
        console.error("[CRON copro-convocation-reminders] Error processing 21-day assembly:", assembly.id, err);
        stats.errors++;
      }
    }

    // ── 7 days: send reminder emails to copropriétaires with sent convocations ──
    const { data: assemblies7, error: err7 } = await supabase
      .from("copro_assemblies")
      .select("*")
      .eq("status", "convened")
      .gte("scheduled_at", in7daysStart.toISOString())
      .lte("scheduled_at", in7daysEnd.toISOString());

    if (err7) {
      console.error("[CRON copro-convocation-reminders] Error fetching 7-day assemblies:", err7);
    }

    for (const assembly of (assemblies7 as any[]) || []) {
      try {
        // Find convocations that have been sent or delivered
        const { data: sentConvos, error: sentErr } = await supabase
          .from("copro_convocations")
          .select("*")
          .eq("assembly_id", assembly.id)
          .in("status", ["sent", "delivered"]);

        if (sentErr) {
          console.error("[CRON copro-convocation-reminders] Error fetching sent convocations:", sentErr);
          stats.errors++;
          continue;
        }

        const scheduledAt = new Date(assembly.scheduled_at);
        const dateStr = scheduledAt.toLocaleDateString("fr-FR");
        const heureStr = scheduledAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

        for (const convo of (sentConvos as any[]) || []) {
          try {
            if (!convo.recipient_email) continue;

            const subject = `Rappel : AG le ${dateStr} à ${heureStr}`;
            const html = coproAgConvocationEmail({
              recipientName: convo.recipient_name || "Copropriétaire",
              assemblyTitle: assembly.title || assembly.reference_number || "Assemblée Générale",
              assemblyDate: dateStr,
              assemblyTime: heureStr,
              isReminder: true,
            });

            await sendEmail({
              to: convo.recipient_email,
              subject,
              html,
            });

            // Insert a notification record
            const { error: notifErr } = await supabase.from("notifications").insert({
              profile_id: null,
              user_id: null,
              type: "copro_ag_reminder",
              title: subject,
              message: `Rappel envoyé à ${convo.recipient_name || convo.recipient_email} pour l'AG du ${dateStr}.`,
              action_url: `/copropriete/assemblees/${assembly.id}`,
              is_read: false,
              priority: "normal",
              status: "sent",
              channels_status: { email: "sent" },
              data: {
                assembly_id: assembly.id,
                site_id: assembly.site_id,
                convocation_id: convo.id,
                recipient_email: convo.recipient_email,
              },
            } as any);

            if (notifErr) {
              console.error("[CRON copro-convocation-reminders] Error inserting reminder notification:", notifErr);
            }

            stats.remindersSent++;
            console.log(`[CRON copro-convocation-reminders] Reminder sent to ${convo.recipient_email} for assembly ${assembly.id}`);
          } catch (err) {
            console.error("[CRON copro-convocation-reminders] Error sending reminder to", convo.recipient_email, err);
            stats.errors++;
          }
        }
      } catch (err) {
        console.error("[CRON copro-convocation-reminders] Error processing 7-day assembly:", assembly.id, err);
        stats.errors++;
      }
    }

    console.log("[CRON copro-convocation-reminders] Done.", stats);

    return NextResponse.json({
      success: true,
      stats,
      date: now.toISOString(),
    });
  } catch (err) {
    console.error("[CRON copro-convocation-reminders] Fatal error:", err);
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
