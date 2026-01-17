export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

/**
 * API Route pour le dashboard agence
 * GET /api/agency/dashboard
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json(
        { error: "Accès non autorisé - rôle agence requis" },
        { status: 403 }
      );
    }

    // Récupérer le profil agence
    const { data: agencyProfile } = await supabase
      .from("agency_profiles")
      .select("*")
      .eq("profile_id", profile.id)
      .single();

    if (!agencyProfile) {
      return NextResponse.json({
        profile: {
          id: profile.id,
          prenom: profile.prenom,
          nom: profile.nom,
        },
        has_agency_profile: false,
        onboarding_required: true,
      });
    }

    // Récupérer les mandats
    const { data: mandates, error: mandatesError } = await supabase
      .from("mandates")
      .select(`
        id,
        numero_mandat,
        type_mandat,
        date_debut,
        date_fin,
        statut,
        commission_pourcentage,
        owner:profiles!mandates_owner_profile_id_fkey(
          id, prenom, nom
        )
      `)
      .eq("agency_profile_id", profile.id);

    // Statistiques
    const mandatsActifs = mandates?.filter(m => m.statut === "active").length || 0;
    const totalProprietaires = new Set(mandates?.map(m => (m.owner as any)?.id).filter(Boolean)).size;

    // Récupérer les biens gérés
    let totalBiensGeres = 0;
    if (mandates && mandates.length > 0) {
      const ownerIds = [...new Set(mandates.filter(m => m.statut === "active").map(m => (m.owner as any)?.id).filter(Boolean))];
      if (ownerIds.length > 0) {
        const { count } = await supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
          .in("owner_id", ownerIds);
        totalBiensGeres = count || 0;
      }
    }

    // Récupérer les commissions
    const { data: commissions } = await supabase
      .from("agency_commissions")
      .select("montant_commission, statut")
      .in("mandate_id", mandates?.map(m => m.id) || []);

    const commissionsEncaissees = commissions
      ?.filter(c => c.statut === "paid")
      .reduce((sum, c) => sum + (c.montant_commission || 0), 0) || 0;

    const commissionsEnAttente = commissions
      ?.filter(c => c.statut === "pending")
      .reduce((sum, c) => sum + (c.montant_commission || 0), 0) || 0;

    return NextResponse.json({
      profile: {
        id: profile.id,
        prenom: profile.prenom,
        nom: profile.nom,
      },
      agency: {
        raison_sociale: agencyProfile.raison_sociale,
        siret: agencyProfile.siret,
        numero_carte_pro: agencyProfile.numero_carte_pro,
        logo_url: agencyProfile.logo_url,
      },
      has_agency_profile: true,
      stats: {
        total_mandats: mandates?.length || 0,
        mandats_actifs: mandatsActifs,
        total_proprietaires: totalProprietaires,
        total_biens_geres: totalBiensGeres,
        commissions_encaissees: commissionsEncaissees,
        commissions_en_attente: commissionsEnAttente,
      },
      recent_mandates: mandates?.slice(0, 5) || [],
    });
  } catch (error: unknown) {
    console.error("Erreur API agency dashboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

