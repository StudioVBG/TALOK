export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/admin/people/tenants - Liste des locataires
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
    const status = searchParams.get("status") || "all";
    const offset = (page - 1) * limit;

    // Requête simplifiée pour éviter la récursion RLS
    let query = supabase
      .from("profiles")
      .select(
        `
        id,
        prenom,
        nom,
        telephone,
        user_id,
        tenant_profiles(*),
        lease_signers(
          lease_id,
          role
        )
      `,
        { count: "exact" }
      )
      .eq("role", "tenant")
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `prenom.ilike.%${search}%,nom.ilike.%${search}%`
      );
    }

    const { data, error: queryError, count } = await query;

    if (queryError) {
      console.error("Error fetching tenants:", queryError);
      return NextResponse.json(
        { error: queryError.message || "Erreur serveur" },
        { status: 500 }
      );
    }

    // Récupérer les âges
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

    // Récupérer les informations des baux
    const leaseIds = dataArray
      .flatMap((p) => (Array.isArray(p.lease_signers) ? p.lease_signers : []))
      .map((ls: any) => ls.lease_id)
      .filter(Boolean);

    const leasesMap = new Map<string, any>();
    if (leaseIds.length > 0) {
      const { data: leases } = await supabase
        .from("leases")
        .select(`
          id,
          property_id,
          statut,
          properties!inner(
            id,
            adresse_complete
          )
        `)
        .in("id", leaseIds);

      if (leases) {
        leases.forEach((lease: any) => {
          leasesMap.set(lease.id, lease);
        });
      }
    }

    // Récupérer les emails depuis auth.users via l'API admin
    const userIds = dataArray.map((p) => p.user_id).filter(Boolean);
    const emailsMap = new Map<string, string>();
    if (userIds.length > 0) {
      try {
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

    // Construire les items
    const items = dataArray.map((profile) => {
      const tenantProfile = Array.isArray(profile.tenant_profiles) && profile.tenant_profiles.length > 0
        ? profile.tenant_profiles[0]
        : null;
      const fullName = `${profile.prenom || ""} ${profile.nom || ""}`.trim();
      
      // Trouver le bail actif
      const leaseSigners = Array.isArray(profile.lease_signers) ? profile.lease_signers : [];
      const activeLeaseSigner = leaseSigners.find((ls: any) => {
        const lease = leasesMap.get(ls.lease_id);
        return lease && ["active", "pending_signature"].includes(lease.statut);
      });
      
      const activeLease = activeLeaseSigner ? leasesMap.get(activeLeaseSigner.lease_id) : null;
      const property = activeLease?.properties?.[0] || activeLease?.properties;

      return {
        id: profile.id,
        profile_id: profile.id,
        full_name: fullName || "Sans nom",
        email: emailsMap.get(profile.user_id) || undefined,
        phone: profile.telephone || undefined,
        age_years: ageMap.get(profile.id) ?? null,
        property_id: property?.id || undefined,
        property_address: property?.adresse_complete || undefined,
        lease_id: activeLease?.id || undefined,
        lease_status: activeLease?.statut || undefined,
      };
    });

    // Filtrer par statut si nécessaire
    const filteredItems = status === "active"
      ? items.filter((item) => item.lease_status === "active")
      : items;

    return NextResponse.json({
      items: filteredItems,
      total: count || 0,
    });
  } catch (error: any) {
    console.error("Error in GET /api/admin/people/tenants:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

