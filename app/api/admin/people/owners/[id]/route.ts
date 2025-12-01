// @ts-nocheck
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
        created_at,
        owner_profiles(*),
        properties(*)
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

    const { data: age } = await supabase
      .from("v_person_age")
      .select("age_years")
      .eq("person_id", ownerId)
      .single();

    return NextResponse.json({
      ...profile,
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
