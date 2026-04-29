export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/syndic/site-claims/[claimId]
 * Body: { decision: 'approve' | 'reject', reason? }
 *
 * Le syndic approuve ou refuse une demande de rattachement.
 * Le trigger SQL apply_building_site_link met à jour buildings.site_id
 * et crée user_site_roles automatiquement.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSyndic } from "@/lib/helpers/syndic-auth";

const DecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
});

interface RouteParams {
  params: Promise<{ claimId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { claimId } = await params;
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json().catch(() => ({}));
    const parse = DecisionSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    // Récupérer le claim et vérifier qu'il vise bien un site du syndic
    const { data: claim } = await auth.serviceClient
      .from("building_site_links")
      .select("id, site_id, status")
      .eq("id", claimId)
      .maybeSingle();
    if (!claim) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }
    if ((claim as { status: string }).status !== "pending") {
      return NextResponse.json(
        { error: "Cette demande a déjà été traitée." },
        { status: 409 }
      );
    }

    // Vérifie que le syndic est bien gestionnaire du site
    const { data: site } = await auth.serviceClient
      .from("sites")
      .select("id, syndic_profile_id")
      .eq("id", (claim as { site_id: string }).site_id)
      .maybeSingle();
    if (!site) {
      return NextResponse.json({ error: "Copropriété introuvable" }, { status: 404 });
    }
    if (
      !auth.isAdmin &&
      (site as { syndic_profile_id: string }).syndic_profile_id !== auth.profile.id
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const newStatus = parse.data.decision === "approve" ? "approved" : "rejected";

    const { data: updated, error } = await auth.serviceClient
      .from("building_site_links")
      .update({
        status: newStatus,
        decided_by_profile_id: auth.profile.id,
        decided_at: new Date().toISOString(),
        decision_reason: parse.data.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
