export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour les commissions de l'agence
 * GET /api/agency/commissions - Liste des commissions
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Paramètres de requête
    const searchParams = request.nextUrl.searchParams;
    const statut = searchParams.get("statut");
    const mandateId = searchParams.get("mandate_id");
    const periode = searchParams.get("periode");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Récupérer les IDs des mandats de l'agence
    const { data: mandates } = await supabase
      .from("mandates")
      .select("id")
      .eq("agency_profile_id", profile.id);

    const mandateIds = mandates?.map(m => m.id) || [];

    if (mandateIds.length === 0) {
      return NextResponse.json({
        commissions: [],
        total: 0,
        stats: {
          total: 0,
          pending: 0,
          paid: 0,
        },
        page,
        limit,
      });
    }

    // Construire la requête
    let query = supabase
      .from("agency_commissions")
      .select(`
        *,
        mandate:mandates!agency_commissions_mandate_id_fkey(
          id,
          numero_mandat,
          owner:profiles!mandates_owner_profile_id_fkey(
            id, prenom, nom
          )
        )
      `, { count: "exact" })
      .in("mandate_id", mandateIds);

    if (statut && statut !== "all") {
      query = query.eq("statut", statut);
    }

    if (mandateId) {
      query = query.eq("mandate_id", mandateId);
    }

    if (periode) {
      query = query.eq("periode", periode);
    }

    const { data: commissions, count, error } = await query
      .order("periode", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Erreur récupération commissions:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    // Calculer les stats
    const { data: allCommissions } = await supabase
      .from("agency_commissions")
      .select("montant_commission, statut")
      .in("mandate_id", mandateIds);

    const stats = {
      total: allCommissions?.reduce((sum, c) => sum + (c.montant_commission || 0), 0) || 0,
      pending: allCommissions
        ?.filter(c => c.statut === "pending")
        .reduce((sum, c) => sum + (c.montant_commission || 0), 0) || 0,
      paid: allCommissions
        ?.filter(c => c.statut === "paid")
        .reduce((sum, c) => sum + (c.montant_commission || 0), 0) || 0,
    };

    return NextResponse.json({
      commissions: commissions || [],
      total: count || 0,
      stats,
      page,
      limit,
    });
  } catch (error: unknown) {
    console.error("Erreur API agency commissions GET:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

