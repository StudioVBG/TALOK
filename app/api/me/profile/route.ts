export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { profileUpdateSchema } from "@/lib/validations";
import type { ProfileUpdate } from "@/lib/supabase/typed-client";

/**
 * GET /api/me/profile - Récupérer le profil de l'utilisateur connecté
 */
export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Utiliser le service role pour éviter les problèmes RLS
    const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
    const serviceClient = supabaseAdmin();

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error: unknown) {
    console.error("Error in GET /api/me/profile:", error);
    return handleApiError(error);
  }
}

/**
 * POST /api/me/profile - Auto-créer un profil manquant (quand le trigger handle_new_user n'a pas fonctionné)
 * Sécurisé : seul l'utilisateur authentifié peut créer son propre profil.
 */
export async function POST(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error || !user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
    const serviceClient = supabaseAdmin();

    // Vérifier que le profil n'existe pas déjà (double sécurité)
    const { data: existing } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      // Le profil existe déjà — retourner le profil complet
      const { data: fullProfile } = await serviceClient
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      return NextResponse.json(fullProfile);
    }

    // Lire le rôle et les metadata de l'utilisateur
    const metadata = user.user_metadata || {};
    const role = metadata.role && ["admin", "owner", "tenant", "provider"].includes(metadata.role)
      ? metadata.role
      : "tenant";

    // Créer le profil manquant via service role (bypass RLS)
    const { data: newProfile, error: insertError } = await serviceClient
      .from("profiles")
      .insert({
        user_id: user.id,
        role,
        email: user.email,
        prenom: metadata.prenom || null,
        nom: metadata.nom || null,
        telephone: metadata.telephone || null,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[POST /api/me/profile] Erreur création profil:", insertError);
      return NextResponse.json(
        { error: "Impossible de créer le profil: " + insertError.message },
        { status: 500 }
      );
    }

    console.log("[POST /api/me/profile] Profil auto-créé pour user_id:", user.id, "role:", role);

    // ✅ AUTO-LINK: Lier les lease_signers orphelins (invited_email match, profile_id NULL)
    // Couvre le cas où le locataire a été invité avant de créer son compte
    if (user.email && newProfile) {
      try {
        const { data: orphanSigners, error: orphanError } = await serviceClient
          .from("lease_signers")
          .select("id, lease_id")
          .ilike("invited_email", user.email)
          .is("profile_id", null);

        if (!orphanError && orphanSigners && orphanSigners.length > 0) {
          const { error: linkError } = await serviceClient
            .from("lease_signers")
            .update({ profile_id: (newProfile as any).id } as Record<string, unknown>)
            .ilike("invited_email", user.email)
            .is("profile_id", null);

          if (linkError) {
            console.error("[POST /api/me/profile] Erreur auto-link lease_signers:", linkError);
          } else {
            console.log(`[POST /api/me/profile] ✅ ${orphanSigners.length} lease_signers auto-liés au profil ${(newProfile as any).id}`);
          }
        }

        // Aussi lier les invitations non-utilisées
        const { error: invLinkError } = await serviceClient
          .from("invitations")
          .update({ used_by: (newProfile as any).id, used_at: new Date().toISOString() } as Record<string, unknown>)
          .ilike("email", user.email)
          .is("used_at", null);

        if (invLinkError) {
          console.error("[POST /api/me/profile] Erreur auto-link invitations:", invLinkError);
        }
      } catch (autoLinkErr) {
        // Ne jamais bloquer la création du profil pour le auto-link
        console.error("[POST /api/me/profile] Erreur auto-link (non-bloquante):", autoLinkErr);
      }
    }

    return NextResponse.json(newProfile, { status: 201 });
  } catch (error: unknown) {
    console.error("Error in POST /api/me/profile:", error);
    return handleApiError(error);
  }
}

/**
 * PATCH /api/me/profile - Mettre à jour les informations du profil utilisateur
 */
export async function PATCH(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user || !supabase) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const validated = profileUpdateSchema.parse(body) as ProfileUpdate;

    const updatePayload: ProfileUpdate = {};
    if (validated.prenom !== undefined) updatePayload.prenom = validated.prenom;
    if (validated.nom !== undefined) updatePayload.nom = validated.nom;
    if (validated.telephone !== undefined) updatePayload.telephone = validated.telephone;
    if (validated.date_naissance !== undefined) updatePayload.date_naissance = validated.date_naissance;
    // ✅ SOTA 2026: Support du lieu de naissance
    if ((validated as any).lieu_naissance !== undefined) {
      (updatePayload as any).lieu_naissance = (validated as any).lieu_naissance;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "Aucun champ à mettre à jour" },
        { status: 400 }
      );
    }

    const { data: profile, error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError || !profile) {
      console.error("Error updating profile:", updateError);
      return NextResponse.json(
        { error: updateError?.message || "Erreur lors de la mise à jour du profil" },
        { status: 500 }
      );
    }

    return NextResponse.json(profile);
  } catch (error: unknown) {
    console.error("Error in PATCH /api/me/profile:", error);
    return handleApiError(error);
  }
}

/**
 * PUT /api/me/profile - Alias pour PATCH (mise à jour du profil)
 */
export async function PUT(request: Request) {
  return PATCH(request);
}
