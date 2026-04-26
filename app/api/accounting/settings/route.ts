/**
 * API Route: Accounting settings per entity.
 *
 * GET   /api/accounting/settings?entityId=... → read accounting_enabled +
 *                                               declaration_mode for the entity
 * PATCH /api/accounting/settings              → update accounting_enabled,
 *                                               declaration_mode, regime_fiscal
 *
 * Gated by requireAccountingAccess (plan Confort+). The owner must also own
 * the entity (checked via owner_profile_id match).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchSettingsSchema = z.object({
  entityId: z.string().uuid(),
  accountingEnabled: z.boolean().optional(),
  declarationMode: z.enum(["micro_foncier", "reel", "is_comptable"]).optional(),
});

async function resolveProfileId(supabase: ReturnType<typeof getServiceClient>, userId: string) {
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();
  return (profile as { id: string } | null)?.id ?? null;
}

/**
 * GET /api/accounting/settings?entityId=<uuid>
 */
export async function GET(request: Request) {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    timings.auth = Date.now() - t0;
    if (!user) throw new ApiError(401, "Non authentifié");

    const serviceClient = getServiceClient();
    const tProfile = Date.now();
    const profileId = await resolveProfileId(serviceClient, user.id);
    timings.profile = Date.now() - tProfile;
    if (!profileId) throw new ApiError(403, "Profil introuvable");

    const tGate = Date.now();
    const gate = await requireAccountingAccess(profileId, "entries");
    timings.gate = Date.now() - tGate;
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    if (!entityId) throw new ApiError(400, "entityId requis");

    // Fetch ownership + settings in a single round-trip, then enforce
    // ownership in memory. Previously this was two sequential queries on
    // the same row.
    const tEntity = Date.now();
    const { data } = await (serviceClient as any)
      .from("legal_entities")
      .select("id, owner_profile_id, accounting_enabled, declaration_mode, regime_fiscal")
      .eq("id", entityId)
      .maybeSingle();
    timings.entity = Date.now() - tEntity;

    const row = data as {
      id: string;
      owner_profile_id: string;
      accounting_enabled: boolean | null;
      declaration_mode: string | null;
      regime_fiscal: string | null;
    } | null;
    if (!row) throw new ApiError(404, "Entité introuvable");
    if (row.owner_profile_id !== profileId) {
      throw new ApiError(403, "Accès refusé à cette entité");
    }

    timings.total = Date.now() - t0;
    if (timings.total > 1000) {
      console.warn("[perf] GET /api/accounting/settings slow", timings);
    } else if (process.env.NODE_ENV === "development") {
      console.log("[perf] GET /api/accounting/settings", timings);
    }

    return NextResponse.json({
      success: true,
      data: {
        entityId: row.id,
        accountingEnabled: row.accounting_enabled ?? false,
        declarationMode: (row.declaration_mode ?? "reel") as
          | "micro_foncier"
          | "reel"
          | "is_comptable",
        regimeFiscal: row.regime_fiscal,
      },
    });
  } catch (error) {
    timings.total = Date.now() - t0;
    if (timings.total > 1000) {
      console.warn("[perf] GET /api/accounting/settings slow (error)", timings);
    }
    return handleApiError(error);
  }
}

/**
 * PATCH /api/accounting/settings
 * Body: { entityId, accountingEnabled?, declarationMode? }
 */
export async function PATCH(request: Request) {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    timings.auth = Date.now() - t0;
    if (!user) throw new ApiError(401, "Non authentifié");

    const serviceClient = getServiceClient();
    const tProfile = Date.now();
    const profileId = await resolveProfileId(serviceClient, user.id);
    timings.profile = Date.now() - tProfile;
    if (!profileId) throw new ApiError(403, "Profil introuvable");

    const tGate = Date.now();
    const gate = await requireAccountingAccess(profileId, "entries");
    timings.gate = Date.now() - tGate;
    if (gate) return gate;

    const body = await request.json();
    const validation = PatchSettingsSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entityId, accountingEnabled, declarationMode } = validation.data;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof accountingEnabled === "boolean") {
      update.accounting_enabled = accountingEnabled;
    }
    if (declarationMode) {
      update.declaration_mode = declarationMode;
    }

    if (Object.keys(update).length === 1) {
      // Only updated_at — nothing to change
      throw new ApiError(400, "Aucun champ à mettre à jour");
    }

    // Fold ownership check into the UPDATE via the owner_profile_id filter.
    // If no row matches we distinguish 404 vs 403 with a single follow-up
    // lookup, but only in the unhappy path.
    const tUpdate = Date.now();
    const { data, error } = await (serviceClient as any)
      .from("legal_entities")
      .update(update)
      .eq("id", entityId)
      .eq("owner_profile_id", profileId)
      .select("id, accounting_enabled, declaration_mode")
      .maybeSingle();
    timings.update = Date.now() - tUpdate;

    if (error) {
      console.error("[Accounting Settings] update failed:", error);
      throw new ApiError(500, "Mise à jour impossible");
    }

    if (!data) {
      const { data: existing } = await (serviceClient as any)
        .from("legal_entities")
        .select("id")
        .eq("id", entityId)
        .maybeSingle();
      if (!existing) throw new ApiError(404, "Entité introuvable");
      throw new ApiError(403, "Accès refusé à cette entité");
    }

    const row = data as {
      id: string;
      accounting_enabled: boolean;
      declaration_mode: string;
    };

    timings.total = Date.now() - t0;
    if (timings.total > 1000) {
      console.warn("[perf] PATCH /api/accounting/settings slow", timings);
    } else if (process.env.NODE_ENV === "development") {
      console.log("[perf] PATCH /api/accounting/settings", timings);
    }

    return NextResponse.json({
      success: true,
      data: {
        entityId: row.id,
        accountingEnabled: row.accounting_enabled,
        declarationMode: row.declaration_mode as
          | "micro_foncier"
          | "reel"
          | "is_comptable",
      },
    });
  } catch (error) {
    timings.total = Date.now() - t0;
    if (timings.total > 1000) {
      console.warn("[perf] PATCH /api/accounting/settings slow (error)", timings);
    }
    return handleApiError(error);
  }
}
