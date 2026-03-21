export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { LeaseCreateSchema, getMaxDepotLegal } from "@/lib/validations/lease-financial";
import { SIGNER_ROLES } from "@/lib/constants/roles";
import { withSubscriptionLimit } from "@/lib/middleware/subscription-check";
import { withSecurity } from "@/lib/api/with-security";

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
        property:properties(*)
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
 * POST /api/leases — Creer un nouveau bail
 * SOTA 2026: Delegue a LeaseCreationService
 *
 * Supporte mode=draft (ancien /api/leases POST) et mode=invite (ancien /api/leases/invite)
 */
export const POST = withSecurity(async function POST(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error) throw new ApiError(error.status || 401, error.message);
    if (!user) throw new ApiError(401, "Non authentifié");

    const { createServiceRoleClient } = await import("@/lib/supabase/service-client");
    const serviceClient = createServiceRoleClient();

    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) throw new ApiError(404, "Profil non trouvé");
    const profileData = profile as Profile & { prenom?: string; nom?: string };
    if (profileData.role !== "owner" && profileData.role !== "admin") throw new ApiError(403, "Accès non autorisé");

    const body = await request.json();

    const loyerRaw = body.loyer ? parseFloat(body.loyer) : 0;
    const loyer = Number.isFinite(loyerRaw) ? loyerRaw : 0;
    const chargesRaw = body.charges_forfaitaires ? parseFloat(body.charges_forfaitaires) : 0;
    const depotRaw = body.depot_garantie ? parseFloat(body.depot_garantie) : undefined;

    const validationResult = LeaseCreateSchema.safeParse({
      property_id: body.property_id,
      type_bail: body.type_bail || "meuble",
      signatory_entity_id: body.signatory_entity_id ?? null,
      loyer,
      charges_forfaitaires: Number.isFinite(chargesRaw) ? chargesRaw : 0,
      depot_de_garantie: depotRaw !== undefined && Number.isFinite(depotRaw) ? depotRaw : undefined,
      date_debut: body.date_debut,
      date_fin: body.date_fin || null,
      tenant_email: body.tenant_email,
      tenant_name: body.tenant_name,
    });

    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({ field: e.path.join("."), message: e.message }));
      throw new ApiError(400, errors[0]?.message || "Données invalides", { errors });
    }

    const v = validationResult.data;
    const mode = body.mode || "draft";

    const { createLease } = await import("@/lib/services/lease-creation.service");
    const result = await createLease({
      mode: mode as any,
      ownerProfileId: profileData.id,
      ownerName: `${profileData.prenom || ""} ${profileData.nom || ""}`.trim(),
      propertyId: v.property_id,
      typeBail: v.type_bail,
      signatoryEntityId: v.signatory_entity_id,
      loyer: v.loyer,
      chargesForfaitaires: v.charges_forfaitaires,
      depotGarantie: v.depot_de_garantie,
      dateDebut: v.date_debut,
      dateFin: v.date_fin,
      jourPaiement: body.jour_paiement,
      customClauses: body.custom_clauses,
      taxRegime: body.tax_regime,
      lmnpStatus: body.lmnp_status,
      furnitureInventory: body.furniture_inventory,
      tenantEmail: v.tenant_email,
      tenantName: v.tenant_name,
      colocConfig: body.coloc_config,
      invitees: body.invitees,
    });

    revalidatePath(`/owner/properties/${v.property_id}`);
    revalidatePath("/owner/properties");
    revalidatePath("/owner/leases");

    return NextResponse.json({
      id: result.leaseId,
      lease_id: result.leaseId,
      success: true,
      message: result.message,
      mode: result.mode,
      invitees: result.inviteeSummary,
    }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}, { routeName: "POST /api/leases", csrf: true });

