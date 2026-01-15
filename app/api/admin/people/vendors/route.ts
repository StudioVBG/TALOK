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

    const items = await Promise.all(
      dataArray.map(async (profile) => {
        const providerProfile =
          Array.isArray(profile.provider_profiles) && profile.provider_profiles.length > 0
            ? profile.provider_profiles[0]
            : null;
        const name = `${profile.prenom || ""} ${profile.nom || ""}`.trim();

        let email: string | undefined;
        if (profile.user_id) {
          try {
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
              profile.user_id
            );
            if (!userError && userData?.user) {
              email = userData.user.email ?? undefined;
            }
          } catch (err) {
            console.error("Error fetching vendor email:", err);
          }
        }

        return {
          id: profile.id,
          profile_id: profile.id,
          name: name || "Sans nom",
          email,
          phone: profile.telephone || undefined,
          type_services: providerProfile?.type_services || [],
          zones_intervention: providerProfile?.zones_intervention || undefined,
        };
      })
    );

    return NextResponse.json({
      items,
      total: count || 0,
    });
  } catch (error: any) {
    console.error("Error in GET /api/admin/people/vendors:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

