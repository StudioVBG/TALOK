/**
 * EDL Creation Service
 *
 * Shared logic for creating an EDL, used by both:
 *   - POST /api/edl
 *   - POST /api/properties/[id]/inspections
 *
 * Centralises validation, deduplication, signature injection, event logging.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateEDLParams {
  /** The authenticated user's auth.uid */
  userId: string;
  /** The user's profile ID (from profiles table) */
  profileId: string;
  /** The user's role */
  profileRole: string;
  /** The lease to attach this EDL to */
  leaseId: string;
  /** The property ID (resolved from lease if not provided) */
  propertyId?: string;
  /** Type of EDL */
  type: "entree" | "sortie";
  /** Scheduled date (ISO string) */
  scheduledAt?: string;
  /** General notes */
  generalNotes?: string;
  /** Keys data */
  keys?: Array<{ type: string; quantite: number; notes?: string }>;
}

export interface CreateEDLResult {
  success: boolean;
  edl?: Record<string, unknown>;
  error?: string;
  status?: number;
  /** If an existing EDL was found and reused */
  reused?: boolean;
}

// ─── Service ────────────────────────────────────────────────────────────────

export async function createEDL(
  serviceClient: SupabaseClient,
  params: CreateEDLParams
): Promise<CreateEDLResult> {
  const {
    userId,
    profileId,
    profileRole,
    leaseId,
    type,
    scheduledAt,
    generalNotes,
    keys,
  } = params;

  // 1. Validate type
  if (!type || !["entree", "sortie"].includes(type)) {
    return { success: false, error: "Type d'EDL invalide (entree ou sortie requis)", status: 400 };
  }

  // 2. Resolve lease and property
  const { data: lease, error: leaseError } = await serviceClient
    .from("leases")
    .select(`id, property_id, property:properties(id, owner_id)`)
    .eq("id", leaseId)
    .single();

  if (leaseError || !lease) {
    return { success: false, error: "Bail non trouvé", status: 404 };
  }

  const leaseData = lease as Record<string, unknown>;
  const propertyData = Array.isArray(leaseData.property)
    ? (leaseData.property as Record<string, unknown>[])[0]
    : (leaseData.property as Record<string, unknown>);
  const propertyId = params.propertyId || (leaseData.property_id as string);

  // 3. Verify permissions
  const isOwner = propertyData?.owner_id === profileId;
  const isAdmin = profileRole === "admin";

  if (!isOwner && !isAdmin) {
    return { success: false, error: "Seul le propriétaire peut créer un EDL", status: 403 };
  }

  // 4. Deduplication: check for existing draft/scheduled/in_progress EDL
  const { data: existingEdl } = await serviceClient
    .from("edl")
    .select("id, status")
    .eq("lease_id", leaseId)
    .eq("type", type)
    .in("status", ["draft", "scheduled", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingEdl) {
    return {
      success: true,
      edl: existingEdl as Record<string, unknown>,
      reused: true,
    };
  }

  // 5. Create the EDL
  const scheduledDate = scheduledAt
    ? new Date(scheduledAt).toISOString().split("T")[0]
    : null;

  const { data: newEdl, error: createError } = await serviceClient
    .from("edl")
    .insert({
      lease_id: leaseId,
      property_id: propertyId,
      type,
      status: scheduledAt ? "scheduled" : "draft",
      scheduled_at: scheduledAt || null,
      scheduled_date: scheduledDate,
      general_notes: generalNotes || null,
      keys: keys || [],
      created_by: userId,
    } as Record<string, unknown>)
    .select()
    .single();

  if (createError) {
    console.error("[createEDL] DB Error:", createError);
    return { success: false, error: createError.message || "Erreur lors de la création de l'EDL", status: 500 };
  }

  const edlData = newEdl as Record<string, unknown>;

  // 6. Inject lease signers as EDL signatures (non-blocking)
  try {
    const { data: leaseSigners } = await serviceClient
      .from("lease_signers")
      .select("profile_id, role, invited_email, invited_name")
      .eq("lease_id", leaseId);

    if (leaseSigners && leaseSigners.length > 0) {
      const edlSignatures = leaseSigners.map((ls: Record<string, unknown>) => ({
        edl_id: edlData.id,
        signer_user: null,
        signer_profile_id: ls.profile_id,
        signer_role: (ls.role === "proprietaire" || ls.role === "owner") ? "owner" : "tenant",
        signer_email: ls.invited_email || null,
        signer_name: ls.invited_name || null,
        invitation_token: crypto.randomUUID(),
      }));

      await serviceClient.from("edl_signatures").insert(edlSignatures as Record<string, unknown>[]);
    }
  } catch (sigError) {
    console.error("[createEDL] Signature injection error:", sigError);
  }

  // 7. Outbox event (non-blocking)
  void Promise.resolve(
    serviceClient
      .from("outbox")
      .insert({
        event_type: "Inspection.Scheduled",
        payload: {
          edl_id: edlData.id,
          property_id: propertyId,
          lease_id: leaseId,
          type,
          scheduled_at: scheduledAt,
        },
      } as Record<string, unknown>)
  ).catch(() => {});

  // 8. Audit log (non-blocking)
  void Promise.resolve(
    serviceClient
      .from("audit_log")
      .insert({
        user_id: userId,
        action: "edl_created",
        entity_type: "edl",
        entity_id: edlData.id,
        metadata: { type, lease_id: leaseId },
      } as Record<string, unknown>)
  ).catch(() => {});

  // 9. Invalidate Next.js cache
  revalidatePath("/owner/inspections");
  revalidatePath(`/owner/inspections/${edlData.id}`);

  return { success: true, edl: edlData };
}
