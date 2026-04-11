export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { createClient } from "@supabase/supabase-js";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

/**
 * GET /api/properties/[id]/documents - Récupérer les documents d'une propriété
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, error } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: extractErrorMessage(error), details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const propertyId = id;
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
    const isOwner = (property as any).owner_id === profileData.id;

    // ✅ Vérifier si le locataire est lié à cette propriété via un bail (lease_signers)
    let isTenantLinked = false;
    if (!isAdmin && !isOwner && profileData.role === "tenant") {
      const { data: tenantSigners } = await serviceClient
        .from("lease_signers")
        .select("id, lease:leases!inner(property_id)")
        .eq("profile_id", profileData.id);

      if (tenantSigners && tenantSigners.length > 0) {
        isTenantLinked = tenantSigners.some(
          (s: any) => s.lease?.property_id === propertyId
        );
      }
    }

    if (!isAdmin && !isOwner && !isTenantLinked) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Construire la requête pour récupérer les documents
    let baseQuery = serviceClient
      .from("documents")
      .select("*")
      .eq("property_id", propertyId as any);

    // Filtrer visible_tenant pour les locataires (service role bypass RLS)
    if (isTenantLinked && !isAdmin && !isOwner) {
      baseQuery = baseQuery.eq("visible_tenant", true);
    }

    // Ajouter le filtre collection si fourni et si la colonne existe
    let documents: any[] | null = null;
    let queryError: any = null;

    if (collection) {
      const { data: docsWithCollection, error: errorWithCollection } = await baseQuery
        .eq("collection", collection)
        .order("created_at", { ascending: false });

      if (errorWithCollection) {
        if (
          errorWithCollection.message?.includes("does not exist") ||
          errorWithCollection.message?.includes("column") ||
          errorWithCollection.code === "42703"
        ) {
          let fallbackQuery = serviceClient
            .from("documents")
            .select("*")
            .eq("property_id", propertyId as any);

          if (isTenantLinked && !isAdmin && !isOwner) {
            fallbackQuery = fallbackQuery.eq("visible_tenant", true);
          }

          const { data: docsWithoutCollection, error: errorWithoutCollection } = await fallbackQuery
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
      const { data: docs, error: docsError } = await baseQuery.order("created_at", { ascending: false });
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
    console.error("[GET /api/properties/documents] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

