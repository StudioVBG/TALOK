export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/admin/people/vendors - Liste des prestataires
 */
export async function GET(request: Request) {
  try {
    const { error, user, supabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
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

    let query = supabase
      .from("profiles")
      .select(
        `
        id,
        prenom,
        nom,
        telephone,
        user_id,
        provider_profiles(*)
      `,
        { count: "exact" }
      )
      .eq("role", "provider")
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `prenom.ilike.%${search}%,nom.ilike.%${search}%`
      );
    }

    const { data, error: queryError, count } = await query;

    if (queryError) {
      console.error("Error fetching vendors:", queryError);
      return NextResponse.json(
        { error: queryError.message || "Erreur serveur" },
        { status: 500 }
      );
    }

    const dataArray = (data || []) as any[];
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
        console.error("Error fetching vendor emails from auth:", authErr);
      }
    }

    const items = dataArray.map((profile) => {
      const providerProfile =
        Array.isArray(profile.provider_profiles) && profile.provider_profiles.length > 0
          ? profile.provider_profiles[0]
          : null;
      const name = `${profile.prenom || ""} ${profile.nom || ""}`.trim();
      const email = profile.user_id ? emailsMap.get(profile.user_id) : undefined;

      return {
        id: profile.id,
        profile_id: profile.id,
        name: name || "Sans nom",
        email,
        phone: profile.telephone || undefined,
        type_services: providerProfile?.type_services || [],
        zones_intervention: providerProfile?.zones_intervention || undefined,
      };
    });

    return NextResponse.json({
      items,
      total: count || 0,
    });
  } catch (error: unknown) {
    console.error("Error in GET /api/admin/people/vendors:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

