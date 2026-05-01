export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/buildings/[id]/syndic-summary
 *
 * Si le building est `linked` à un site syndic, retourne un résumé
 * lecture-seule pour le copropriétaire bailleur :
 *   - prochaine AG
 *   - dernier appel de fonds (et ce qu'il doit)
 *   - documents officiels récents (PV, DPE collectif, règlement copro)
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: buildingId } = await params;
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = getServiceClient();

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }
    const profileId = (profile as { id: string }).id;

    const { data: building } = await serviceClient
      .from("buildings")
      .select("id, owner_id, site_id, site_link_status")
      .eq("id", buildingId)
      .maybeSingle();
    if (!building) {
      return NextResponse.json({ error: "Immeuble introuvable" }, { status: 404 });
    }
    const b = building as {
      owner_id: string;
      site_id: string | null;
      site_link_status: string;
    };
    if (b.owner_id !== profileId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (!b.site_id || b.site_link_status !== "linked") {
      return NextResponse.json({
        linked: false,
        next_assembly: null,
        latest_fund_call: null,
        recent_documents: [],
      });
    }

    const today = new Date().toISOString();

    // Prochaine AG
    const { data: nextAssembly } = await serviceClient
      .from("copro_assemblies")
      .select("id, title, reference_number, assembly_type, scheduled_at, location, online_meeting_url, status")
      .eq("site_id", b.site_id)
      .gte("scheduled_at", today)
      .in("status", ["draft", "convened", "in_progress"])
      .order("scheduled_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    // Dernier appel de fonds émis sur le site
    const { data: latestFundCall } = await serviceClient
      .from("copro_fund_calls")
      .select(
        "id, call_number, period_label, due_date, total_amount_cents, total_amount, status"
      )
      .eq("site_id", b.site_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Calcul du solde exact :
    //   - on récupère les copro_lot_id mappés sur les building_units du building
    //   - on filtre les lignes du fund call sur ces lot_id
    //   - si aucun mapping, on retourne null (solde non calculable précisément)
    let userOwedCents: number | null = null;
    let mappingUsed = false;
    if (latestFundCall) {
      const { data: mappedUnits } = await serviceClient
        .from("building_units")
        .select("copro_lot_id")
        .eq("building_id", buildingId)
        .not("copro_lot_id", "is", null);
      const mappedLotIds = (mappedUnits ?? [])
        .map((u) => (u as { copro_lot_id: string | null }).copro_lot_id)
        .filter((v): v is string => v !== null);

      if (mappedLotIds.length > 0) {
        mappingUsed = true;
        const { data: lines } = await serviceClient
          .from("copro_fund_call_lines")
          .select("amount_cents, paid_cents, lot_id")
          .eq("call_id", (latestFundCall as { id: string }).id)
          .in("lot_id", mappedLotIds);
        userOwedCents = (lines ?? []).reduce(
          (sum, l) =>
            sum +
            Math.max(
              0,
              ((l as { amount_cents: number }).amount_cents ?? 0) -
                ((l as { paid_cents: number }).paid_cents ?? 0)
            ),
          0
        );
      }
    }

    // Derniers PV de copro (3 plus récents)
    const { data: minutes } = await serviceClient
      .from("copro_minutes")
      .select(
        "id, version, status, signed_by_president_at, distributed_at, assembly_id, assembly:copro_assemblies(title, scheduled_at)"
      )
      .order("distributed_at", { ascending: false, nullsFirst: false })
      .limit(3);

    return NextResponse.json({
      linked: true,
      site_id: b.site_id,
      next_assembly: nextAssembly ?? null,
      latest_fund_call: latestFundCall
        ? {
            ...(latestFundCall as Record<string, unknown>),
            user_owed_cents: userOwedCents,
            mapping_used: mappingUsed,
          }
        : null,
      recent_documents: minutes ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
