export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    // Requête pour récupérer les propriétaires (sans jointure properties)
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
        )
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

    const dataArray = (data || []) as any[];
    const profileIds = dataArray.map((p) => p.id);
    const userIds = dataArray.map((p) => p.user_id).filter(Boolean);

    // Récupérer les âges depuis la vue
    const { data: ages } = await supabase
      .from("v_person_age")
      .select("person_id, age_years")
      .in("person_id", profileIds.length > 0 ? profileIds : ["00000000-0000-0000-0000-000000000000"]);

    const agesArray = (ages || []) as any[];
    const ageMap = new Map(
      agesArray.map((a) => [a.person_id, a.age_years])
    );

    // Récupérer TOUTES les propriétés pour ces propriétaires (par profile.id OU user_id)
    const allOwnerIds = [...new Set([...profileIds, ...userIds])];
    const { data: allProperties } = await supabase
      .from("properties")
      .select("id, owner_id")
      .in("owner_id", allOwnerIds.length > 0 ? allOwnerIds : ["00000000-0000-0000-0000-000000000000"]);

    // Créer un map owner_id -> properties[]
    const propertiesByOwner = new Map<string, any[]>();
    if (allProperties) {
      allProperties.forEach((prop: any) => {
        const ownerId = prop.owner_id;
        if (!propertiesByOwner.has(ownerId)) {
          propertiesByOwner.set(ownerId, []);
        }
        propertiesByOwner.get(ownerId)!.push(prop);
      });
    }

    // Récupérer les property IDs pour les baux
    const propertyIds = allProperties?.map((p: any) => p.id).filter(Boolean) || [];

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

    // Récupérer les emails depuis auth.users via l'API admin
    // userIds est déjà défini plus haut
    const emailsMap = new Map<string, string>();
    if (userIds.length > 0) {
      try {
        // Récupérer tous les utilisateurs via l'API admin
        const { data: authUsersData } = await supabase.auth.admin.listUsers({
          perPage: 1000,
        });
        
        if (authUsersData?.users) {
          for (const authUser of authUsersData.users) {
            if (userIds.includes(authUser.id) && authUser.email) {
              emailsMap.set(authUser.id, authUser.email);
            }
          }
        }
      } catch (authErr) {
        console.error("Error fetching emails from auth.users:", authErr);
      }
    }

    // Compter les logements et baux actifs
    const items = dataArray.map((profile) => {
      const ownerProfile = Array.isArray(profile.owner_profiles) && profile.owner_profiles.length > 0 
        ? profile.owner_profiles[0] 
        : null;
      const name = `${profile.prenom || ""} ${profile.nom || ""}`.trim();
      
      // Récupérer les propriétés par profile.id OU par user_id
      const propertiesByProfileId = propertiesByOwner.get(profile.id) || [];
      const propertiesByUserId = profile.user_id ? (propertiesByOwner.get(profile.user_id) || []) : [];
      
      // Combiner (éviter les doublons si les deux retournent les mêmes propriétés)
      const propertyIdsSet = new Set<string>();
      const propertiesArray: any[] = [];
      [...propertiesByProfileId, ...propertiesByUserId].forEach((prop) => {
        if (!propertyIdsSet.has(prop.id)) {
          propertyIdsSet.add(prop.id);
          propertiesArray.push(prop);
        }
      });
      
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

