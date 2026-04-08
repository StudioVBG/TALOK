export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

/**
 * GET /api/agency/mandates/[id] — Get mandate detail
 * PATCH /api/agency/mandates/[id] — Update mandate
 */

const updateMandateSchema = z.object({
  mandate_type: z.enum(["gestion", "location", "syndic", "transaction"]).optional(),
  end_date: z.string().nullable().optional(),
  tacit_renewal: z.boolean().optional(),
  management_fee_type: z.enum(["percentage", "fixed"]).optional(),
  management_fee_rate: z.number().min(0).max(100).optional(),
  management_fee_fixed_cents: z.number().optional(),
  property_ids: z.array(z.string().uuid()).optional(),
  mandant_bank_iban: z.string().nullable().optional(),
  mandant_bank_bic: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "terminated", "expired"]).optional(),
});

async function getAgencyProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "agency" && profile.role !== "admin")) {
    return null;
  }

  return profile;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const profile = await getAgencyProfile(supabase);

    if (!profile) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const { data: mandate, error } = await supabase
      .from("agency_mandates")
      .select(`
        *,
        owner:profiles!agency_mandates_owner_profile_id_fkey(
          id, prenom, nom, email, telephone
        ),
        crgs:agency_crg(
          id, period_start, period_end, total_rent_collected_cents,
          total_fees_cents, net_reversement_cents, status, sent_at, created_at
        ),
        account:agency_mandant_accounts(
          id, balance_cents, last_reversement_at, reversement_overdue
        )
      `)
      .eq("id", id)
      .eq("agency_profile_id", profile.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Mandat non trouve" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ mandate });
  } catch (error: unknown) {
    console.error("[agency/mandates/[id] GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const profile = await getAgencyProfile(supabase);

    if (!profile) {
      return NextResponse.json({ error: "Non autorise" }, { status: 401 });
    }

    const body = await request.json();
    const validated = updateMandateSchema.parse(body);

    const { data: mandate, error } = await supabase
      .from("agency_mandates")
      .update(validated)
      .eq("id", id)
      .eq("agency_profile_id", profile.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ mandate });
  } catch (error: unknown) {
    if ((error as any)?.name === "ZodError") {
      return NextResponse.json(
        { error: "Donnees invalides", details: (error as any).errors },
        { status: 400 }
      );
    }
    console.error("[agency/mandates/[id] PATCH]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
