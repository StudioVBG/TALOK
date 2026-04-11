import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/app/api/_lib/supabase";

/**
 * Helper SOTA 2026 — Authentification syndic
 *
 * Vérifie que l'utilisateur est :
 *   1. Authentifié
 *   2. Profil avec rôle syndic (ou admin/platform_admin pour bypass)
 *   3. (optionnel) Propriétaire du site concerné (syndic_profile_id = profile.id)
 *
 * Usage:
 *   const auth = await requireSyndic(request, { siteId });
 *   if (auth instanceof NextResponse) return auth; // Error response
 *   const { user, profile, isAdmin } = auth;
 */

export interface SyndicAuthResult {
  user: { id: string; email?: string | null };
  profile: {
    id: string;
    role: string;
    prenom: string | null;
    nom: string | null;
  };
  isAdmin: boolean;
  serviceClient: ReturnType<typeof supabaseAdmin>;
}

export async function requireSyndic(
  _request: Request,
  options: { siteId?: string | null } = {}
): Promise<SyndicAuthResult | NextResponse> {
  const supabase = await createClient();

  // 1. Authentification
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Profil + rôle (via service role pour bypass RLS récursion)
  const serviceClient = supabaseAdmin();
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, role, prenom, nom")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  const allowedRoles = ["syndic", "admin", "platform_admin"];
  if (!allowedRoles.includes((profile as any).role)) {
    return NextResponse.json(
      { error: "Accès réservé aux utilisateurs syndic" },
      { status: 403 }
    );
  }

  const isAdmin = ["admin", "platform_admin"].includes((profile as any).role);

  // 3. Si siteId fourni, vérifier que le syndic est bien propriétaire du site
  if (options.siteId && !isAdmin) {
    const { data: site, error: siteError } = await serviceClient
      .from("sites")
      .select("id, syndic_profile_id")
      .eq("id", options.siteId)
      .maybeSingle();

    if (siteError || !site) {
      return NextResponse.json(
        { error: "Site introuvable" },
        { status: 404 }
      );
    }

    if ((site as any).syndic_profile_id !== (profile as any).id) {
      return NextResponse.json(
        { error: "Vous n'êtes pas le syndic de ce site" },
        { status: 403 }
      );
    }
  }

  return {
    user: { id: user.id, email: user.email },
    profile: profile as SyndicAuthResult["profile"],
    isAdmin,
    serviceClient,
  };
}

/**
 * Vérifie qu'une assemblée appartient bien à un site géré par le syndic.
 * Retourne l'assemblée si OK, NextResponse d'erreur sinon.
 */
export async function requireAssemblyAccess(
  request: Request,
  assemblyId: string
): Promise<
  | { auth: SyndicAuthResult; assembly: { id: string; site_id: string; status: string } }
  | NextResponse
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const serviceClient = supabaseAdmin();
  const { data: assembly, error } = await serviceClient
    .from("copro_assemblies")
    .select("id, site_id, status")
    .eq("id", assemblyId)
    .maybeSingle();

  if (error || !assembly) {
    return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
  }

  const auth = await requireSyndic(request, { siteId: (assembly as any).site_id });
  if (auth instanceof NextResponse) return auth;

  return {
    auth,
    assembly: assembly as { id: string; site_id: string; status: string },
  };
}
