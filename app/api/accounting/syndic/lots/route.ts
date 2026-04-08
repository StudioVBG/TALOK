/**
 * API Route: Syndic Copropriété — Lots
 * GET  /api/accounting/syndic/lots  - List lots for an entity
 * POST /api/accounting/syndic/lots  - Create a new lot + auto-create sub-account 450xxx
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { z } from "zod";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { getCoproAccount } from "@/lib/accounting/syndic/fund-calls";

export const dynamic = "force-dynamic";

const CreateLotSchema = z.object({
  entityId: z.string().uuid(),
  lotNumber: z.string().min(1).max(20),
  lotType: z
    .enum(["habitation", "commerce", "parking", "cave", "bureau", "autre"])
    .default("habitation"),
  ownerName: z.string().min(1).max(255),
  ownerEntityId: z.string().uuid().optional(),
  ownerProfileId: z.string().uuid().optional(),
  tantieme: z.number().int().positive(),
  tantièmesSpeciaux: z.record(z.number().int().positive()).optional(),
  surfaceM2: z.number().positive().optional(),
});

/**
 * GET /api/accounting/syndic/lots?entityId=xxx
 */
export async function GET(request: Request) {
  try {
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

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");

    if (!entityId) {
      throw new ApiError(400, "entityId est requis");
    }

    const { data: lots, error } = await supabase
      .from("copro_lots")
      .select("*")
      .eq("copro_entity_id", entityId)
      .order("lot_number");

    if (error) {
      throw new ApiError(500, `Erreur chargement lots: ${error.message}`);
    }

    // Compute total tantiemes
    const totalTantiemes = (lots ?? []).reduce(
      (sum, lot) => sum + (lot.tantiemes_generaux as number),
      0,
    );

    return NextResponse.json({
      success: true,
      data: lots ?? [],
      meta: { totalTantiemes, count: lots?.length ?? 0 },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/syndic/lots
 */
export async function POST(request: Request) {
  try {
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
    const validation = CreateLotSchema.safeParse(body);

    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const data = validation.data;

    // Insert lot
    const { data: lot, error: lotError } = await supabase
      .from("copro_lots")
      .insert({
        copro_entity_id: data.entityId,
        lot_number: data.lotNumber,
        lot_type: data.lotType,
        owner_name: data.ownerName,
        owner_entity_id: data.ownerEntityId ?? null,
        owner_profile_id: data.ownerProfileId ?? null,
        tantiemes_generaux: data.tantieme,
        tantiemes_speciaux: data.tantièmesSpeciaux ?? {},
        surface_m2: data.surfaceM2 ?? null,
      })
      .select()
      .single();

    if (lotError) {
      if (lotError.code === "23505") {
        throw new ApiError(
          409,
          `Le lot ${data.lotNumber} existe deja pour cette copropriete`,
        );
      }
      throw new ApiError(500, `Erreur creation lot: ${lotError.message}`);
    }

    // Auto-create sub-account 450xxx in chart_of_accounts
    const coproAccountNumber = getCoproAccount(data.lotNumber);

    await supabase.from("chart_of_accounts").upsert(
      {
        entity_id: data.entityId,
        account_number: coproAccountNumber,
        label: `Coproprietaire — ${data.ownerName} (lot ${data.lotNumber})`,
        account_type: "asset",
        plan_type: "copro",
      },
      { onConflict: "entity_id,account_number" },
    );

    return NextResponse.json(
      { success: true, data: lot, coproAccount: coproAccountNumber },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
