export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

/**
 * Configuration Vercel: maxDuration: 10s
 */
export const maxDuration = 10;

interface Profile {
  id: string;
  role: "admin" | "owner" | "tenant" | "provider";
}

interface PropertyWithId {
  id: string;
}

interface LeaseSignerWithLeaseId {
  lease_id: string;
}

export async function GET(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      throw new ApiError(error.status || 401, error.message);
    }

    if (!user || !supabase) {
      throw new ApiError(401, "Non authentifié");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(
        500,
        "SUPABASE_SERVICE_ROLE_KEY manquante. Configurez la clé service-role pour lister les baux."
      );
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Récupérer le profil de l'utilisateur courant
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const profileData = profile as Profile;

    const url = new URL(request.url);
    const propertyIdParam =
      url.searchParams.get("propertyId") ?? url.searchParams.get("property_id");
    const ownerIdParam =
      url.searchParams.get("ownerId") ?? url.searchParams.get("owner_id");
    const tenantIdParam =
      url.searchParams.get("tenantId") ?? url.searchParams.get("tenant_id");
    // Support du paramètre status pour filtrer les baux par statut
    const statusParam = url.searchParams.get("status");

    // Sécuriser les filtres explicites
    let ownerProfileId: string | null = null;
    if (ownerIdParam) {
      if (profileData.role !== "admin" && ownerIdParam !== profileData.id) {
        throw new ApiError(403, "Accès non autorisé");
      }
      ownerProfileId = ownerIdParam;
    } else if (profileData.role === "owner") {
      ownerProfileId = profileData.id;
    }

    let tenantProfileId: string | null = null;
    if (tenantIdParam) {
      if (profileData.role !== "admin" && tenantIdParam !== profileData.id) {
        throw new ApiError(403, "Accès non autorisé");
      }
      tenantProfileId = tenantIdParam;
    } else if (profileData.role === "tenant") {
      tenantProfileId = profileData.id;
    }

    // ✅ Récupérer les baux avec les données COMPLÈTES de la propriété (source unique)
    let query = serviceClient
      .from("leases")
      .select(`
        *,
        property:properties(
          id,
          adresse_complete,
          ville,
          code_postal,
          loyer_hc,
          loyer_base,
          charges_mensuelles,
          surface_habitable_m2,
          surface
        )
      `)
      .order("created_at", { ascending: false });

    if (propertyIdParam) {
      // Si property_id est "new", retourner un tableau vide (pas encore de propriété créée)
      if (propertyIdParam === "new") {
        return NextResponse.json({ leases: [] });
      }
      query = query.eq("property_id", propertyIdParam);
    } else if (ownerProfileId) {
      // Optimisation : utiliser une sous-requête pour éviter deux requêtes séparées
      // Récupérer directement les baux des propriétés de l'owner
      const { data: ownerProperties, error: ownerPropertiesError } = await serviceClient
        .from("properties")
        .select("id")
        .eq("owner_id", ownerProfileId)
        .limit(100); // Limiter pour éviter les problèmes de performance

      if (ownerPropertiesError) {
        console.error("[GET /api/leases] Error fetching owner properties:", ownerPropertiesError);
        return NextResponse.json({ leases: [] });
      }

      const propertyIds = ((ownerProperties || []) as PropertyWithId[])
        .map((p) => p.id)
        .filter(Boolean);
      if (propertyIds.length === 0) {
        return NextResponse.json({ leases: [] });
      }

      query = query.in("property_id", propertyIds);
    } else if (profileData.role !== "admin") {
      // Les rôles non-admin sans filtre explicite n'ont pas accès aux baux
      return NextResponse.json({ leases: [] });
    }

    if (tenantProfileId) {
      const { data: signers, error: signersError } = await serviceClient
        .from("lease_signers")
        .select("lease_id")
        .eq("profile_id", tenantProfileId)
        .in("role", ["locataire_principal", "colocataire"]);

      if (signersError) throw signersError;

      const leaseIds = ((signers || []) as LeaseSignerWithLeaseId[])
        .map((s) => s.lease_id)
        .filter(Boolean);
      if (leaseIds.length === 0) {
        return NextResponse.json({ leases: [] });
      }

      query = query.in("id", leaseIds);
    }

    // Filtrer par statut si le paramètre est fourni
    if (statusParam) {
      const statuses = statusParam.split(",").map(s => s.trim()).filter(Boolean);
      if (statuses.length > 0) {
        query = query.in("statut", statuses);
      }
    }

    const { data: leases, error: leasesError } = await query;
    if (leasesError) throw leasesError;

    // Récupérer les signataires pour chaque bail
    const leaseIds = (leases || []).map((l: any) => l.id);
    let signersMap: Record<string, any[]> = {};
    
    if (leaseIds.length > 0) {
      const { data: allSigners, error: allSignersError } = await serviceClient
        .from("lease_signers")
        .select(`
          id,
          lease_id,
          profile_id,
          role,
          signature_status,
          signed_at,
          profile:profiles(id, prenom, nom, email, telephone)
        `)
        .in("lease_id", leaseIds);
      
      if (!allSignersError && allSigners) {
        // Grouper les signataires par lease_id
        for (const signer of allSigners) {
          if (!signersMap[signer.lease_id]) {
            signersMap[signer.lease_id] = [];
          }
          signersMap[signer.lease_id].push(signer);
        }
      }
    }

    // ✅ SYNCHRONISATION : Les données financières viennent du BIEN (source unique)
    // Le bail ne stocke que property_id, type_bail, dates, statut
    const getMaxDepotLegal = (typeBail: string, loyerHC: number): number => {
      switch (typeBail) {
        case "nu":
        case "etudiant":
          return loyerHC * 1;
        case "meuble":
        case "colocation":
          return loyerHC * 2;
        case "mobilite":
          return 0;
        case "saisonnier":
          return loyerHC * 2;
        default:
          return loyerHC;
      }
    };

    const leasesWithSigners = (leases || []).map((lease: any) => {
      const property = lease.property;
      const signers = signersMap[lease.id] || [];
      
      // ✅ LIRE depuis le BIEN (source unique)
      const loyer = property?.loyer_hc ?? property?.loyer_base ?? 0;
      const charges = property?.charges_mensuelles ?? 0;
      const maxDepot = getMaxDepotLegal(lease.type_bail, loyer);

      // Extraire le nom du locataire principal
      const tenantSigner = signers.find(
        (s: any) => s.role === "locataire_principal" || s.role === "colocataire"
      );
      const tenantName = tenantSigner?.profile 
        ? `${tenantSigner.profile.prenom || ""} ${tenantSigner.profile.nom || ""}`.trim()
        : "Locataire";

      return {
        ...lease,
        // ✅ Données lues depuis le BIEN
        loyer,
        charges_forfaitaires: charges,
        depot_de_garantie: maxDepot,
        signers,
        // Nom du locataire pour affichage
        tenant_name: tenantName,
        // Déterminer si le propriétaire doit signer
        owner_needs_to_sign: signers.some(
          (s: any) => s.role === "proprietaire" && s.signature_status === "pending"
        ),
        // Déterminer si un locataire doit signer
        tenant_needs_to_sign: signers.some(
          (s: any) => ["locataire_principal", "colocataire"].includes(s.role) && s.signature_status === "pending"
        ),
      };
    });

    // Ajouter des headers de cache pour réduire la charge CPU
    return NextResponse.json(
      { leases: leasesWithSigners },
      {
        headers: {
          'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

interface PropertyWithOwner {
  id: string;
  owner_id: string;
}

interface LeaseResult {
  id: string;
  [key: string]: unknown;
}

/**
 * POST /api/leases - Créer un nouveau bail
 */
export async function POST(request: Request) {
  try {
    const { user, error, supabase } = await getAuthenticatedUser(request);

    if (error) {
      throw new ApiError(error.status || 401, error.message);
    }

    if (!user || !supabase) {
      throw new ApiError(401, "Non authentifié");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new ApiError(500, "Configuration manquante");
    }

    const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
    const serviceClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Récupérer le profil de l'utilisateur courant
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    const profileData = profile as Profile;

    // Seuls les propriétaires et admins peuvent créer des baux
    if (profileData.role !== "owner" && profileData.role !== "admin") {
      throw new ApiError(403, "Accès non autorisé");
    }

    const body = await request.json();
    
    // Validation des champs requis
    if (!body.property_id) {
      throw new ApiError(400, "property_id est requis");
    }
    if (!body.loyer || body.loyer <= 0) {
      throw new ApiError(400, "loyer est requis et doit être positif");
    }
    if (!body.date_debut) {
      throw new ApiError(400, "date_debut est requise");
    }

    // Vérifier que le bien appartient au propriétaire (sauf admin)
    if (profileData.role !== "admin") {
      const { data: property, error: propertyError } = await serviceClient
        .from("properties")
        .select("id, owner_id")
        .eq("id", body.property_id)
        .single();

      if (propertyError || !property) {
        throw new ApiError(404, "Bien non trouvé");
      }

      const typedProperty = property as PropertyWithOwner;
      if (typedProperty.owner_id !== profileData.id) {
        throw new ApiError(403, "Vous n'êtes pas propriétaire de ce bien");
      }
    }

    // Créer le bail (attention: colonne = depot_de_garantie dans la BDD)
    const leaseData = {
      property_id: body.property_id as string,
      type_bail: (body.type_bail as string) || "meuble",
      loyer: parseFloat(body.loyer),
      charges_forfaitaires: body.charges_forfaitaires ? parseFloat(body.charges_forfaitaires) : 0,
      depot_de_garantie: body.depot_garantie ? parseFloat(body.depot_garantie) : parseFloat(body.loyer),
      date_debut: body.date_debut as string,
      date_fin: (body.date_fin as string) || null,
      statut: (body.statut as string) || "draft",
    };

    const { data: lease, error: leaseError } = await serviceClient
      .from("leases")
      .insert(leaseData)
      .select()
      .single();

    if (leaseError || !lease) {
      console.error("[POST /api/leases] Error creating lease:", leaseError);
      throw new ApiError(500, leaseError?.message || "Erreur lors de la création du bail");
    }

    const leaseResult = lease as LeaseResult;

    // Ajouter le propriétaire comme signataire automatiquement
    try {
      const { error: ownerSignerError } = await serviceClient
        .from("lease_signers")
        .insert({
          lease_id: leaseResult.id,
          profile_id: profileData.id,
          role: "proprietaire",
          signature_status: "pending",
        });

      if (ownerSignerError) {
        console.warn("[POST /api/leases] Erreur ajout signataire propriétaire:", ownerSignerError);
      } else {
        console.log("[POST /api/leases] Propriétaire ajouté comme signataire");
      }
    } catch (signerErr) {
      console.warn("[POST /api/leases] Exception signataire (non bloquant):", signerErr);
    }

    // ✅ FIX: Ajouter un signataire locataire (soit avec profile existant, soit placeholder)
    try {
      const tenantEmail = body.tenant_email as string | undefined;
      const tenantName = body.tenant_name as string | undefined;
      const tenantProfileId = body.tenant_profile_id as string | undefined;
      
      let tenantSignerData: Record<string, unknown>;
      
      if (tenantProfileId) {
        // Cas 1: Le locataire a déjà un profil
        tenantSignerData = {
          lease_id: leaseResult.id,
          profile_id: tenantProfileId,
          role: "locataire_principal",
          signature_status: "pending",
        };
        console.log("[POST /api/leases] Locataire ajouté via profile_id:", tenantProfileId);
      } else if (tenantEmail && tenantEmail !== "") {
        // Cas 2: On a un email - chercher si un profil existe via auth.users
        const { data: authData } = await serviceClient.auth.admin.listUsers();
        const existingUser = authData?.users?.find(u => u.email?.toLowerCase() === tenantEmail.toLowerCase());
        
        let existingProfileId: string | null = null;
        if (existingUser) {
          const { data: profile } = await serviceClient
            .from("profiles")
            .select("id")
            .eq("user_id", existingUser.id)
            .maybeSingle();
          if (profile) existingProfileId = profile.id;
        }
        
        if (existingProfileId) {
          tenantSignerData = {
            lease_id: leaseResult.id,
            profile_id: existingProfileId,
            role: "locataire_principal",
            signature_status: "pending",
          };
          console.log("[POST /api/leases] Locataire trouvé par email:", tenantEmail);
        } else {
          // Créer un signataire invité
          tenantSignerData = {
            lease_id: leaseResult.id,
            profile_id: null,
            invited_email: tenantEmail,
            invited_name: tenantName || tenantEmail.split("@")[0],
            role: "locataire_principal",
            signature_status: "pending",
          };
          console.log("[POST /api/leases] Locataire invité créé:", tenantEmail);
        }
      } else {
        // Cas 3: Pas d'info locataire - créer un placeholder
        tenantSignerData = {
          lease_id: leaseResult.id,
          profile_id: null,
          invited_email: "locataire@a-definir.com",
          invited_name: "Locataire à définir",
          role: "locataire_principal",
          signature_status: "pending",
        };
        console.log("[POST /api/leases] Locataire placeholder créé");
      }
      
      const { error: tenantSignerError } = await serviceClient
        .from("lease_signers")
        .insert(tenantSignerData);
      
      if (tenantSignerError) {
        console.warn("[POST /api/leases] Erreur ajout signataire locataire:", tenantSignerError);
      }
    } catch (tenantErr) {
      console.warn("[POST /api/leases] Exception signataire locataire (non bloquant):", tenantErr);
    }

    console.log("[POST /api/leases] Bail créé avec signataires:", leaseResult.id);

    return NextResponse.json(lease, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

