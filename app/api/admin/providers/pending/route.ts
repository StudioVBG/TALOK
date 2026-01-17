export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/admin/providers/pending - Liste des prestataires en attente de validation
 */
export async function GET(request: Request) {
  try {
    console.log("GET /api/admin/providers/pending - Début de la requête");
    const cookieHeader = request.headers.get("cookie");
    console.log("Cookies reçus:", cookieHeader ? "présents" : "absents");
    
    const { error, user, supabase } = await requireAdmin(request);

    if (error) {
      console.error("requireAdmin returned error:", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
        { status: error.status }
      );
    }

    if (!user || !supabase) {
      console.error("No user or supabase returned from requireAdmin");
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    console.log("Admin authentifié:", user.email);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status") || "pending"; // pending, approved, rejected, all
    const offset = (page - 1) * limit;

    // Construire la requête - utiliser une approche en deux étapes pour éviter les problèmes RLS
    let query = supabase
      .from("provider_profiles")
      .select(
        `
        profile_id,
        type_services,
        certifications,
        zones_intervention,
        status,
        validated_at,
        validated_by,
        rejection_reason,
        created_at
      `,
        { count: "exact" }
      )
      .range(offset, offset + limit - 1);

    // Filtrer par statut
    if (status !== "all") {
      query = query.eq("status", status as any);
    }

    const { data: providersData, error: queryError, count } = await query;

    if (queryError) {
      console.error("Error fetching pending providers:", queryError);
      console.error("Query error details:", JSON.stringify(queryError, null, 2));
      return NextResponse.json(
        { error: queryError.message || "Erreur serveur", details: queryError },
        { status: 500 }
      );
    }

    console.log(`Found ${providersData?.length || 0} provider profiles with status '${status}'`);

    const providersArray = (providersData || []) as any[];
    
    // Récupérer les profils séparément
    const profileIds = providersArray.map((p) => p.profile_id).filter(Boolean);
    
    let profilesMap = new Map<string, any>();
    if (profileIds.length > 0) {
      let profilesQuery = supabase
        .from("profiles")
        .select("id, prenom, nom, telephone, user_id, created_at")
        .in("id", profileIds as any);

      // Appliquer le filtre de recherche si nécessaire
      if (search) {
        profilesQuery = profilesQuery.or(
          `prenom.ilike.%${search}%,nom.ilike.%${search}%`
        );
      }

      const { data: profilesData, error: profilesError } = await profilesQuery;

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        // Continuer même en cas d'erreur partielle
      } else {
        // Récupérer les emails depuis auth.users
        const userIds = (profilesData || []).map((p: any) => p.user_id).filter(Boolean);
        const emailsMap = new Map<string, string>();
        
        if (userIds.length > 0) {
          const { createClient } = await import("@supabase/supabase-js");
          const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
              auth: {
                autoRefreshToken: false,
                persistSession: false,
              },
            }
          );
          
          const { data: { users } } = await adminClient.auth.admin.listUsers();
          users.forEach((u) => {
            if (u.email) {
              emailsMap.set(u.id, u.email);
            }
          });
        }

        (profilesData || []).forEach((profile: any) => {
          profilesMap.set(profile.id, {
            ...profile,
            email: emailsMap.get(profile.user_id) || undefined,
          });
        });
      }
    }

    // Formater les résultats
    const items = providersArray
      .map((provider) => {
        const profile = profilesMap.get(provider.profile_id) || {};
        const name = `${profile.prenom || ""} ${profile.nom || ""}`.trim();

        // Filtrer par recherche si nécessaire (côté serveur après récupération)
        if (search && name && !name.toLowerCase().includes(search.toLowerCase())) {
          return null;
        }

        return {
          id: provider.profile_id,
          profile_id: provider.profile_id,
          name: name || "Sans nom",
          email: profile.email || undefined,
          phone: profile.telephone || undefined,
          type_services: provider.type_services || [],
          certifications: provider.certifications || undefined,
          zones_intervention: provider.zones_intervention || undefined,
          status: provider.status,
          validated_at: provider.validated_at || undefined,
          validated_by: provider.validated_by || undefined,
          rejection_reason: provider.rejection_reason || undefined,
          created_at: provider.created_at || profile.created_at,
        };
      })
      .filter(Boolean) as any[];

    // Ajuster le total si on a filtré par recherche
    const finalTotal = search ? items.length : (count || 0);

    return NextResponse.json({
      items,
      total: finalTotal,
    });
  } catch (error: unknown) {
    console.error("Error in GET /api/admin/providers/pending:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

