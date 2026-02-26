export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getServiceClient } from "@/lib/supabase/service-client";
import { NextResponse } from "next/server";

/** Jours avant expiration pour envoyer un rappel (fenêtre de relance). */
const CNI_EXPIRY_REMINDER_DAYS = 30;

/**
 * GET ou POST /api/cron/cni-expiry-reminders
 *
 * Cron job : liste les tenant_profiles dont la CNI expire dans les 30 prochains jours
 * (ou est déjà expirée), insère un événement Identity.CniExpiryReminder dans l'outbox
 * pour chaque profil. Le worker process-outbox enverra la notification in-app (et email si configuré).
 *
 * Authentification : Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  return runCniExpiryReminders(request);
}

export async function POST(request: Request) {
  return runCniExpiryReminders(request);
}

async function runCniExpiryReminders(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
    }

    const serviceClient = getServiceClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + CNI_EXPIRY_REMINDER_DAYS);
    const windowEndStr = windowEnd.toISOString().slice(0, 10);

    // Locataires avec CNI vérifiée et date d'expiration déjà dépassée ou dans les 30 prochains jours
    const { data: rows, error } = await serviceClient
      .from("tenant_profiles")
      .select("profile_id, cni_expiry_date")
      .not("cni_expiry_date", "is", null)
      .lte("cni_expiry_date", windowEndStr)
      .in("kyc_status", ["verified"]);

    if (error) {
      console.error("[cni-expiry-reminders] Erreur requête tenant_profiles:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = (rows || []) as { profile_id: string; cni_expiry_date: string }[];
    if (list.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Aucun rappel CNI à envoyer",
        processed: 0,
      });
    }

    // Récupérer user_id pour chaque profile_id
    const profileIds = [...new Set(list.map((r) => r.profile_id))];
    const { data: profiles } = await serviceClient
      .from("profiles")
      .select("id, user_id")
      .in("id", profileIds);

    const profileToUser = new Map<string | null, string>();
    for (const p of profiles || []) {
      if (p.user_id) profileToUser.set(p.id, p.user_id);
    }

    let inserted = 0;
    for (const row of list) {
      const tenantUserId = profileToUser.get(row.profile_id);
      if (!tenantUserId) continue;
      const { error: insertErr } = await serviceClient.from("outbox").insert({
        event_type: "Identity.CniExpiryReminder",
        payload: {
          profile_id: row.profile_id,
          tenant_user_id: tenantUserId,
          cni_expiry_date: row.cni_expiry_date,
        },
        status: "pending",
        scheduled_at: new Date().toISOString(),
      } as any);
      if (!insertErr) inserted++;
    }

    return NextResponse.json({
      success: true,
      processed: inserted,
      total_eligible: list.length,
    });
  } catch (err) {
    console.error("[cni-expiry-reminders] Erreur:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
