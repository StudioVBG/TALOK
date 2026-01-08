export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * GET /api/subscriptions/usage
 * Récupère l'usage actuel de l'utilisateur
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { PLANS, type PlanSlug, getUsagePercentage } from "@/lib/subscriptions/plans";

export async function GET() {
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

    // Récupérer l'abonnement via owner_id (schéma existant)
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("owner_id", profile.id)
      .maybeSingle();

    const planSlug = (subscription?.plan_slug || 'starter') as PlanSlug;
    const limits = PLANS[planSlug]?.limits || PLANS.starter.limits;

    // Compter les propriétés
    const { count: propertiesCount } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id);

    // Compter les baux actifs via les propriétés du propriétaire
    let leasesCount = 0;
    if (propertiesCount && propertiesCount > 0) {
      // D'abord récupérer les IDs des propriétés
      const { data: properties } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", profile.id);
      
      if (properties && properties.length > 0) {
        const propertyIds = properties.map(p => p.id);
        const { count } = await supabase
          .from("leases")
          .select("id", { count: "exact", head: true })
          .in("property_id", propertyIds)
          .in("statut", ["active", "pending_signature"]);
        leasesCount = count || 0;
      }
    }

    // Compter les utilisateurs (pour multi-users)
    const usersCount = 1;

    // Récupérer l'usage mensuel (signatures) - avec gestion d'erreur si table n'existe pas
    let signaturesUsed = 0;
    let storageUsed = 0;
    
    try {
      const periodStart = new Date();
      periodStart.setDate(1);
      periodStart.setHours(0, 0, 0, 0);

      const { data: usageRecord } = await supabase
        .from("subscription_usage")
        .select("signatures_used_this_month, storage_used_bytes")
        .eq("user_id", user.id)
        .gte("period_start", periodStart.toISOString())
        .maybeSingle();

      signaturesUsed = usageRecord?.signatures_used_this_month || 0;
      storageUsed = usageRecord?.storage_used_bytes || 0;
    } catch {
      // Table subscription_usage n'existe peut-être pas encore
      console.warn("[Usage] subscription_usage table not found");
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
        limit: limits.signatures_monthly_quota,
        percentage: getUsagePercentage(signaturesUsed, limits.signatures_monthly_quota),
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

