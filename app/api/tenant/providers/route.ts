export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import {
  TENANT_BOOKABLE_CATEGORIES,
  checkTenantBookingPermission,
  type TenantBookableCategory,
} from "@/lib/tickets/tenant-service-permissions";

/**
 * GET /api/tenant/providers?category=jardinage
 *
 * Liste les prestataires marketplace disponibles pour une catégorie donnée,
 * à condition que le locataire soit autorisé par son bail à la réserver.
 */
export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status || 401 }
      );
    }
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    if (!category) {
      return NextResponse.json(
        { error: "category requis", code: "MISSING_CATEGORY" },
        { status: 400 }
      );
    }
    if (!(TENANT_BOOKABLE_CATEGORIES as readonly string[]).includes(category)) {
      return NextResponse.json(
        { error: "Catégorie non réservable", code: "INVALID_CATEGORY" },
        { status: 400 }
      );
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "Profil non trouvé", code: "NO_PROFILE" },
        { status: 404 }
      );
    }

    const profileData = profile as { id: string; email: string | null };

    const decision = await checkTenantBookingPermission({
      serviceClient,
      profileId: profileData.id,
      userEmail: profileData.email ?? user.email ?? null,
      category,
    });

    if (!decision.allowed) {
      return NextResponse.json(
        { error: decision.message, code: decision.code },
        { status: decision.status }
      );
    }

    // Filtrer par département de la propriété si disponible (rayon = service_radius_km)
    const { data: property } = await serviceClient
      .from("properties")
      .select("departement")
      .eq("id", decision.property_id)
      .maybeSingle();

    const department = (property as { departement: string | null } | null)?.departement ?? null;

    let query = serviceClient
      .from("providers")
      .select(
        "id, profile_id, company_name, contact_name, city, postal_code, department, avg_rating, total_reviews, total_interventions, is_verified, trade_categories"
      )
      .eq("status", "active")
      .eq("is_marketplace", true)
      .contains("trade_categories", [category])
      .order("avg_rating", { ascending: false, nullsFirst: false })
      .limit(30);

    if (department) {
      query = query.eq("department", department);
    }

    const { data: providers, error } = await query;
    if (error) {
      console.error("[GET /api/tenant/providers] Supabase error:", error.message);
      return NextResponse.json(
        { error: "Erreur lors de la recherche des prestataires" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      category: category as TenantBookableCategory,
      requires_owner_approval: decision.permissions.requires_owner_approval,
      max_amount_cents: decision.permissions.max_amount_cents,
      providers: providers ?? [],
    });
  } catch (error: unknown) {
    console.error("[GET /api/tenant/providers] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
