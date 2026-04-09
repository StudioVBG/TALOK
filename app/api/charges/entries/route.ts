export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { chargeEntryCreateSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/helpers/api-error";

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
    const fiscalYear = searchParams.get("fiscal_year");

    if (!propertyId) {
      return NextResponse.json(
        { error: "property_id requis" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("charge_entries")
      .select("*, category:charge_categories(*)")
      .eq("property_id", propertyId)
      .order("date", { ascending: false });

    if (fiscalYear) {
      query = query.eq("fiscal_year", parseInt(fiscalYear, 10));
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json({ entries: data });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

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
    const validated = chargeEntryCreateSchema.parse(body);

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

    // Verify category belongs to this property
    const { data: cat } = await supabase
      .from("charge_categories")
      .select("id")
      .eq("id", validated.category_id)
      .eq("property_id", validated.property_id)
      .maybeSingle();

    if (!cat) {
      return NextResponse.json(
        { error: "Catégorie introuvable pour ce bien" },
        { status: 404 }
      );
    }

    const { data: entry, error } = await supabase
      .from("charge_entries")
      .insert(validated as any)
      .select("*, category:charge_categories(*)")
      .single();

    if (error) throw error;
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
