import { NextResponse } from "next/server";
import { propertyGeneralUpdateSchema, propertySchema } from "@/lib/validations";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { propertyIdParamSchema } from "@/lib/validations/params";
import type { ServiceSupabaseClient, MediaDocument, SupabaseError } from "@/lib/types/supabase-client";

/**
 * GET /api/properties/[id] - Récupérer une propriété par ID
 * Configuration Vercel: maxDuration: 10s
 */
export const maxDuration = 10;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ VALIDATION: Vérifier que l'ID est un UUID valide
    const propertyId = propertyIdParamSchema.parse(params.id);

    // ✅ AUTHENTIFICATION: Vérifier l'utilisateur
    const { user, error: authError, supabase } = await getAuthenticatedUser(request);

    if (authError || !user || !supabase) {
      throw new ApiError(authError?.status || 401, authError?.message || "Non authentifié");
    }

    // ✅ CONFIGURATION: Vérifier les variables d'environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(
        500,
        "Configuration serveur incomplète",
        "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour consulter un logement."
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ✅ PERMISSIONS: Récupérer le profil pour vérifier les permissions
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé", profileError);
    }

    // ✅ RÉCUPÉRATION: Récupérer la propriété avec ID validé
    const { data: property, error: propertyError } = await serviceClient
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .maybeSingle();

    if (propertyError) {
      console.error(`[GET /api/properties/${propertyId}] Erreur lors de la récupération:`, propertyError);
      throw new ApiError(500, "Erreur lors de la récupération de la propriété", propertyError);
    }
    
    if (!property) {
      throw new ApiError(404, "Propriété non trouvée", { propertyId });
    }

    // ✅ PERMISSIONS: Vérifier les permissions d'accès
    const isAdmin = profile.role === "admin";
    const isOwner = profile.id === property.owner_id;

    if (!isAdmin && !isOwner) {
      // Vérifier si l'utilisateur a un bail actif sur cette propriété
      const { data: leases, error: leasesError } = await serviceClient
        .from("lease_signers")
        .select("lease_id")
        .eq("profile_id", profile.id);

      if (leasesError) {
        throw new ApiError(500, "Erreur lors de la vérification des baux", leasesError);
      }

      if (leases && leases.length > 0) {
        const leaseIds = leases.map((l) => l.lease_id).filter(Boolean);
        const { data: activeLeases, error: activeLeasesError } = await serviceClient
          .from("leases")
          .select("property_id")
          .in("id", leaseIds)
          .eq("property_id", propertyId)
          .eq("statut", "active");

        if (activeLeasesError) {
          throw new ApiError(500, "Erreur lors de la vérification des baux actifs", activeLeasesError);
        }

        if (!activeLeases || activeLeases.length === 0) {
          throw new ApiError(403, "Vous n'avez pas accès à cette propriété");
        }
      } else {
        throw new ApiError(403, "Vous n'avez pas accès à cette propriété");
      }
    }

    // ✅ MÉDIAS: Récupérer les médias de la propriété
    const mediaInfo = await fetchSinglePropertyMedia(serviceClient, property.id);

    return NextResponse.json({
      property: {
        ...property,
        ...mediaInfo,
      },
    });
  } catch (error: unknown) {
    // ✅ GESTION ERREURS: Utiliser handleApiError pour une gestion uniforme
    return handleApiError(error);
  }
}

/**
 * PATCH /api/properties/[id] - Mise à jour progressive (tous types de biens V3)
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ VALIDATION: Vérifier que l'ID est un UUID valide
    const propertyId = propertyIdParamSchema.parse(params.id);

    // ✅ AUTHENTIFICATION: Vérifier l'utilisateur
    const { user, error: authError, supabase } = await getAuthenticatedUser(request);

    if (authError || !user || !supabase) {
      throw new ApiError(authError?.status || 401, authError?.message || "Non authentifié");
    }

    // ✅ CONFIGURATION: Vérifier les variables d'environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(
        500,
        "Configuration serveur incomplète",
        "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour mettre à jour un logement."
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ✅ VALIDATION: Valider le body avec Zod
    const body = await request.json();
    const validated = propertyGeneralUpdateSchema.parse(body);

    // ✅ PERMISSIONS: Récupérer le profil avec serviceClient pour éviter les problèmes RLS
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé", profileError);
    }

    // ✅ RÉCUPÉRATION: Récupérer la propriété avec ID validé
    // Essayer d'abord avec toutes les colonnes, puis sans si certaines n'existent pas
    let property: { owner_id: string; etat?: string; type?: string | null } | null = null;
    let propertyError: unknown = null;
    
    const { data: propertyWithAll, error: errorWithAll } = await serviceClient
      .from("properties")
      .select("owner_id, etat, type")
      .eq("id", propertyId)
      .maybeSingle();

    if (errorWithAll) {
      // Si l'erreur est due à une colonne manquante, réessayer sans etat et type
      if (errorWithAll.message?.includes("does not exist") || errorWithAll.message?.includes("column") || errorWithAll.code === "42703") {
        console.log(`[PATCH /api/properties/${params.id}] Colonne manquante détectée, réessai avec colonnes minimales`);
        const { data: propertyMinimal, error: errorMinimal } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", propertyId)
          .maybeSingle();
        
        if (errorMinimal) {
          console.error(`[PATCH /api/properties/${params.id}] Erreur même avec colonnes minimales:`, errorMinimal);
          propertyError = errorMinimal;
        } else {
          property = propertyMinimal;
          // Si etat n'existe pas, on considère que c'est un draft par défaut
          if (property) {
            property.etat = "draft";
            property.type = null; // Type peut ne pas exister
          }
        }
      } else {
        console.error(`[PATCH /api/properties/${params.id}] Erreur non liée à une colonne manquante:`, errorWithAll);
        propertyError = errorWithAll;
      }
    } else {
      property = propertyWithAll;
    }

    if (propertyError) {
      console.error(`[PATCH /api/properties/${propertyId}] Erreur lors de la récupération de la propriété:`, propertyError);
      throw new ApiError(500, "Erreur lors de la récupération de la propriété", propertyError);
    }

    if (!property) {
      throw new ApiError(404, "Propriété non trouvée", { propertyId });
    }

    // ✅ PERMISSIONS: Vérifier les permissions de modification
    const isAdmin = profile.role === "admin";
    const isOwner = property.owner_id === profile.id;

    if (!isAdmin && !isOwner) {
      throw new ApiError(403, "Vous n'avez pas la permission de modifier ce logement");
    }

    // ✅ VALIDATION MÉTIER: Vérifier l'état seulement si la colonne existe
    const propertyEtat = property.etat;
    if (!isAdmin && propertyEtat && !["draft", "rejected"].includes(propertyEtat)) {
      throw new ApiError(400, "Impossible de modifier un logement soumis ou publié");
    }

    // Retirer la restriction sur le type "appartement" pour permettre tous les types V3
    // Le flux PATCH peut maintenant être utilisé pour tous les types de biens

    // ✅ VALIDATION MÉTIER: Vérifier le changement de mode_location si présent
    if ("mode_location" in validated && validated.mode_location) {
      const { hasActiveLeaseForProperty } = await import("@/lib/helpers/lease-helper");
      const { hasActive, lease, error: leaseError } = await hasActiveLeaseForProperty(
        propertyId,
        supabaseUrl,
        serviceRoleKey
      );

      if (leaseError) {
        console.error(`[PATCH /api/properties/${params.id}] Erreur lors de la vérification des baux:`, leaseError);
        // On continue malgré l'erreur pour ne pas bloquer l'utilisateur
      } else if (hasActive && lease) {
        // Récupérer les informations du locataire pour l'erreur
        const { getActiveLeaseWithTenant } = await import("@/lib/helpers/lease-helper");
        const { tenant } = await getActiveLeaseWithTenant(params.id, supabaseUrl, serviceRoleKey);

        return NextResponse.json(
          {
            error: "active_lease_blocking",
            fieldErrors: {
              mode_location: "Impossible de changer le mode de location tant qu'un bail est en cours.",
            },
            globalErrors: [
              "Résiliez ou terminez le bail actif avant de changer le mode de location.",
            ],
            lease: {
              id: lease.id,
              type_bail: lease.type_bail,
              date_debut: lease.date_debut,
              date_fin: lease.date_fin,
              tenant: tenant
                ? {
                    name: `${tenant.prenom || ""} ${tenant.nom || ""}`.trim() || tenant.email,
                    email: tenant.email,
                  }
                : null,
            },
          },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, unknown> = { ...validated, updated_at: new Date().toISOString() };

    // Mapping type_bien → type pour compatibilité (si type_bien est fourni mais pas type)
    if (Object.prototype.hasOwnProperty.call(validated, "type_bien") && !Object.prototype.hasOwnProperty.call(validated, "type")) {
      updates.type = validated.type_bien;
    }
    // Si les deux sont fournis, s'assurer qu'ils sont cohérents
    if (Object.prototype.hasOwnProperty.call(validated, "type_bien") && Object.prototype.hasOwnProperty.call(validated, "type")) {
      // type_bien a la priorité pour V3
      updates.type = validated.type_bien;
    }

    // Mapping loyer_hc → loyer_base pour compatibilité
    if (Object.prototype.hasOwnProperty.call(validated, "loyer_hc")) {
      const value = validated.loyer_hc ?? null;
      updates.loyer_base = value ?? 0;
    }

    // ✅ MISE À JOUR: Utiliser serviceClient pour la mise à jour pour éviter les problèmes RLS
    const { data: updatedProperty, error: updateError } = await serviceClient
      .from("properties")
      .update(updates)
      .eq("id", propertyId)
      .select()
      .single();

    if (updateError || !updatedProperty) {
      throw new ApiError(
        500,
        "Impossible de mettre à jour le logement",
        updateError
      );
    }

    return NextResponse.json({ property: updatedProperty });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

async function fetchSinglePropertyMedia(serviceClient: any, propertyId: string) {
  const baseQuery = serviceClient
    .from("documents")
    .select("id, preview_url, storage_path, is_cover, position")
    .eq("property_id", propertyId)
    .eq("collection", "property_media")
    .order("position", { ascending: true });

  let mediaDocs: any[] | null = null;
  let mediaError: any = null;

  const attempt = await baseQuery;
  mediaDocs = attempt.data;
  mediaError = attempt.error;

  if (mediaError) {
    const message = mediaError.message?.toLowerCase() ?? "";
    const missingColumn =
      message.includes("collection") ||
      message.includes("position") ||
      message.includes("is_cover");

    if (!missingColumn) {
      console.error("Error fetching property media:", mediaError);
      return {
        cover_document_id: null,
        cover_url: null,
        documents_count: 0,
      };
    }

    const fallback = await serviceClient
      .from("documents")
      .select("id, preview_url, storage_path, created_at")
      .eq("property_id", propertyId);

    mediaDocs = fallback.data;
    mediaError = fallback.error;
  }

  if (mediaError || !mediaDocs) {
    if (mediaError) {
      console.error("Error fetching property media:", mediaError);
    }
    return {
      cover_document_id: null,
      cover_url: null,
      documents_count: 0,
    };
  }

  const sortedDocs = mediaDocs.slice().sort((a: MediaDocument, b: MediaDocument) => {
    const posA = (a as { position?: number }).position ?? Number.MAX_SAFE_INTEGER;
    const posB = (b as { position?: number }).position ?? Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });
  const cover = sortedDocs.find((doc: MediaDocument) => (doc as { is_cover?: boolean }).is_cover) ?? sortedDocs[0] ?? null;

  return {
    cover_document_id: cover?.id ?? null,
    cover_url: cover?.preview_url ?? null,
    documents_count: mediaDocs.length,
  };
}

/**
 * PUT /api/properties/[id] - Mettre à jour une propriété
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ VALIDATION: Vérifier que l'ID est un UUID valide
    const propertyId = propertyIdParamSchema.parse(params.id);

    // ✅ AUTHENTIFICATION: Vérifier l'utilisateur
    const { user, error: authError, supabase } = await getAuthenticatedUser(request);

    if (authError || !user || !supabase) {
      throw new ApiError(authError?.status || 401, authError?.message || "Non authentifié");
    }

    // ✅ VALIDATION: Valider le body avec Zod
    const body = await request.json();
    const validated = propertyGeneralUpdateSchema.parse(body);

    // ✅ CONFIGURATION: Vérifier les variables d'environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(
        500,
        "Configuration serveur incomplète",
        "SUPABASE_SERVICE_ROLE_KEY manquante"
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ✅ PERMISSIONS: Vérifier que l'utilisateur est propriétaire de la propriété
    const { data: property, error: propertyError } = await serviceClient
      .from("properties")
      .select("owner_id, etat")
      .eq("id", propertyId)
      .single();

    if (propertyError || !property) {
      throw new ApiError(404, "Propriété non trouvée", propertyError);
    }

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé", profileError);
    }

    // ✅ PERMISSIONS: Vérifier les permissions
    const isAdmin = profile.role === "admin";
    const isOwner = profile.id === property.owner_id;

    if (!isAdmin && !isOwner) {
      throw new ApiError(403, "Vous n'avez pas la permission de modifier cette propriété");
    }

    // ✅ VALIDATION MÉTIER: Vérifier l'état
    if (!isAdmin && property.etat && !["draft", "rejected"].includes(property.etat)) {
      throw new ApiError(400, "Impossible de modifier un logement en cours de validation ou publié");
    }

    // ✅ MISE À JOUR: Mettre à jour la propriété
    const { data: updatedProperty, error: updateError } = await serviceClient
      .from("properties")
      .update(validated)
      .eq("id", propertyId)
      .select()
      .single();

    if (updateError || !updatedProperty) {
      throw new ApiError(500, "Impossible de mettre à jour la propriété", updateError);
    }

    return NextResponse.json({ property: updatedProperty });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/properties/[id] - Supprimer une propriété
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // ✅ VALIDATION: Vérifier que l'ID est un UUID valide
    const propertyId = propertyIdParamSchema.parse(params.id);

    // ✅ AUTHENTIFICATION: Vérifier l'utilisateur
    const { user, error: authError, supabase } = await getAuthenticatedUser(request);

    if (authError || !user || !supabase) {
      throw new ApiError(authError?.status || 401, authError?.message || "Non authentifié");
    }

    // ✅ CONFIGURATION: Vérifier les variables d'environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(
        500,
        "Configuration serveur incomplète",
        "SUPABASE_SERVICE_ROLE_KEY manquante. Impossible de supprimer le logement."
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ✅ RÉCUPÉRATION: Vérifier que l'utilisateur est propriétaire de la propriété
    // Essayer d'abord avec etat, puis sans si la colonne n'existe pas
    let property: { owner_id: string; etat?: string } | null = null;
    let propertyError: unknown = null;
    
    const { data: propertyWithEtat, error: errorWithEtat } = await serviceClient
      .from("properties")
      .select("owner_id, etat")
      .eq("id", propertyId)
      .maybeSingle();

    if (errorWithEtat) {
      // Si l'erreur est due à une colonne manquante, réessayer sans etat
      if (errorWithEtat.message?.includes("does not exist") || errorWithEtat.message?.includes("column") || errorWithEtat.code === "42703") {
        const { data: propertyWithoutEtat, error: errorWithoutEtat } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", propertyId)
          .maybeSingle();
        
        if (errorWithoutEtat) {
          propertyError = errorWithoutEtat;
        } else {
          property = propertyWithoutEtat;
          // Si etat n'existe pas, on considère que c'est un draft par défaut
          if (property) {
            property.etat = "draft";
          }
        }
      } else {
        propertyError = errorWithEtat;
      }
    } else {
      property = propertyWithEtat;
    }

    if (propertyError) {
      throw new ApiError(500, "Erreur lors de la récupération de la propriété", propertyError);
    }

    if (!property) {
      // Fallback: essayer de supprimer directement (pour compatibilité)
      const { error: fallbackError, count } = await serviceClient
        .from("properties")
        .delete({ count: "exact" })
        .eq("id", propertyId);

      if (fallbackError) {
        throw new ApiError(500, "Erreur lors de la suppression", fallbackError);
      }

      if ((count ?? 0) > 0) {
        return NextResponse.json({ success: true });
      }

      throw new ApiError(404, "Propriété non trouvée", { propertyId });
    }

    // ✅ PERMISSIONS: Vérifier le profil
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé", profileError);
    }

    // ✅ PERMISSIONS: Vérifier les permissions de suppression
    const isAdmin = profile.role === "admin";
    const isOwner = profile.id === property.owner_id;

    if (!isAdmin && !isOwner) {
      throw new ApiError(403, "Vous n'avez pas la permission de supprimer cette propriété");
    }

    // ✅ VALIDATION MÉTIER: Vérifier l'état (seuls les brouillons peuvent être supprimés)
    if (!isAdmin && property.etat && property.etat !== "draft") {
      throw new ApiError(400, "Seuls les brouillons peuvent être supprimés");
    }

    // ✅ SUPPRESSION: Supprimer la propriété
    const { error: deleteError } = await serviceClient
      .from("properties")
      .delete()
      .eq("id", propertyId);

    if (deleteError) {
      throw new ApiError(500, "Erreur lors de la suppression", deleteError);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

