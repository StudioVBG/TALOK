// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import type { OwnerProperty } from "@/lib/types/owner-property";

export interface PropertyDetails {
  property: OwnerProperty;
  units: any[];
  rooms: any[]; // ✅ Ajout des pièces
  leases: any[];
  tickets: any[];
  invoices: any[];
  photos: any[];
}

export async function fetchPropertyDetails(propertyId: string, ownerId: string): Promise<PropertyDetails | null> {
  console.log(`[fetchPropertyDetails] Chargement (Admin Mode): Property=${propertyId}, Owner=${ownerId}`);
  
  // Utiliser supabaseAdmin pour contourner RLS, mais on valide ownerId manuellement
  const { supabaseAdmin } = await import("@/app/api/_lib/supabase");
  const supabase = supabaseAdmin();

  // 1. Récupérer la propriété
  // Colonnes essentielles, sans type_bien ni loyer_base
  const essentialColumns = "id, owner_id, type, adresse_complete, code_postal, ville, surface, nb_pieces, loyer_hc, charges_mensuelles, created_at, etat, nb_chambres, meuble, dpe_classe_energie, dpe_classe_climat";
  
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select(essentialColumns)
    .eq("id", propertyId)
    .eq("owner_id", ownerId)
    .single();

  if (propertyError || !property) {
    console.error("[fetchPropertyDetails] Property Error (Admin):", propertyError);
    return null;
  }

  // 2. Récupérer les données liées en parallèle
  const [
    { data: units },
    { data: leases },
    { data: tickets },
    { data: invoices },
    { data: photosData },
    { data: documentsData },
    { data: rooms } // ✅ Ajout de la récupération des rooms
  ] = await Promise.all([
    // Units
    supabase.from("units").select("*").eq("property_id", propertyId),
    // Leases (baux actifs ou en attente)
    supabase.from("leases").select("*").eq("property_id", propertyId).neq("statut", "terminated"),
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

  // 4. Construire l'objet OwnerProperty
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
  const pendingLease = leases?.find((l) => l.statut === "pending_signature");
  
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
