export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

/**
 * GET /api/agency/prospects
 * Liste des prospects de l'agence connectée.
 * Filtres optionnels : ?status=new|contacted|... &search=<text>
 *
 * POST /api/agency/prospects
 * Crée un prospect.
 */

const createSchema = z.object({
  name: z.string().min(2).max(200),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
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
    .default("manual"),
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
    .default("new"),
  property_id: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  next_action_at: z.string().datetime().optional(),
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
    (profile.role !== "agency" &&
      profile.role !== "admin" &&
      profile.role !== "platform_admin")
  ) {
    return { error: "forbidden" as const };
  }

  return { user, profile };
}

export async function GET(request: NextRequest) {
  const auth = await getAgencyProfile();
  if ("error" in auth) {
    if (auth.error === "unauth") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return NextResponse.json({ error: "Réservé aux agences" }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.trim();

  const serviceClient = getServiceClient();
  let query = serviceClient
    .from("agency_prospects")
    .select(
      `
      id, name, email, phone, source, status,
      property_id, notes,
      last_action_at, next_action_at,
      lease_id, created_at, updated_at,
      property:properties(id, adresse_complete, ville)
    `,
    )
    .eq("agency_profile_id", auth.profile.id)
    .order("last_action_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let prospects = data ?? [];

  // Filtre côté client si recherche : nom/email/téléphone
  if (search) {
    const q = search.toLowerCase();
    prospects = prospects.filter((p: any) => {
      return (
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.phone && p.phone.toLowerCase().includes(q))
      );
    });
  }

  // Stats par statut pour la kanban
  const stats = (data ?? []).reduce<Record<string, number>>((acc, p: any) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ prospects, stats, total: prospects.length });
}

export async function POST(request: NextRequest) {
  const auth = await getAgencyProfile();
  if ("error" in auth) {
    if (auth.error === "unauth") {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return NextResponse.json({ error: "Réservé aux agences" }, { status: 403 });
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
  const { data, error } = await serviceClient
    .from("agency_prospects")
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
