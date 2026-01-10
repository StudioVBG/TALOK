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

export async function fetchPropertyDetails(propertyId: string, ownerId: string): Promise<PropertyDetails | null> {
  console.log(`[fetchPropertyDetails] Chargement: Property=${propertyId}, Owner=${ownerId}`);

  // Utiliser supabaseAdmin pour contourner RLS, MAIS on filtre par owner_id à la source
  // C'est plus sécurisé que de vérifier après le fetch
  const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
  const supabase = supabaseAdmin();

  // SÉCURITÉ: Filtrer par owner_id directement dans la query
  // Cela garantit qu'on ne récupère JAMAIS de données non autorisées
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .eq("owner_id", ownerId) // ✅ Filtrage à la source - plus sécurisé
    .maybeSingle();

  if (propertyError) {
    console.error("[fetchPropertyDetails] Property Error:", propertyError);
    return null;
  }

  if (!property) {
    // Soit la propriété n'existe pas, soit l'owner_id ne correspond pas
    // On ne distingue pas pour éviter l'énumération
    console.warn(`[fetchPropertyDetails] Property not found or access denied: id=${propertyId}`);
    return null;
  }

  console.log(`[fetchPropertyDetails] ✅ Property found with owner verification`)

  // 2. Récupérer les données liées en parallèle
  const [
    { data: units },
    { data: leasesData },
    { data: edlsData },
    { data: tickets },
    { data: invoices },
    { data: photosData },
    { data: documentsData },
    { data: rooms } // ✅ Ajout de la récupération des rooms
  ] = await Promise.all([
    // Units
    supabase.from("units").select("*").eq("property_id", propertyId),
    // Leases (baux actifs ou en attente avec leurs signataires)
    supabase.from("leases").select("*, tenants:lease_signers(id, role, profile:profiles(prenom, nom))").eq("property_id", propertyId).neq("statut", "terminated"),
    // EDLs (tous les EDLs de la propriété)
    supabase.from("edl").select("id, lease_id, type, status, scheduled_at, completed_date").eq("property_id", propertyId),
    // Tickets
    supabase.from("tickets").select("*").eq("property_id", propertyId).order("created_at", { ascending: false }).limit(5),
    // Invoices (dernières factures)
    supabase.from("invoices").select("*").eq("lease_id", propertyId).order("created_at", { ascending: false }).limit(5),
    // Photos (table photos)
    supabase.from("photos").select("*").eq("property_id", propertyId).order("ordre", { ascending: true }),
    // Documents (table documents - pour fallback photos)
    supabase.from("documents").select("*").eq("property_id", propertyId).eq("collection", "property_media"),
    // Rooms (table rooms - pièces du logement)
    supabase.from("rooms").select("*").eq("property_id", propertyId).order("ordre", { ascending: true })
  ]);

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
    photos = documentsData.map((doc) => ({
      id: doc.id,
      url: doc.preview_url,
      is_main: doc.is_cover,
      ordre: doc.position
    }));
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
    leases: leases || [],
    tickets: tickets || [],
    invoices: invoices || [],
    photos: photos
  };
}
