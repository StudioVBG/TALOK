/**
 * RBAC intra-copropriété — vérification des rôles fins par site
 *
 * Complément à `requireSyndic` (qui ne vérifie que le rôle plateforme).
 * Ce helper consulte `user_site_roles` pour valider qu'un utilisateur
 * a bien le rôle adéquat dans le contexte d'une copropriété donnée.
 *
 * Modèle de rôles intra-copro (table user_site_roles.role_code) :
 *   - syndic                  : cabinet professionnel (admin total du site)
 *   - tresorier               : trésorier élu (gestion comptable déléguée)
 *   - conseil_syndical        : membre du conseil syndical (lecture étendue)
 *   - coproprietaire          : copropriétaire standard
 *   - coproprietaire_bailleur : propriétaire qui loue son lot
 *   - locataire_copro         : locataire d'un copropriétaire bailleur
 *
 * @example
 * import { requireCoproRole } from "@/lib/auth/copro-rbac";
 *
 * export async function POST(request: Request) {
 *   const access = await requireCoproRole(request, {
 *     siteId,
 *     allowedRoles: ["syndic", "tresorier"],
 *   });
 *   if (access instanceof NextResponse) return access;
 *
 *   // access.coproRole vaut "syndic" ou "tresorier"
 *   // access.user, access.profile, access.serviceClient disponibles
 * }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

export type CoproSiteRole =
  | "syndic"
  | "tresorier"
  | "conseil_syndical"
  | "coproprietaire"
  | "coproprietaire_bailleur"
  | "locataire_copro";

interface CoproRoleAuthResult {
  user: { id: string; email: string | null };
  profile: { id: string; role: string };
  /** Rôle intra-copro de l'utilisateur sur ce site, ou "platform_admin" si bypass */
  coproRole: CoproSiteRole | "platform_admin";
  /** Lots assignés à l'utilisateur si role = coproprietaire / locataire_copro */
  unitIds: string[];
  serviceClient: ReturnType<typeof getServiceClient>;
}

interface RequireCoproRoleOptions {
  /** ID du site (copropriété) concerné */
  siteId: string;
  /** Rôles intra-copro autorisés à effectuer l'action */
  allowedRoles: CoproSiteRole[];
  /**
   * Si true (défaut), les admins plateforme (role=admin/platform_admin) bypassent
   * la vérification du rôle intra-copro pour le support / debug.
   */
  allowPlatformAdmin?: boolean;
}

/**
 * Vérifie qu'un utilisateur a un rôle intra-copro autorisé sur un site donné.
 *
 * Best-effort robustesse :
 *   - 401 si non authentifié
 *   - 404 si site introuvable
 *   - 403 si rôle plateforme insuffisant et pas de rôle intra-copro autorisé
 *
 * Bypass automatique pour les admins plateforme (sauf si allowPlatformAdmin=false).
 */
export async function requireCoproRole(
  _request: Request,
  options: RequireCoproRoleOptions,
): Promise<CoproRoleAuthResult | NextResponse> {
  const allowPlatformAdmin = options.allowPlatformAdmin ?? true;

  // 1. Auth
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Profil plateforme
  const serviceClient = getServiceClient();
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  const platformRole = (profile as any).role as string;
  const isPlatformAdmin = ["admin", "platform_admin"].includes(platformRole);

  // 3. Bypass admin plateforme (si autorisé)
  if (allowPlatformAdmin && isPlatformAdmin) {
    return {
      user: { id: user.id, email: user.email ?? null },
      profile: profile as CoproRoleAuthResult["profile"],
      coproRole: "platform_admin",
      unitIds: [],
      serviceClient,
    };
  }

  // 4. Vérifier que le site existe
  const { data: site } = await serviceClient
    .from("sites")
    .select("id")
    .eq("id", options.siteId)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site introuvable" }, { status: 404 });
  }

  // 5. Récupérer le(s) rôle(s) intra-copro de l'utilisateur sur ce site
  const { data: siteRoles, error: rolesError } = await serviceClient
    .from("user_site_roles")
    .select("role_code, unit_ids")
    .eq("user_id", user.id)
    .eq("site_id", options.siteId);

  if (rolesError) {
    return NextResponse.json(
      { error: "Erreur lors de la vérification des droits" },
      { status: 500 },
    );
  }

  const userCoproRoles = ((siteRoles ?? []) as Array<{
    role_code: string;
    unit_ids: string[] | null;
  }>).map((r) => r.role_code as CoproSiteRole);

  // 6. Intersection : l'utilisateur a-t-il au moins un rôle autorisé ?
  const matchedRole = userCoproRoles.find((r) => options.allowedRoles.includes(r));

  if (!matchedRole) {
    return NextResponse.json(
      {
        error: "Accès refusé",
        details: `Cette action requiert l'un des rôles suivants sur cette copropriété : ${options.allowedRoles.join(", ")}.`,
        your_roles: userCoproRoles.length > 0 ? userCoproRoles : null,
      },
      { status: 403 },
    );
  }

  // 7. Récupérer les lots assignés au user (utile pour scoping ultérieur)
  const matchedRoleEntry = ((siteRoles ?? []) as Array<{
    role_code: string;
    unit_ids: string[] | null;
  }>).find((r) => r.role_code === matchedRole);
  const unitIds = matchedRoleEntry?.unit_ids ?? [];

  return {
    user: { id: user.id, email: user.email ?? null },
    profile: profile as CoproRoleAuthResult["profile"],
    coproRole: matchedRole,
    unitIds,
    serviceClient,
  };
}

/**
 * Helper : vérifie qu'un utilisateur a au moins un rôle dans une liste,
 * sans short-circuit en NextResponse. Utile dans une logique métier
 * conditionnelle (ex: afficher des actions différentes selon le rôle).
 *
 * @returns le rôle matché, ou null si aucun rôle autorisé
 */
export async function getUserCoproRole(
  userId: string,
  siteId: string,
): Promise<CoproSiteRole[]> {
  const serviceClient = getServiceClient();
  const { data, error } = await serviceClient
    .from("user_site_roles")
    .select("role_code")
    .eq("user_id", userId)
    .eq("site_id", siteId);

  if (error || !data) return [];
  return data.map((r: any) => r.role_code as CoproSiteRole);
}

/**
 * Hiérarchie : `syndic > tresorier > conseil_syndical > coproprietaire`
 * Renvoie true si `actualRole` peut effectuer une action requérant `requiredRole`.
 *
 * Note : cette hiérarchie est volontairement simplifiée. Pour des cas plus
 * complexes, utilisez `requireCoproRole` avec une liste explicite.
 */
export function hasAtLeastRole(
  actualRole: CoproSiteRole | "platform_admin" | null,
  requiredRole: CoproSiteRole,
): boolean {
  if (!actualRole) return false;
  if (actualRole === "platform_admin") return true;

  const hierarchy: Record<CoproSiteRole, number> = {
    syndic: 100,
    tresorier: 80,
    conseil_syndical: 60,
    coproprietaire_bailleur: 40,
    coproprietaire: 30,
    locataire_copro: 10,
  };

  return hierarchy[actualRole] >= hierarchy[requiredRole];
}
