/**
 * SOTA 2026 — Service unifie de creation de bail
 *
 * Centralise la logique commune entre :
 * - POST /api/leases          (creation draft simple)
 * - POST /api/leases/invite   (creation + invitation locataires)
 *
 * Les deux routes deviennent des adaptateurs legers delegant a ce service.
 */

import { getServiceClient } from "@/lib/supabase/service-client";
import { randomBytes } from "crypto";
import { SIGNER_ROLES } from "@/lib/constants/roles";
import { getMaxDepotLegal } from "@/lib/validations/lease-financial";
import { withSubscriptionLimit } from "@/lib/middleware/subscription-check";
import { sendLeaseInviteEmail } from "@/lib/services/email-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CreationMode = "draft" | "invite" | "colocation";

export interface TenantInvitee {
  email: string;
  name?: string | null;
  role: "principal" | "colocataire";
  weight?: number;
  room_label?: string | null;
  has_guarantor?: boolean;
  guarantor_email?: string | null;
  guarantor_name?: string | null;
}

export interface ColocationConfig {
  nb_places: number;
  bail_type: "unique" | "individuel";
  solidarite: boolean;
  solidarite_duration_months: number;
  split_mode: "equal" | "custom" | "by_room";
}

export interface LeaseCreationInput {
  mode: CreationMode;
  ownerProfileId: string;
  ownerName: string;
  propertyId: string;
  typeBail: string;
  signatoryEntityId?: string | null;
  loyer: number;
  chargesForfaitaires: number;
  chargesType?: "forfait" | "provisions";
  depotGarantie?: number;
  dateDebut: string;
  dateFin?: string | null;
  jourPaiement?: number;
  customClauses?: { id: string; text: string; isCustom: boolean }[];
  taxRegime?: string | null;
  lmnpStatus?: string | null;
  furnitureInventory?: any;
  furnitureAdditional?: any;
  // Tenant (for simple invite)
  tenantEmail?: string | null;
  tenantName?: string | null;
  // Colocation
  colocConfig?: ColocationConfig;
  invitees?: TenantInvitee[];
}

export interface LeaseCreationResult {
  leaseId: string;
  mode: CreationMode;
  inviteeSummary: { email: string; exists: boolean; emailSent: boolean; inviteUrl: string }[];
  message: string;
}

type ServiceClient = ReturnType<typeof getServiceClient>;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function createLease(input: LeaseCreationInput): Promise<LeaseCreationResult> {
  const serviceClient = getServiceClient();

  // 1. Subscription limit
  const limitCheck = await withSubscriptionLimit(input.ownerProfileId, "leases");
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message || "Limite de baux atteinte pour votre forfait.");
  }

  // 2. Verify property ownership
  const { data: property, error: propError } = await serviceClient
    .from("properties")
    .select("id, owner_id, adresse_complete, code_postal, ville, dpe_classe_energie, legal_entity_id")
    .eq("id", input.propertyId)
    .single();

  if (propError || !property) throw new Error("Bien non trouvé");
  if ((property as any).owner_id !== input.ownerProfileId) throw new Error("Ce bien ne vous appartient pas");

  // 3. DPE check
  const dpe = ((property as any).dpe_classe_energie || "").toUpperCase();
  const isHabitation = ["nu", "meuble", "colocation", "bail_mobilite", "etudiant", "bail_mixte"].includes(input.typeBail);
  if (isHabitation && dpe === "G") {
    throw new Error("Location interdite — DPE classe G (Loi Climat et Résilience)");
  }

  // 4. Entity validation
  const signatoryEntityId = input.signatoryEntityId || (property as any).legal_entity_id || null;
  if (input.signatoryEntityId) {
    const { data: entity, error: entityError } = await serviceClient
      .from("legal_entities")
      .select("id, owner_profile_id")
      .eq("id", input.signatoryEntityId)
      .eq("is_active", true)
      .single();
    if (entityError || !entity || (entity as any).owner_profile_id !== input.ownerProfileId) {
      throw new Error("Entité juridique invalide ou non autorisée");
    }
  }

  // 5. Depot calculation
  const maxDepot = getMaxDepotLegal(input.typeBail, input.loyer);
  const depotFinal = input.depotGarantie && input.depotGarantie > 0
    ? Math.min(input.depotGarantie, maxDepot)
    : maxDepot;

  // 6. Create lease
  const isManualDraft = input.mode === "draft";
  const isColocation = input.mode === "colocation" && input.invitees && input.invitees.length > 0;

  const leaseData: Record<string, unknown> = {
    property_id: input.propertyId,
    type_bail: input.typeBail,
    signatory_entity_id: signatoryEntityId,
    loyer: input.loyer,
    charges_forfaitaires: input.chargesForfaitaires,
    charges_type: input.chargesType || "forfait",
    depot_de_garantie: depotFinal,
    date_debut: input.dateDebut,
    date_fin: input.dateFin || null,
    jour_paiement: input.jourPaiement || 5,
    statut: isManualDraft ? "draft" : "pending_signature",
    clauses_particulieres: input.customClauses?.length ? JSON.stringify(input.customClauses) : null,
    tax_regime: input.taxRegime || null,
    lmnp_status: input.lmnpStatus || null,
    furniture_inventory: input.furnitureInventory ? JSON.stringify(input.furnitureInventory) : null,
  };

  if (isColocation && input.colocConfig) {
    leaseData.coloc_config = input.colocConfig;
  }

  const { data: lease, error: leaseError } = await serviceClient
    .from("leases")
    .insert(leaseData)
    .select("id")
    .single();

  if (leaseError || !lease) throw new Error("Erreur création bail: " + (leaseError?.message ?? ""));
  const leaseId = (lease as any).id;

  // 7. Owner signer
  await serviceClient.from("lease_signers").insert({
    lease_id: leaseId,
    profile_id: input.ownerProfileId,
    role: SIGNER_ROLES.OWNER,
    signature_status: "pending",
  });

  // 8. Resolve existing profiles for invitees
  const emailsToProcess = buildEmailList(input);
  const existingProfiles = await resolveProfiles(serviceClient, emailsToProcess);

  // 9. Create signers + roommates + invitations
  const inviteeSummary: LeaseCreationResult["inviteeSummary"] = [];
  const invitationTokens = new Map<string, string>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  for (const invitee of emailsToProcess) {
    const existing = existingProfiles.get(invitee.email.toLowerCase());
    const signerRole = invitee.role === "principal" ? SIGNER_ROLES.TENANT_PRINCIPAL : SIGNER_ROLES.CO_TENANT;

    // Colocation: create roommate
    if (isColocation) {
      await createRoommate(serviceClient, leaseId, invitee, existing, input);
    }

    // Create signer
    await serviceClient.from("lease_signers").insert({
      lease_id: leaseId,
      profile_id: existing?.id ?? null,
      invited_email: invitee.email.toLowerCase().trim(),
      invited_name: invitee.name || null,
      role: signerRole,
      signature_status: "pending",
    });

    // Create invitation token
    if (!isManualDraft) {
      const token = randomBytes(32).toString("hex");
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      await serviceClient.from("invitations").insert({
        token,
        email: invitee.email,
        role: signerRole,
        property_id: input.propertyId,
        unit_id: null,
        lease_id: leaseId,
        created_by: input.ownerProfileId,
        expires_at: expires.toISOString(),
      });
      invitationTokens.set(invitee.email.toLowerCase(), token);
    }

    // Notification for existing users
    if (existing) {
      await serviceClient.from("notifications").insert({
        user_id: existing.user_id,
        profile_id: existing.id,
        type: "lease_invite",
        title: isColocation ? "Invitation colocation" : "Nouveau bail à signer",
        body: `${input.ownerName} vous invite à signer un bail pour ${(property as any).adresse_complete}, ${(property as any).code_postal} ${(property as any).ville}.`,
        read: false,
        is_read: false,
        metadata: { lease_id: leaseId, property_id: input.propertyId, type_bail: input.typeBail },
      });
    }

    inviteeSummary.push({
      email: invitee.email,
      exists: !!existing,
      emailSent: false,
      inviteUrl: invitationTokens.has(invitee.email.toLowerCase())
        ? `${appUrl}/invite/${invitationTokens.get(invitee.email.toLowerCase())}`
        : "",
    });
  }

  // 10. Send invite emails
  if (!isManualDraft) {
    for (const summary of inviteeSummary) {
      if (!summary.inviteUrl) continue;
      const invitee = emailsToProcess.find((e) => e.email === summary.email);
      try {
        const result = await sendLeaseInviteEmail({
          to: summary.email,
          tenantName: invitee?.name || undefined,
          ownerName: input.ownerName,
          propertyAddress: `${(property as any).adresse_complete}, ${(property as any).code_postal} ${(property as any).ville}`,
          rent: isColocation ? Math.round(input.loyer * (invitee?.weight || 1)) : input.loyer,
          charges: isColocation ? Math.round(input.chargesForfaitaires * (invitee?.weight || 1)) : input.chargesForfaitaires,
          leaseType: input.typeBail,
          inviteUrl: summary.inviteUrl,
        });
        summary.emailSent = result.success;
      } catch { /* non-blocking */ }
    }
  }

  // 11. Build message
  const emailsSent = inviteeSummary.filter((s) => s.emailSent).length;
  const existingCount = inviteeSummary.filter((s) => s.exists).length;
  let message: string;

  if (isManualDraft) {
    message = "Bail créé en mode brouillon.";
  } else if (isColocation) {
    message = `Bail colocation créé avec ${emailsToProcess.length} colocataire(s). ${emailsSent} email(s) envoyé(s).`;
  } else {
    message = emailsSent > 0 ? `Invitation envoyée à ${emailsToProcess[0]?.email}` : "Bail créé avec succès.";
  }

  return { leaseId, mode: input.mode, inviteeSummary, message };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEmailList(input: LeaseCreationInput): TenantInvitee[] {
  if (input.mode === "colocation" && input.invitees?.length) {
    return input.invitees.map((inv) => ({
      ...inv,
      weight: inv.weight || (input.colocConfig ? 1 / input.colocConfig.nb_places : 1),
    }));
  }
  if (input.tenantEmail) {
    return [{ email: input.tenantEmail, name: input.tenantName, role: "principal", weight: 1 }];
  }
  return [];
}

async function resolveProfiles(
  supabase: ServiceClient,
  invitees: TenantInvitee[]
): Promise<Map<string, { id: string; user_id: string }>> {
  const result = new Map<string, { id: string; user_id: string }>();
  for (const inv of invitees) {
    try {
      const { data } = await supabase.rpc("find_profile_by_email", { target_email: inv.email });
      const profile = Array.isArray(data) ? data[0] : data;
      if (profile?.id) result.set(inv.email.toLowerCase(), { id: profile.id, user_id: profile.user_id });
    } catch { /* continue */ }
  }
  return result;
}

async function createRoommate(
  supabase: ServiceClient,
  leaseId: string,
  invitee: TenantInvitee,
  existing: { id: string; user_id: string } | undefined,
  input: LeaseCreationInput
) {
  const data: Record<string, unknown> = {
    lease_id: leaseId,
    role: invitee.role === "principal" ? "principal" : "tenant",
    weight: invitee.weight,
    joined_on: input.dateDebut,
    invitation_status: existing ? "accepted" : "pending",
    invited_email: invitee.email.toLowerCase().trim(),
    room_label: invitee.room_label || null,
    has_guarantor: invitee.has_guarantor || false,
    guarantor_email: invitee.guarantor_email || null,
    guarantor_name: invitee.guarantor_name || null,
  };
  if (existing) data.user_id = existing.user_id;

  const { data: roommate, error } = await supabase.from("roommates").insert(data).select("id").single();
  if (error) return;

  if (input.depotGarantie && input.depotGarantie > 0 && invitee.weight) {
    await supabase.from("deposit_shares").insert({
      lease_id: leaseId,
      roommate_id: (roommate as any).id,
      amount: input.depotGarantie * invitee.weight,
      status: "pending",
    });
  }
}
