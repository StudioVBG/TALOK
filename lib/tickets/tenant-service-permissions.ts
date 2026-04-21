/**
 * Permissions self-service du locataire.
 *
 * Le propriétaire configure dans le bail les catégories que le locataire
 * peut réserver directement (ex. jardinage, nettoyage) — sans attendre
 * que l'owner approuve. Ce module lit et valide ces permissions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface TenantBookingPermissions {
  enabled: boolean;
  allowed_categories: string[];
  max_amount_cents: number | null;
  requires_owner_approval: boolean;
}

const DEFAULT_PERMISSIONS: TenantBookingPermissions = {
  enabled: false,
  allowed_categories: [],
  max_amount_cents: null,
  requires_owner_approval: false,
};

export type PermissionDecision =
  | { allowed: true; permissions: TenantBookingPermissions; lease_id: string; property_id: string; owner_profile_id: string }
  | { allowed: false; code: "NO_LEASE" | "DISABLED" | "CATEGORY_NOT_ALLOWED"; status: 403 | 404; message: string };

/**
 * Vérifie qu'un profil locataire a le droit de booker un service d'une
 * catégorie donnée, en s'appuyant sur ses baux actifs (via profile_id
 * OU invited_email, cf. resolve-ticket-context).
 */
export async function checkTenantBookingPermission(args: {
  serviceClient: SupabaseClient<any>;
  profileId: string;
  userEmail: string | null;
  category: string;
}): Promise<PermissionDecision> {
  const { serviceClient, profileId, userEmail, category } = args;

  // 1. Récupérer les lease_ids du locataire (profile_id + invited_email)
  const leaseIds = new Set<string>();

  const { data: byProfile } = await serviceClient
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profileId)
    .in("role", ["locataire_principal", "colocataire"]);

  for (const s of byProfile || []) {
    leaseIds.add((s as { lease_id: string }).lease_id);
  }

  if (userEmail) {
    const { data: byEmail } = await serviceClient
      .from("lease_signers")
      .select("lease_id")
      .ilike("invited_email", userEmail)
      .in("role", ["locataire_principal", "colocataire"]);
    for (const s of byEmail || []) {
      leaseIds.add((s as { lease_id: string }).lease_id);
    }
  }

  if (leaseIds.size === 0) {
    return {
      allowed: false,
      code: "NO_LEASE",
      status: 404,
      message: "Aucun bail actif trouvé pour votre compte.",
    };
  }

  // 2. Chercher un bail actif autorisant cette catégorie
  const { data: leases } = await serviceClient
    .from("leases")
    .select("id, property_id, tenant_service_bookings")
    .in("id", Array.from(leaseIds))
    .in("statut", ["active", "fully_signed"]);

  const activeLeases = (leases || []) as Array<{
    id: string;
    property_id: string;
    tenant_service_bookings: TenantBookingPermissions | null;
  }>;

  if (activeLeases.length === 0) {
    return {
      allowed: false,
      code: "NO_LEASE",
      status: 404,
      message: "Aucun bail actif trouvé pour votre compte.",
    };
  }

  // Un locataire peut avoir plusieurs baux ; on prend le premier qui autorise
  // la catégorie demandée (l'owner_id peut différer d'un bail à l'autre).
  for (const lease of activeLeases) {
    const perms = normalizePermissions(lease.tenant_service_bookings);
    if (perms.enabled && perms.allowed_categories.includes(category)) {
      const { data: property } = await serviceClient
        .from("properties")
        .select("owner_id")
        .eq("id", lease.property_id)
        .maybeSingle();
      const ownerProfileId = (property as { owner_id: string } | null)?.owner_id;
      if (!ownerProfileId) continue;

      return {
        allowed: true,
        permissions: perms,
        lease_id: lease.id,
        property_id: lease.property_id,
        owner_profile_id: ownerProfileId,
      };
    }
  }

  // Aucun bail n'autorise cette catégorie — on distingue le cas "self-service
  // jamais activé" du cas "catégorie non listée" pour un message clair.
  const anyEnabled = activeLeases.some((l) => normalizePermissions(l.tenant_service_bookings).enabled);
  if (!anyEnabled) {
    return {
      allowed: false,
      code: "DISABLED",
      status: 403,
      message: "Votre propriétaire n'a pas activé la réservation directe de prestataires.",
    };
  }

  return {
    allowed: false,
    code: "CATEGORY_NOT_ALLOWED",
    status: 403,
    message: "Cette catégorie de service n'est pas autorisée dans votre bail.",
  };
}

export function normalizePermissions(
  raw: TenantBookingPermissions | null | undefined
): TenantBookingPermissions {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PERMISSIONS };
  return {
    enabled: Boolean(raw.enabled),
    allowed_categories: Array.isArray(raw.allowed_categories) ? raw.allowed_categories : [],
    max_amount_cents:
      typeof raw.max_amount_cents === "number" && raw.max_amount_cents > 0
        ? raw.max_amount_cents
        : null,
    requires_owner_approval: Boolean(raw.requires_owner_approval),
  };
}

/**
 * Catégories que nous exposons au locataire pour le self-service.
 * Se limite aux catégories "non urgentes + faible risque" où le locataire
 * n'a pas besoin de l'expertise de l'owner pour décider.
 * Source : providers.trade_categories (cf. 20260408120000_providers_module_sota.sql).
 */
export const TENANT_BOOKABLE_CATEGORIES = [
  "jardinage",
  "nettoyage",
  "demenagement",
  "peinture",
  "petits_travaux",
] as const;

export type TenantBookableCategory = (typeof TENANT_BOOKABLE_CATEGORIES)[number];

export const TENANT_BOOKABLE_CATEGORY_LABELS: Record<TenantBookableCategory, string> = {
  jardinage: "Jardinage",
  nettoyage: "Ménage",
  demenagement: "Déménagement",
  peinture: "Peinture",
  petits_travaux: "Petits travaux",
};
