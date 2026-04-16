export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { BuildingDetailClient } from "./BuildingDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(
  { params }: PageProps,
): Promise<Metadata> {
  try {
    const { id } = await params;
    const serviceClient = getServiceClient();

    // Essayer par property_id d'abord (sans filtre type pour robustesse)
    let building = (await serviceClient
      .from("properties")
      .select("adresse_complete, ville")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()).data;

    // Fallback par building_id → property_id
    if (!building) {
      const { data: br } = await serviceClient
        .from("buildings")
        .select("property_id")
        .eq("id", id)
        .maybeSingle();
      if (br?.property_id) {
        building = (await serviceClient
          .from("properties")
          .select("adresse_complete, ville")
          .eq("id", br.property_id)
          .is("deleted_at", null)
          .maybeSingle()).data;
      }
    }

    if (!building) {
      return { title: "Immeuble non trouvé | Talok" };
    }

    return {
      title: `${building.adresse_complete} | Talok`,
      description: `Gestion de l'immeuble situé à ${building.ville}`,
    };
  } catch {
    return { title: "Immeuble | Talok" };
  }
}

export default async function BuildingDetailPage({ params }: PageProps) {
  const { id } = await params;
  console.log("[BUILDING-DEBUG] Starting page load for id:", id);

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  console.log(
    "[BUILDING-DEBUG] user.id:",
    user?.id,
    "user.email:",
    user?.email,
    "authError:",
    authError?.message ?? null,
  );

  if (authError || !user) {
    console.log("[BUILDING-DEBUG] >>> REDIRECTING to /auth/signin — reason: no auth user");
    redirect("/auth/signin");
  }

  // Service client pour bypasser RLS (évite récursion user_profile_id())
  const serviceClient = getServiceClient();

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, role, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "[BUILDING-DEBUG] Profile query error:",
      profileError.message,
      profileError.code,
      profileError.details,
    );
  }

  console.log(
    "[BUILDING-DEBUG] profile:",
    JSON.stringify({
      id: (profile as any)?.id,
      role: (profile as any)?.role,
      email: (profile as any)?.email,
    }),
  );

  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
    console.log(
      "[BUILDING-DEBUG] >>> REDIRECTING to /dashboard — reason: profile missing or role not allowed (role=",
      (profile as any)?.role,
      ")",
    );
    redirect("/dashboard");
  }

  // Fetch building — le param [id] peut être un property_id OU un building_id
  // Stratégie : query large (sans filtre owner/type) puis vérification post-
  // query via owner_id direct OU entity_members (cas SCI).
  let propertyId = id;

  // 1. Chercher la property par id SANS filtrer par owner_id. Le filtre
  //    `owner_id = profile.id` produisait un faux 404 pour les immeubles
  //    détenus via une entité SCI dont le `legal_entity_id` pointe vers un
  //    autre profil ou dont l'utilisateur est membre via `entity_members`.
  console.log("[BUILDING-DEBUG] Querying properties with id:", id);
  const { data: property, error } = await serviceClient
    .from("properties")
    .select(`
      id,
      type,
      adresse_complete,
      ville,
      code_postal,
      departement,
      surface,
      cover_url,
      annee_construction,
      owner_id,
      legal_entity_id,
      created_at,
      updated_at
    `)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error(
      "[BUILDING-DEBUG] Property query error:",
      error.message,
      error.code,
      error.details,
    );
  }

  console.log(
    "[BUILDING-DEBUG] property result:",
    JSON.stringify({
      id: (property as any)?.id,
      type: (property as any)?.type,
      owner_id: (property as any)?.owner_id,
      legal_entity_id: (property as any)?.legal_entity_id,
      error: error?.message ?? null,
    }),
  );

  if (property) {
    // Vérification d'accès : admin, owner direct, ou membre SCI via
    // entity_members. Même pattern que `/api/invoices/[id]/route.ts:78-106`.
    const propertyAny = property as any;
    const isAdmin = profile.role === "admin";
    const isOwnerDirect = propertyAny.owner_id === profile.id;
    let isSciMember = false;
    let membershipError: { message: string; code?: string } | null = null;
    if (!isAdmin && !isOwnerDirect && propertyAny.legal_entity_id) {
      const { data: membership, error: memErr } = await serviceClient
        .from("entity_members")
        .select("id")
        .eq("entity_id", propertyAny.legal_entity_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (memErr) {
        membershipError = { message: memErr.message, code: memErr.code };
        console.error(
          "[BUILDING-DEBUG] entity_members query error:",
          memErr.message,
          memErr.code,
          memErr.details,
        );
      }
      isSciMember = !!membership;
    }

    console.log(
      "[BUILDING-DEBUG] access check → isAdmin:",
      isAdmin,
      "isOwnerDirect:",
      isOwnerDirect,
      "isSciMember:",
      isSciMember,
      "propertyOwnerId:",
      propertyAny.owner_id,
      "profileId:",
      profile.id,
      "legalEntityId:",
      propertyAny.legal_entity_id,
      "membershipError:",
      membershipError,
    );

    if (!isAdmin && !isOwnerDirect && !isSciMember) {
      console.warn("[building-detail] Accès refusé", {
        propertyId: id,
        profileId: profile.id,
        ownerId: propertyAny.owner_id,
        legalEntityId: propertyAny.legal_entity_id,
      });
      console.log(
        "[BUILDING-DEBUG] >>> TRIGGERING 404 — reason: access denied (not admin, not direct owner, not SCI member)",
      );
      notFound();
    }

    // Property trouvée et accessible — vérifier que c'est bien un immeuble
    if (property.type !== "immeuble") {
      console.log(
        "[BUILDING-DEBUG] >>> REDIRECTING to /owner/properties/",
        id,
        "— reason: type is not immeuble (actual type=",
        property.type,
        ")",
      );
      // Ce n'est pas un immeuble, rediriger vers la fiche bien classique
      redirect(`/owner/properties/${id}`);
    }
  }

  if (!property) {
    console.log(
      "[BUILDING-DEBUG] property is null — attempting buildings table fallback with id:",
      id,
    );
    // 2. Fallback : peut-être que l'URL contient un building_id au lieu d'un property_id
    const { data: buildingRecord, error: buildingRecordError } = await serviceClient
      .from("buildings")
      .select("property_id")
      .eq("id", id)
      .maybeSingle();

    if (buildingRecordError) {
      console.error(
        "[BUILDING-DEBUG] buildings fallback query error:",
        buildingRecordError.message,
        buildingRecordError.code,
        buildingRecordError.details,
      );
    }

    console.log(
      "[BUILDING-DEBUG] buildings fallback result:",
      JSON.stringify({ property_id: buildingRecord?.property_id ?? null }),
    );

    if (buildingRecord?.property_id) {
      console.log(
        "[BUILDING-DEBUG] >>> REDIRECTING to canonical URL /owner/buildings/",
        buildingRecord.property_id,
      );
      // Rediriger vers l'URL canonique avec property_id
      redirect(`/owner/buildings/${buildingRecord.property_id}`);
    }

    // 3. Diagnostic : la property existe-t-elle sans filtre owner_id ?
    const { data: anyProperty, error: anyPropertyError } = await serviceClient
      .from("properties")
      .select("id, owner_id, type, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (anyPropertyError) {
      console.error(
        "[BUILDING-DEBUG] anyProperty diagnostic query error:",
        anyPropertyError.message,
        anyPropertyError.code,
        anyPropertyError.details,
      );
    }

    if (anyProperty) {
      console.error("[building-detail] Property exists but access denied:", {
        id,
        requestedBy: profile.id,
        actualOwner: anyProperty.owner_id,
        ownerMatch: anyProperty.owner_id === profile.id,
        type: anyProperty.type,
        deleted_at: anyProperty.deleted_at,
      });
      console.log(
        "[BUILDING-DEBUG] >>> TRIGGERING 404 — reason: property exists but was filtered out by initial query (deleted_at=",
        anyProperty.deleted_at,
        "type=",
        anyProperty.type,
        "owner_id=",
        anyProperty.owner_id,
        ")",
      );
    } else {
      console.error("[building-detail] Property not found in DB at all:", { id, error });
      console.log(
        "[BUILDING-DEBUG] >>> TRIGGERING 404 — reason: property truly does not exist in DB for id:",
        id,
      );
    }

    notFound();
  }

  // À ce stade, property est non-null et de type immeuble
  const building = property;
  propertyId = building.id;
  console.log(
    "[BUILDING-DEBUG] property validated as immeuble, proceeding with propertyId:",
    propertyId,
  );

  // Fetch building metadata
  const { data: buildingMeta, error: buildingMetaError } = await serviceClient
    .from("buildings")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();

  if (buildingMetaError) {
    console.error(
      "[BUILDING-DEBUG] buildings metadata query error:",
      buildingMetaError.message,
      buildingMetaError.code,
      buildingMetaError.details,
    );
  }

  console.log(
    "[BUILDING-DEBUG] buildingMeta:",
    JSON.stringify({ id: (buildingMeta as any)?.id ?? null }),
  );

  // Fetch units + documents en parallèle
  const [unitsResult, documentsResult] = await Promise.all([
    buildingMeta?.id
      ? serviceClient
          .from("building_units")
          .select(`
            id, floor, position, type, template, surface, nb_pieces,
            loyer_hc, charges, depot_garantie, status, property_id,
            current_lease_id, notes
          `)
          .eq("building_id", buildingMeta.id)
          .order("floor", { ascending: true })
          .order("position", { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    serviceClient
      .from("documents")
      .select("id, type, title, original_filename, file_size, mime_type, created_at, expiry_date, valid_until, ged_status")
      .eq("property_id", propertyId)
      .eq("is_current_version", true)
      .order("created_at", { ascending: false }),
  ]);

  if ((unitsResult as any).error) {
    console.error(
      "[BUILDING-DEBUG] building_units query error:",
      (unitsResult as any).error.message,
      (unitsResult as any).error.code,
      (unitsResult as any).error.details,
    );
  }
  if ((documentsResult as any).error) {
    console.error(
      "[BUILDING-DEBUG] documents query error:",
      (documentsResult as any).error.message,
      (documentsResult as any).error.code,
      (documentsResult as any).error.details,
    );
  }

  // The generated DB types don't include the `property_id` column on `building_units`
  // yet, so we cast through unknown to layer the runtime-truthful shape.
  const units = ((unitsResult.data as unknown) || []) as Array<{
    id: string;
    property_id: string | null;
    current_lease_id: string | null;
    [key: string]: unknown;
  }>;

  console.log("[BUILDING-DEBUG] units count:", units.length);

  // Fetch lot properties (cover_url, unique_code) and active leases/tenants in parallel.
  // Chaque lot pointe vers son propre property_id — on récupère ici les infos
  // nécessaires pour afficher le lot avec la même card que la page "Mes biens".
  const lotPropertyIds = units.map((u) => u.property_id).filter((v): v is string => !!v);
  const leaseIds = units.map((u) => u.current_lease_id).filter((v): v is string => !!v);

  const [lotPropertiesResult, leasesResult] = await Promise.all([
    lotPropertyIds.length > 0
      ? serviceClient
          .from("properties")
          .select("id, cover_url, unique_code, adresse_complete")
          .in("id", lotPropertyIds)
      : Promise.resolve({ data: [], error: null }),
    leaseIds.length > 0
      ? serviceClient
          .from("leases")
          .select("id, tenant_id, date_fin, statut, loyer, charges_forfaitaires")
          .in("id", leaseIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if ((lotPropertiesResult as any).error) {
    console.error(
      "[BUILDING-DEBUG] lotProperties query error:",
      (lotPropertiesResult as any).error.message,
      (lotPropertiesResult as any).error.code,
      (lotPropertiesResult as any).error.details,
    );
  }
  if ((leasesResult as any).error) {
    console.error(
      "[BUILDING-DEBUG] leases query error:",
      (leasesResult as any).error.message,
      (leasesResult as any).error.code,
      (leasesResult as any).error.details,
    );
  }

  const lotProperties = (lotPropertiesResult.data || []) as Array<{
    id: string;
    cover_url: string | null;
    unique_code: string | null;
    adresse_complete: string | null;
  }>;

  const leases = (leasesResult.data || []) as Array<{
    id: string;
    tenant_id: string | null;
    date_fin: string | null;
    statut: string | null;
    loyer: number | null;
    charges_forfaitaires: number | null;
  }>;

  const tenantIds = leases.map((l) => l.tenant_id).filter((v): v is string => !!v);
  const tenantsQuery = tenantIds.length > 0
    ? await serviceClient
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", tenantIds)
    : { data: [] as Array<{ id: string; first_name: string | null; last_name: string | null }>, error: null };

  if ((tenantsQuery as any).error) {
    console.error(
      "[BUILDING-DEBUG] tenants profiles query error:",
      (tenantsQuery as any).error.message,
      (tenantsQuery as any).error.code,
      (tenantsQuery as any).error.details,
    );
  }

  const tenants = (tenantsQuery.data || []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
  }>;

  console.log(
    "[BUILDING-DEBUG] rendering BuildingDetailClient — lotProperties:",
    lotProperties.length,
    "leases:",
    leases.length,
    "tenants:",
    tenants.length,
    "documents:",
    (documentsResult.data as any[])?.length ?? 0,
  );

  return (
    <BuildingDetailClient
      propertyId={propertyId}
      buildingId={buildingMeta?.id ?? null}
      building={{
        ...building,
        cover_url: building.cover_url ?? null,
        annee_construction: building.annee_construction ?? null,
      }}
      buildingMeta={buildingMeta ?? null}
      units={units}
      lotProperties={lotProperties}
      leases={leases}
      tenants={tenants}
      documents={(documentsResult.data as any[]) || []}
    />
  );
}
