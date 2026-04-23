/**
 * API Route: Historical accounting backfill.
 *
 * POST /api/accounting/backfill
 * Body: { entityId, from?, dryRun? }
 *
 * Replays past payments / deposits / subscription invoices for an entity to
 * generate the missing double-entry bookings. Idempotent.
 *
 * Gated by requireAccountingAccess (plan Confort+). Owner must own the entity
 * and the entity must have accounting_enabled = true.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { runEntityBackfill } from "@/lib/accounting/backfill";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { ApiError, handleApiError } from "@/lib/helpers/api-error";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BackfillSchema = z.object({
  entityId: z.string().uuid(),
  from: z.string().optional(),
  dryRun: z.boolean().optional(),
});

async function resolveProfileId(supabase: ReturnType<typeof getServiceClient>, userId: string) {
  const { data: profile } = await (supabase as any).from("profiles").select("id").eq("user_id", userId).single();
  return (profile as { id: string } | null)?.id ?? null;
}

async function loadEntityForBackfill(
  supabase: ReturnType<typeof getServiceClient>,
  entityId: string,
  profileId: string,
) {
  const { data } = await (supabase as any)
    .from("legal_entities")
    .select("id, owner_profile_id, accounting_enabled")
    .eq("id", entityId)
    .maybeSingle();
  const row = data as {
    id: string;
    owner_profile_id: string;
    accounting_enabled: boolean | null;
  } | null;
  if (!row) {
    throw new ApiError(404, "Entité introuvable");
  }
  if (row.owner_profile_id !== profileId) {
    throw new ApiError(403, "Accès refusé à cette entité");
  }
  if (!row.accounting_enabled) {
    throw new ApiError(400, "Activez d'abord la comptabilité automatique pour cette entité.");
  }
}

export async function POST(request: Request) {
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
    const validation = BackfillSchema.safeParse(body);
    if (!validation.success) {
      throw new ApiError(400, validation.error.errors[0].message);
    }

    const { entityId, from, dryRun } = validation.data;
    await loadEntityForBackfill(serviceClient, entityId, profileId);

    const result = await runEntityBackfill(serviceClient as any, entityId, {
      from: from ?? null,
      dryRun: dryRun ?? false,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return handleApiError(error);
  }
}
