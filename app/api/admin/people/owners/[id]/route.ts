export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/admin/people/owners/[id] - Détails d'un propriétaire (admin uniquement)
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    const ownerId = params.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        prenom,
        nom,
        telephone,
        user_id,
        created_at,
        owner_profiles(*)
      `
      )
      .eq("id", ownerId)
      .eq("role", "owner")
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Propriétaire introuvable", details: profileError?.message },
        { status: 404 }
      );
    }

    // Récupérer les propriétés séparément pour supporter les deux cas de owner_id
    let { data: properties } = await supabase
      .from("properties")
      .select("*")
      .eq("owner_id", ownerId);

    // Si aucune propriété trouvée, essayer avec user_id comme owner_id
    if ((!properties || properties.length === 0) && profile.user_id) {
      const { data: propertiesByUserId } = await supabase
        .from("properties")
        .select("*")
        .eq("owner_id", profile.user_id);
      
      if (propertiesByUserId && propertiesByUserId.length > 0) {
        console.log(`[GET /api/admin/people/owners/${ownerId}] Propriétés trouvées via user_id=${profile.user_id}`);
        properties = propertiesByUserId;
      }
    }

    // Récupérer l'email depuis auth.users via l'API admin
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
        console.error("Error fetching owner email:", err);
      }
    }

    const { data: age } = await supabase
      .from("v_person_age")
      .select("age_years")
      .eq("person_id", ownerId)
      .single();

    return NextResponse.json({
      ...profile,
      properties: properties || [],
      email,
      age_years: age?.age_years ?? null,
    });
  } catch (err: any) {
    console.error("Error in GET /api/admin/people/owners/[id]:", err);
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}
