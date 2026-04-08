export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError } from "@/lib/helpers/api-error";

/**
 * GET /api/colocation/expenses/balances?property_id=xxx
 * Soldes entre colocataires
 */
export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);
    if (error || !user || !supabase) {
      return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
    }

    const url = new URL(request.url);
    const propertyId = url.searchParams.get("property_id");
    if (!propertyId) {
      return NextResponse.json({ error: "property_id requis" }, { status: 400 });
    }

    const { data: balances, error: dbError } = await supabase
      .from("v_colocation_balances")
      .select("*")
      .eq("property_id", propertyId);

    if (dbError) throw dbError;

    // Enrich with member names
    const memberIds = new Set<string>();
    for (const b of balances || []) {
      memberIds.add(b.payer_id as string);
      memberIds.add(b.debtor_id as string);
    }

    const { data: members } = await supabase
      .from("colocation_members")
      .select("id, profiles:tenant_profile_id(prenom, nom)")
      .in("id", Array.from(memberIds));

    const nameMap = new Map<string, string>();
    for (const m of members || []) {
      const p = m.profiles as any;
      if (p) {
        nameMap.set(m.id as string, `${p.prenom || ""} ${p.nom || ""}`.trim());
      }
    }

    const enriched = (balances || []).map((b: any) => ({
      ...b,
      payer_name: nameMap.get(b.payer_id) || "Inconnu",
      debtor_name: nameMap.get(b.debtor_id) || "Inconnu",
    }));

    return NextResponse.json({ balances: enriched });
  } catch (err) {
    return handleApiError(err);
  }
}
