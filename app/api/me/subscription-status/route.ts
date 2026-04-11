export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { supabaseAdmin } from "@/app/api/_lib/supabase";

/**
 * GET /api/me/subscription-status
 * Retourne le statut d'abonnement de l'utilisateur connecté.
 * Utilisé notamment par /signup/plan pour détecter si le user a déjà choisi un plan
 * et éviter un retour en arrière dans le parcours d'inscription.
 */
export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = supabaseAdmin();

    // Récupérer le profile_id
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({
        has_subscription: false,
        selected_plan_at: null,
        plan_slug: null,
      });
    }

    // Récupérer l'abonnement (owner uniquement pour l'instant)
    const { data: subscription } = await serviceClient
      .from("subscriptions")
      .select("selected_plan_at, plan_slug, status")
      .eq("owner_id", (profile as any).id)
      .maybeSingle();

    return NextResponse.json({
      has_subscription: !!subscription,
      selected_plan_at: (subscription as any)?.selected_plan_at ?? null,
      plan_slug: (subscription as any)?.plan_slug ?? null,
      status: (subscription as any)?.status ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
