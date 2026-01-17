export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getTypedSupabaseClient } from "@/lib/helpers/supabase-client";

/**
 * GET /api/search - Recherche plein texte (BTN-U01)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const supabaseClient = getTypedSupabaseClient(supabase);
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q");
    const type = searchParams.get("type"); // 'properties', 'leases', 'tickets', 'all'

    if (!q || q.length < 2) {
      return NextResponse.json(
        { error: "Requête de recherche trop courte (minimum 2 caractères)" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    const profileData = profile as any;
    const results: any = {
      properties: [],
      leases: [],
      tickets: [],
      documents: [],
    };

    // Recherche dans les propriétés (si owner ou admin)
    if (!type || type === "properties" || type === "all") {
      if (profileData?.role === "owner" || profileData?.role === "admin") {
        const { data: properties } = await supabaseClient
          .from("properties")
          .select("id, adresse_complete, type")
          .or(`adresse_complete.ilike.%${q}%,type.ilike.%${q}%`)
          .limit(10);

        results.properties = properties || [];
      }
    }

    // Recherche dans les baux
    if (!type || type === "leases" || type === "all") {
      const { data: leases } = await supabaseClient
        .from("leases")
        .select("id, type_bail, date_debut, date_fin")
        .or(`type_bail.ilike.%${q}%`)
        .limit(10);

      results.leases = leases || [];
    }

    // Recherche dans les tickets
    if (!type || type === "tickets" || type === "all") {
      const { data: tickets } = await supabaseClient
        .from("tickets")
        .select("id, titre, description, statut")
        .or(`titre.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(10);

      results.tickets = tickets || [];
    }

    // Recherche dans les documents
    if (!type || type === "documents" || type === "all") {
      const { data: documents } = await supabaseClient
        .from("documents")
        .select("id, type, storage_path")
        .or(`type.ilike.%${q}%`)
        .limit(10);

      results.documents = documents || [];
    }

    return NextResponse.json({
      query: q,
      results,
      total: Object.values(results).reduce((sum: number, arr: any) => sum + arr.length, 0),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

