import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapInvitationRoleToUserRole,
  type InvitationRole,
} from "@/lib/invitations/role-mapper";

export type ResolvedInvitationSource = "lease" | "guarantor";

export type ResolvedInvitation = {
  source: ResolvedInvitationSource;
  id: string;
  email: string;
  applicativeRole: "tenant" | "guarantor";
  invitationRole: InvitationRole;
  lease_id: string | null;
};

export type ResolveInvitationError =
  | { kind: "not_found" }
  | { kind: "expired" }
  | { kind: "already_used" }
  | { kind: "declined" };

export type ResolveInvitationResult =
  | { ok: true; invitation: ResolvedInvitation }
  | { ok: false; error: ResolveInvitationError };

/**
 * Résout un token d'invitation côté serveur en interrogeant successivement
 * la table `invitations` (bail) puis `guarantor_invitations` (garant
 * standalone). Garantit que les deux pipelines partagent la même logique
 * de validation (expiration, single-use, mapping FR→EN du rôle).
 *
 * Utilise un client admin (service_role) — RLS bypassée volontairement,
 * cette résolution est appelée depuis des endpoints publics (signup,
 * validate) qui ne peuvent pas s'authentifier en tant que destinataire
 * de l'invitation.
 */
export async function resolveInvitationByToken(
  adminClient: SupabaseClient<any, any, any>,
  token: string
): Promise<ResolveInvitationResult> {
  const { data: leaseInv } = await adminClient
    .from("invitations")
    .select("id, email, role, expires_at, used_at, lease_id")
    .eq("token", token)
    .maybeSingle();

  if (leaseInv) {
    if (leaseInv.used_at) {
      return { ok: false, error: { kind: "already_used" } };
    }
    if (new Date(leaseInv.expires_at as string) < new Date()) {
      return { ok: false, error: { kind: "expired" } };
    }
    const invitationRole = leaseInv.role as InvitationRole;
    return {
      ok: true,
      invitation: {
        source: "lease",
        id: String(leaseInv.id),
        email: String(leaseInv.email).toLowerCase().trim(),
        applicativeRole: mapInvitationRoleToUserRole(invitationRole),
        invitationRole,
        lease_id: (leaseInv.lease_id as string | null) ?? null,
      },
    };
  }

  const { data: garInv } = await adminClient
    .from("guarantor_invitations")
    .select("id, guarantor_email, status, expires_at, accepted_at, declined_at, lease_id")
    .eq("invitation_token", token)
    .maybeSingle();

  if (!garInv) {
    return { ok: false, error: { kind: "not_found" } };
  }
  if (garInv.status === "accepted" || garInv.accepted_at) {
    return { ok: false, error: { kind: "already_used" } };
  }
  if (garInv.status === "declined" || garInv.declined_at) {
    return { ok: false, error: { kind: "declined" } };
  }
  if (
    garInv.status === "expired" ||
    (garInv.expires_at && new Date(garInv.expires_at as string) < new Date())
  ) {
    return { ok: false, error: { kind: "expired" } };
  }

  return {
    ok: true,
    invitation: {
      source: "guarantor",
      id: String(garInv.id),
      email: String(garInv.guarantor_email).toLowerCase().trim(),
      applicativeRole: "guarantor",
      invitationRole: "garant",
      lease_id: (garInv.lease_id as string | null) ?? null,
    },
  };
}
