export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { withSecurity } from "@/lib/api/with-security";
import { INSURANCE_TYPES } from "@/lib/insurance/types";
import { enrichPolicyWithExpiry, sortPoliciesByUrgency } from "@/lib/insurance/helpers";

const createSchema = z.object({
  insurance_type: z.enum(INSURANCE_TYPES),
  insurer_name: z.string().min(1, "Nom de l'assureur requis").max(200),
  policy_number: z.string().max(100).optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (AAAA-MM-JJ)"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format date invalide (AAAA-MM-JJ)"),
  amount_covered_cents: z.number().int().positive().optional().nullable(),
  property_id: z.string().uuid().optional().nullable(),
  lease_id: z.string().uuid().optional().nullable(),
  document_id: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/insurance — Liste les assurances de l'utilisateur
 */
export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const url = new URL(request.url);
    const propertyId = url.searchParams.get("property_id");
    const leaseId = url.searchParams.get("lease_id");
    const type = url.searchParams.get("type");

    let query = supabase
      .from("insurance_policies")
      .select("*, properties(adresse_complete)")
      .eq("profile_id", profile.id)
      .order("end_date", { ascending: true });

    if (propertyId) query = query.eq("property_id", propertyId);
    if (leaseId) query = query.eq("lease_id", leaseId);
    if (type) query = query.eq("insurance_type", type);

    const { data: policies, error: queryError } = await query;

    if (queryError) {
      console.error("GET /api/insurance error:", queryError);
      return NextResponse.json({ error: "Erreur lors de la recuperation" }, { status: 500 });
    }

    const enriched = (policies || []).map((p: any) =>
      enrichPolicyWithExpiry(p, p.properties?.adresse_complete)
    );

    return NextResponse.json({
      data: sortPoliciesByUrgency(enriched),
      total: enriched.length,
    });
  } catch (err) {
    console.error("GET /api/insurance unexpected error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/insurance — Cree une nouvelle police d'assurance
 */
export const POST = withSecurity(async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Donnees invalides", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { data } = parsed;

    // Verifier que end_date > start_date
    if (new Date(data.end_date) <= new Date(data.start_date)) {
      return NextResponse.json(
        { error: "La date de fin doit etre posterieure a la date de debut" },
        { status: 400 }
      );
    }

    const { data: policy, error: insertError } = await supabase
      .from("insurance_policies")
      .insert({
        profile_id: profile.id,
        insurance_type: data.insurance_type,
        insurer_name: data.insurer_name,
        policy_number: data.policy_number || null,
        start_date: data.start_date,
        end_date: data.end_date,
        amount_covered_cents: data.amount_covered_cents || null,
        property_id: data.property_id || null,
        lease_id: data.lease_id || null,
        document_id: data.document_id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("POST /api/insurance error:", insertError);
      return NextResponse.json({ error: "Erreur lors de la creation" }, { status: 500 });
    }

    return NextResponse.json({ data: policy }, { status: 201 });
  } catch (err) {
    console.error("POST /api/insurance unexpected error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}, { routeName: "POST /api/insurance" });
