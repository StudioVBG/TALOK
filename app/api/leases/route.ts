// @ts-nocheck
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

/**
 * POST /api/leases - Créer un nouveau bail
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error.message },
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
        { error: "Configuration manquante" },
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

    // Seuls les propriétaires et admins peuvent créer des baux
    if (profileData.role !== "owner" && profileData.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    
    // Validation des champs requis
    if (!body.property_id) {
      return NextResponse.json({ error: "property_id est requis" }, { status: 400 });
    }
    if (!body.loyer || body.loyer <= 0) {
      return NextResponse.json({ error: "loyer est requis et doit être positif" }, { status: 400 });
    }
    if (!body.date_debut) {
      return NextResponse.json({ error: "date_debut est requise" }, { status: 400 });
    }

    // Vérifier que le bien appartient au propriétaire (sauf admin)
    if (profileData.role !== "admin") {
      const { data: property, error: propertyError } = await serviceClient
        .from("properties")
        .select("id, owner_id")
        .eq("id", body.property_id)
        .single();

      if (propertyError || !property) {
        return NextResponse.json({ error: "Bien non trouvé" }, { status: 404 });
      }

      if ((property as any).owner_id !== profileData.id) {
        return NextResponse.json({ error: "Vous n'êtes pas propriétaire de ce bien" }, { status: 403 });
      }
    }

    // Créer le bail (attention: colonne = depot_de_garantie dans la BDD)
    const leaseData = {
      property_id: body.property_id,
      type_bail: body.type_bail || "meuble",
      loyer: parseFloat(body.loyer),
      charges_forfaitaires: body.charges_forfaitaires ? parseFloat(body.charges_forfaitaires) : 0,
      depot_de_garantie: body.depot_garantie ? parseFloat(body.depot_garantie) : parseFloat(body.loyer),
      date_debut: body.date_debut,
      date_fin: body.date_fin || null,
      statut: body.statut || "draft",
    };

    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .insert(leaseData)
      .select()
      .single();

    if (leaseError) {
      console.error("[POST /api/leases] Error creating lease:", leaseError);
      return NextResponse.json(
        { error: leaseError.message || "Erreur lors de la création du bail" },
        { status: 500 }
      );
    }

    // Si un email de locataire est fourni, on pourrait créer une invitation ici
    // Pour l'instant, on retourne juste le bail créé

    console.log("[POST /api/leases] Bail créé:", lease);

    return NextResponse.json(lease, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/leases:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

