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
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Service client pour bypasser RLS (évite récursion user_profile_id())
  const serviceClient = getServiceClient();

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
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

  if (property) {
    // Vérification d'accès : admin, owner direct, ou membre SCI via
    // entity_members. Même pattern que `/api/invoices/[id]/route.ts:78-106`.
    const propertyAny = property as any;
    const isAdmin = profile.role === "admin";
    const isOwnerDirect = propertyAny.owner_id === profile.id;
    let isSciMember = false;
    if (!isAdmin && !isOwnerDirect && propertyAny.legal_entity_id) {
      const { data: membership } = await serviceClient
        .from("entity_members")
        .select("id")
        .eq("entity_id", propertyAny.legal_entity_id)
        .eq("user_id", user.id)
        .maybeSingle();
      isSciMember = !!membership;
    }

    if (!isAdmin && !isOwnerDirect && !isSciMember) {
      console.warn("[building-detail] Accès refusé", {
        propertyId: id,
        profileId: profile.id,
        ownerId: propertyAny.owner_id,
        legalEntityId: propertyAny.legal_entity_id,
      });
      notFound();
    }

    // Property trouvée et accessible — vérifier que c'est bien un immeuble
    if (property.type !== "immeuble") {
      // Ce n'est pas un immeuble, rediriger vers la fiche bien classique
      redirect(`/owner/properties/${id}`);
    }
  }

  if (!property) {
    // 2. Fallback : peut-être que l'URL contient un building_id au lieu d'un property_id
    const { data: buildingRecord } = await serviceClient
      .from("buildings")
      .select("property_id")
      .eq("id", id)
      .maybeSingle();

    if (buildingRecord?.property_id) {
      // Rediriger vers l'URL canonique avec property_id
      redirect(`/owner/buildings/${buildingRecord.property_id}`);
    }

    // 3. Diagnostic : la property existe-t-elle sans filtre owner_id ?
    const { data: anyProperty } = await serviceClient
      .from("properties")
      .select("id, owner_id, type, deleted_at")
      .eq("id", id)
      .maybeSingle();

    if (anyProperty) {
      console.error("[building-detail] Property exists but access denied:", {
        id,
        requestedBy: profile.id,
        actualOwner: anyProperty.owner_id,
        ownerMatch: anyProperty.owner_id === profile.id,
        type: anyProperty.type,
        deleted_at: anyProperty.deleted_at,
      });
    } else {
      console.error("[building-detail] Property not found in DB at all:", { id, error });
    }

    notFound();
  }

  // À ce stade, property est non-null et de type immeuble
  const building = property;
  propertyId = building.id;

  // Fetch building metadata
  const { data: buildingMeta } = await serviceClient
    .from("buildings")
    .select("*")
    .eq("property_id", propertyId)
    .single();

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
      : Promise.resolve({ data: null }),
    serviceClient
      .from("documents")
      .select("id, type, title, original_filename, file_size, mime_type, created_at, expiry_date, valid_until, ged_status")
      .eq("property_id", propertyId)
      .eq("is_current_version", true)
      .order("created_at", { ascending: false }),
  ]);

  // The generated DB types don't include the `property_id` column on `building_units`
  // yet, so we cast through unknown to layer the runtime-truthful shape.
  const units = ((unitsResult.data as unknown) || []) as Array<{
    id: string;
    property_id: string | null;
    current_lease_id: string | null;
    [key: string]: unknown;
  }>;

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
      : Promise.resolve({ data: [] }),
    leaseIds.length > 0
      ? serviceClient
          .from("leases")
          .select("id, tenant_id, date_fin, statut, loyer, charges_forfaitaires")
          .in("id", leaseIds)
      : Promise.resolve({ data: [] }),
  ]);

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
  const { data: tenantsData } = tenantIds.length > 0
    ? await serviceClient
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", tenantIds)
    : { data: [] as Array<{ id: string; first_name: string | null; last_name: string | null }> };

  const tenants = (tenantsData || []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
  }>;

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
