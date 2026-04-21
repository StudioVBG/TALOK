/**
 * Résolution du contexte d'un ticket pour un créateur donné.
 *
 * Centralise la logique d'accès : un locataire peut être lié à un bail via
 * `lease_signers.profile_id` (nominal) OU via `lease_signers.invited_email`
 * (cas où l'invitation n'a pas encore été "healed"). La route POST /api/tickets
 * ignorait le second cas, ce qui causait des 403 alors que l'utilisateur a
 * légitimement accès à la propriété.
 *
 * Résout aussi :
 *   - property_id à partir du bail actif si non fourni par le client
 *   - lease_id à partir de la propriété
 *   - owner_id de la propriété (pour notification + colonne tickets.owner_id)
 *
 * Renvoie un discriminated union pour forcer le handler à traiter tous les cas.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type TicketCreatorRole = "owner" | "tenant" | "agency" | "admin" | "other";

export interface ResolvedTicketContext {
  ok: true;
  property_id: string | null;
  lease_id: string | null;
  owner_profile_id: string | null;
  owner_user_id: string | null;
  creator_role: TicketCreatorRole;
}

export type TicketContextError =
  | { ok: false; code: "NO_PROFILE"; status: 404; message: string }
  | { ok: false; code: "PROPERTY_NOT_FOUND"; status: 404; message: string }
  | { ok: false; code: "NO_ACCESS"; status: 403; message: string }
  | { ok: false; code: "NO_ACTIVE_LEASE"; status: 400; message: string };

interface ResolveArgs {
  serviceClient: SupabaseClient<any>;
  profileId: string;
  role: string;
  userEmail?: string | null;
  propertyId?: string | null;
  leaseId?: string | null;
}

const TENANT_SIGNER_ROLES = ["locataire_principal", "colocataire"];

export async function resolveTicketContext(
  args: ResolveArgs
): Promise<ResolvedTicketContext | TicketContextError> {
  const { serviceClient, profileId, role, userEmail, propertyId, leaseId } = args;

  const normalizedEmail = userEmail?.trim().toLowerCase() || null;

  if (role === "admin") {
    return resolveForAdmin(serviceClient, propertyId, leaseId);
  }

  if (role === "owner") {
    return resolveForOwner(serviceClient, profileId, propertyId, leaseId);
  }

  // tenant (par défaut) — couvre aussi les rôles non standard qui ont un bail
  return resolveForTenant(serviceClient, profileId, normalizedEmail, propertyId, leaseId);
}

async function resolveForAdmin(
  supabase: SupabaseClient<any>,
  propertyId: string | null | undefined,
  leaseId: string | null | undefined
): Promise<ResolvedTicketContext | TicketContextError> {
  if (!propertyId) {
    return {
      ok: false,
      code: "NO_ACTIVE_LEASE",
      status: 400,
      message: "property_id requis pour un ticket créé par un administrateur",
    };
  }

  const property = await fetchProperty(supabase, propertyId);
  if (!property) {
    return {
      ok: false,
      code: "PROPERTY_NOT_FOUND",
      status: 404,
      message: "Propriété introuvable",
    };
  }

  const ownerUserId = await fetchOwnerUserId(supabase, property.owner_id);
  return {
    ok: true,
    property_id: propertyId,
    lease_id: leaseId ?? null,
    owner_profile_id: property.owner_id,
    owner_user_id: ownerUserId,
    creator_role: "admin",
  };
}

async function resolveForOwner(
  supabase: SupabaseClient<any>,
  profileId: string,
  propertyId: string | null | undefined,
  leaseId: string | null | undefined
): Promise<ResolvedTicketContext | TicketContextError> {
  if (!propertyId) {
    return {
      ok: false,
      code: "NO_ACTIVE_LEASE",
      status: 400,
      message: "Veuillez sélectionner une propriété",
    };
  }

  const property = await fetchProperty(supabase, propertyId);
  if (!property) {
    return {
      ok: false,
      code: "PROPERTY_NOT_FOUND",
      status: 404,
      message: "Propriété introuvable",
    };
  }

  if (property.owner_id !== profileId) {
    return {
      ok: false,
      code: "NO_ACCESS",
      status: 403,
      message: "Vous n'êtes pas propriétaire de ce bien",
    };
  }

  const ownerUserId = await fetchOwnerUserId(supabase, property.owner_id);
  return {
    ok: true,
    property_id: propertyId,
    lease_id: leaseId ?? null,
    owner_profile_id: property.owner_id,
    owner_user_id: ownerUserId,
    creator_role: "owner",
  };
}

async function resolveForTenant(
  supabase: SupabaseClient<any>,
  profileId: string,
  userEmail: string | null,
  propertyId: string | null | undefined,
  leaseId: string | null | undefined
): Promise<ResolvedTicketContext | TicketContextError> {
  // 1. Trouver tous les baux auxquels le locataire est rattaché
  //    (via profile_id OU invited_email), avec leur propriété.
  const tenantLeases = await fetchTenantLeases(supabase, profileId, userEmail);

  if (tenantLeases.length === 0) {
    return {
      ok: false,
      code: "NO_ACTIVE_LEASE",
      status: 400,
      message:
        "Aucun bail actif trouvé sur votre compte. Contactez votre propriétaire ou votre agence.",
    };
  }

  // 2. Si le client a fourni property_id, vérifier qu'un bail correspond.
  if (propertyId) {
    const property = await fetchProperty(supabase, propertyId);
    if (!property) {
      return {
        ok: false,
        code: "PROPERTY_NOT_FOUND",
        status: 404,
        message: "Propriété introuvable",
      };
    }

    const matching = tenantLeases.find((l) => l.property_id === propertyId);
    if (!matching) {
      return {
        ok: false,
        code: "NO_ACCESS",
        status: 403,
        message: "Vous n'êtes pas rattaché à cette propriété",
      };
    }

    // Cohérence lease_id si fourni
    const finalLeaseId = leaseId && matching.id === leaseId ? leaseId : matching.id;

    const ownerUserId = await fetchOwnerUserId(supabase, property.owner_id);
    return {
      ok: true,
      property_id: propertyId,
      lease_id: finalLeaseId,
      owner_profile_id: property.owner_id,
      owner_user_id: ownerUserId,
      creator_role: "tenant",
    };
  }

  // 3. Pas de property_id fourni : auto-résoudre depuis le premier bail actif.
  const primary =
    tenantLeases.find((l) => l.statut === "active") ??
    tenantLeases.find((l) => l.statut === "fully_signed") ??
    tenantLeases[0];

  const property = await fetchProperty(supabase, primary.property_id);
  if (!property) {
    return {
      ok: false,
      code: "PROPERTY_NOT_FOUND",
      status: 404,
      message: "Propriété introuvable pour votre bail",
    };
  }

  const ownerUserId = await fetchOwnerUserId(supabase, property.owner_id);
  return {
    ok: true,
    property_id: primary.property_id,
    lease_id: primary.id,
    owner_profile_id: property.owner_id,
    owner_user_id: ownerUserId,
    creator_role: "tenant",
  };
}

async function fetchProperty(
  supabase: SupabaseClient<any>,
  propertyId: string
): Promise<{ id: string; owner_id: string } | null> {
  const { data } = await supabase
    .from("properties")
    .select("id, owner_id")
    .eq("id", propertyId)
    .maybeSingle();
  return (data as { id: string; owner_id: string } | null) || null;
}

async function fetchOwnerUserId(
  supabase: SupabaseClient<any>,
  ownerProfileId: string | null
): Promise<string | null> {
  if (!ownerProfileId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("id", ownerProfileId)
    .maybeSingle();
  return (data as { user_id: string | null } | null)?.user_id ?? null;
}

interface TenantLease {
  id: string;
  property_id: string;
  statut: string;
}

async function fetchTenantLeases(
  supabase: SupabaseClient<any>,
  profileId: string,
  userEmail: string | null
): Promise<TenantLease[]> {
  // Lease ids via profile_id
  const { data: signersByProfile } = await supabase
    .from("lease_signers")
    .select("lease_id")
    .eq("profile_id", profileId)
    .in("role", TENANT_SIGNER_ROLES);

  const leaseIds = new Set<string>(
    (signersByProfile || []).map((s: { lease_id: string }) => s.lease_id)
  );

  // Lease ids via invited_email (auto-heal passif : on ne réécrit pas ici,
  // c'est le rôle du dashboard. On se contente d'accepter l'accès.)
  if (userEmail) {
    const { data: signersByEmail } = await supabase
      .from("lease_signers")
      .select("lease_id")
      .ilike("invited_email", userEmail)
      .in("role", TENANT_SIGNER_ROLES);

    for (const s of signersByEmail || []) {
      leaseIds.add((s as { lease_id: string }).lease_id);
    }
  }

  if (leaseIds.size === 0) return [];

  const { data: leases } = await supabase
    .from("leases")
    .select("id, property_id, statut")
    .in("id", Array.from(leaseIds));

  return (leases as TenantLease[] | null) || [];
}
