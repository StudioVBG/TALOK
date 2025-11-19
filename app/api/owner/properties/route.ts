/**
 * GET /api/owner/properties
 * 
 * Route API scopée aux propriétaires pour récupérer leurs propriétés
 * Retourne les propriétés avec les médias (photos) enrichis
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import type { OwnerPropertiesResponse, OwnerProperty } from "@/lib/types/owner-property";

export const maxDuration = 20;

export async function GET(request: Request) {
  try {
    // ✅ AUTHENTIFICATION: Vérifier que l'utilisateur est authentifié
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ApiError(401, "Non authentifié");
    }

    // ✅ PERMISSIONS: Vérifier que l'utilisateur est un propriétaire
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    if (profile.role !== "owner") {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    // ✅ RÉCUPÉRATION: Récupérer les propriétés du propriétaire
    // Utiliser les colonnes correctes : type (pas type_bien), loyer_hc (pas loyer_base)
    const essentialColumns = "id, owner_id, type, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_hc, created_at, etat";

    const { data: properties, error: propertiesError, count } = await supabase
      .from("properties")
      .select(essentialColumns, { count: "exact" })
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false });

    if (propertiesError) {
      console.error("[GET /api/owner/properties] Error fetching properties:", propertiesError);
      throw new ApiError(500, "Erreur lors de la récupération des propriétés", propertiesError);
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json<OwnerPropertiesResponse>({
        properties: [],
        pagination: {
          page: 1,
          limit: 100,
          total: 0,
        },
      });
    }

    // ✅ MÉDIAS: Charger les photos depuis la table photos (priorité) puis documents (fallback)
    const propertyIds = properties.map((p) => p.id);
    const mediaMap = await fetchPropertyMedia(propertyIds);

    // ✅ ENRICHISSEMENT: Enrichir les propriétés avec les médias
    const enrichedProperties: OwnerProperty[] = properties.map((property) => {
      const media = mediaMap.get(property.id) ?? {
        cover_url: null,
        cover_document_id: null,
        documents_count: 0,
      };

      return {
        ...property,
        cover_url: media.cover_url,
        cover_document_id: media.cover_document_id,
        documents_count: media.documents_count,
        loyer_base: property.loyer_hc ?? 0, // Alias pour compatibilité
      } as OwnerProperty;
    });

    return NextResponse.json<OwnerPropertiesResponse>({
      properties: enrichedProperties,
      pagination: {
        page: 1,
        limit: 100,
        total: count ?? enrichedProperties.length,
      },
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * Récupère les médias (photos) pour les propriétés
 * Priorité : table photos (is_main) → table documents (fallback)
 */
async function fetchPropertyMedia(
  propertyIds: string[]
): Promise<Map<string, { cover_url: string | null; cover_document_id: string | null; documents_count: number }>> {
  const result = new Map<string, { cover_url: string | null; cover_document_id: string | null; documents_count: number }>();

  if (propertyIds.length === 0) {
    return result;
  }

  // Limiter à 20 propriétés pour éviter les timeouts
  const limitedPropertyIds = propertyIds.slice(0, 20);

  try {
    // ✅ Utiliser le service_role pour bypasser RLS sur les médias
    const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
    const serviceClient = supabaseAdmin();

    // ✅ PRIORITÉ 1: Chercher dans la table photos (système principal)
    try {
      const { data: photos, error: photosError } = await serviceClient
        .from("photos")
        .select("id, property_id, url, is_main, ordre")
        .in("property_id", limitedPropertyIds)
        .order("is_main", { ascending: false })
        .order("ordre", { ascending: true })
        .limit(100);

      if (!photosError && photos && photos.length > 0) {
        photos.forEach((photo: any) => {
          if (!photo.property_id) return;
          const current = result.get(photo.property_id) ?? {
            cover_url: null,
            cover_document_id: null,
            documents_count: 0,
          };
          current.documents_count += 1;
          // Utiliser la photo principale (is_main) ou la première photo
          if (photo.is_main || (!current.cover_url && current.documents_count === 1)) {
            current.cover_document_id = photo.id ?? null;
            current.cover_url = photo.url ?? null;
          }
          result.set(photo.property_id, current);
        });
      }
    } catch (photosError: any) {
      console.warn("[fetchPropertyMedia] Error fetching from photos table:", photosError?.message);
      // Continuer avec le fallback sur documents
    }

    // ✅ PRIORITÉ 2: Chercher aussi dans la table documents (système de fallback)
    // Seulement si aucune photo n'a été trouvée pour certaines propriétés
    const propertiesWithoutMedia = limitedPropertyIds.filter((id) => !result.has(id) || !result.get(id)?.cover_url);

    if (propertiesWithoutMedia.length > 0) {
      try {
        const { data: documents, error: documentsError } = await serviceClient
          .from("documents")
          .select("id, property_id, preview_url, is_cover, created_at")
          .in("property_id", propertiesWithoutMedia)
          .eq("collection", "property_media")
          .order("is_cover", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(100);

        if (!documentsError && documents && documents.length > 0) {
          documents.forEach((doc: any) => {
            if (!doc.property_id) return;
            const current = result.get(doc.property_id) ?? {
              cover_url: null,
              cover_document_id: null,
              documents_count: 0,
            };
            current.documents_count += 1;
            // Utiliser le document marqué comme cover ou le premier document
            const isCover = doc.is_cover || (!current.cover_url && current.documents_count === 1);
            if (isCover && !current.cover_url) {
              // Ne remplacer que si aucune photo n'a déjà été trouvée
              current.cover_document_id = doc.id ?? null;
              current.cover_url = doc.preview_url ?? null;
            }
            result.set(doc.property_id, current);
          });
        }
      } catch (documentsError: any) {
        console.warn("[fetchPropertyMedia] Error fetching from documents table:", documentsError?.message);
        // Ne pas bloquer si les documents échouent
      }
    }

    return result;
  } catch (error: unknown) {
    console.error("[fetchPropertyMedia] Unexpected error:", error);
    return result;
  }
}

