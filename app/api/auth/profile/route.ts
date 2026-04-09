export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validations";

/**
 * GET /api/auth/profile — Récupérer le profil de l'utilisateur authentifié
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        "id, user_id, role, prenom, nom, email, telephone, avatar_url, date_naissance, lieu_naissance, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error: unknown) {
    console.error("Error in GET /api/auth/profile:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/auth/profile — Mettre à jour le profil de l'utilisateur authentifié
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = profileUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.errors
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join(", "),
        },
        { status: 400 }
      );
    }

    const { data: profile, error: updateError } = await supabase
      .from("profiles")
      .update(parsed.data)
      .eq("user_id", user.id)
      .select(
        "id, user_id, role, prenom, nom, email, telephone, avatar_url, date_naissance, lieu_naissance, updated_at"
      )
      .single();

    if (updateError || !profile) {
      return NextResponse.json(
        { error: updateError?.message || "Erreur lors de la mise à jour" },
        { status: 500 }
      );
    }

    return NextResponse.json(profile);
  } catch (error: unknown) {
    console.error("Error in PATCH /api/auth/profile:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
