export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/admin/people/vendors/[id] - Détails d'un prestataire (admin uniquement)
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const vendorId = id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(
        `
        id,
        prenom,
        nom,
        telephone,
        avatar_url,
        user_id,
        created_at,
        provider_profiles(
          status,
          validated_at,
          validated_by,
          rejection_reason,
          type_services,
          certifications,
          zones_intervention
        )
      `
      )
      .eq("id", vendorId)
      .eq("role", "provider")
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching vendor profile:", profileError);
      return NextResponse.json(
        { error: profileError.message || "Erreur lors de la récupération du prestataire" },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json({ error: "Prestataire introuvable" }, { status: 404 });
    }

    let email: string | undefined;
    if (profile.user_id) {
      try {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.user_id);
        if (!userError && userData?.user) {
          email = userData.user.email ?? undefined;
        }
      } catch (err) {
        console.error("Error fetching vendor email:", err);
      }
    }

    const providerProfile = Array.isArray(profile.provider_profiles) && profile.provider_profiles.length > 0
      ? profile.provider_profiles[0]
      : profile.provider_profiles || null;

    return NextResponse.json({
      id: profile.id,
      full_name: `${profile.prenom || ""} ${profile.nom || ""}`.trim() || "Sans nom",
      prenom: profile.prenom,
      nom: profile.nom,
      email,
      telephone: profile.telephone,
      avatar_url: profile.avatar_url,
      created_at: profile.created_at,
      profile: providerProfile
        ? {
            status: providerProfile.status,
            validated_at: providerProfile.validated_at,
            validated_by: providerProfile.validated_by,
            rejection_reason: providerProfile.rejection_reason,
            type_services: providerProfile.type_services || [],
            certifications: providerProfile.certifications,
            zones_intervention: providerProfile.zones_intervention,
          }
        : null,
    });
  } catch (error: unknown) {
    console.error("Error in GET /api/admin/people/vendors/[id]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}





