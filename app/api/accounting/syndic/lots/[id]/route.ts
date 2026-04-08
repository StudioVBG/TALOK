// @ts-nocheck
/**
 * API Route: Syndic Copropriété — Lot Detail
 * GET    /api/accounting/syndic/lots/[id] - Get single lot
 * PATCH  /api/accounting/syndic/lots/[id] - Update lot
 * DELETE /api/accounting/syndic/lots/[id] - Soft-delete (is_active=false)
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";

export const dynamic = "force-dynamic";

interface Context {
  params: Promise<{ id: string }>;
}

const UpdateLotSchema = z.object({
  lotNumber: z.string().min(1).max(20).optional(),
  lotType: z
    .enum(["habitation", "commerce", "parking", "cave", "bureau", "autre"])
    .optional(),
  ownerName: z.string().min(1).max(255).optional(),
  ownerEntityId: z.string().uuid().nullable().optional(),
  ownerProfileId: z.string().uuid().nullable().optional(),
  tantieme: z.number().int().positive().optional(),
  tantièmesSpeciaux: z.record(z.number().int().positive()).optional(),
  surfaceM2: z.number().positive().nullable().optional(),
});

/**
 * GET /api/accounting/syndic/lots/[id]
 */
export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(403, "Profil non trouve");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { data: lot, error } = await (supabase as any)
      .from("copro_lots")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !lot) {
      throw new ApiError(404, "Lot non trouve");
    }

    return NextResponse.json({ success: true, data: lot });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/accounting/syndic/lots/[id]
 */
export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(403, "Profil non trouve");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const body = await request.json();
    const validation = UpdateLotSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const data = validation.data;

    // Build update object with snake_case keys
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.lotNumber !== undefined) update.lot_number = data.lotNumber;
    if (data.lotType !== undefined) update.lot_type = data.lotType;
    if (data.ownerName !== undefined) update.owner_name = data.ownerName;
    if (data.ownerEntityId !== undefined) update.owner_entity_id = data.ownerEntityId;
    if (data.ownerProfileId !== undefined) update.owner_profile_id = data.ownerProfileId;
    if (data.tantieme !== undefined) update.tantiemes_generaux = data.tantieme;
    if (data.tantièmesSpeciaux !== undefined) update.tantiemes_speciaux = data.tantièmesSpeciaux;
    if (data.surfaceM2 !== undefined) update.surface_m2 = data.surfaceM2;

    const { data: lot, error } = await (supabase as any)
      .from("copro_lots")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error || !lot) {
      throw new ApiError(404, "Lot non trouve ou erreur mise a jour");
    }

    return NextResponse.json({ success: true, data: lot });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/accounting/syndic/lots/[id]
 * Soft-delete: sets is_active = false
 */
export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(403, "Profil non trouve");

    const featureGate = await requireAccountingAccess(profile.id, "entries");
    if (featureGate) return featureGate;

    const { data: lot, error } = await (supabase as any)
      .from("copro_lots")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !lot) {
      throw new ApiError(404, "Lot non trouve");
    }

    return NextResponse.json({
      success: true,
      message: `Lot ${lot.lot_number} desactive`,
      data: lot,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
