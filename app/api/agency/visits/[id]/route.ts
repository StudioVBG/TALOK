export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * PATCH  /api/agency/visits/[id]   → mise à jour (status, notes, scheduled_at)
 * DELETE /api/agency/visits/[id]   → suppression
 *
 * Si status passe à 'completed' : on bascule le prospect lié à 'visited'.
 */

const updateSchema = z.object({
  scheduled_at: z.string().datetime().optional(),
  duration_minutes: z.number().int().positive().max(480).optional(),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).optional(),
  notes: z.string().max(2000).optional(),
  cancellation_reason: z.string().max(500).optional(),
});

async function getAgencyAccess(visitId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { error: "unauth" as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (
    !profile ||
    !["agency", "admin", "platform_admin"].includes(profile.role)
  ) {
    return { error: "forbidden" as const };
  }

  const serviceClient = getServiceClient();
  const { data: visit } = await serviceClient
    .from("agency_visits")
    .select("id, agency_profile_id, status, prospect_id")
    .eq("id", visitId)
    .maybeSingle();

  if (!visit) return { error: "notfound" as const };

  const isOwner = visit.agency_profile_id === profile.id;
  const isAdmin = ["admin", "platform_admin"].includes(profile.role);
  if (!isOwner && !isAdmin) return { error: "forbidden" as const };

  return { user, profile, visit, serviceClient };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await getAgencyAccess(id);
  if ("error" in access) {
    const map = { unauth: 401, forbidden: 403, notfound: 404 } as const;
    return NextResponse.json(
      { error: "Accès refusé ou visite introuvable" },
      { status: map[access.error] ?? 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { ...parsed.data };

  // Si on passe à 'completed', enregistrer la date + faire avancer le prospect
  if (
    parsed.data.status === "completed" &&
    access.visit.status !== "completed"
  ) {
    updates.completed_at = new Date().toISOString();

    if (access.visit.prospect_id) {
      // Faire passer le prospect à 'visited' s'il était en visit_scheduled
      await access.serviceClient
        .from("agency_prospects")
        .update({
          status: "visited",
          last_action_at: new Date().toISOString(),
          next_action_at: null,
        })
        .eq("id", access.visit.prospect_id)
        .eq("status", "visit_scheduled");
    }
  }

  const { data, error } = await access.serviceClient
    .from("agency_visits")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await getAgencyAccess(id);
  if ("error" in access) {
    const map = { unauth: 401, forbidden: 403, notfound: 404 } as const;
    return NextResponse.json(
      { error: "Accès refusé ou visite introuvable" },
      { status: map[access.error] ?? 400 },
    );
  }

  const { error } = await access.serviceClient
    .from("agency_visits")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
