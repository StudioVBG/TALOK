export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/copro/fonds-travaux
 * GET  — Liste les fonds travaux (loi ALUR) d'un site par exercice
 * POST — Crée un nouveau fonds travaux pour un exercice
 *
 * Loi ALUR 2014 article 58 : cotisation minimale 5% du budget prévisionnel.
 * Obligatoire pour les copropriétés > 5 ans depuis le 1er janvier 2017.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";
import { CreateFondsTravauxSchema } from "@/lib/validations/syndic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const fiscalYear = searchParams.get("fiscalYear");

  const auth = await requireSyndic(request, { siteId });
  if (auth instanceof NextResponse) return auth;

  try {
    let query = auth.serviceClient
      .from("copro_fonds_travaux")
      .select("*")
      .order("fiscal_year", { ascending: false });

    if (siteId) {
      query = query.eq("site_id", siteId);
    } else if (!auth.isAdmin) {
      const { data: mySites } = await auth.serviceClient
        .from("sites")
        .select("id")
        .eq("syndic_profile_id", auth.profile.id);
      const siteIds = (mySites || []).map((s: any) => s.id);
      if (siteIds.length === 0) return NextResponse.json([]);
      query = query.in("site_id", siteIds);
    }

    if (fiscalYear) {
      query = query.eq("fiscal_year", parseInt(fiscalYear, 10));
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("[fonds-travaux:GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = CreateFondsTravauxSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    const auth = await requireSyndic(request, { siteId: input.site_id });
    if (auth instanceof NextResponse) return auth;

    // Validation : si non exempt, le taux doit être >= 5% (loi ALUR)
    if (!input.loi_alur_exempt && input.cotisation_taux_percent < 5) {
      return NextResponse.json(
        {
          error:
            "Loi ALUR : le taux de cotisation doit être d'au moins 5% du budget prévisionnel (sauf exemption votée)",
        },
        { status: 400 }
      );
    }

    // Si exempt, une raison doit être fournie
    if (input.loi_alur_exempt && !input.exempt_reason) {
      return NextResponse.json(
        { error: "Une raison d'exemption doit être fournie si loi_alur_exempt est true" },
        { status: 400 }
      );
    }

    const { data: fund, error } = await auth.serviceClient
      .from("copro_fonds_travaux")
      .insert({
        site_id: input.site_id,
        exercise_id: input.exercise_id || null,
        fiscal_year: input.fiscal_year,
        cotisation_taux_percent: input.cotisation_taux_percent,
        cotisation_montant_annual_cents: input.cotisation_montant_annual_cents,
        budget_reference_cents: input.budget_reference_cents || null,
        solde_initial_cents: input.solde_initial_cents,
        solde_actuel_cents: input.solde_initial_cents,
        dedicated_bank_account: input.dedicated_bank_account || null,
        bank_name: input.bank_name || null,
        loi_alur_exempt: input.loi_alur_exempt,
        exempt_reason: input.exempt_reason || null,
        exempt_voted_resolution_id: input.exempt_voted_resolution_id || null,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        return NextResponse.json(
          { error: `Un fonds travaux existe déjà pour l'année ${input.fiscal_year}` },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(fund, { status: 201 });
  } catch (error) {
    console.error("[fonds-travaux:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
