export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/documents/search - Recherche full-text dans les documents
 * 
 * Query params:
 * - q: Texte de recherche
 * - category: Catégorie (optionnel)
 * - limit: Nombre max de résultats (défaut: 50)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Utiliser la fonction RPC pour la recherche full-text
    // Si la fonction n'existe pas encore (migration pas encore appliquée),
    // fallback sur une recherche LIKE basique
    let results: any[] = [];

    try {
      // Essayer la recherche full-text
      const rpcParams: Record<string, any> = {
        search_query: query,
        p_limit: limit,
      };

      // Ajouter les filtres selon le rôle
      if (profile.role === "owner") {
        rpcParams.p_owner_id = profile.id;
      } else if (profile.role === "tenant") {
        rpcParams.p_tenant_id = profile.id;
      }
      if (category) {
        rpcParams.p_category = category;
      }

      const { data, error } = await supabase.rpc("search_documents", rpcParams);

      if (error) {
        throw error;
      }

      results = data || [];
    } catch (rpcError) {
      // Fallback sur recherche LIKE si la fonction RPC n'existe pas
      console.log("Fallback sur recherche LIKE:", rpcError);

      let baseQuery = supabase
        .from("documents")
        .select(`
          id,
          type,
          title,
          created_at,
          tenant_id,
          property_id,
          properties(adresse_complete)
        `)
        .or(`title.ilike.%${query}%,type.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(limit);

      // Filtrer selon le rôle
      if (profile.role === "owner") {
        baseQuery = baseQuery.eq("owner_id", profile.id);
      } else if (profile.role === "tenant") {
        baseQuery = baseQuery.eq("tenant_id", profile.id);
      }

      if (category) {
        baseQuery = baseQuery.eq("category", category);
      }

      const { data, error: likeError } = await baseQuery;

      if (likeError) {
        throw likeError;
      }

      results = (data || []).map((d: any) => ({
        id: d.id,
        type: d.type,
        title: d.title,
        created_at: d.created_at,
        property_address: d.properties?.adresse_complete,
        rank: 0.5, // Rank fictif pour le fallback
      }));
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    console.error("Erreur recherche documents:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

