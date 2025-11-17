import { NextResponse } from "next/server";
import { propertyGeneralUpdateSchema, propertySchema } from "@/lib/validations";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";

/**
 * GET /api/properties/[id] - Récupérer une propriété par ID
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError, supabase } = await getAuthenticatedUser(request);

    if (authError) {
      return NextResponse.json(
        { error: authError.message, details: (authError as any).details },
        { status: authError.status || 401 }
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
            "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour consulter un logement.",
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

    // Récupérer le profil pour vérifier les permissions
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;

    // Récupérer la propriété
    const { data: property, error: propertyError } = await serviceClient
      .from("properties")
      .select("*")
      .eq("id", params.id as any)
      .maybeSingle();

    if (propertyError) {
      console.error(`[GET /api/properties/${params.id}] Erreur lors de la récupération:`, propertyError);
      throw propertyError;
    }
    if (!property) {
      console.warn(`[GET /api/properties/${params.id}] Propriété non trouvée (ID: ${params.id})`);
      return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
    }

    console.log(`[GET /api/properties/${params.id}] Propriété trouvée: owner_id=${property.owner_id}`);

    const propertyData = property as any;

    // Vérifier les permissions : admin peut tout voir, owner peut voir ses propriétés
    if (profileData.role !== "admin" && profileData.id !== propertyData.owner_id) {
      // Vérifier si l'utilisateur a un bail actif sur cette propriété
      const { data: leases, error: leasesError } = await serviceClient
        .from("lease_signers")
        .select("lease_id")
        .eq("profile_id", profileData.id);

      if (leasesError) throw leasesError;

      if (leases && leases.length > 0) {
        const leaseIds = leases.map((l: any) => l.lease_id);
        const { data: activeLeases, error: activeLeasesError } = await serviceClient
          .from("leases")
          .select("property_id")
          .in("id", leaseIds)
          .eq("property_id", params.id)
          .eq("statut", "active");

        if (activeLeasesError) throw activeLeasesError;

        if (!activeLeases || activeLeases.length === 0) {
          return NextResponse.json(
            { error: "Vous n'avez pas accès à cette propriété" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Vous n'avez pas accès à cette propriété" },
          { status: 403 }
        );
      }
    }

    const mediaInfo = await fetchSinglePropertyMedia(serviceClient, propertyData.id);

    return NextResponse.json({
      property: {
        ...property,
        ...mediaInfo,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
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
    const { user, error: authError, supabase } = await getAuthenticatedUser(request);

    if (authError) {
      return NextResponse.json(
        { error: authError.message, details: (authError as any).details },
        { status: authError.status || 401 }
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
            "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour mettre à jour un logement.",
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

    const body = await request.json();
    const validated = propertyGeneralUpdateSchema.parse(body);

    // Récupérer le profil avec serviceClient pour éviter les problèmes RLS
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Récupérer la propriété avec serviceClient pour éviter les problèmes RLS
    // Essayer d'abord avec toutes les colonnes, puis sans si certaines n'existent pas
    let property: any = null;
    let propertyError: any = null;
    
    const { data: propertyWithAll, error: errorWithAll } = await serviceClient
      .from("properties")
      .select("owner_id, etat, type")
      .eq("id", params.id as any)
      .maybeSingle();

    if (errorWithAll) {
      // Si l'erreur est due à une colonne manquante, réessayer sans etat et type
      if (errorWithAll.message?.includes("does not exist") || errorWithAll.message?.includes("column") || errorWithAll.code === "42703") {
        console.log(`[PATCH /api/properties/${params.id}] Colonne manquante détectée, réessai avec colonnes minimales`);
        const { data: propertyMinimal, error: errorMinimal } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", params.id as any)
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
      console.error(`[PATCH /api/properties/${params.id}] Erreur lors de la récupération de la propriété:`, propertyError);
      throw propertyError;
    }

    if (!property) {
      console.warn(`[PATCH /api/properties/${params.id}] Propriété non trouvée (ID: ${params.id})`);
      return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
    }

    console.log(`[PATCH /api/properties/${params.id}] Propriété trouvée: owner_id=${property.owner_id}, etat=${property.etat || "N/A"}, type=${property.type || "N/A"}`);

    const profileData = profile as any;
    const isAdmin = profileData.role === "admin";
    const isOwner = property.owner_id === profileData.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier ce logement" },
        { status: 403 }
      );
    }

    // Vérifier l'état seulement si la colonne existe
    const propertyEtat = (property as any).etat;
    if (!isAdmin && propertyEtat && !["draft", "rejected"].includes(propertyEtat as string)) {
      return NextResponse.json(
        { error: "Impossible de modifier un logement soumis ou publié" },
        { status: 400 }
      );
    }

    // Retirer la restriction sur le type "appartement" pour permettre tous les types V3
    // Le flux PATCH peut maintenant être utilisé pour tous les types de biens

    const updates: Record<string, unknown> = { ...validated, updated_at: new Date().toISOString() };

    if (Object.prototype.hasOwnProperty.call(validated, "loyer_hc")) {
      const value = validated.loyer_hc ?? null;
      updates.loyer_base = value ?? 0;
    }

    // Utiliser serviceClient pour la mise à jour pour éviter les problèmes RLS
    const { data: updatedProperty, error: updateError } = await serviceClient
      .from("properties")
      .update(updates as any)
      .eq("id", params.id as any)
      .select()
      .single();

    if (updateError || !updatedProperty) {
      return NextResponse.json(
        { error: updateError?.message || "Impossible de mettre à jour le logement" },
        { status: 500 }
      );
    }

    return NextResponse.json({ property: updatedProperty });
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

  const sortedDocs = mediaDocs.slice().sort((a: any, b: any) => {
    const posA = a.position ?? Number.MAX_SAFE_INTEGER;
    const posB = b.position ?? Number.MAX_SAFE_INTEGER;
    return posA - posB;
  });
  const cover = sortedDocs.find((doc: any) => doc.is_cover) ?? sortedDocs[0] ?? null;

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
    const { user, error: authError, supabase } = await getAuthenticatedUser(request);

    if (authError || !user || !supabase) {
      return NextResponse.json(
        { error: authError?.message || "Non authentifié" },
        { status: authError?.status || 401 }
      );
    }

    const body = await request.json();
    // Utiliser propertyGeneralUpdateSchema pour les mises à jour partielles
    const validated = propertyGeneralUpdateSchema.parse(body);

    const supabaseClient = supabase as any;

    // Vérifier que l'utilisateur est propriétaire de la propriété
    const { data: property, error: propertyError } = await supabaseClient
      .from("properties")
      .select("owner_id, etat")
      .eq("id", params.id as any)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;
    const propertyData = property as any;

    if (profileData.role !== "admin" && profileData.id !== propertyData.owner_id) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier cette propriété" },
        { status: 403 }
      );
    }

    if (
      profileData.role !== "admin" &&
      !["draft", "rejected"].includes(propertyData.etat as string)
    ) {
      return NextResponse.json(
        { error: "Impossible de modifier un logement en cours de validation ou publié" },
        { status: 400 }
      );
    }

    const { data: updatedProperty, error: updateError } = await supabaseClient
      .from("properties")
      .update(validated as any)
      .eq("id", params.id as any)
      .select()
      .single();

    if (updateError) throw updateError;
    return NextResponse.json({ property: updatedProperty });
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

/**
 * DELETE /api/properties/[id] - Supprimer une propriété
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError, supabase } = await getAuthenticatedUser(request);

    if (authError || !user || !supabase) {
      return NextResponse.json(
        { error: authError?.message || "Non authentifié" },
        { status: authError?.status || 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY manquante. Impossible de supprimer le logement." },
        { status: 500 }
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Vérifier que l'utilisateur est propriétaire de la propriété
    // Essayer d'abord avec etat, puis sans si la colonne n'existe pas
    let property: any = null;
    let propertyError: any = null;
    
    const { data: propertyWithEtat, error: errorWithEtat } = await serviceClient
      .from("properties")
      .select("owner_id, etat")
      .eq("id", params.id as any)
      .maybeSingle();

    if (errorWithEtat) {
      // Si l'erreur est due à une colonne manquante, réessayer sans etat
      if (errorWithEtat.message?.includes("does not exist") || errorWithEtat.message?.includes("column") || errorWithEtat.code === "42703") {
        const { data: propertyWithoutEtat, error: errorWithoutEtat } = await serviceClient
          .from("properties")
          .select("owner_id")
          .eq("id", params.id as any)
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
      throw propertyError;
    }

    if (!property) {
      const { error: fallbackError, count } = await serviceClient
        .from("properties")
        .delete({ count: "exact" })
        .eq("id", params.id as any);

      if (fallbackError) {
        throw fallbackError;
      }

      if ((count ?? 0) > 0) {
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: "Propriété non trouvée" }, { status: 404 });
    }

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id as any)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    const profileData = profile as any;
    const propertyData = property as any;

    if (profileData.role !== "admin" && profileData.id !== propertyData.owner_id) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de supprimer cette propriété" },
        { status: 403 }
      );
    }

    // Vérifier l'état seulement si la colonne existe (etat sera "draft" par défaut si la colonne n'existe pas)
    if (
      profileData.role !== "admin" &&
      propertyData.etat &&
      propertyData.etat !== "draft"
    ) {
      return NextResponse.json(
        { error: "Seuls les brouillons peuvent être supprimés" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await serviceClient
      .from("properties")
      .delete()
      .eq("id", params.id as any);

    if (deleteError) throw deleteError;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

