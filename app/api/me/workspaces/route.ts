export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/me/workspaces
 *
 * Liste les espaces que l'utilisateur peut atteindre depuis son compte
 * actuel. Utilisé par le commutateur d'espace dans la sidebar owner pour
 * afficher /syndic aux owners qui gèrent aussi un site (mode bénévole ou
 * via invitation publique acceptée), sans avoir muté profiles.role.
 *
 * Source de vérité :
 *   - profiles.role (rôle primaire)
 *   - sites.syndic_profile_id  → éligibilité /syndic
 *   - user_site_roles.role_code='syndic'  → éligibilité /syndic
 *
 * Forme de la réponse :
 *   {
 *     primary: "owner",
 *     workspaces: [
 *       { key: "owner",  href: "/owner/dashboard",  label: "Espace propriétaire" },
 *       { key: "syndic", href: "/syndic/dashboard", label: "Espace syndic", count: 1 }
 *     ]
 *   }
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";
import { supabaseAdmin } from "@/app/api/_lib/supabase";

interface Workspace {
  key: "owner" | "tenant" | "provider" | "agency" | "syndic" | "guarantor" | "admin" | "copro";
  href: string;
  label: string;
  count?: number;
}

const ROLE_TO_WORKSPACE: Record<string, Workspace> = {
  owner: { key: "owner", href: "/owner/dashboard", label: "Espace propriétaire" },
  tenant: { key: "tenant", href: "/tenant/dashboard", label: "Espace locataire" },
  provider: { key: "provider", href: "/provider/dashboard", label: "Espace prestataire" },
  agency: { key: "agency", href: "/agency/dashboard", label: "Espace agence" },
  syndic: { key: "syndic", href: "/syndic/dashboard", label: "Espace syndic" },
  guarantor: { key: "guarantor", href: "/guarantor/dashboard", label: "Espace garant" },
  admin: { key: "admin", href: "/admin/dashboard", label: "Espace admin" },
  platform_admin: { key: "admin", href: "/admin/dashboard", label: "Espace admin" },
};

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
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ primary: null, workspaces: [] });
    }

    const profileRow = profile as { id: string; role: string };
    const primary = profileRow.role;

    const workspaces: Workspace[] = [];
    const seen = new Set<string>();

    const primaryWorkspace = ROLE_TO_WORKSPACE[primary];
    if (primaryWorkspace) {
      workspaces.push(primaryWorkspace);
      seen.add(primaryWorkspace.key);
    }

    // Éligibilité /syndic via sites gérés ou user_site_roles.
    if (!seen.has("syndic")) {
      const [{ count: ownedSites }, { count: siteRoles }] = await Promise.all([
        serviceClient
          .from("sites")
          .select("id", { count: "exact", head: true })
          .eq("syndic_profile_id", profileRow.id),
        serviceClient
          .from("user_site_roles")
          .select("site_id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("role_code", "syndic"),
      ]);
      const total = (ownedSites ?? 0) + (siteRoles ?? 0);
      if (total > 0) {
        workspaces.push({ ...ROLE_TO_WORKSPACE.syndic, count: total });
        seen.add("syndic");
      }
    }

    // Éligibilité /copro via user_site_roles (locataire_copro,
    // coproprietaire, conseil_syndical, etc.). Cohérent avec le fix
    // app/copro/layout.tsx qui accepte ces rôles secondaires.
    if (!seen.has("copro")) {
      const { count: coproRoles } = await serviceClient
        .from("user_site_roles")
        .select("site_id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .in("role_code", [
          "tresorier",
          "conseil_syndical",
          "coproprietaire",
          "coproprietaire_bailleur",
          "locataire_copro",
        ]);
      if ((coproRoles ?? 0) > 0) {
        workspaces.push({
          key: "copro",
          href: "/copro/dashboard",
          label: "Espace copropriété",
          count: coproRoles ?? 0,
        });
      }
    }

    // Éligibilité /guarantor via la table guarantors. Cohérent avec
    // app/guarantor/layout.tsx qui accepte les multi-rôles.
    if (!seen.has("guarantor")) {
      const { count: guarantorRows } = await serviceClient
        .from("guarantors")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if ((guarantorRows ?? 0) > 0) {
        workspaces.push({
          key: "guarantor",
          href: "/guarantor/dashboard",
          label: "Espace garant",
          count: guarantorRows ?? 0,
        });
      }
    }

    return NextResponse.json({ primary, workspaces });
  } catch (error) {
    return handleApiError(error);
  }
}
