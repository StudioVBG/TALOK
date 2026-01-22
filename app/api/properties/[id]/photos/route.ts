export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";

/**
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour consulter les photos.",
        },
        { status: 500 }
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Vérifier que la propriété existe avec serviceClient pour éviter les problèmes RLS
    const { data: property } = await serviceClient
      .from("properties")
      .select("id")
      .eq("id", id as any)
      .maybeSingle();

    if (!property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    // Utiliser serviceClient pour récupérer les photos pour éviter les problèmes RLS
    const { data: photos, error: photosError } = await serviceClient
      .from("photos")
      .select("*")
      .eq("property_id", id as any)
      .order("ordre", { ascending: true });

    if (photosError) {
      return NextResponse.json(
        { error: photosError.message || "Erreur lors du chargement des photos" },
        { status: 500 }
      );
    }

    return NextResponse.json({ photos: photos ?? [] });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
