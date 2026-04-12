export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import {
  assertCronAuth,
  findCoproprietairesForSite,
  loadSyndicInfoForSite,
} from "@/lib/helpers/copro-cron-helpers";
import { coproPvDistributionEmail } from "@/lib/emails/templates/copro-pv-distribution";
import { sendEmail } from "@/lib/emails/resend.service";

export async function GET(request: Request) {
  const authError = assertCronAuth(request);
  if (authError) return authError;

  const supabase = createServiceRoleClient();
  const now = new Date();
  const stats = {
    minutesFound: 0,
    minutesDistributed: 0,
    emailsSent: 0,
    errors: 0,
  };

  try {
    console.log("[CRON copro-pv-distribution] Starting...");

    // Find signed minutes that haven't been distributed yet
    const { data: minutes, error: fetchErr } = await supabase
      .from("copro_minutes")
      .select("*")
      .eq("status", "signed")
      .not("signed_by_president_at", "is", null)
      .is("distributed_at", null);

    if (fetchErr) {
      console.error("[CRON copro-pv-distribution] Error fetching minutes:", fetchErr);
      return NextResponse.json(
        { success: false, stats, date: now.toISOString(), error: fetchErr.message },
        { status: 500 }
      );
    }

    stats.minutesFound = ((minutes as any[]) || []).length;
    console.log(`[CRON copro-pv-distribution] Found ${stats.minutesFound} minutes to distribute`);

    for (const pv of (minutes as any[]) || []) {
      try {
        // Load the assembly for context
        const { data: assembly, error: assemblyErr } = await supabase
          .from("copro_assemblies")
          .select("*")
          .eq("id", pv.assembly_id)
          .single();

        if (assemblyErr || !assembly) {
          console.error("[CRON copro-pv-distribution] Could not load assembly for minutes", pv.id, assemblyErr);
          stats.errors++;
          continue;
        }

        const assemblyData = assembly as any;

        // Load the site
        const { data: site, error: siteErr } = await supabase
          .from("sites")
          .select("*")
          .eq("id", pv.site_id)
          .single();

        if (siteErr || !site) {
          console.error("[CRON copro-pv-distribution] Could not load site for minutes", pv.id, siteErr);
          stats.errors++;
          continue;
        }

        const siteData = site as any;

        // Load all copropriétaires for this site
        const coproprietaires = await findCoproprietairesForSite(supabase, pv.site_id);

        if (!coproprietaires || coproprietaires.length === 0) {
          console.warn("[CRON copro-pv-distribution] No copropriétaires found for site", pv.site_id);
          stats.errors++;
          continue;
        }

        const assemblyDate = assemblyData.held_at
          ? new Date(assemblyData.held_at).toLocaleDateString("fr-FR")
          : assemblyData.scheduled_at
            ? new Date(assemblyData.scheduled_at).toLocaleDateString("fr-FR")
            : "N/A";

        // Compute contestation deadline: 2 months from now
        const contestationDeadline = new Date(now);
        contestationDeadline.setMonth(contestationDeadline.getMonth() + 2);

        let emailsSentForThisPv = 0;

        // Send email to each copropriétaire
        for (const copro of coproprietaires) {
          try {
            if (!copro.email) {
              console.warn("[CRON copro-pv-distribution] No email for copropriétaire", copro.profile_id || copro.id);
              continue;
            }

            const recipientName = [copro.prenom, copro.nom].filter(Boolean).join(" ") || "Copropriétaire";

            const subject = `PV de l'AG du ${assemblyDate} — ${siteData.name || "Copropriété"}`;

            const html = coproPvDistributionEmail({
              recipientName,
              assemblyTitle: assemblyData.title || assemblyData.reference_number || "Assemblée Générale",
              assemblyDate,
              siteName: siteData.name || "Copropriété",
              contestationDeadline: contestationDeadline.toLocaleDateString("fr-FR"),
              documentUrl: pv.document_url || null,
            });

            const emailPayload: { to: string; subject: string; html: string; attachments?: any[] } = {
              to: copro.email,
              subject,
              html,
            };

            await sendEmail(emailPayload);

            stats.emailsSent++;
            emailsSentForThisPv++;
          } catch (emailErr) {
            console.error("[CRON copro-pv-distribution] Error sending email to", copro.email, emailErr);
            stats.errors++;
          }
        }

        // Update copro_minutes: status='distributed', distributed_at, contestation_deadline
        const { error: updateErr } = await supabase
          .from("copro_minutes")
          .update({
            status: "distributed",
            distributed_at: now.toISOString(),
            contestation_deadline: contestationDeadline.toISOString(),
          } as any)
          .eq("id", pv.id);

        if (updateErr) {
          console.error("[CRON copro-pv-distribution] Error updating minutes", pv.id, updateErr);
          stats.errors++;
        } else {
          stats.minutesDistributed++;
          console.log(`[CRON copro-pv-distribution] Distributed PV ${pv.id} — ${emailsSentForThisPv} emails sent`);
        }

        // Notify the syndic that PV was distributed
        try {
          const syndic = await loadSyndicInfoForSite(supabase, pv.site_id);
          if (syndic) {
            await supabase.from("notifications").insert({
              profile_id: syndic.profile_id,
              user_id: syndic.user_id,
              type: "copro_pv_distributed",
              title: `PV distribué — AG du ${assemblyDate}`,
              message: `Le procès-verbal de l'AG du ${assemblyDate} a été envoyé à ${emailsSentForThisPv} copropriétaire(s). Délai de contestation : ${contestationDeadline.toLocaleDateString("fr-FR")}.`,
              action_url: `/copropriete/assemblees/${assemblyData.id}/pv`,
              is_read: false,
              priority: "normal",
              status: "sent",
              channels_status: { in_app: "sent" },
              data: {
                minutes_id: pv.id,
                assembly_id: pv.assembly_id,
                site_id: pv.site_id,
                emails_sent: emailsSentForThisPv,
                contestation_deadline: contestationDeadline.toISOString(),
              },
            } as any);
          }
        } catch (syndicErr) {
          console.error("[CRON copro-pv-distribution] Error notifying syndic:", syndicErr);
          // Non-fatal, don't increment errors
        }
      } catch (pvErr) {
        console.error("[CRON copro-pv-distribution] Error processing minutes:", pv.id, pvErr);
        stats.errors++;
      }
    }

    console.log("[CRON copro-pv-distribution] Done.", stats);

    return NextResponse.json({
      success: true,
      stats,
      date: now.toISOString(),
    });
  } catch (err) {
    console.error("[CRON copro-pv-distribution] Fatal error:", err);
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
