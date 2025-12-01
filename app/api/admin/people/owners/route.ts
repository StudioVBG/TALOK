// @ts-nocheck
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/admin/people/owners - Liste des propriétaires
 */
export async function GET(request: Request) {
  try {
    const { error, user, supabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error.message, details: (error as any).details },
        { status: error.status }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Requête pour récupérer les propriétaires
    let query = supabase
      .from("profiles")
      .select(
        `
        id,
        prenom,
        nom,
        user_id,
        owner_profiles(
          type,
          siret,
          tva
        ),
        properties(id)
      `,
        { count: "exact" }
      )
      .eq("role", "owner")
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `prenom.ilike.%${search}%,nom.ilike.%${search}%`
      );
    }

    const { data, error: queryError, count } = await query;

    if (queryError) {
      console.error("Error fetching owners:", queryError);
      return NextResponse.json(
        { error: queryError.message || "Erreur serveur" },
        { status: 500 }
      );
    }

    // Récupérer les âges depuis la vue
    const dataArray = (data || []) as any[];
    const profileIds = dataArray.map((p) => p.id);
    const { data: ages } = await supabase
      .from("v_person_age")
      .select("person_id, age_years")
      .in("person_id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"]);

    const agesArray = (ages || []) as any[];
    const ageMap = new Map(
      agesArray.map((a) => [a.person_id, a.age_years])
    );

    // Récupérer les property IDs
    const propertyIds = dataArray
      .flatMap((p) => (Array.isArray(p.properties) ? p.properties : []))
      .map((prop: any) => prop.id)
      .filter(Boolean);

    // Récupérer les leases séparément pour éviter la récursion RLS
    let leasesMap = new Map<string, any[]>();
    if (propertyIds.length > 0) {
      const { data: leases } = await supabase
        .from("leases")
        .select("id, property_id, statut")
        .in("property_id", propertyIds);

      if (leases) {
        leases.forEach((lease: any) => {
          const propId = lease.property_id;
          if (!leasesMap.has(propId)) {
            leasesMap.set(propId, []);
          }
          leasesMap.get(propId)!.push(lease);
        });
      }
    }

    // Récupérer les emails depuis auth.users
    const userIds = dataArray.map((p) => p.user_id).filter(Boolean);
    const emailsMap = new Map<string, string>();
    if (userIds.length > 0) {
      // Note: On ne peut pas directement accéder à auth.users via Supabase client
      // Les emails seront récupérés côté client si nécessaire
    }

    // Compter les logements et baux actifs
    const items = dataArray.map((profile) => {
      const ownerProfile = Array.isArray(profile.owner_profiles) && profile.owner_profiles.length > 0 
        ? profile.owner_profiles[0] 
        : null;
      const name = `${profile.prenom || ""} ${profile.nom || ""}`.trim();
      const propertiesArray = Array.isArray(profile.properties) ? profile.properties : [];
      const unitsCount = propertiesArray.length;
      
      // Compter les baux actifs depuis la map
      const activeLeases = propertiesArray.reduce((count: number, property: any) => {
        const propertyLeases = leasesMap.get(property.id) || [];
        return count + propertyLeases.filter((l: any) =>
          ["active", "pending_signature"].includes(l.statut)
        ).length;
      }, 0);

      return {
        id: profile.id,
        name: name || "Sans nom",
        type: ownerProfile?.type || "particulier",
        email: emailsMap.get(profile.user_id) || undefined,
        units_count: unitsCount,
        active_leases: activeLeases,
        age_years: ageMap.get(profile.id) ?? null,
      };
    });

    return NextResponse.json({
      items,
      total: count || 0,
    });
  } catch (error: any) {
    console.error("Error in GET /api/admin/people/owners:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

