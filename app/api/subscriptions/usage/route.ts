export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * GET /api/subscriptions/usage
 * Récupère l'usage actuel de l'utilisateur
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { PLANS, type PlanSlug, getUsagePercentage } from "@/lib/subscriptions/plans";
import { getSignatureUsageByOwner } from "@/lib/subscriptions/signature-tracking";
import { getLiveOwnerUsage } from "@/lib/subscriptions/market-standard";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil via service role (évite la récursion RLS 42P17 sur profiles)
    const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
    const adminClient = supabaseAdmin();
    let profile: { id: string; role: string } | null = null;
    const { data: profileData } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    profile = profileData;

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // 🔧 FIX: Pour les locataires, on renvoie un usage vide au lieu de 500
    if (profile.role === "tenant") {
      return NextResponse.json({ 
        usage: {
          properties: { used: 0, limit: 0, percentage: 0 },
          leases: { used: 0, limit: 0, percentage: 0 },
          users: { used: 1, limit: 1, percentage: 100 },
          signatures: { used: 0, limit: 0, percentage: 0 },
          storage: { used: 0, limit: 0, percentage: 0, unit: "Mo" },
        },
        plan_slug: "tenant",
        limits: {},
      });
    }

    // Récupérer l'abonnement via owner_id (service role pour éviter récursion RLS)
    const { data: subscription } = await adminClient
      .from("subscriptions")
      .select("*")
      .eq("owner_id", profile.id)
      .maybeSingle();

    // Résoudre plan_slug : priorité plan_slug, fallback plan_id, puis "gratuit"
    let planSlug: PlanSlug = (subscription?.plan_slug as PlanSlug) || 'gratuit';
    if (planSlug === 'gratuit' && subscription?.plan_id) {
      const { data: planData } = await adminClient
        .from("subscription_plans")
        .select("slug")
        .eq("id", subscription.plan_id)
        .maybeSingle();
      if (planData?.slug) {
        planSlug = planData.slug as PlanSlug;
      }
    }
    const limits = PLANS[planSlug]?.limits || PLANS.gratuit.limits;

    const liveUsage = await getLiveOwnerUsage(supabase as any, profile.id);
    const propertiesCount = liveUsage.properties;
    const leasesCount = liveUsage.leases;

    // Compter les utilisateurs (pour multi-users)
    const usersCount = 1;

    // Récupérer l'usage des signatures via le nouveau service de tracking
    let signaturesUsed = 0;
    let signaturesLimit = limits.signatures_monthly_quota;
    let storageUsed = 0;

    try {
      const sigUsage = await getSignatureUsageByOwner(profile.id);
      signaturesUsed = sigUsage.signatures_used;
      signaturesLimit = sigUsage.signatures_limit;
    } catch (err) {
      console.warn("[Usage] Error fetching signature usage:", err);
    }

    // Récupérer le stockage utilisé depuis subscriptions
    if (subscription?.documents_size_mb) {
      storageUsed = subscription.documents_size_mb * 1024 * 1024; // Convertir MB en bytes
    }

    // Construire le résumé d'usage
    const usage = {
      properties: {
        used: propertiesCount || 0,
        limit: limits.max_properties,
        percentage: getUsagePercentage(propertiesCount || 0, limits.max_properties),
      },
      leases: {
        used: leasesCount,
        limit: limits.max_leases,
        percentage: getUsagePercentage(leasesCount, limits.max_leases),
      },
      users: {
        used: usersCount,
        limit: limits.max_users,
        percentage: getUsagePercentage(usersCount, limits.max_users),
      },
      signatures: {
        used: signaturesUsed,
        limit: signaturesLimit,
        percentage: getUsagePercentage(signaturesUsed, signaturesLimit),
      },
      storage: {
        used: Math.round(storageUsed / (1024 * 1024)), // MB
        limit: limits.max_documents_gb * 1024, // MB
        percentage: getUsagePercentage(storageUsed / (1024 * 1024), limits.max_documents_gb * 1024),
        unit: "Mo",
      },
    };

    return NextResponse.json({ 
      usage,
      plan_slug: planSlug,
      limits,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur serveur";
    console.error("[Usage GET]", error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

