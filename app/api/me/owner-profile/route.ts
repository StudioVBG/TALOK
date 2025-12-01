// @ts-nocheck
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { ownerProfileSchema } from "@/lib/validations";
import type { OwnerType } from "@/lib/types";

/**
 * GET /api/me/owner-profile - Récupérer le profil propriétaire
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Utiliser le service role pour éviter les problèmes RLS
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Récupérer le profil de base
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if (profile.role !== "owner") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Récupérer le profil propriétaire
    const { data: ownerProfile, error: ownerError } = await supabase
      .from("owner_profiles")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (ownerError) {
      console.error("[GET /api/me/owner-profile] Error:", ownerError);
    }

    return NextResponse.json(ownerProfile || null);
  } catch (error: unknown) {
    console.error("Error in GET /api/me/owner-profile:", error);
    return handleApiError(error);
  }
}

/**
 * PUT /api/me/owner-profile - Créer ou mettre à jour le profil propriétaire
 */
export async function PUT(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Utiliser le service role pour éviter les problèmes RLS
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Récupérer le profil de base
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if (profile.role !== "owner") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    console.log("[PUT /api/me/owner-profile] Body reçu:", body);

    // Valider les données
    const validated = ownerProfileSchema.parse(body);
    console.log("[PUT /api/me/owner-profile] Validé:", validated);

    // Vérifier si le profil propriétaire existe
    const { data: existing } = await supabase
      .from("owner_profiles")
      .select("id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    let ownerProfile;

    if (existing) {
      // Mettre à jour
      const { data, error: updateError } = await supabase
        .from("owner_profiles")
        .update(validated)
        .eq("profile_id", profile.id)
        .select()
        .single();

      if (updateError) {
        console.error("[PUT /api/me/owner-profile] Update error:", updateError);
        throw new Error(updateError.message);
      }
      ownerProfile = data;
      console.log("[PUT /api/me/owner-profile] Profil mis à jour:", ownerProfile);
    } else {
      // Créer
      const { data, error: insertError } = await supabase
        .from("owner_profiles")
        .insert({
          profile_id: profile.id,
          ...validated,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[PUT /api/me/owner-profile] Insert error:", insertError);
        throw new Error(insertError.message);
      }
      ownerProfile = data;
      console.log("[PUT /api/me/owner-profile] Profil créé:", ownerProfile);
    }

    return NextResponse.json(ownerProfile);
  } catch (error: unknown) {
    console.error("Error in PUT /api/me/owner-profile:", error);
    return handleApiError(error);
  }
}

