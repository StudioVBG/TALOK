export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

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
    
    // DEBUG: Log les données reçues pour diagnostiquer les problèmes de sauvegarde
    console.log(`[PATCH /api/properties/${params.id}] Body reçu:`, JSON.stringify(body, null, 2));
    
    // Utiliser safeParse pour avoir des logs détaillés en cas d'erreur de validation
    const parseResult = propertyGeneralUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      console.error(`[PATCH /api/properties/${params.id}] ❌ Erreur validation Zod:`, JSON.stringify(parseResult.error.errors, null, 2));
      throw new ApiError(400, "Données invalides", parseResult.error.errors);
    }
    const validated = parseResult.data;
    
    // DEBUG: Log les données après validation
    console.log(`[PATCH /api/properties/${params.id}] ✅ Validé:`, JSON.stringify(validated, null, 2));

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

    // TODO: Réactiver après application de la migration 20251207231451_add_visite_virtuelle_url.sql
    // Supprimer temporairement le champ visite_virtuelle_url car la colonne n'existe pas encore
    delete updates.visite_virtuelle_url;

    // Mapping type_bien → type pour compatibilité (si type_bien est fourni mais pas type)
    if (Object.prototype.hasOwnProperty.call(validated, "type_bien") && !Object.prototype.hasOwnProperty.call(validated, "type")) {
      updates.type = validated.type_bien;
    }
    // Si les deux sont fournis, s'assurer qu'ils sont cohérents
    if (Object.prototype.hasOwnProperty.call(validated, "type_bien") && Object.prototype.hasOwnProperty.call(validated, "type")) {
      // type_bien a la priorité pour V3
      updates.type = validated.type_bien;
    }

    // Note: loyer_base n'existe pas dans la table properties
    // On utilise uniquement loyer_hc (colonne ajoutée par migration V3)

    // Mapping surface ↔ surface_habitable_m2 pour compatibilité V2/V3
    // Si surface est fourni, on met à jour aussi surface_habitable_m2
    if (Object.prototype.hasOwnProperty.call(validated, "surface") && validated.surface != null) {
      updates.surface_habitable_m2 = validated.surface;
    }
    // Si surface_habitable_m2 est fourni, on met à jour aussi surface
    if (Object.prototype.hasOwnProperty.call(validated, "surface_habitable_m2") && validated.surface_habitable_m2 != null) {
      updates.surface = validated.surface_habitable_m2;
    }

    // DEBUG: Log les updates qui vont être appliqués
    console.log(`[PATCH /api/properties/${params.id}] Updates à appliquer:`, JSON.stringify(updates, null, 2));

    // ✅ MISE À JOUR: Utiliser serviceClient pour la mise à jour pour éviter les problèmes RLS
    const { data: updatedProperty, error: updateError } = await serviceClient
      .from("properties")
      .update(updates)
      .eq("id", propertyId)
      .select()
      .single();

    if (updateError || !updatedProperty) {
      console.error(`[PATCH /api/properties/${params.id}] Erreur update:`, {
        error: updateError,
        errorMessage: updateError?.message,
        errorCode: updateError?.code,
        errorDetails: updateError?.details,
        errorHint: updateError?.hint,
        updates: Object.keys(updates),
      });
      
      // Construire un message d'erreur plus détaillé
      let errorMessage = "Impossible de mettre à jour le logement";
      if (updateError?.message) {
        errorMessage = updateError.message;
      } else if (updateError?.code) {
        errorMessage = `Erreur base de données (${updateError.code})`;
      }
      
      throw new ApiError(
        500,
        errorMessage,
        {
          ...updateError,
          updatesAttempted: Object.keys(updates),
          errorDetails: updateError?.details || updateError,
        }
      );
    }
    
    // DEBUG: Log le résultat de la mise à jour
    console.log(`[PATCH /api/properties/${params.id}] Propriété mise à jour:`, {
      surface: updatedProperty.surface,
      surface_habitable_m2: updatedProperty.surface_habitable_m2,
      nb_pieces: updatedProperty.nb_pieces,
      nb_chambres: updatedProperty.nb_chambres,
      loyer_hc: updatedProperty.loyer_hc,
    });

    // ✅ SOTA 2026: Émettre notification si publication
    if (updates.etat === "published" && property.etat !== "published") {
      try {
        await serviceClient.from("outbox").insert({
          event_type: "Property.Published",
          payload: {
            property_id: propertyId,
            owner_user_id: user.id,
            property_address: updatedProperty.adresse_complete || updatedProperty.ville || "Votre bien",
          },
        });
      } catch (notifError) {
        console.warn("Notification Property.Published non envoyée:", notifError);
      }
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

    // ✅ SOTA 2026: Vérifier s'il y a des baux actifs
    const { data: activeLeases, error: leasesError } = await serviceClient
      .from("leases")
      .select(`
        id, 
        statut,
        type_bail,
        signers:lease_signers(
          profile_id,
          role,
          profile:profiles(id, prenom, nom, email)
        )
      `)
      .eq("property_id", propertyId)
      .in("statut", ["active", "pending_signature", "partially_signed", "fully_signed"]);

    if (leasesError) {
      console.error("[DELETE Property] Erreur vérification baux:", leasesError);
    }

    // ✅ BLOQUER si bail actif (sauf admin)
    if (!isAdmin && activeLeases && activeLeases.length > 0) {
      const activeLease = activeLeases[0] as any;
      const tenantSigner = activeLease.signers?.find((s: any) => 
        s.role === "locataire_principal" || s.role === "colocataire"
      );
      const tenantName = tenantSigner?.profile 
        ? `${tenantSigner.profile.prenom || ""} ${tenantSigner.profile.nom || ""}`.trim() || tenantSigner.profile.email
        : "un locataire";

      throw new ApiError(
        400, 
        `Impossible de supprimer : bail ${activeLease.statut === "active" ? "actif" : "en cours de signature"} avec ${tenantName}. Terminez d'abord le bail.`,
        { 
          leaseId: activeLease.id, 
          leaseStatus: activeLease.statut,
          tenantName 
        }
      );
    }

    // ✅ SOTA 2026: Récupérer l'adresse pour les notifications
    const { data: propertyDetails } = await serviceClient
      .from("properties")
      .select("adresse_complete, ville")
      .eq("id", propertyId)
      .single();

    // ✅ SOTA 2026: Notifier les locataires des baux (même terminés) avant suppression
    const { data: allLeases } = await serviceClient
      .from("leases")
      .select(`
        id,
        signers:lease_signers(
          profile_id,
          role
        )
      `)
      .eq("property_id", propertyId);

    if (allLeases && allLeases.length > 0) {
      const tenantProfileIds = new Set<string>();
      
      for (const lease of allLeases) {
        const leaseData = lease as any;
        if (leaseData.signers) {
          for (const signer of leaseData.signers) {
            if ((signer.role === "locataire_principal" || signer.role === "colocataire") && signer.profile_id) {
              tenantProfileIds.add(signer.profile_id);
            }
          }
        }
      }

      // Créer les notifications pour chaque locataire
      const address = propertyDetails?.adresse_complete || "Adresse inconnue";
      const city = propertyDetails?.ville || "";
      
      for (const tenantId of tenantProfileIds) {
        await serviceClient
          .from("notifications")
          .insert({
            recipient_id: tenantId,
            type: "alert",
            title: "Logement supprimé",
            message: `Le logement "${address}${city ? `, ${city}` : ""}" a été supprimé par le propriétaire. Vos documents restent accessibles dans votre coffre-fort.`,
            link: "/tenant/documents",
            related_id: propertyId,
            related_type: "property"
          })
          .then(({ error }) => {
            if (error) {
              console.error("[DELETE Property] Erreur notification locataire:", error);
            }
          });
      }
    }

    // ✅ SOTA 2026: Soft-delete au lieu de hard-delete
    // Marquer comme supprimé plutôt que supprimer définitivement
    const { data: softDeletedProperty, error: softDeleteError } = await serviceClient
      .from("properties")
      .update({ 
        etat: "deleted",
        deleted_at: new Date().toISOString(),
        deleted_by: profile.id
      })
      .eq("id", propertyId)
      .select()
      .single();

    // Si soft-delete échoue (colonne manquante), faire un hard-delete
    if (softDeleteError) {
      console.warn("[DELETE Property] Soft-delete échoué, fallback hard-delete:", softDeleteError.message);
      
      const { error: deleteError } = await serviceClient
        .from("properties")
        .delete()
        .eq("id", propertyId);

      if (deleteError) {
        throw new ApiError(500, "Erreur lors de la suppression", deleteError);
      }

      return NextResponse.json({ 
        success: true, 
        mode: "hard_delete",
        message: "Propriété supprimée définitivement"
      });
    }

    return NextResponse.json({ 
      success: true,
      mode: "soft_delete", 
      message: "Propriété archivée. Les locataires ont été notifiés.",
      tenantsNotified: allLeases?.length || 0
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

