export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/copro/fonds-travaux/movements?site_id=...   Liste les mouvements
 * POST /api/copro/fonds-travaux/movements                Crée un mouvement
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSyndic } from "@/lib/helpers/syndic-auth";

const MovementSchema = z.object({
  site_id: z.string().uuid(),
  fonds_id: z.string().uuid().optional(),
  movement_type: z.enum(["cotisation", "travaux", "interets", "remboursement", "autre"]),
  direction: z.enum(["credit", "debit"]),
  amount_cents: z.number().int().positive(),
  movement_date: z.string().optional(),
  description: z.string().max(500).optional(),
  reference: z.string().max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("site_id");
    if (!siteId) {
      return NextResponse.json({ error: "site_id requis" }, { status: 400 });
    }

    const auth = await requireSyndic(request, { siteId });
    if (auth instanceof NextResponse) return auth;

    const { data, error } = await auth.serviceClient
      .from("copro_fonds_travaux_movements")
      .select("*")
      .eq("site_id", siteId)
      .order("movement_date", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parse = MovementSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parse.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parse.data;
    const auth = await requireSyndic(request, { siteId: input.site_id });
    if (auth instanceof NextResponse) return auth;

    let fondsId = input.fonds_id;
    if (!fondsId) {
      const { data: fonds } = await auth.serviceClient
        .from("copro_fonds_travaux")
        .select("id")
        .eq("site_id", input.site_id)
        .eq("status", "active")
        .order("fiscal_year", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!fonds) {
        return NextResponse.json(
          { error: "Aucun fonds de travaux actif. Créez-en un d'abord." },
          { status: 400 }
        );
      }
      fondsId = (fonds as { id: string }).id;
    }

    const { data: inserted, error: insertError } = await auth.serviceClient
      .from("copro_fonds_travaux_movements")
      .insert({
        fonds_id: fondsId,
        site_id: input.site_id,
        movement_type: input.movement_type,
        direction: input.direction,
        amount_cents: input.amount_cents,
        movement_date: input.movement_date ?? new Date().toISOString().split("T")[0],
        description: input.description ?? null,
        reference: input.reference ?? null,
        created_by_profile_id: auth.profile.id,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
