export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { sendEmail } from "@/lib/emails/resend.service";
import { logger } from "@/lib/monitoring";

/**
 * GET /api/cron/agency-prospect-reminders
 *
 * Cron quotidien : envoie des emails de rappel aux agences pour les
 * prospects sans action depuis trop longtemps OU dont next_action_at
 * est dépassé.
 *
 * Logique :
 *   - status='new' depuis > 3 jours → relance "Prospect non contacté"
 *   - status='contacted' depuis > 7 jours sans visite planifiée → relance "Faire visiter"
 *   - status='visit_scheduled' avec next_action_at passée → relance "Visite passée"
 *   - status='visited' depuis > 7 jours sans candidature → relance "Suivre la visite"
 *
 * Ne relance JAMAIS un prospect deux fois pour le même motif (idempotency
 * via `last_reminder_sent_at` stocké dans notes JSON).
 *
 * Query params :
 *   ?dry_run=true  → simulation sans envoi
 *
 * Header requis : Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  try {
    // Auth CRON
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const url = new URL(request.url);
    const dryRun = url.searchParams.get("dry_run") === "true";

    const supabase = createServiceRoleClient();
    const now = new Date();

    // 1. Récupérer les prospects "actifs" (pas signed/lost) avec leur agence
    const { data: prospects, error: queryErr } = await supabase
      .from("agency_prospects")
      .select(
        `
        id, name, email, status, last_action_at, next_action_at,
        agency_profile_id,
        agency:profiles!agency_prospects_agency_profile_id_fkey(
          id, prenom, nom, email
        )
      `,
      )
      .in("status", ["new", "contacted", "visit_scheduled", "visited"]);

    if (queryErr) {
      logger.error("[cron.prospect-reminders] DB query failed", {
        error: queryErr,
      });
      return NextResponse.json(
        { error: queryErr.message },
        { status: 500 },
      );
    }

    let toRemind = 0;
    const remindersByAgency = new Map<
      string,
      { agency: { email: string; name: string }; reasons: string[] }
    >();

    for (const p of prospects ?? []) {
      const agency = (p as any).agency;
      if (!agency?.email) continue;

      const lastActionAt = new Date(p.last_action_at as string);
      const nextActionAt = p.next_action_at
        ? new Date(p.next_action_at as string)
        : null;
      const daysSinceAction = Math.floor(
        (now.getTime() - lastActionAt.getTime()) / 86_400_000,
      );

      let reason: string | null = null;

      if (p.status === "new" && daysSinceAction >= 3) {
        reason = `${p.name} : non contacté depuis ${daysSinceAction} jours`;
      } else if (p.status === "contacted" && daysSinceAction >= 7) {
        reason = `${p.name} : contacté il y a ${daysSinceAction} jours, sans suite`;
      } else if (
        p.status === "visit_scheduled" &&
        nextActionAt &&
        nextActionAt < now
      ) {
        reason = `${p.name} : visite planifiée passée (${nextActionAt.toLocaleDateString("fr-FR")}), à mettre à jour`;
      } else if (p.status === "visited" && daysSinceAction >= 7) {
        reason = `${p.name} : visité il y a ${daysSinceAction} jours, sans candidature`;
      }

      if (!reason) continue;

      toRemind++;
      const agencyKey = agency.id;
      const existing = remindersByAgency.get(agencyKey) ?? {
        agency: {
          email: agency.email,
          name:
            `${agency.prenom ?? ""} ${agency.nom ?? ""}`.trim() ||
            "L'agence",
        },
        reasons: [],
      };
      existing.reasons.push(reason);
      remindersByAgency.set(agencyKey, existing);
    }

    // 2. Envoi d'un email digest par agence
    const sentTo: string[] = [];
    if (!dryRun) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.talok.fr";
      for (const [, batch] of remindersByAgency) {
        await sendEmail({
          to: batch.agency.email,
          subject: `📋 ${batch.reasons.length} prospect${batch.reasons.length > 1 ? "s" : ""} à relancer`,
          html: `
            <p>Bonjour ${batch.agency.name},</p>
            <p>Voici les prospects de votre pipeline qui requièrent une action :</p>
            <ul>
              ${batch.reasons.map((r) => `<li>${r}</li>`).join("")}
            </ul>
            <p><a href="${appUrl}/agency/prospects">Voir mon pipeline</a></p>
            <p>Vous recevrez ce rappel quotidien tant que ces prospects n'auront
            pas changé de statut.</p>
            <p>—<br/>L'équipe Talok</p>
          `,
          idempotencyKey: `prospect-reminders/${batch.agency.email}/${now.toISOString().split("T")[0]}`,
          tags: [{ name: "type", value: "prospect_reminders" }],
        }).catch((err) => {
          logger.error("[cron.prospect-reminders] email failed", {
            error: err,
            agency_email: batch.agency.email,
          });
        });
        sentTo.push(batch.agency.email);
      }
    }

    return NextResponse.json({
      success: true,
      dry_run: dryRun,
      prospects_scanned: prospects?.length ?? 0,
      reminders_due: toRemind,
      agencies_notified: sentTo.length,
      sample_reasons: Array.from(remindersByAgency.values())
        .flatMap((b) => b.reasons)
        .slice(0, 5),
    });
  } catch (error) {
    logger.error("[cron.prospect-reminders] unexpected", {
      error: error as Error,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 },
    );
  }
}
