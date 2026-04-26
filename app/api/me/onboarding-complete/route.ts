export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";

/**
 * POST /api/me/onboarding-complete
 * Marque l'onboarding comme terminé pour l'utilisateur connecté.
 * En plus de positionner profiles.onboarding_completed_at, on :
 *  - clôture la fenêtre `onboarding_analytics` (completed_at + duration)
 *  - annule les rappels pending (24h/72h/7d) pour ne pas spammer l'utilisateur
 *  - déclenche la notification in-app + email "account.welcome"
 */
export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
    const serviceClient = supabaseAdmin();

    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Marquer le profil comme onboardé + récupérer infos utiles
    const { data: updatedProfile, error: updateError } = await serviceClient
      .from("profiles")
      .update({ onboarding_completed_at: nowIso })
      .eq("user_id", user.id)
      .select("id, role, prenom, nom, email")
      .maybeSingle();

    if (updateError || !updatedProfile) {
      console.error("[POST /api/me/onboarding-complete] update profile failed:", updateError);
      return NextResponse.json(
        { error: "Impossible de marquer l'onboarding comme terminé" },
        { status: 500 }
      );
    }

    // 2. Annuler les rappels onboarding encore en attente (best-effort, non bloquant)
    serviceClient
      .from("onboarding_reminders")
      .update({ status: "cancelled" })
      .eq("user_id", user.id)
      .eq("status", "pending")
      .then(({ error: cancelError }: { error: unknown }) => {
        if (cancelError) {
          console.warn("[onboarding-complete] cancel reminders failed:", cancelError);
        }
      });

    // 3. Clôturer la session d'onboarding_analytics ouverte (s'il y en a une)
    (async () => {
      try {
        const { data: openSession } = await serviceClient
          .from("onboarding_analytics")
          .select("id, started_at")
          .eq("user_id", user.id)
          .is("completed_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!openSession?.id || !openSession.started_at) return;

        const startedAt = new Date(openSession.started_at as string).getTime();
        const durationSeconds = Math.max(0, Math.round((now.getTime() - startedAt) / 1000));

        const { error: closeError } = await serviceClient
          .from("onboarding_analytics")
          .update({
            completed_at: nowIso,
            total_duration_seconds: durationSeconds,
          })
          .eq("id", openSession.id);

        if (closeError) {
          console.warn("[onboarding-complete] close analytics failed:", closeError);
        }
      } catch (e) {
        console.warn("[onboarding-complete] analytics block failed:", e);
      }
    })();

    // 4. Notification de bienvenue (in-app + email best-effort)
    //    Le NotificationType "system" est utilisé car "account.welcome" appartient
    //    au système d'events distinct (lib/notifications/events.ts) et n'est pas
    //    accepté par createNotification(). On trace l'event dans metadata.
    import("@/lib/services/notification-service")
      .then(({ createNotification }) =>
        createNotification({
          type: "system",
          title: "Bienvenue sur Talok !",
          message: `Bienvenue ${updatedProfile.prenom || ""} ! Votre compte est prêt.`,
          recipientId: updatedProfile.id,
          actionUrl: `/${updatedProfile.role}/dashboard`,
          actionLabel: "Accéder à mon espace",
          metadata: {
            event: "account.welcome",
            role: updatedProfile.role,
            triggered_by: "onboarding-complete",
          },
        })
      )
      .catch((e: unknown) => console.warn("[onboarding-complete] welcome notification failed:", e));

    return NextResponse.json({ success: true, onboarding_completed_at: nowIso });
  } catch (error: unknown) {
    console.error("Error in POST /api/me/onboarding-complete:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
