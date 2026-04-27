export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { z } from "zod";
import { propertySchema } from "@/lib/validations";
import { validatePropertyData, safeValidatePropertyData } from "@/lib/validations/property-validator";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { propertiesQuerySchema, validateQueryParams } from "@/lib/validations/params";
import { withSubscriptionLimit, createSubscriptionErrorResponse } from "@/lib/middleware/subscription-check";
import { syncPropertyBillingToStripe } from "@/lib/stripe/sync-property-billing";
import { applyRateLimit } from "@/lib/middleware/rate-limit";
import { createLogger } from "@/lib/logging/structured-logger";
import { ALL_PROPERTY_TYPES } from "@/lib/constants/property-types";
import type {
  ServiceSupabaseClient,
  TypedSupabaseClient,
  MediaDocument,
  SupabaseError,
  PropertyData,
  ProfileData,
} from "@/lib/types/supabase-client";

// Configuration de timeout optimisée : 25 secondes max pour les requêtes complexes
const MAX_REQUEST_TIME = 25000;
const AUTH_TIMEOUT = 3000;
const QUERY_TIMEOUT = 8000; // Augmenté pour les requêtes complexes

type SupabaseDbClient = ServiceSupabaseClient | TypedSupabaseClient;

/**
 * GET /api/properties - Récupérer les propriétés de l'utilisateur
 * Optimisé pour réduire la consommation CPU et éviter les timeouts
 * 
 * Configuration Vercel: maxDuration: 10s
 */
export const maxDuration = 20;

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    // ✅ VALIDATION: Valider les query params avec gestion d'erreur
    const url = new URL(request.url);
    let queryParams;
    try {
      queryParams = validateQueryParams(propertiesQuerySchema, url.searchParams);
    } catch (validationError) {
      // Si la validation échoue, utiliser des paramètres par défaut au lieu de planter
      createLogger("GET /api/properties").warn("Invalid query params, using defaults", { validationError });
      queryParams = {};
    }

    // ✅ AUTHENTIFICATION: Authentification avec timeout simple
    const authPromise = getAuthenticatedUser(request);
    const authTimeout = new Promise<{ user: null; error: { message: string; status: number }; supabase: null }>((resolve) => {
      setTimeout(() => {
        resolve({ user: null, error: { message: "Auth timeout", status: 504 }, supabase: null });
      }, AUTH_TIMEOUT);
    });
    
    const { user, error, supabase } = await Promise.race([authPromise, authTimeout]);
    
    if (error || !user || !supabase) {
      throw new ApiError(error?.status || 401, error?.message || "Non authentifié");
    }

    // ✅ TIMEOUT: Vérifier le temps écoulé
    if (Date.now() - startTime > MAX_REQUEST_TIME - 5000) {
      throw new ApiError(504, "Request timeout");
    }

    // ✅ PERMISSIONS: Récupérer le profil avec timeout simple
    const profilePromise = supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    
    const profileTimeout = new Promise<{ data: ProfileData | null; error: { message: string } }>((resolve) => {
      setTimeout(() => {
        resolve({ data: null, error: { message: "Timeout" } });
      }, QUERY_TIMEOUT);
    });

    const { data: profile, error: profileError } = await Promise.race([profilePromise, profileTimeout]) as {
      data: ProfileData | null;
      error: { message: string } | null;
    };

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé", profileError);
    }

    if (profile.role !== "owner" && profile.role !== "admin") {
      throw new ApiError(403, "Accès réservé aux propriétaires ou administrateurs");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let dbClient: SupabaseDbClient = supabase as TypedSupabaseClient;

    if (profile.role === "admin") {
      if (!supabaseUrl || !serviceRoleKey) {
        createLogger("GET /api/properties").warn("Service role indisponible pour l'admin, utilisation du client authentifié");
      } else {
        const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
        dbClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });
      }
    }

    // ✅ TIMEOUT: Vérifier le temps écoulé avant les requêtes principales
    if (Date.now() - startTime > MAX_REQUEST_TIME - 5000) {
      throw new ApiError(504, "Request timeout");
    }

    // ✅ RÉCUPÉRATION: Récupérer les propriétés selon le rôle - requêtes optimisées
    let properties: Array<Record<string, unknown>> = [];
    let totalCount = 0;
    
    // ✅ PAGINATION: Récupérer les paramètres de pagination
    const page = parseInt(queryParams.page as unknown as string || "1");
    const limit = Math.min(parseInt(queryParams.limit as unknown as string || "100"), 200); // Max 200
    const offset = (page - 1) * limit;
    
    try {
      // Colonnes essentielles - utiliser seulement les colonnes de base qui existent dans toutes les DB
      // Les colonnes V3 (type_bien, surface_habitable_m2, nb_chambres, loyer_hc) peuvent ne pas exister
      const essentialColumns = "id, owner_id, type, adresse_complete, code_postal, ville, surface, nb_pieces, created_at, etat";
      
      // ✅ RECHERCHE: Construire la requête avec recherche si fournie
      let baseQuery;
      
      if (profile.role === "admin") {
        baseQuery = dbClient
          .from("properties")
          .select(essentialColumns, { count: "exact" })
          .is("deleted_at", null)
          .is("parent_property_id", null)
          .order("created_at", { ascending: false });
      } else {
        baseQuery = dbClient
          .from("properties")
          .select(essentialColumns, { count: "exact" })
          .eq("owner_id", profile.id)
          .is("deleted_at", null)
          .is("parent_property_id", null)
          .order("created_at", { ascending: false });
      }

      // ✅ RECHERCHE: Appliquer la recherche si fournie
      const searchTerm = queryParams.search || queryParams.q;
      if (baseQuery && searchTerm) {
        const term = String(searchTerm).toLowerCase();
        baseQuery = baseQuery.or(`adresse_complete.ilike.%${term}%,code_postal.ilike.%${term}%,ville.ilike.%${term}%`);
      }

      // ✅ FILTRES BASIQUES: Appliquer les filtres si fournis
      // NOTE: queryParams.type_bien est un alias V3 du wizard ; mappé sur la colonne réelle `type`.
      const typeFilter = queryParams.type ?? queryParams.type_bien;
      if (baseQuery && typeFilter) {
        baseQuery = baseQuery.eq("type", typeFilter);
      }
      if (baseQuery && queryParams.etat) {
        baseQuery = baseQuery.eq("etat", queryParams.etat);
      }
      
      // ✅ FILTRES GÉOGRAPHIQUES
      if (baseQuery && queryParams.ville) {
        baseQuery = baseQuery.ilike("ville", `%${queryParams.ville}%`);
      }
      if (baseQuery && queryParams.code_postal) {
        baseQuery = baseQuery.eq("code_postal", queryParams.code_postal);
      }
      if (baseQuery && queryParams.departement) {
        baseQuery = baseQuery.eq("departement", queryParams.departement);
      }
      
      // ✅ FILTRES NUMÉRIQUES (surface, pièces, loyer)
      if (baseQuery && queryParams.surface_min) {
        baseQuery = baseQuery.gte("surface", Number(queryParams.surface_min));
      }
      if (baseQuery && queryParams.surface_max) {
        baseQuery = baseQuery.lte("surface", Number(queryParams.surface_max));
      }
      if (baseQuery && queryParams.nb_pieces_min) {
        baseQuery = baseQuery.gte("nb_pieces", Number(queryParams.nb_pieces_min));
      }
      if (baseQuery && queryParams.nb_pieces_max) {
        baseQuery = baseQuery.lte("nb_pieces", Number(queryParams.nb_pieces_max));
      }
      if (baseQuery && queryParams.loyer_min) {
        // Note: utilise loyer_hc si disponible, sinon fallback
        baseQuery = baseQuery.gte("loyer_hc", Number(queryParams.loyer_min));
      }
      if (baseQuery && queryParams.loyer_max) {
        baseQuery = baseQuery.lte("loyer_hc", Number(queryParams.loyer_max));
      }
      
      // ✅ FILTRES BOOLÉENS
      if (baseQuery && queryParams.meuble !== undefined) {
        baseQuery = baseQuery.eq("meuble", queryParams.meuble);
      }
      if (baseQuery && queryParams.ascenseur !== undefined) {
        baseQuery = baseQuery.eq("ascenseur", queryParams.ascenseur);
      }
      
      // ✅ TRI PERSONNALISÉ
      if (baseQuery && queryParams.sort_by) {
        const sortOrder = queryParams.sort_order === "asc" ? true : false;
        baseQuery = baseQuery.order(queryParams.sort_by as string, { ascending: sortOrder });
      }

      // ✅ PAGINATION: Appliquer la pagination
      if (baseQuery) {
        const queryPromise = baseQuery.range(offset, offset + limit - 1);

        const queryResult = await Promise.race([
          queryPromise,
          new Promise<{ data: Array<Record<string, unknown>>; error: { message: string }; count: number | null }>((resolve) => {
            setTimeout(() => resolve({ data: [], error: { message: "Timeout" }, count: null }), QUERY_TIMEOUT);
          })
        ]);

        if (queryResult.error && queryResult.error.message !== "Timeout") {
          throw new ApiError(500, "Erreur lors de la récupération des propriétés", queryResult.error);
        }

        properties = queryResult.data || [];
        totalCount = typeof queryResult.count === "number" ? queryResult.count : properties.length;
        
        // ✅ MÉDIAS: Charger les médias (photos de couverture) de manière asynchrone et non-bloquante
        // Ne pas bloquer la réponse si les médias prennent trop de temps
        if (properties.length > 0 && dbClient && properties.length <= 20) {
          // Limiter le chargement des médias aux petites listes pour éviter les timeouts
          try {
            const propertyIds = properties.map((p: any) => p.id).filter(Boolean) as string[];
            
            // Timeout de 2 secondes max pour les médias
            const mediaPromise = fetchPropertyMedia(dbClient, propertyIds);
            const mediaTimeout = new Promise<Map<string, any>>((resolve) => {
              setTimeout(() => resolve(new Map()), 2000);
            });
            
            const mediaMap = await Promise.race([mediaPromise, mediaTimeout]);
            
            // Enrichir les propriétés avec les médias
            properties = properties.map((property: any) => {
              const media = mediaMap.get(property.id);
              return {
                ...property,
                cover_url: media?.cover_url || null,
                cover_document_id: media?.cover_document_id || null,
                documents_count: media?.documents_count || 0,
              };
            });
          } catch (mediaError) {
            // Ne pas faire échouer la requête si les médias échouent
            createLogger("GET /api/properties").warn("Error loading media (non-blocking)", { mediaError });
          }
        } else if (properties.length > 20) {
          // Pour les grandes listes, ne pas charger les médias pour éviter les timeouts
          properties = properties.map((property: any) => ({
            ...property,
            cover_url: null,
            cover_document_id: null,
            documents_count: 0,
          }));
        }
      }
    } catch (queryError: unknown) {
      createLogger("GET /api/properties").error("Query error", { queryError });
      if (queryError instanceof ApiError) {
        throw queryError;
      }
      throw new ApiError(500, "Erreur lors de la récupération des propriétés", queryError);
    }

    const elapsedTime = Date.now() - startTime;
    
    // Log uniquement si > 3 secondes pour réduire les logs
    if (elapsedTime > 3000) {
      createLogger("GET /api/properties").warn("Slow request", { elapsedTime, role: profile.role, count: totalCount });
    }
    
    // ✅ TIMEOUT: Retourner une erreur si trop lent
    if (elapsedTime > MAX_REQUEST_TIME) {
      throw new ApiError(504, "La requête a pris trop de temps");
    }

    // ✅ RÉPONSE: Ajouter des headers de cache pour réduire la charge CPU
    return NextResponse.json(
      { 
        properties: properties || [],
        pagination: {
          page,
          limit,
          total: totalCount,
        }
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: unknown) {
    // ✅ GESTION ERREURS: Utiliser handleApiError pour une gestion uniforme
    return handleApiError(error);
  }
}

async function fetchPropertyMedia(
  serviceClient: ServiceSupabaseClient | TypedSupabaseClient,
  propertyIds: string[]
): Promise<Map<string, { cover_document_id: string | null; cover_url: string | null; documents_count: number }>> {
  const result = new Map<string, { cover_document_id: string | null; cover_url: string | null; documents_count: number }>();

  if (propertyIds.length === 0) {
    return result;
  }

  // Limiter le nombre de propriétés pour éviter les timeouts (réduit à 20)
  const limitedPropertyIds = propertyIds.slice(0, 20);
  
  try {
    // Essayer d'abord avec la requête complète (timeout réduit à 2 secondes)
    const primaryQuery = serviceClient
      .from("documents")
      .select("id, property_id, preview_url, storage_path, is_cover, position")
      .in("property_id", limitedPropertyIds)
      .eq("collection", "property_media")
      .limit(100); // Limiter le nombre de résultats (réduit de 500 à 100)

    let mediaDocs: MediaDocument[] | null = null;
    let mediaError: SupabaseError | null = null;

    const attempt = await Promise.race([
      primaryQuery,
      new Promise<any>((resolve) => {
        setTimeout(() => {
          resolve({ data: null, error: { message: "Timeout" } });
        }, 2000); // Timeout réduit à 2 secondes
      })
    ]);
    
    mediaDocs = attempt.data;
    mediaError = attempt.error;

    if (mediaError) {
      const message = mediaError.message?.toLowerCase() ?? "";
      const missingColumn =
        message.includes("collection") ||
        message.includes("position") ||
        message.includes("is_cover") ||
        message.includes("timeout");

      if (!missingColumn && message !== "timeout") {
        createLogger("fetchPropertyMedia").error("Error fetching property media", { mediaError });
        return result;
      }

      // Fallback : requête simplifiée sans les colonnes optionnelles
      try {
        const fallback = await Promise.race([
          serviceClient
            .from("documents")
            .select("id, property_id, preview_url, storage_path, created_at")
            .in("property_id", limitedPropertyIds)
            .limit(100), // Limiter à 100 résultats
          new Promise<{ data: MediaDocument[] | null; error: SupabaseError | null }>((resolve) => {
            setTimeout(() => {
              resolve({ data: null, error: { message: "Timeout" } });
            }, 2000); // Timeout réduit à 2 secondes
          })
        ]);

        mediaDocs = fallback.data as MediaDocument[] | null;
        mediaError = fallback.error;
      } catch (fallbackError: unknown) {
        createLogger("fetchPropertyMedia").error("Fallback query failed", { fallbackError });
        return result;
      }
    }

    if (mediaError || !mediaDocs) {
      if (mediaError && mediaError.message !== "Timeout") {
        createLogger("fetchPropertyMedia").error("Error fetching property media", { mediaError });
      }
      return result;
    }

    mediaDocs.forEach((doc: MediaDocument) => {
      if (!doc.property_id) return;
      const current = result.get(doc.property_id) ?? {
        cover_document_id: null,
        cover_url: null,
        documents_count: 0,
      };

      current.documents_count += 1;
      const isCover = doc.is_cover || (!current.cover_document_id && current.documents_count === 1);
      if (isCover) {
        current.cover_document_id = doc.id ?? null;
        current.cover_url = doc.preview_url ?? null;
      }

      result.set(doc.property_id, current);
    });

    return result;
  } catch (error: unknown) {
    createLogger("fetchPropertyMedia").error("Unexpected error", { error });
    return result;
  }
}

async function generateUniquePropertyCode(serviceClient: ServiceSupabaseClient): Promise<string> {
  const { generateCode } = await import("@/lib/helpers/code-generator");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = await generateCode();
    const { data } = await serviceClient
      .from("properties")
      .select("id")
      .eq("unique_code", candidate)
      .maybeSingle();
    if (!data) {
      return candidate;
    }
  }
  throw new Error("Impossible de générer un code unique");
}

const OPTIONAL_COLUMNS = [
  "charges_mensuelles",
  "commercial_previous_activity",
  "complement_justification",
  "complement_loyer",
] as const;

function getMissingOptionalColumn(
  error: { message?: string } | null | undefined,
  payload: Record<string, unknown>
) {
  const rawMessage = error?.message ?? "";
  const message = rawMessage.toLowerCase();

  const fromOptionalList = OPTIONAL_COLUMNS.find((column) => message.includes(column));
  if (fromOptionalList) {
    return fromOptionalList;
  }

  const detectionRegexes = [
    /column\s+"?([\w]+)"?\s+of\s+relation\s+"properties"/i,
    /could not find the '([\w]+)' column/i,
    /column\s+"?([\w]+)"?\s+does not exist/i,
  ];

  for (const regex of detectionRegexes) {
    const match = rawMessage.match(regex);
    const column = match?.[1];
    if (column && Object.prototype.hasOwnProperty.call(payload, column)) {
      return column;
    }
  }

  return undefined;
}

async function insertPropertyRecord(
  serviceClient: ServiceSupabaseClient,
  payload: Record<string, unknown>
): Promise<{ data: PropertyData; warning?: string }> {
  const sanitizedPayload = { ...payload };
  const warnings: string[] = [];

  while (true) {
    // Note: Utilisation de `as any` pour gérer les colonnes optionnelles dynamiques
    // qui peuvent ne pas exister dans le schéma TypeScript mais existent en base
    const attempt = await serviceClient.from("properties").insert(sanitizedPayload as any).select().single() as {
      data: PropertyData | null;
      error: SupabaseError | null;
    };
    if (!attempt.error && attempt.data) {
      return { data: attempt.data, warning: warnings[0] };
    }

    const missingColumn = getMissingOptionalColumn(attempt.error, sanitizedPayload);
    if (!missingColumn) {
      throw attempt.error ?? new Error("Insertion impossible");
    }

    createLogger("POST /api/properties").warn("Colonne optionnelle absente, insertion sans ce champ", { missingColumn });
    warnings.push(`${missingColumn}_non_pris_en_compte`);
    delete (sanitizedPayload as any)[missingColumn];
  }
}

async function createDraftProperty({
  payload,
  profileId,
  serviceClient,
}: {
  payload: z.infer<typeof propertyDraftSchema>;
  profileId: string;
  serviceClient: ServiceSupabaseClient;
}): Promise<PropertyData> {
  // Récupérer l'entité par défaut du propriétaire pour lier la propriété
  const { data: defaultEntity } = await serviceClient
    .from("legal_entities")
    .select("id")
    .eq("owner_profile_id", profileId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const uniqueCode = await generateUniquePropertyCode(serviceClient);
  const insertPayload: Record<string, unknown> = {
    owner_id: profileId,
    legal_entity_id: defaultEntity?.id ?? null,
    type: payload.type_bien,
    adresse_complete: "Adresse à compléter",
    code_postal: "00000",
    ville: "Ville à préciser",
    departement: "00",
    surface: 0,
    nb_pieces: 0,
    nb_chambres: 0,
    ascenseur: false,
    loyer_hc: 0,
    charges_mensuelles: 0,
    depot_garantie: 0,
    zone_encadrement: false,
    unique_code: uniqueCode,
    etat: "draft",
  };

  const { data } = await insertPropertyRecord(serviceClient, insertPayload);
  createLogger("createDraftProperty").info("Draft créé", { id: data.id, type: payload.type_bien });
  return data;
}

/**
 * POST /api/properties - Créer une nouvelle propriété
 *
 * Source unique des types : ALL_PROPERTY_TYPES (lib/constants/property-types.ts).
 * Doit rester aligné avec la contrainte SQL `properties_type_check` et avec
 * l'enum équivalent dans /api/properties/init.
 */
const typeBienEnum = z.enum(ALL_PROPERTY_TYPES);

const usagePrincipalEnum = z.enum([
  "habitation",
  "local_commercial",
  "bureaux",
  "entrepot",
  "parking",
  "fonds_de_commerce",
]);

const propertyDraftSchema = z.object({
  type_bien: typeBienEnum,
  usage_principal: usagePrincipalEnum.optional(),
});

export async function POST(request: Request) {
  try {
    const rateLimitResponse = applyRateLimit(request, "property");
    if (rateLimitResponse) return rateLimitResponse;

    // ✅ AUTHENTIFICATION: Vérifier l'utilisateur
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error || !user || !supabase) {
      throw new ApiError(error?.status || 401, error?.message || "Non authentifié");
    }

    // ✅ VALIDATION: Valider le body
    const body = await request.json();
    const draftPayload = propertyDraftSchema.safeParse(body);

    // ✅ CONFIGURATION: Vérifier les variables d'environnement
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(
        500,
        "Configuration serveur incomplète",
        "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour créer des logements."
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // ✅ PERMISSIONS: Récupérer le profil
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé", profileError);
    }

    // ✅ PERMISSIONS: Vérifier que l'utilisateur est propriétaire
    if (profile.role !== "owner") {
      throw new ApiError(403, "Seuls les propriétaires peuvent créer des propriétés");
    }

    // ✅ QUOTAS SOTA 2026: Vérifier les limites d'abonnement via middleware
    const limitCheck = await withSubscriptionLimit(profile.id, "properties");
    if (!limitCheck.allowed) {
      createLogger("POST /api/properties").info("Limite atteinte", { current: limitCheck.current, max: limitCheck.max, plan: limitCheck.plan });
      // SOTA 2026: Utiliser QuotaExceededError pour un message clair avec lien upgrade
      const { QuotaExceededError } = await import("@/lib/helpers/api-error");
      throw new QuotaExceededError("properties", limitCheck.current, limitCheck.max, limitCheck.plan);
    }

    // ✅ CRÉATION: Créer un draft ou une propriété complète
    if (draftPayload.success) {
      createLogger("POST /api/properties").info("Création draft", { type_bien: draftPayload.data.type_bien });
      const property = await createDraftProperty({
        payload: draftPayload.data,
        profileId: profile.id,
        serviceClient,
      });
      createLogger("POST /api/properties").info("Draft créé avec succès", { id: property.id, owner_id: property.owner_id });

      // ✅ STRIPE SYNC: Mettre à jour la facturation des biens supplémentaires
      try {
        await syncPropertyBillingToStripe(profile.id);
      } catch (billingError) {
        createLogger("POST /api/properties").warn("Stripe billing sync failed", { billingError });
      }

      return NextResponse.json({ property }, { status: 201 });
    }

    // ✅ VALIDATION: Utiliser le validator avec détection automatique V3 vs Legacy
    const validationResult = safeValidatePropertyData(body);
    if (!validationResult.success) {
      throw new ApiError(400, "Données invalides", validationResult.error.errors);
    }
    const validated = validationResult.data;

    const uniqueCode = await generateUniquePropertyCode(serviceClient);

    // Récupérer l'entité par défaut pour lier la propriété
    const { data: defaultEntity } = await serviceClient
      .from("legal_entities")
      .select("id")
      .eq("owner_profile_id", profile.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    // ✅ CRÉATION: Créer la propriété avec le code unique et l'entité par défaut
    const { data: property } = await insertPropertyRecord(serviceClient, {
      ...validated,
      owner_id: profile.id,
      unique_code: uniqueCode,
      legal_entity_id: (validated as Record<string, unknown>).legal_entity_id ?? defaultEntity?.id ?? null,
    });

    // ✅ ÉVÉNEMENTS: Émettre un événement (si la table existe)
    try {
      await serviceClient.from("outbox").insert({
        event_type: "Property.Created",
        payload: {
          property_id: property.id,
          owner_id: profile.id,
          unique_code: uniqueCode,
        },
      });
    } catch (outboxError) {
      // Ignorer si la table n'existe pas
      createLogger("POST /api/properties").warn("Table outbox non disponible", { outboxError });
    }

    // ✅ AUDIT: Journaliser (si la table existe)
    try {
      await serviceClient.from("audit_log").insert({
        user_id: user.id,
        action: "property_created",
        entity_type: "property",
        entity_id: property.id,
        metadata: { unique_code: uniqueCode },
      });
    } catch (auditError) {
      // Ignorer si la table n'existe pas
      createLogger("POST /api/properties").warn("Table audit_log non disponible", { auditError });
    }

    // ✅ STRIPE SYNC: Mettre à jour la facturation des biens supplémentaires
    try {
      await syncPropertyBillingToStripe(profile.id);
    } catch (billingError) {
      createLogger("POST /api/properties").warn("Stripe billing sync failed (post-outbox)", { billingError });
    }

    return NextResponse.json({ property }, { status: 201 });
  } catch (error: unknown) {
    // ✅ GESTION ERREURS: Utiliser handleApiError pour une gestion uniforme
    return handleApiError(error);
  }
}
