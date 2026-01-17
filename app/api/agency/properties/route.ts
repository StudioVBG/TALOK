export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Route pour les biens gérés par l'agence
 * GET /api/agency/properties - Liste des biens gérés
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
    const mandateId = searchParams.get("mandate_id");
    const ownerId = searchParams.get("owner_id");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Récupérer les mandats actifs de l'agence
    const { data: mandates } = await supabase
      .from("mandates")
      .select("owner_profile_id, properties_ids, inclut_tous_biens")
      .eq("agency_profile_id", profile.id)
      .eq("statut", "active");

    if (!mandates || mandates.length === 0) {
      return NextResponse.json({
        properties: [],
        total: 0,
        page,
        limit,
      });
    }

    // Construire la liste des propriétaires avec mandats actifs
    const ownerIds = [...new Set(mandates.map(m => m.owner_profile_id))];
    
    // Filtrer par propriétaire si spécifié
    const filteredOwnerIds = ownerId ? [ownerId].filter(id => ownerIds.includes(id)) : ownerIds;
    
    if (filteredOwnerIds.length === 0) {
      return NextResponse.json({
        properties: [],
        total: 0,
        page,
        limit,
      });
    }

    // Récupérer les biens
    let query = supabase
      .from("properties")
      .select(`
        *,
        owner:profiles!properties_owner_id_fkey(
          id, prenom, nom
        )
      `, { count: "exact" })
      .in("owner_id", filteredOwnerIds);

    // Filtrer par mandat spécifique si demandé
    if (mandateId) {
      const mandate = mandates.find(m => m.owner_profile_id === ownerId);
      if (mandate && !mandate.inclut_tous_biens && mandate.properties_ids?.length > 0) {
        query = query.in("id", mandate.properties_ids);
      }
    }

    const { data: properties, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Erreur récupération biens agence:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    // Ajouter les infos de bail actif pour chaque bien
    const propertiesWithLeases = await Promise.all(
      (properties || []).map(async (property) => {
        const { data: lease } = await supabase
          .from("leases")
          .select("id, loyer, charges_forfaitaires, statut, date_debut")
          .eq("property_id", property.id)
          .eq("statut", "active")
          .single();

        return {
          ...property,
          active_lease: lease || null,
        };
      })
    );

    return NextResponse.json({
      properties: propertiesWithLeases,
      total: count || 0,
      page,
      limit,
    });
  } catch (error: unknown) {
    console.error("Erreur API agency properties GET:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

