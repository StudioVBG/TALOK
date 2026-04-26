/**
 * API Route: Expert-Comptable Access — single-row operations
 * DELETE /api/accounting/ec/access/[id] - Revoke access
 * PATCH  /api/accounting/ec/access/[id] - Update contact info + preferences
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  ec_name: z.string().min(1).max(255).optional(),
  ec_email: z.string().email().optional(),
  ec_phone: z.string().max(32).nullable().optional(),
  access_level: z.enum(["read", "annotate", "validate"]).optional(),
  auto_send_on_closing: z.boolean().optional(),
  read_only_access: z.boolean().optional(),
});

/**
 * DELETE /api/accounting/ec/access/[id]
 * Revoke an EC access by setting revoked_at and is_active = false.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { error } = await (supabase as any)
      .from("ec_access")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("is_active", true);

    if (error) {
      throw new ApiError(500, "Erreur lors de la revocation de l'acces");
    }

    return NextResponse.json({ success: true, data: { revoked: true } });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/accounting/ec/access/[id]
 * Update contact fields (name / email / phone) and/or preferences
 * (access_level, auto_send_on_closing, read_only_access).
 *
 * Ownership is enforced via a join on legal_entities.owner_profile_id so an
 * owner cannot mutate an EC grant attached to another entity.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");

    const serviceClient = getServiceClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (!profile) throw new ApiError(403, "Profil non trouve");

    const parsed = PatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ApiError(400, parsed.error.errors[0].message);
    }
    const patch = parsed.data;
    if (Object.keys(patch).length === 0) {
      throw new ApiError(400, "Aucune modification à enregistrer");
    }

    // Ownership check: fetch the grant + its entity in one round-trip.
    const { data: access } = await (serviceClient as any)
      .from("ec_access")
      .select("id, entity_id, legal_entities!inner(owner_profile_id)")
      .eq("id", id)
      .maybeSingle();
    if (!access) throw new ApiError(404, "Accès introuvable");

    const ownerProfileId = access.legal_entities?.owner_profile_id;
    if (profile.role !== "admin" && ownerProfileId !== profile.id) {
      throw new ApiError(403, "Accès refusé");
    }

    const { data: updated, error } = await (serviceClient as any)
      .from("ec_access")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new ApiError(500, `Mise à jour impossible: ${error.message}`);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
