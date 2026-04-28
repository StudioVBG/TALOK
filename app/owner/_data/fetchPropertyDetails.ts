import { createClient } from "@/lib/supabase/server";
import type { OwnerProperty, PropertyPhoto, LeaseInfo } from "@/lib/types/owner-property";

export interface PropertyDetails {
  property: OwnerProperty;
  units: unknown[];
  rooms: unknown[];
  leases: LeaseInfo[];
  tickets: unknown[];
  invoices: unknown[];
  photos: PropertyPhoto[];
}

/**
 * Récupère les détails d'une propriété pour la vue propriétaire.
 *
 * Accès autorisé pour :
 *  - le propriétaire direct (`properties.owner_id = profileId`)
 *  - les membres de l'entité légale liée à la property (SCI, EIRL, etc.)
 *    via `entity_members.user_id = userId`
 *
 * @param propertyId UUID de la property
 * @param profileId  profile.id du viewer (clé propriétaire historique)
 * @param userId     auth.users.id du viewer — requis pour le check entity_members
 *                   (rétro-compat : si non fourni, seul le check owner direct s'applique)
 */
export async function fetchPropertyDetails(
  propertyId: string,
  profileId: string,
  userId?: string,
): Promise<PropertyDetails | null> {
  const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
  const supabase = supabaseAdmin();

  // Récupération sans filtre owner_id : on contrôle l'accès après pour pouvoir
  // autoriser les membres SCI/entity_members qui ne sont pas owner direct.
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .maybeSingle();

  if (propertyError) {
    console.error("[fetchPropertyDetails] Property Error:", propertyError);
    return null;
  }

  if (!property) {
    console.warn(`[fetchPropertyDetails] Property not found: id=${propertyId}`);
    return null;
  }

  // Vérification d'accès : owner direct OU membre de l'entité légale.
  const isOwner = (property as { owner_id?: string | null }).owner_id === profileId;
  let isEntityMember = false;
  const legalEntityId = (property as { legal_entity_id?: string | null }).legal_entity_id;
  if (!isOwner && userId && legalEntityId) {
    const { data: membership } = await supabase
      .from("entity_members")
      .select("id")
      .eq("entity_id", legalEntityId)
      .eq("user_id", userId)
      .maybeSingle();
    isEntityMember = !!membership;
  }

  if (!isOwner && !isEntityMember) {
    console.warn(`[fetchPropertyDetails] Access denied: id=${propertyId}, profileId=${profileId}`);
    return null;
  }

  // 2. Récupérer les données liées en parallèle
  const [
    { data: units },
    { data: leasesData },
    { data: edlsData },
    { data: tickets },
    { data: photosData },
    { data: documentsData },
    { data: rooms }
  ] = await Promise.all([
    // Units
    supabase.from("units").select("*").eq("property_id", propertyId),
    // Leases (baux actifs ou en attente avec leurs signataires)
    supabase.from("leases").select("*, tenants:lease_signers(id, role, profile:profiles(prenom, nom))").eq("property_id", propertyId).neq("statut", "terminated"),
    // EDLs (tous les EDLs de la propriété)
    supabase.from("edl").select("id, lease_id, type, status, scheduled_at, completed_date").eq("property_id", propertyId),
    // Tickets
    supabase.from("tickets").select("*").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(5),
    // Photos (table photos)
    supabase.from("photos").select("*").eq("property_id", propertyId).order("ordre", { ascending: true }),
    // Documents (table documents - pour fallback photos)
    supabase.from("documents").select("*").eq("property_id", propertyId).eq("collection", "property_media"),
    // Rooms (table rooms - pièces du logement)
    supabase.from("rooms").select("*").eq("property_id", propertyId).order("ordre", { ascending: true })
  ]);

  // 2b. Récupérer les factures via les lease_id (pas property_id !)
  const leaseIds = (leasesData || []).map((l: any) => l.id);
  let invoices: any[] = [];
  if (leaseIds.length > 0) {
    const { data: invoicesData } = await supabase
      .from("invoices")
      .select("*")
      .in("lease_id", leaseIds)
      .order("created_at", { ascending: false })
      .limit(10);
    invoices = invoicesData || [];
  }

  // 3. Traiter les médias
  let photos = photosData || [];
  let coverUrl = null;
  let coverDocId = null;

  if (photos.length > 0) {
    const cover = photos.find((p) => p.is_main) || photos[0];
    coverUrl = cover.url;
    coverDocId = cover.id;
  } else if (documentsData && documentsData.length > 0) {
    // Fallback sur documents si pas de photos
    photos = documentsData.map((doc: any) => ({
      id: doc.id,
      url: doc.preview_url,
      is_main: doc.is_cover,
      ordre: doc.position
    })) as any;
    const cover = photos.find((p: any) => p.is_main) || photos[0];
    coverUrl = cover.url;
    coverDocId = cover.id;
  }

  // 4. Attacher les EDLs aux baux correspondants
  const leases = (leasesData || []).map(lease => ({
    ...lease,
    edls: (edlsData || []).filter(e => e.lease_id === lease.id)
  }));

  // 5. Construire l'objet OwnerProperty
  const enrichedProperty: OwnerProperty = {
    ...property,
    cover_url: coverUrl,
    cover_document_id: coverDocId,
    documents_count: photos.length,
    loyer_base: property.loyer_hc ?? 0,
    status: "vacant", // À calculer plus précisément si besoin avec les baux
  } as unknown as OwnerProperty;

  // Calcul simple du statut
  const activeLease = leases?.find((l) => l.statut === "active");
  const pendingLease = leases?.find((l) => ["pending_signature", "fully_signed", "partially_signed"].includes(l.statut));
  
  if (activeLease) enrichedProperty.status = "loue";
  else if (pendingLease) enrichedProperty.status = "en_preavis";

  return {
    property: enrichedProperty,
    units: units || [],
    rooms: rooms || [], // ✅ Retour des rooms
    leases: (leases || []) as unknown as LeaseInfo[],
    tickets: tickets || [],
    invoices: invoices || [],
    photos: photos as unknown as PropertyPhoto[]
  };
}
