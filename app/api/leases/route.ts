import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";

/**
 * Configuration Vercel: maxDuration: 10s
 */
export const maxDuration = 10;

export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error.message, details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour lister les baux.",
        },
        { status: 500 }
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Récupérer le profil de l'utilisateur courant
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    const url = new URL(request.url);
    const propertyIdParam =
      url.searchParams.get("propertyId") ?? url.searchParams.get("property_id");
    const ownerIdParam =
      url.searchParams.get("ownerId") ?? url.searchParams.get("owner_id");
    const tenantIdParam =
      url.searchParams.get("tenantId") ?? url.searchParams.get("tenant_id");

    // Sécuriser les filtres explicites
    let ownerProfileId: string | null = null;
    if (ownerIdParam) {
      if (profileData.role !== "admin" && ownerIdParam !== profileData.id) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }
      ownerProfileId = ownerIdParam;
    } else if (profileData.role === "owner") {
      ownerProfileId = profileData.id;
    }

    let tenantProfileId: string | null = null;
    if (tenantIdParam) {
      if (profileData.role !== "admin" && tenantIdParam !== profileData.id) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }
      tenantProfileId = tenantIdParam;
    } else if (profileData.role === "tenant") {
      tenantProfileId = profileData.id;
    }

    let query = serviceClient
      .from("leases")
      .select("*")
      .order("created_at", { ascending: false });

    if (propertyIdParam) {
      // Si property_id est "new", retourner un tableau vide (pas encore de propriété créée)
      if (propertyIdParam === "new") {
        return NextResponse.json({ leases: [] });
      }
      query = query.eq("property_id", propertyIdParam);
    } else if (ownerProfileId) {
      // Optimisation : utiliser une sous-requête pour éviter deux requêtes séparées
      // Récupérer directement les baux des propriétés de l'owner
      const { data: ownerProperties, error: ownerPropertiesError } = await serviceClient
        .from("properties")
        .select("id")
        .eq("owner_id", ownerProfileId)
        .limit(100); // Limiter pour éviter les problèmes de performance

      if (ownerPropertiesError) {
        console.error("[GET /api/leases] Error fetching owner properties:", ownerPropertiesError);
        return NextResponse.json({ leases: [] });
      }

      const propertyIds = (ownerProperties || []).map((p: any) => p.id).filter(Boolean);
      if (propertyIds.length === 0) {
        return NextResponse.json({ leases: [] });
      }

      query = query.in("property_id", propertyIds);
    } else if (profileData.role !== "admin") {
      // Les rôles non-admin sans filtre explicite n'ont pas accès aux baux
      return NextResponse.json({ leases: [] });
    }

    if (tenantProfileId) {
      const { data: signers, error: signersError } = await serviceClient
        .from("lease_signers")
        .select("lease_id")
        .eq("profile_id", tenantProfileId)
        .in("role", ["locataire_principal", "colocataire"]);

      if (signersError) throw signersError;

      const leaseIds = (signers || []).map((s: any) => s.lease_id).filter(Boolean);
      if (leaseIds.length === 0) {
        return NextResponse.json({ leases: [] });
      }

      query = query.in("id", leaseIds);
    }

    const { data: leases, error: leasesError } = await query;
    if (leasesError) throw leasesError;

    // Ajouter des headers de cache pour réduire la charge CPU
    return NextResponse.json(
      { leases: leases || [] },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: any) {
    console.error("Error in GET /api/leases:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}





