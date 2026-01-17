export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/properties/[id]/documents - Récupérer les documents d'une propriété
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue", details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const propertyId = params.id;
    const { searchParams } = new URL(request.url);
    const collection = searchParams.get("collection");

    // Utiliser le service client pour éviter les problèmes RLS
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY manquante" },
        { status: 500 }
      );
    }

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    // Vérifier que la propriété existe et que l'utilisateur y a accès
    const { data: property } = await serviceClient
      .from("properties")
      .select("id, owner_id")
      .eq("id", propertyId as any)
      .maybeSingle();

    if (!property) {
      return NextResponse.json(
        { error: "Propriété non trouvée" },
        { status: 404 }
      );
    }

    // Récupérer le profil pour vérifier les permissions
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;
    const isAdmin = profileData.role === "admin";
    const isOwner = property.owner_id === profileData.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Construire la requête pour récupérer les documents
    let query = serviceClient
      .from("documents")
      .select("*")
      .eq("property_id", propertyId as any);

    // Ajouter le filtre collection si fourni et si la colonne existe
    // On essaie d'abord avec collection, puis sans si ça échoue
    let documents: any[] | null = null;
    let queryError: any = null;

    if (collection) {
      // Essayer avec collection
      const { data: docsWithCollection, error: errorWithCollection } = await query
        .eq("collection", collection)
        .order("created_at", { ascending: false });

      if (errorWithCollection) {
        // Si erreur due à colonne manquante, réessayer sans collection
        if (
          errorWithCollection.message?.includes("does not exist") ||
          errorWithCollection.message?.includes("column") ||
          errorWithCollection.code === "42703"
        ) {
          console.log(`[GET /api/properties/${propertyId}/documents] Colonne collection manquante, réessai sans filtre`);
          const { data: docsWithoutCollection, error: errorWithoutCollection } = await serviceClient
            .from("documents")
            .select("*")
            .eq("property_id", propertyId as any)
            .order("created_at", { ascending: false });

          if (errorWithoutCollection) {
            queryError = errorWithoutCollection;
          } else {
            documents = docsWithoutCollection;
          }
        } else {
          queryError = errorWithCollection;
        }
      } else {
        documents = docsWithCollection;
      }
    } else {
      // Pas de filtre collection, requête simple
      const { data: docs, error: docsError } = await query.order("created_at", { ascending: false });
      if (docsError) {
        queryError = docsError;
      } else {
        documents = docs;
      }
    }

    if (queryError) {
      console.error(`[GET /api/properties/${propertyId}/documents] Erreur:`, queryError);
      throw queryError;
    }

    // Trier les documents par position si disponible
    const sortedDocuments = (documents || []).sort((a, b) => {
      const posA = a.position ?? Number.MAX_SAFE_INTEGER;
      const posB = b.position ?? Number.MAX_SAFE_INTEGER;
      if (posA !== posB) return posA - posB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({ documents: sortedDocuments });
  } catch (error: unknown) {
    console.error(`[GET /api/properties/${params.id}/documents] Erreur:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

