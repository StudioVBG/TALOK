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

async function assertEntityOwnership(
  supabase: ReturnType<typeof getServiceClient>,
  entityId: string,
  profileId: string,
) {
  const { data } = await (supabase as any)
    .from("legal_entities")
    .select("id, owner_profile_id")
    .eq("id", entityId)
    .maybeSingle();
  const row = data as { id: string; owner_profile_id: string } | null;
  if (!row) {
    throw new ApiError(404, "Entité introuvable");
  }
  if (row.owner_profile_id !== profileId) {
    throw new ApiError(403, "Accès refusé à cette entité");
  }
}

/**
 * GET /api/accounting/settings?entityId=<uuid>
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const serviceClient = getServiceClient();
    const profileId = await resolveProfileId(serviceClient, user.id);
    if (!profileId) throw new ApiError(403, "Profil introuvable");

    const gate = await requireAccountingAccess(profileId, "entries");
    if (gate) return gate;

    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get("entityId");
    if (!entityId) throw new ApiError(400, "entityId requis");

    await assertEntityOwnership(serviceClient, entityId, profileId);

    const { data } = await (serviceClient as any)
      .from("legal_entities")
      .select("id, accounting_enabled, declaration_mode, regime_fiscal")
      .eq("id", entityId)
      .single();

    const row = data as {
      id: string;
      accounting_enabled: boolean | null;
      declaration_mode: string | null;
      regime_fiscal: string | null;
    };

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
    return handleApiError(error);
  }
}

/**
 * PATCH /api/accounting/settings
 * Body: { entityId, accountingEnabled?, declarationMode? }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const serviceClient = getServiceClient();
    const profileId = await resolveProfileId(serviceClient, user.id);
    if (!profileId) throw new ApiError(403, "Profil introuvable");

    const gate = await requireAccountingAccess(profileId, "entries");
    if (gate) return gate;

    const body = await request.json();
    const validation = PatchSettingsSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entityId, accountingEnabled, declarationMode } = validation.data;
    await assertEntityOwnership(serviceClient, entityId, profileId);

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

    const { data, error } = await (serviceClient as any)
      .from("legal_entities")
      .update(update)
      .eq("id", entityId)
      .select("id, accounting_enabled, declaration_mode")
      .single();

    if (error) {
      console.error("[Accounting Settings] update failed:", error);
      throw new ApiError(500, "Mise à jour impossible");
    }

    const row = data as {
      id: string;
      accounting_enabled: boolean;
      declaration_mode: string;
    };

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
    return handleApiError(error);
  }
}
