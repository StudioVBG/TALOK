// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export interface LeaseDetails {
  lease: any; // TODO: Typage strict
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
    type: string;
    cover_url: string | null;
  };
  signers: any[];
  payments: any[];
  documents: any[];
  edl?: any;
}

export async function fetchLeaseDetails(leaseId: string, ownerId: string): Promise<LeaseDetails | null> {
  console.log("[fetchLeaseDetails] Starting for leaseId:", leaseId, "ownerId:", ownerId);
  
  // Utiliser directement le fallback (plus fiable que la RPC)
  // La RPC a des problèmes avec les baux liés à des unités
  return fetchLeaseDetailsFallback(leaseId, ownerId);
}

async function fetchLeaseDetailsFallback(
  leaseId: string,
  ownerId: string
): Promise<LeaseDetails | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[fetchLeaseDetailsFallback] Config check:", {
    hasUrl: !!supabaseUrl,
    hasServiceKey: !!serviceRoleKey,
  });

  let supabase: ReturnType<typeof createServiceClient> | Awaited<ReturnType<typeof createClient>>;

  if (supabaseUrl && serviceRoleKey) {
    // Utiliser le service role pour contourner les RLS
    supabase = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log("[fetchLeaseDetailsFallback] Using service role client");
  } else {
    console.warn(
      "[fetchLeaseDetailsFallback] SUPABASE_SERVICE_ROLE_KEY manquant, utilisation du client standard (RLS actif)"
    );
    supabase = await createClient();
  }

  // 1. Récupérer le bail avec la propriété en une seule requête
  console.log("[fetchLeaseDetailsFallback] Fetching lease:", leaseId);
  
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select(`
      *,
      properties:property_id (*)
    `)
    .eq("id", leaseId)
    .single();

  if (leaseError) {
    console.error("[fetchLeaseDetailsFallback] Lease error:", leaseError);
    return null;
  }
  
  if (!lease) {
    console.error("[fetchLeaseDetailsFallback] Lease not found for id:", leaseId);
    return null;
  }

  console.log("[fetchLeaseDetailsFallback] Lease found:", {
    id: lease.id,
    property_id: lease.property_id,
    unit_id: lease.unit_id,
    has_property_join: !!lease.properties,
  });

  // 2. Récupérer la propriété associée (directement ou via unit)
  let propertyRow: any | null = null;

  // Si la propriété est déjà jointe
  if (lease.properties) {
    propertyRow = lease.properties;
    console.log("[fetchLeaseDetailsFallback] Property from join:", propertyRow?.id);
  } else if (lease.property_id) {
    // Fallback: requête séparée
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", lease.property_id)
      .single();

    if (error || !data) {
      console.error("[fetchLeaseDetailsFallback] Property error:", error);
      return null;
    }
    propertyRow = data;
    console.log("[fetchLeaseDetailsFallback] Property from separate query:", propertyRow?.id);
  } else if (lease.unit_id) {
    console.log("[fetchLeaseDetailsFallback] Fetching unit:", lease.unit_id);
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select("id, property_id")
      .eq("id", lease.unit_id)
      .single();

    if (unitError || !unit) {
      console.error("[fetchLeaseDetailsFallback] Unit error:", unitError);
      return null;
    }

    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", unit.property_id)
      .single();

    if (error || !data) {
      console.error("[fetchLeaseDetailsFallback] Property from unit error:", error);
      return null;
    }
    propertyRow = data;
    console.log("[fetchLeaseDetailsFallback] Property from unit:", propertyRow?.id);
  } else {
    console.warn("[fetchLeaseDetailsFallback] Lease without property or unit", {
      leaseId,
    });
    return null;
  }

  // Vérifier l'accès propriétaire
  console.log("[fetchLeaseDetailsFallback] Checking owner access:", {
    expected: ownerId,
    actual: propertyRow?.owner_id,
  });
  
  if (propertyRow.owner_id !== ownerId) {
    console.warn("[fetchLeaseDetailsFallback] Access denied: owner mismatch", {
      expected: ownerId,
      got: propertyRow.owner_id,
    });
    return null;
  }
  
  console.log("[fetchLeaseDetailsFallback] Owner access verified ✓");

  // 2. Récupérer les signataires
  const { data: signers } = await supabase
    .from("lease_signers")
    .select(`
      id,
      role,
      signature_status,
      signed_at,
      signature_image,
      invited_email,
      invited_name,
      invited_at,
      profiles (
        id,
        prenom,
        nom,
        email,
        telephone,
        avatar_url,
        date_naissance,
        lieu_naissance,
        nationalite,
        adresse
      )
    `)
    .eq("lease_id", leaseId);

  // 3. Récupérer les paiements via les factures
  const { data: payments } = await supabase
    .from("payments")
    .select(`
      id,
      date_paiement,
      montant,
      statut,
      invoices!inner (
        periode,
        lease_id
      )
    `)
    .eq("invoices.lease_id", leaseId)
    .order("date_paiement", { ascending: false })
    .limit(12);

  // 4. Récupérer les documents
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("lease_id", leaseId);

  // 5. Récupérer la photo principale
  const { data: mainPhoto } = await supabase
    .from("property_photos")
    .select("url")
    .eq("property_id", propertyRow.id)
    .eq("is_main", true)
    .limit(1)
    .maybeSingle();

  // 6. Récupérer l'EDL le plus récent pour ce bail
  const { data: edl } = await supabase
    .from("edl")
    .select("id, status, type, scheduled_at, completed_date")
    .eq("lease_id", leaseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Construire le résultat
  const property = {
    ...propertyRow,
    cover_url: mainPhoto?.url || null,
  };

  const cleanLease = lease;

  // Transformer les signataires
  const formattedSigners = (signers || []).map((s: any) => ({
    id: s.id,
    role: s.role,
    signature_status: s.signature_status,
    signed_at: s.signed_at,
    signature_image: s.signature_image,
    invited_email: s.invited_email,
    invited_name: s.invited_name,
    invited_at: s.invited_at,
    profile: s.profiles ? {
      id: s.profiles.id,
      prenom: s.profiles.prenom,
      nom: s.profiles.nom,
      email: s.profiles.email,
      telephone: s.profiles.telephone,
      avatar_url: s.profiles.avatar_url,
      date_naissance: s.profiles.date_naissance,
      lieu_naissance: s.profiles.lieu_naissance,
      nationalite: s.profiles.nationalite,
      adresse: s.profiles.adresse,
    } : null,
  }));

  // Transformer les paiements
  const formattedPayments = (payments || []).map((p: any) => ({
    id: p.id,
    date_paiement: p.date_paiement,
    montant: p.montant,
    statut: p.statut,
    periode: p.invoices?.periode,
  }));

  const result = {
    lease: cleanLease,
    property,
    signers: formattedSigners,
    payments: formattedPayments,
    documents: documents || [],
    edl: edl || null,
  };

  console.log("[fetchLeaseDetailsFallback] Success! Returning lease details:", {
    leaseId: result.lease?.id,
    propertyId: result.property?.id,
    signersCount: result.signers?.length,
    paymentsCount: result.payments?.length,
    documentsCount: result.documents?.length,
  });

  return result;
}
