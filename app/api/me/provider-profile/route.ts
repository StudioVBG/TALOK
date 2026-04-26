export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { providerSettingsSchema } from "@/lib/validations";

function serviceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * GET /api/me/provider-profile - Récupérer le profil prestataire
 */
export async function GET(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabase = serviceClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if (profile.role !== "provider") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const { data: providerProfile, error: providerError } = await supabase
      .from("provider_profiles")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (providerError) {
      console.error("[GET /api/me/provider-profile] Error:", providerError);
    }

    return NextResponse.json(providerProfile || null);
  } catch (error: unknown) {
    console.error("Error in GET /api/me/provider-profile:", error);
    return handleApiError(error);
  }
}

/**
 * PUT /api/me/provider-profile - Créer ou mettre à jour le profil prestataire
 */
export async function PUT(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabase = serviceClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if (profile.role !== "provider") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const validated = providerSettingsSchema.parse(body);

    // Normaliser : transformer les chaînes vides en null pour les colonnes scalaires
    const payload: Record<string, unknown> = {};
    if (validated.raison_sociale !== undefined)
      payload.raison_sociale = validated.raison_sociale === "" ? null : validated.raison_sociale;
    if (validated.siret !== undefined)
      payload.siret = validated.siret === "" ? null : validated.siret;
    if (validated.adresse !== undefined)
      payload.adresse = validated.adresse === "" ? null : validated.adresse;
    if (validated.bio !== undefined)
      payload.bio = validated.bio === "" ? null : validated.bio;
    if (validated.zones_intervention !== undefined)
      payload.zones_intervention = validated.zones_intervention === "" ? null : validated.zones_intervention;
    if (validated.type_services !== undefined)
      payload.type_services = validated.type_services;

    const { data: existing } = await supabase
      .from("provider_profiles")
      .select("profile_id")
      .eq("profile_id", profile.id)
      .maybeSingle();

    let providerProfile;

    if (existing) {
      const { data, error: updateError } = await supabase
        .from("provider_profiles")
        .update(payload)
        .eq("profile_id", profile.id)
        .select()
        .single();

      if (updateError) {
        console.error("[PUT /api/me/provider-profile] Update error:", JSON.stringify(updateError, null, 2));
        throw new Error(updateError.message);
      }
      providerProfile = data;
    } else {
      const { data, error: insertError } = await supabase
        .from("provider_profiles")
        .insert({
          profile_id: profile.id,
          type_services: validated.type_services ?? [],
          ...payload,
        })
        .select()
        .single();

      if (insertError) {
        console.error("[PUT /api/me/provider-profile] Insert error:", JSON.stringify(insertError, null, 2));
        throw new Error(insertError.message);
      }
      providerProfile = data;
    }

    return NextResponse.json(providerProfile);
  } catch (error: unknown) {
    console.error("Error in PUT /api/me/provider-profile:", error);
    return handleApiError(error);
  }
}
