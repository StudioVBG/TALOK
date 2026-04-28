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

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }

    // Vérifier que la propriété existe et qu'elle appartient au propriétaire
    const { data: property } = await serviceClient
      .from("properties")
      .select("id, owner_id")
      .eq("id", id as any)
      .maybeSingle();

    if (!property) {
      return NextResponse.json({ error: "Logement introuvable" }, { status: 404 });
    }

    const isOwner = property.owner_id === profile.id;
    const isAdmin = profile.role === "admin";
    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Source canonique : table `photos` (alimentée par PhotosStep + édition).
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

    // Fallback legacy : si aucune photo dans la table dédiée, on regarde dans
    // documents.collection=property_media (biens créés via l'ancien upload-batch).
    if (!photos || photos.length === 0) {
      try {
        const { data: legacyDocs } = await serviceClient
          .from("documents")
          .select("id, preview_url, storage_path, is_cover, position, created_at")
          .eq("property_id", id as any)
          .eq("collection", "property_media")
          .order("position", { ascending: true });

        if (legacyDocs && legacyDocs.length > 0) {
          const sorted = legacyDocs.slice().sort((a: any, b: any) => {
            const posA = a.position ?? Number.MAX_SAFE_INTEGER;
            const posB = b.position ?? Number.MAX_SAFE_INTEGER;
            return posA - posB;
          });
          const fallbackPhotos = sorted.map((doc: any, idx: number) => ({
            id: doc.id,
            property_id: id,
            url: doc.preview_url,
            storage_path: doc.storage_path,
            is_main: !!doc.is_cover || idx === 0,
            ordre: doc.position ?? idx,
            tag: null,
            room_id: null,
            created_at: doc.created_at ?? null,
            updated_at: doc.created_at ?? null,
          }));
          return NextResponse.json({ photos: fallbackPhotos });
        }
      } catch (legacyErr) {
        console.warn("[GET /api/properties/[id]/photos] legacy documents fallback failed:", legacyErr);
      }
    }

    return NextResponse.json({ photos: photos ?? [] });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
