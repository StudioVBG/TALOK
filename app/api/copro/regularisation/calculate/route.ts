export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireCoproFeature } from "@/lib/helpers/copro-feature-gate";

export async function POST(request: Request) {
  try {
    // S1-2 : auth + feature gate copro_module
    const access = await requireCoproFeature();
    if (access instanceof NextResponse) return access;

    const supabase = await createClient();
    const body = await request.json();
    const { property_id, period_start, period_end } = body;

    if (!property_id || !period_start || !period_end) {
      return NextResponse.json(
        { error: "property_id, period_start et period_end requis" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("calculate_lease_regularisation", {
      p_property_id: property_id,
      p_period_start: period_start,
      p_period_end: period_end,
    });

    if (error) {
      console.error("[Regularisation] Calculate error:", error);
      return NextResponse.json({ error: "Erreur de calcul" }, { status: 500 });
    }

    return NextResponse.json({ success: true, regularisation: data });
  } catch (error) {
    console.error("[Regularisation] Unexpected error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
