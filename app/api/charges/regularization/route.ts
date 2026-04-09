export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { regularizationCalculateSchema } from "@/lib/validations";
import { calculateRegularization } from "@/lib/charges/engine";
import { handleApiError } from "@/lib/helpers/api-error";

/**
 * GET /api/charges/regularization - List regularizations for a property
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get("property_id");
    const leaseId = searchParams.get("lease_id");

    let query = supabase
      .from("lease_charge_regularizations")
      .select("*")
      .order("fiscal_year", { ascending: false });

    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }
    if (leaseId) {
      query = query.eq("lease_id", leaseId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ regularizations: data });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * POST /api/charges/regularization - Calculate a regularization
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile as any).role !== "owner") {
      return NextResponse.json({ error: "Réservé aux propriétaires" }, { status: 403 });
    }

    const body = await request.json();
    const validated = regularizationCalculateSchema.parse(body);

    // Verify property ownership
    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .eq("id", validated.property_id)
      .eq("owner_id", (profile as any).id)
      .maybeSingle();

    if (!prop) {
      return NextResponse.json({ error: "Bien non trouvé" }, { status: 404 });
    }

    // Verify lease belongs to property
    const { data: lease } = await supabase
      .from("leases")
      .select("id, charges_forfaitaires")
      .eq("id", validated.lease_id)
      .eq("property_id", validated.property_id)
      .maybeSingle();

    if (!lease) {
      return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
    }

    // Fetch categories for property
    const { data: categories } = await supabase
      .from("charge_categories")
      .select("*")
      .eq("property_id", validated.property_id);

    // Fetch charge entries for the fiscal year
    const { data: entries } = await supabase
      .from("charge_entries")
      .select("*")
      .eq("property_id", validated.property_id)
      .eq("fiscal_year", validated.fiscal_year);

    // Calculate total provisions paid (from charge_provisions or lease monthly charges)
    const yearStart = `${validated.fiscal_year}-01-01`;
    const yearEnd = `${validated.fiscal_year}-12-31`;

    const { data: provisions } = await supabase
      .from("charge_provisions")
      .select("amount")
      .eq("lease_id", validated.lease_id)
      .gte("month", yearStart)
      .lte("month", yearEnd);

    let totalProvisionsCents = 0;
    if (provisions && provisions.length > 0) {
      totalProvisionsCents = provisions.reduce(
        (sum: number, p: any) => sum + Math.round(parseFloat(p.amount) * 100),
        0
      );
    } else {
      // Fallback: use lease charges_forfaitaires * 12
      const monthlyCharges = Math.round(
        parseFloat((lease as any).charges_forfaitaires || "0") * 100
      );
      totalProvisionsCents = monthlyCharges * 12;
    }

    // Calculate regularization using the engine
    const calculation = calculateRegularization({
      leaseId: validated.lease_id,
      propertyId: validated.property_id,
      fiscalYear: validated.fiscal_year,
      categories: (categories || []) as any,
      entries: (entries || []) as any,
      totalProvisionsCents,
    });

    // Upsert the regularization
    const { data: existing } = await supabase
      .from("lease_charge_regularizations")
      .select("id")
      .eq("lease_id", validated.lease_id)
      .eq("fiscal_year", validated.fiscal_year)
      .maybeSingle();

    let regularization;
    const regData = {
      lease_id: calculation.lease_id,
      property_id: calculation.property_id,
      fiscal_year: calculation.fiscal_year,
      total_provisions_cents: calculation.total_provisions_cents,
      total_actual_cents: calculation.total_actual_cents,
      detail_per_category: calculation.detail_per_category,
      status: "calculated",
    };

    if (existing) {
      const { data, error } = await supabase
        .from("lease_charge_regularizations")
        .update(regData as any)
        .eq("id", (existing as any).id)
        .select()
        .single();
      if (error) throw error;
      regularization = data;
    } else {
      const { data, error } = await supabase
        .from("lease_charge_regularizations")
        .insert(regData as any)
        .select()
        .single();
      if (error) throw error;
      regularization = data;
    }

    return NextResponse.json({ regularization, calculation });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
