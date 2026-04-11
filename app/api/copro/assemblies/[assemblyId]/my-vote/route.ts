export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Routes dédiées au copropriétaire (portail /copro).
 *
 * GET /api/copro/assemblies/[id]/my-vote
 *   Retourne l'assemblée, les résolutions, les lots du copropriétaire connecté
 *   et ses votes déjà enregistrés.
 *
 * POST /api/copro/assemblies/[id]/my-vote
 *   Enregistre un vote en ligne par le copropriétaire connecté.
 *   Seuls les votes pour ses propres lots sont acceptés.
 *
 * Contraintes:
 *   - L'assemblée doit être en statut 'convened' ou 'in_progress'
 *   - L'utilisateur doit avoir un rôle dans user_site_roles pour le site
 *   - Un lot ne peut voter qu'une fois par résolution (unique DB constraint)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/app/api/_lib/supabase";

interface RouteParams {
  params: { assemblyId: string };
}

const CastOnlineVoteSchema = z.object({
  resolution_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  vote: z.enum(["for", "against", "abstain"]),
});

// ============================================
// GET — my assembly view
// ============================================
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const serviceClient = supabaseAdmin();

    // Profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    // Assembly
    const { data: assembly, error: assemblyError } = await serviceClient
      .from("copro_assemblies")
      .select("*")
      .eq("id", params.assemblyId)
      .maybeSingle();

    if (assemblyError || !assembly) {
      return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
    }

    const assemblyAny = assembly as any;

    // Vérifier que l'utilisateur est bien copropriétaire sur ce site
    const { data: siteRoles } = await serviceClient
      .from("user_site_roles")
      .select("role_code, unit_ids")
      .eq("user_id", user.id)
      .eq("site_id", assemblyAny.site_id);

    const isCopro = (siteRoles || []).length > 0;
    const isAdmin = (profile as any).role === "admin" || (profile as any).role === "platform_admin";

    if (!isCopro && !isAdmin) {
      return NextResponse.json(
        { error: "Vous n'êtes pas copropriétaire de ce site" },
        { status: 403 }
      );
    }

    // Récupérer les lots du copropriétaire (via owner_profile_id)
    const { data: myUnits } = await serviceClient
      .from("copro_units")
      .select("id, lot_number, type, tantieme_general, tantiemes_speciaux")
      .eq("site_id", assemblyAny.site_id)
      .eq("owner_profile_id", (profile as any).id)
      .eq("is_active", true);

    // Résolutions
    const { data: resolutions } = await serviceClient
      .from("copro_resolutions")
      .select("*")
      .eq("assembly_id", assemblyAny.id)
      .order("resolution_number", { ascending: true });

    // Votes déjà enregistrés pour les lots du copropriétaire
    const myUnitIds = ((myUnits || []) as any[]).map((u) => u.id);
    let myVotes: any[] = [];
    if (myUnitIds.length > 0) {
      const { data: votes } = await serviceClient
        .from("copro_votes")
        .select("id, resolution_id, unit_id, vote, voted_at, vote_method")
        .eq("assembly_id", assemblyAny.id)
        .in("unit_id", myUnitIds);
      myVotes = votes || [];
    }

    // PV publiés (visibles)
    const { data: minutes } = await serviceClient
      .from("copro_minutes")
      .select("id, version, status, distributed_at, signed_by_president_at")
      .eq("assembly_id", assemblyAny.id)
      .in("status", ["signed", "distributed", "archived"])
      .order("version", { ascending: false });

    return NextResponse.json({
      assembly: {
        id: assemblyAny.id,
        site_id: assemblyAny.site_id,
        title: assemblyAny.title,
        reference_number: assemblyAny.reference_number,
        assembly_type: assemblyAny.assembly_type,
        scheduled_at: assemblyAny.scheduled_at,
        location: assemblyAny.location,
        location_address: assemblyAny.location_address,
        online_meeting_url: assemblyAny.online_meeting_url,
        is_hybrid: assemblyAny.is_hybrid,
        status: assemblyAny.status,
        quorum_required: assemblyAny.quorum_required,
        description: assemblyAny.description,
      },
      resolutions: resolutions || [],
      my_units: myUnits || [],
      my_votes: myVotes,
      minutes: minutes || [],
      can_vote_online: ["convened", "in_progress"].includes(assemblyAny.status),
    });
  } catch (error) {
    console.error("[my-vote:GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

// ============================================
// POST — cast online vote
// ============================================
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = CastOnlineVoteSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parseResult.data;
    const serviceClient = supabaseAdmin();

    // Profile
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, prenom, nom")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    // Assembly (vérifier statut)
    const { data: assembly } = await serviceClient
      .from("copro_assemblies")
      .select("id, site_id, status")
      .eq("id", params.assemblyId)
      .maybeSingle();

    if (!assembly) {
      return NextResponse.json({ error: "Assemblée introuvable" }, { status: 404 });
    }

    if (!["convened", "in_progress"].includes((assembly as any).status)) {
      return NextResponse.json(
        {
          error: `Vote impossible : l'assemblée doit être en statut 'convened' ou 'in_progress' (actuellement: '${(assembly as any).status}')`,
        },
        { status: 409 }
      );
    }

    // Résolution (vérifier qu'elle appartient à l'assemblée et est proposée)
    const { data: resolution } = await serviceClient
      .from("copro_resolutions")
      .select("id, assembly_id, site_id, status")
      .eq("id", input.resolution_id)
      .maybeSingle();

    if (!resolution || (resolution as any).assembly_id !== (assembly as any).id) {
      return NextResponse.json({ error: "Résolution introuvable" }, { status: 404 });
    }

    if ((resolution as any).status !== "proposed") {
      return NextResponse.json(
        { error: "Cette résolution n'accepte plus de votes" },
        { status: 409 }
      );
    }

    // Lot : vérifier que le user en est bien propriétaire
    const { data: unit } = await serviceClient
      .from("copro_units")
      .select("id, site_id, owner_profile_id, tantieme_general, lot_number")
      .eq("id", input.unit_id)
      .maybeSingle();

    if (!unit) {
      return NextResponse.json({ error: "Lot introuvable" }, { status: 404 });
    }

    const unitAny = unit as any;
    if (unitAny.site_id !== (assembly as any).site_id) {
      return NextResponse.json(
        { error: "Ce lot n'appartient pas à la copropriété concernée" },
        { status: 403 }
      );
    }

    if (unitAny.owner_profile_id !== (profile as any).id) {
      return NextResponse.json(
        { error: "Vous n'êtes pas propriétaire de ce lot" },
        { status: 403 }
      );
    }

    const voterName = `${(profile as any).prenom || ""} ${(profile as any).nom || ""}`.trim() || "Copropriétaire";

    // Enregistrer le vote
    const { data: vote, error: voteError } = await serviceClient
      .from("copro_votes")
      .insert({
        resolution_id: (resolution as any).id,
        assembly_id: (resolution as any).assembly_id,
        site_id: (resolution as any).site_id,
        unit_id: unitAny.id,
        voter_profile_id: (profile as any).id,
        voter_name: voterName,
        voter_tantiemes: unitAny.tantieme_general || 0,
        vote: input.vote,
        vote_method: "online_vote",
        is_proxy: false,
      })
      .select()
      .single();

    if (voteError) {
      if ((voteError as any).code === "23505") {
        return NextResponse.json(
          { error: "Vous avez déjà voté pour ce lot sur cette résolution" },
          { status: 409 }
        );
      }
      throw voteError;
    }

    return NextResponse.json(
      {
        success: true,
        vote,
        message: "Vote enregistré avec succès",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[my-vote:POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
