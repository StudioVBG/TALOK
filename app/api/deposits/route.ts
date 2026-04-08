export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/deposits — Liste des dépôts de garantie
 *
 * Query params:
 *   - lease_id: filtrer par bail
 *   - status: filtrer par statut (pending|received|partially_returned|returned|disputed)
 *   - page / limit: pagination
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const serviceClient = getServiceClient();

    // Récupérer le profil
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;
    const url = new URL(request.url);
    const leaseId = url.searchParams.get("lease_id");
    const status = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
    const offset = (page - 1) * limit;

    // Construire la requête avec jointures
    let query = serviceClient
      .from("security_deposits")
      .select(
        `
        *,
        lease:leases!inner(
          id,
          type_bail,
          date_debut,
          date_fin,
          loyer,
          statut,
          property:properties!inner(
            id,
            adresse_complete,
            owner_id
          )
        ),
        tenant:profiles!security_deposits_tenant_id_fkey(
          id,
          prenom,
          nom,
          email
        )
      `,
        { count: "exact" }
      );

    // Filtrer selon le rôle
    if (profileData.role === "owner") {
      query = query.eq("lease.property.owner_id", profileData.id);
    } else if (profileData.role === "tenant") {
      query = query.eq("tenant_id", profileData.id);
    } else if (profileData.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Filtres optionnels
    if (leaseId) {
      query = query.eq("lease_id", leaseId);
    }
    if (status) {
      query = query.eq("status", status);
    }

    // Pagination et tri
    const { data: deposits, error: queryError, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) {
      console.error("[GET /api/deposits] Query error:", queryError);
      throw queryError;
    }

    return NextResponse.json({
      deposits: deposits || [],
      pagination: {
        page,
        limit,
        total: count || 0,
      },
    });
  } catch (error: unknown) {
    console.error("[GET /api/deposits] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
