export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { supabaseAdmin } from "@/app/api/_lib/supabase";

/**
 * PATCH /api/me/syndic-profile
 * Met à jour le profil syndic spécialisé (raison sociale, carte pro,
 * garantie financière, assurance RCP, etc.)
 *
 * Validation des champs réglementaires loi Hoguet pour les syndics professionnels.
 */

const SIRET_REGEX = /^\d{14}$/;

const SyndicProfileSchema = z.object({
  raison_sociale: z.string().min(1, "Raison sociale requise").max(255),
  forme_juridique: z
    .enum(["SARL", "SAS", "SASU", "SCI", "EURL", "EI", "SA", "association", "benevole", "autre"])
    .nullable()
    .optional(),
  siret: z
    .string()
    .regex(SIRET_REGEX, "SIRET invalide (14 chiffres requis)")
    .nullable()
    .optional(),
  type_syndic: z.enum(["professionnel", "benevole", "cooperatif"]).default("professionnel"),
  numero_carte_pro: z.string().max(100).nullable().optional(),
  carte_pro_delivree_par: z.string().max(255).nullable().optional(),
  carte_pro_validite: z.string().nullable().optional(),
  garantie_financiere_montant: z.number().nonnegative().nullable().optional(),
  garantie_financiere_organisme: z.string().max(255).nullable().optional(),
  assurance_rcp: z.string().max(100).nullable().optional(),
  assurance_rcp_organisme: z.string().max(255).nullable().optional(),
  adresse_siege: z.string().max(500).nullable().optional(),
  code_postal: z.string().regex(/^\d{5}$/, "Code postal invalide").nullable().optional(),
  ville: z.string().max(100).nullable().optional(),
  telephone: z.string().max(30).nullable().optional(),
  email_contact: z.string().email("Email invalide"),
  website: z.string().url("URL invalide").nullable().optional(),
  logo_url: z.string().url("URL invalide").nullable().optional(),
});

export async function PATCH(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = SyndicProfileSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Validation réglementaire pour syndic professionnel
    if (data.type_syndic === "professionnel") {
      if (!data.numero_carte_pro) {
        return NextResponse.json(
          { error: "Numéro de carte professionnelle requis pour un syndic professionnel (loi Hoguet)" },
          { status: 400 }
        );
      }
      if (!data.garantie_financiere_montant || !data.garantie_financiere_organisme) {
        return NextResponse.json(
          { error: "Garantie financière (montant + organisme) requise pour un syndic professionnel" },
          { status: 400 }
        );
      }
      if (!data.assurance_rcp) {
        return NextResponse.json(
          { error: "Assurance RCP requise pour un syndic professionnel" },
          { status: 400 }
        );
      }
    }

    const serviceClient = supabaseAdmin();

    // Récupérer le profil de base
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if ((profile as any).role !== "syndic" && (profile as any).role !== "admin") {
      // Tolère les owner-bénévoles : ils gèrent au moins un site comme syndic
      // (sites.syndic_profile_id ou user_site_roles.role_code='syndic'). Cf.
      // P0 fix qui ne mute plus profiles.role en 'syndic'.
      const profileId = (profile as any).id;
      const [{ count: ownedSites }, { count: roleSites }] = await Promise.all([
        serviceClient
          .from("sites")
          .select("id", { count: "exact", head: true })
          .eq("syndic_profile_id", profileId),
        serviceClient
          .from("user_site_roles")
          .select("site_id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("role_code", "syndic"),
      ]);
      if ((ownedSites ?? 0) === 0 && (roleSites ?? 0) === 0) {
        return NextResponse.json(
          { error: "Accès réservé aux utilisateurs syndic" },
          { status: 403 }
        );
      }
    }

    // Upsert syndic_profiles
    const { error: upsertError } = await serviceClient
      .from("syndic_profiles")
      .upsert(
        {
          profile_id: (profile as any).id,
          ...data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" }
      );

    if (upsertError) {
      console.error("[syndic-profile] Upsert error:", upsertError);
      return NextResponse.json(
        { error: "Erreur lors de la sauvegarde du profil syndic" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * GET /api/me/syndic-profile
 * Récupère le profil syndic de l'utilisateur connecté
 */
export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request);

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = supabaseAdmin();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if ((profile as any).role !== "syndic" && (profile as any).role !== "admin") {
      // Idem PATCH : autorise les owner-bénévoles avec au moins un site géré.
      const profileId = (profile as any).id;
      const [{ count: ownedSites }, { count: roleSites }] = await Promise.all([
        serviceClient
          .from("sites")
          .select("id", { count: "exact", head: true })
          .eq("syndic_profile_id", profileId),
        serviceClient
          .from("user_site_roles")
          .select("site_id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("role_code", "syndic"),
      ]);
      if ((ownedSites ?? 0) === 0 && (roleSites ?? 0) === 0) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const { data: syndicProfile, error } = await serviceClient
      .from("syndic_profiles")
      .select("*")
      .eq("profile_id", (profile as any).id)
      .maybeSingle();

    if (error) {
      console.error("[syndic-profile] Fetch error:", error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({ data: syndicProfile });
  } catch (error) {
    return handleApiError(error);
  }
}
