export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/copro/resolutions/[resolutionId]/vote
 * POST — Enregistre un vote sur une résolution + met à jour les compteurs
 *
 * Logique :
 * 1. Vérifier que la résolution existe et que l'AG est en cours ou convoquée
 * 2. Créer le vote (unique par (resolution_id, unit_id))
 * 3. Recalculer les compteurs sur copro_resolutions (votes_for, tantiemes_for, etc.)
 * 4. Appliquer les règles de majorité pour déterminer le statut final
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";
import { CastVoteSchema } from "@/lib/validations/syndic";

interface RouteParams {
  params: { resolutionId: string };
}

// Détermine le statut d'une résolution selon la règle de majorité
function computeResolutionStatus(
  majorityRule: string,
  tantiemesFor: number,
  tantiemesAgainst: number,
  tantiemesAbstain: number,
  totalTantiemesPresent: number,
  totalTantiemesSite: number,
  votesForCount: number,
  votesAgainstCount: number,
  totalVotersCount: number
): "voted_for" | "voted_against" | "abstained" {
  // Article 24 : majorité simple des présents/représentés
  if (majorityRule === "article_24") {
    if (tantiemesFor > tantiemesAgainst) return "voted_for";
    return "voted_against";
  }

  // Article 25 : majorité absolue de TOUS les copropriétaires (pas juste présents)
  if (majorityRule === "article_25" || majorityRule === "article_25_1") {
    if (tantiemesFor > totalTantiemesSite / 2) return "voted_for";
    return "voted_against";
  }

  // Article 26 : double majorité (2/3 copropriétaires + 2/3 tantièmes)
  if (majorityRule === "article_26" || majorityRule === "article_26_1") {
    const twoThirdsTantiemes = (totalTantiemesSite * 2) / 3;
    const twoThirdsCount = (totalVotersCount * 2) / 3;
    if (tantiemesFor >= twoThirdsTantiemes && votesForCount >= twoThirdsCount) {
      return "voted_for";
    }
    return "voted_against";
  }

  // Unanimité
  if (majorityRule === "unanimite") {
    if (tantiemesAgainst === 0 && tantiemesAbstain === 0 && tantiemesFor === totalTantiemesSite) {
      return "voted_for";
    }
    return "voted_against";
  }

  return "abstained";
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json();
    const parseResult = CastVoteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;

    // Récupérer la résolution + l'assemblée
    const supabaseAdminClient = (await import("@/app/api/_lib/supabase")).supabaseAdmin();

    const { data: resolution, error: resolutionError } = await supabaseAdminClient
      .from("copro_resolutions")
      .select("id, assembly_id, site_id, majority_rule, status, resolution_number")
      .eq("id", params.resolutionId)
      .maybeSingle();

    if (resolutionError || !resolution) {
      return NextResponse.json({ error: "Résolution introuvable" }, { status: 404 });
    }

    const { data: assembly } = await supabaseAdminClient
      .from("copro_assemblies")
      .select("id, site_id, status")
      .eq("id", (resolution as any).assembly_id)
      .single();

    if (!assembly) {
      return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
    }

    // Vérifier l'accès au site
    const auth = await requireSyndic(request, { siteId: (assembly as any).site_id });
    if (auth instanceof NextResponse) return auth;

    // AG doit être en cours ou convoquée
    if (!["convened", "in_progress"].includes((assembly as any).status)) {
      return NextResponse.json(
        {
          error: `Impossible de voter sur une résolution dont l'assemblée est en statut '${(assembly as any).status}'`,
        },
        { status: 409 }
      );
    }

    // Enregistrer le vote
    const { data: vote, error: voteError } = await auth.serviceClient
      .from("copro_votes")
      .insert({
        resolution_id: (resolution as any).id,
        assembly_id: (resolution as any).assembly_id,
        site_id: (resolution as any).site_id,
        unit_id: input.unit_id,
        voter_profile_id: input.voter_profile_id || null,
        voter_name: input.voter_name,
        voter_tantiemes: input.voter_tantiemes,
        vote: input.vote,
        is_proxy: input.is_proxy,
        proxy_holder_profile_id: input.proxy_holder_profile_id || null,
        proxy_holder_name: input.proxy_holder_name || null,
        proxy_document_url: input.proxy_document_url || null,
        proxy_scope: input.proxy_scope || null,
        vote_method: input.vote_method,
      })
      .select()
      .single();

    if (voteError) {
      if ((voteError as any).code === "23505") {
        return NextResponse.json(
          { error: "Ce lot a déjà voté sur cette résolution" },
          { status: 409 }
        );
      }
      throw voteError;
    }

    // Recalculer les compteurs
    const { data: allVotes } = await auth.serviceClient
      .from("copro_votes")
      .select("vote, voter_tantiemes")
      .eq("resolution_id", (resolution as any).id);

    const counters = {
      votes_for_count: 0,
      votes_against_count: 0,
      votes_abstain_count: 0,
      tantiemes_for: 0,
      tantiemes_against: 0,
      tantiemes_abstain: 0,
    };

    for (const v of (allVotes || []) as any[]) {
      if (v.vote === "for") {
        counters.votes_for_count++;
        counters.tantiemes_for += v.voter_tantiemes || 0;
      } else if (v.vote === "against") {
        counters.votes_against_count++;
        counters.tantiemes_against += v.voter_tantiemes || 0;
      } else if (v.vote === "abstain") {
        counters.votes_abstain_count++;
        counters.tantiemes_abstain += v.voter_tantiemes || 0;
      }
    }

    // Récupérer total tantièmes du site pour calculer le statut final
    const { data: site } = await auth.serviceClient
      .from("sites")
      .select("total_tantiemes_general")
      .eq("id", (resolution as any).site_id)
      .single();

    const totalTantiemesSite = ((site as any)?.total_tantiemes_general as number) || 10000;
    const totalPresent = counters.tantiemes_for + counters.tantiemes_against + counters.tantiemes_abstain;
    const totalVoters = counters.votes_for_count + counters.votes_against_count + counters.votes_abstain_count;

    const newStatus = computeResolutionStatus(
      (resolution as any).majority_rule,
      counters.tantiemes_for,
      counters.tantiemes_against,
      counters.tantiemes_abstain,
      totalPresent,
      totalTantiemesSite,
      counters.votes_for_count,
      counters.votes_against_count,
      totalVoters
    );

    // Mettre à jour la résolution
    const { error: updateError } = await auth.serviceClient
      .from("copro_resolutions")
      .update({
        ...counters,
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", (resolution as any).id);

    if (updateError) {
      console.error("[vote:POST] Update counters error:", updateError);
    }

    return NextResponse.json(
      {
        success: true,
        vote,
        resolution: {
          id: (resolution as any).id,
          status: newStatus,
          counters,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[vote:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
