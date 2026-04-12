export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/copro/mandates
 * GET  — Liste les mandats du syndic (ou d'un site spécifique)
 * POST — Crée un nouveau mandat de syndic
 *
 * Note: cette route gère les mandats de SYNDIC (syndic_mandates),
 * distincts des mandats agence (table mandates) et des mandats SEPA.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";
import { checkCoproFeatureForProfile } from "@/lib/helpers/copro-feature-gate";
import { CreateSyndicMandateSchema } from "@/lib/validations/syndic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  const status = searchParams.get("status");

  const auth = await requireSyndic(request, { siteId });
  if (auth instanceof NextResponse) return auth;

  try {
    let query = auth.serviceClient
      .from("syndic_mandates")
      .select("*")
      .order("start_date", { ascending: false });

    if (siteId) {
      query = query.eq("site_id", siteId);
    } else if (!auth.isAdmin) {
      query = query.eq("syndic_profile_id", auth.profile.id);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("[mandates:GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = CreateSyndicMandateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    const auth = await requireSyndic(request, { siteId: input.site_id });
    if (auth instanceof NextResponse) return auth;

    // S1-2 : feature gate copro_module
    const gateError = await checkCoproFeatureForProfile(auth.profile.id);
    if (gateError) return gateError;

    // Seul un admin peut créer un mandat pour un autre syndic_profile_id
    if (!auth.isAdmin && input.syndic_profile_id !== auth.profile.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez créer un mandat que pour votre propre profil syndic" },
        { status: 403 }
      );
    }

    // Validation durée : la loi impose 1-36 mois
    const startDate = new Date(input.start_date);
    const endDate = new Date(input.end_date);
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: "La date de fin doit être postérieure à la date de début" },
        { status: 400 }
      );
    }

    const { data: mandate, error } = await auth.serviceClient
      .from("syndic_mandates")
      .insert({
        site_id: input.site_id,
        syndic_profile_id: input.syndic_profile_id,
        mandate_number: input.mandate_number || null,
        title: input.title,
        start_date: input.start_date,
        end_date: input.end_date,
        duration_months: input.duration_months,
        tacit_renewal: input.tacit_renewal,
        notice_period_months: input.notice_period_months,
        honoraires_annuels_cents: input.honoraires_annuels_cents,
        honoraires_particuliers: input.honoraires_particuliers || {},
        currency: input.currency,
        voted_in_assembly_id: input.voted_in_assembly_id || null,
        voted_resolution_id: input.voted_resolution_id || null,
        mandate_document_url: input.mandate_document_url || null,
        notes: input.notes || null,
        status: "draft",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(mandate, { status: 201 });
  } catch (error) {
    console.error("[mandates:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
