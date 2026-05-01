export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET  /api/agency/visits          → liste des visites de l'agence
 * POST /api/agency/visits          → créer une visite (lié optionnellement à un prospect)
 *
 * Query params GET :
 *   ?upcoming=true       → seulement les futures
 *   ?prospect_id=<uuid>  → filtrer par prospect
 */

const createSchema = z.object({
  prospect_id: z.string().uuid().nullable().optional(),
  property_id: z.string().uuid().nullable().optional(),
  scheduled_at: z.string().datetime(),
  duration_minutes: z.number().int().positive().max(480).default(30),
  notes: z.string().max(2000).optional(),
});

async function getAgencyProfile() {
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
  return { user, profile };
}

export async function GET(request: NextRequest) {
  const auth = await getAgencyProfile();
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauth" ? "Non authentifié" : "Réservé aux agences" },
      { status: auth.error === "unauth" ? 401 : 403 },
    );
  }

  const url = new URL(request.url);
  const upcoming = url.searchParams.get("upcoming") === "true";
  const prospectId = url.searchParams.get("prospect_id");

  const serviceClient = getServiceClient();
  let query = serviceClient
    .from("agency_visits")
    .select(
      `
      id, scheduled_at, duration_minutes, status, notes,
      completed_at, cancellation_reason, created_at,
      prospect:agency_prospects(id, name, email, phone, status),
      property:properties(id, adresse_complete, ville)
    `,
    )
    .eq("agency_profile_id", auth.profile.id)
    .order("scheduled_at", { ascending: true });

  if (upcoming) {
    query = query
      .eq("status", "scheduled")
      .gte("scheduled_at", new Date().toISOString());
  }
  if (prospectId) {
    query = query.eq("prospect_id", prospectId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ visits: data ?? [], total: data?.length ?? 0 });
}

export async function POST(request: NextRequest) {
  const auth = await getAgencyProfile();
  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauth" ? "Non authentifié" : "Réservé aux agences" },
      { status: auth.error === "unauth" ? 401 : 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const serviceClient = getServiceClient();

  // Si on lie un prospect, on bascule automatiquement son statut à visit_scheduled
  // (sauf s'il est déjà à un statut plus avancé)
  if (parsed.data.prospect_id) {
    const { data: prospect } = await serviceClient
      .from("agency_prospects")
      .select("status, agency_profile_id")
      .eq("id", parsed.data.prospect_id)
      .maybeSingle();

    if (
      prospect &&
      prospect.agency_profile_id === auth.profile.id &&
      ["new", "contacted"].includes(prospect.status)
    ) {
      await serviceClient
        .from("agency_prospects")
        .update({
          status: "visit_scheduled",
          last_action_at: new Date().toISOString(),
          next_action_at: parsed.data.scheduled_at,
        })
        .eq("id", parsed.data.prospect_id);
    }
  }

  const { data, error } = await serviceClient
    .from("agency_visits")
    .insert({
      agency_profile_id: auth.profile.id,
      ...parsed.data,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
