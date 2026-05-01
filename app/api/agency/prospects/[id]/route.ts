export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * PATCH /api/agency/prospects/[id]
 *   Met à jour un prospect (status, notes, next_action_at, etc.).
 *   Met automatiquement à jour last_action_at sur changement de status.
 *
 * DELETE /api/agency/prospects/[id]
 *   Supprime définitivement un prospect.
 */

const updateSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  email: z
    .string()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: z.string().optional(),
  source: z
    .enum([
      "manual",
      "website",
      "leboncoin",
      "seloger",
      "pap",
      "recommandation",
      "other",
    ])
    .optional(),
  status: z
    .enum([
      "new",
      "contacted",
      "visit_scheduled",
      "visited",
      "applied",
      "signed",
      "lost",
    ])
    .optional(),
  property_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).optional(),
  next_action_at: z.string().datetime().nullable().optional(),
  lease_id: z.string().uuid().nullable().optional(),
});

async function getAgencyAccess(prospectId: string) {
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

  if (!profile) return { error: "unauth" as const };
  if (
    profile.role !== "agency" &&
    profile.role !== "admin" &&
    profile.role !== "platform_admin"
  ) {
    return { error: "forbidden" as const };
  }

  // Vérifier que le prospect appartient à cette agence
  const serviceClient = getServiceClient();
  const { data: prospect } = await serviceClient
    .from("agency_prospects")
    .select("id, agency_profile_id, status")
    .eq("id", prospectId)
    .maybeSingle();

  if (!prospect) return { error: "notfound" as const };

  const isOwner = prospect.agency_profile_id === profile.id;
  const isPlatformAdmin = ["admin", "platform_admin"].includes(profile.role);

  if (!isOwner && !isPlatformAdmin) {
    return { error: "forbidden" as const };
  }

  return { user, profile, prospect, serviceClient };
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
      { error: "Accès refusé ou prospect introuvable" },
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

  // Si status change, on met à jour last_action_at
  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status && parsed.data.status !== access.prospect.status) {
    updates.last_action_at = new Date().toISOString();
  }

  const { data, error } = await access.serviceClient
    .from("agency_prospects")
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
      { error: "Accès refusé ou prospect introuvable" },
      { status: map[access.error] ?? 400 },
    );
  }

  const { error } = await access.serviceClient
    .from("agency_prospects")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
