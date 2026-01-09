export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * GET /api/subscriptions/signatures
 * Récupère l'usage des signatures du mois courant
 *
 * POST /api/subscriptions/signatures
 * Incrémente l'usage des signatures (après une signature réussie)
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getSignatureUsageByOwner,
  incrementSignatureUsage,
  checkSignatureQuota,
  getSignatureHistory,
} from "@/lib/subscriptions/signature-tracking";
import { PLANS, type PlanSlug } from "@/lib/subscriptions/plans";

/**
 * GET - Obtenir l'usage des signatures
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Les locataires n'ont pas de quota de signatures
    if (profile.role === "tenant") {
      return NextResponse.json({
        signatures: {
          used: 0,
          limit: 0,
          remaining: 0,
          percentage: 0,
          canSign: false,
          isUnlimited: false,
          pricePerExtra: 0,
        },
        history: [],
      });
    }

    // Récupérer l'abonnement pour le plan
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_slug")
      .eq("owner_id", profile.id)
      .maybeSingle();

    const planSlug = (subscription?.plan_slug || 'gratuit') as PlanSlug;

    // Récupérer l'usage et le quota
    const [usage, quota, history] = await Promise.all([
      getSignatureUsageByOwner(profile.id),
      checkSignatureQuota(profile.id, planSlug),
      getSignatureHistory(profile.id, 6),
    ]);

    return NextResponse.json({
      signatures: {
        used: usage.signatures_used,
        limit: usage.signatures_limit,
        remaining: usage.signatures_remaining,
        percentage: usage.usage_percentage,
        canSign: usage.can_sign,
        isUnlimited: usage.signatures_limit === -1,
        pricePerExtra: quota.pricePerExtra,
        pricePerExtraFormatted: `${(quota.pricePerExtra / 100).toFixed(2)}€`,
        lastSignatureAt: usage.last_signature_at,
        periodMonth: usage.period_month,
      },
      history,
      plan: {
        slug: planSlug,
        name: PLANS[planSlug]?.name || 'Gratuit',
        monthlyQuota: PLANS[planSlug]?.limits.signatures_monthly_quota || 0,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Signatures GET]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST - Incrémenter l'usage des signatures
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if (profile.role === "tenant") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // Lire les données de la requête
    const body = await request.json();
    const { quantity = 1, metadata = {} } = body;

    // Incrémenter l'usage
    const result = await incrementSignatureUsage(profile.id, quantity, metadata);

    if (!result.success) {
      return NextResponse.json({
        error: result.error || "Impossible d'enregistrer la signature",
        wasInQuota: result.wasInQuota,
        quotaExceeded: !result.wasInQuota,
      }, { status: 400 });
    }

    // Récupérer l'usage mis à jour
    const updatedUsage = await getSignatureUsageByOwner(profile.id);

    return NextResponse.json({
      success: true,
      wasInQuota: result.wasInQuota,
      usage: {
        used: updatedUsage.signatures_used,
        limit: updatedUsage.signatures_limit,
        remaining: updatedUsage.signatures_remaining,
        canSign: updatedUsage.can_sign,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Signatures POST]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
