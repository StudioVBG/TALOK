import { NextResponse } from "next/server";
import { z } from "zod";
import { propertySchema } from "@/lib/validations";
import { validatePropertyData, safeValidatePropertyData } from "@/lib/validations/property-validator";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { requireAdmin } from "@/lib/helpers/auth-helper";

/**
 * GET /api/properties - Récupérer les propriétés de l'utilisateur
 */
export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error.message, details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const supabaseClient = supabase as any;
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour lister les logements.",
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

    // Récupérer les propriétés selon le rôle
    let properties: any[] | undefined;
    if (profileData.role === "admin") {
      // Les admins voient toutes les propriétés
      const { data, error: queryError } = await serviceClient
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;
      properties = data;
    } else if (profileData.role === "owner") {
      // Les propriétaires voient leurs propriétés
      const { data, error } = await serviceClient
        .from("properties")
        .select("*")
        .eq("owner_id", profileData.id as any)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[GET /api/properties] Error fetching properties:", error);
        console.error("[GET /api/properties] Error details:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          ownerId: profileData.id,
          role: profileData.role
        });
        
        // Si erreur RLS (permission denied), retourner un tableau vide plutôt qu'une erreur 500
        if (error.code === "42501" || error.message?.includes("permission denied") || error.message?.includes("row-level security")) {
          console.warn("[GET /api/properties] RLS error detected, returning empty array");
          return NextResponse.json({ properties: [] });
        }
        
        // Pour toute autre erreur, logger et retourner un tableau vide pour éviter l'erreur 500 côté client
        console.error("[GET /api/properties] Unexpected error, returning empty array to prevent 500");
        return NextResponse.json({ 
          properties: [],
          error: "Erreur lors de la récupération des propriétés",
          debug: {
            code: error.code,
            message: error.message
          }
        });
      }
      properties = data;
    } else {
      // Les autres rôles voient les propriétés où ils ont un bail actif
      const { data: leases } = await serviceClient
        .from("lease_signers")
        .select("lease_id")
        .eq("profile_id", profileData.id as any)
        .in("role", ["locataire_principal", "colocataire"] as any);

      if (!leases || leases.length === 0) {
        properties = [];
      } else {
        const leasesArray = leases as any[];
        const leaseIds = leasesArray.map((l) => l.lease_id);
        const { data: leasesData } = await serviceClient
          .from("leases")
          .select("property_id")
          .in("id", leaseIds as any)
          .eq("statut", "active" as any);

        if (!leasesData || leasesData.length === 0) {
          properties = [];
        } else {
          const leasesDataArray = leasesData as any[];
          const propertyIds = [...new Set(leasesDataArray.map((l) => l.property_id).filter(Boolean))];
          const { data, error } = await serviceClient
            .from("properties")
            .select("*")
            .in("id", propertyIds)
            .order("created_at", { ascending: false });

          if (error) throw error;
          properties = data;
        }
      }
    }

    if (properties && properties.length > 0) {
      const mediaInfo = await fetchPropertyMedia(serviceClient, properties.map((p) => p.id as string));
      properties = properties.map((property: any) => ({
        ...property,
        ...mediaInfo.get(property.id),
      }));
    }

    // Log pour debug
    console.log(`[GET /api/properties] Profil ID: ${profileData.id}, Rôle: ${profileData.role}, Propriétés trouvées: ${properties?.length || 0}`);

    return NextResponse.json({ 
      properties: properties || [],
      debug: {
        profileId: profileData.id,
        role: profileData.role,
        count: properties?.length || 0
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/properties:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    return NextResponse.json(
      { 
        error: error.message || "Erreur serveur",
        details: error.details,
        code: error.code
      },
      { status: 500 }
    );
  }
}

async function fetchPropertyMedia(
  serviceClient: any,
  propertyIds: string[]
): Promise<Map<string, { cover_document_id: string | null; cover_url: string | null; documents_count: number }>> {
  const result = new Map<string, { cover_document_id: string | null; cover_url: string | null; documents_count: number }>();

  if (propertyIds.length === 0) {
    return result;
  }

  const primaryQuery = serviceClient
    .from("documents")
    .select("id, property_id, preview_url, storage_path, is_cover, position")
    .in("property_id", propertyIds)
    .eq("collection", "property_media");

  let mediaDocs: any[] | null = null;
  let mediaError: any = null;

  const attempt = await primaryQuery;
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
      return result;
    }

    const fallback = await serviceClient
      .from("documents")
      .select("id, property_id, preview_url, storage_path, created_at")
      .in("property_id", propertyIds);

    mediaDocs = fallback.data;
    mediaError = fallback.error;
  }

  if (mediaError || !mediaDocs) {
    if (mediaError) {
      console.error("Error fetching property media:", mediaError);
    }
    return result;
  }

  mediaDocs.forEach((doc: any) => {
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
}

async function generateUniquePropertyCode(serviceClient: any): Promise<string> {
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
  serviceClient: any,
  payload: Record<string, unknown>
): Promise<{ data: any; warning?: string }> {
  const sanitizedPayload = { ...payload };
  const warnings: string[] = [];

  while (true) {
    const attempt = await serviceClient.from("properties").insert(sanitizedPayload as any).select().single();
    if (!attempt.error && attempt.data) {
      return { data: attempt.data, warning: warnings[0] };
    }

    const missingColumn = getMissingOptionalColumn(attempt.error, sanitizedPayload);
    if (!missingColumn) {
      throw attempt.error ?? new Error("Insertion impossible");
    }

    console.warn(
      `[api/properties] Colonne optionnelle absente (${missingColumn}). Insertion sans ce champ sur cette base.`
    );
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
  serviceClient: any;
}) {
  const uniqueCode = await generateUniquePropertyCode(serviceClient);
  const insertPayload: Record<string, unknown> = {
    owner_id: profileId,
    // Support V3 : type_bien (nouveau champ)
    type_bien: payload.type_bien,
    // Support Legacy : type (pour rétrocompatibilité)
    type: payload.type_bien,
    usage_principal: payload.usage_principal ?? "habitation",
    adresse_complete: "Adresse à compléter",
    code_postal: "00000",
    ville: "Ville à préciser",
    departement: "00",
    surface: 0,
    nb_pieces: 0,
    nb_chambres: 0,
    ascenseur: false,
    energie: null,
    ges: null,
    loyer_base: 0,
    loyer_hc: 0,
    charges_mensuelles: 0,
    depot_garantie: 0,
    zone_encadrement: false,
    encadrement_loyers: false,
    unique_code: uniqueCode,
    // État par défaut pour un draft
    etat: "draft",
  };

  const { data } = await insertPropertyRecord(serviceClient, insertPayload);
  console.log(`[createDraftProperty] Draft créé: id=${data.id}, type_bien=${payload.type_bien}`);
  return data;
}

/**
 * POST /api/properties - Créer une nouvelle propriété
 */
const typeBienEnum = z.enum([
  "appartement",
  "maison",
  "studio",
  "colocation",
  "saisonnier",
  "local_commercial",
  "bureaux",
  "entrepot",
  "parking",
  "box",
  "fonds_de_commerce",
]);

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
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      return NextResponse.json(
        { error: error.message, details: (error as any).details },
        { status: error.status || 401 }
      );
    }

    if (!user || !supabase) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const draftPayload = propertyDraftSchema.safeParse(body);

    // Récupérer le profil
    const supabaseClientPost = supabase as any;
    const { data: profile } = await supabaseClientPost
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    if (profileData.role !== "owner") {
      return NextResponse.json(
        { error: "Seuls les propriétaires peuvent créer des propriétés" },
        { status: 403 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour créer des logements.",
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

    if (draftPayload.success) {
      console.log(`[POST /api/properties] Création d'un draft avec type_bien=${draftPayload.data.type_bien}`);
      const property = await createDraftProperty({
        payload: draftPayload.data,
        profileId: profileData.id as string,
        serviceClient,
      });
      console.log(`[POST /api/properties] Draft créé avec succès: id=${property.id}, owner_id=${property.owner_id}`);
      return NextResponse.json({ property }, { status: 201 });
    }

    // Utiliser le validator avec détection automatique V3 vs Legacy
    const validationResult = safeValidatePropertyData(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Données invalides", details: validationResult.error.errors },
        { status: 400 }
      );
    }
    const validated = validationResult.data;

    const uniqueCode = await generateUniquePropertyCode(serviceClient);

    // Créer la propriété avec le code unique
    const { data: property } = await insertPropertyRecord(serviceClient, {
      ...validated,
      owner_id: profileData.id as any,
      unique_code: uniqueCode,
    });

    // Émettre un événement
    await serviceClient.from("outbox").insert({
      event_type: "Property.Created",
      payload: {
        property_id: property.id,
        owner_id: profileData.id,
        unique_code: uniqueCode,
      },
    } as any);

    // Journaliser
    await serviceClient.from("audit_log").insert({
      user_id: user.id,
      action: "property_created",
      entity_type: "property",
      entity_id: property.id,
      metadata: { unique_code: uniqueCode },
    } as any);

    return NextResponse.json({ property });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

