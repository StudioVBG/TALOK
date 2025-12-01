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
}

export async function fetchLeaseDetails(leaseId: string, ownerId: string): Promise<LeaseDetails | null> {
  const supabase = await createClient();

  // Essayer d'abord la RPC
  try {
    const { data, error } = await supabase.rpc("lease_details", {
      p_lease_id: leaseId,
      p_owner_id: ownerId,
    });

    if (!error && data) {
      return data as LeaseDetails;
    }
    
    console.warn("[fetchLeaseDetails] RPC failed, using fallback:", error?.message);
  } catch (rpcError) {
    console.warn("[fetchLeaseDetails] RPC exception, using fallback:", rpcError);
  }

  // Fallback: requêtes directes avec service role (contourne RLS)
  return fetchLeaseDetailsFallback(leaseId, ownerId);
}

async function fetchLeaseDetailsFallback(
  leaseId: string,
  ownerId: string
): Promise<LeaseDetails | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let supabase: ReturnType<typeof createServiceClient> | Awaited<ReturnType<typeof createClient>>;

  if (supabaseUrl && serviceRoleKey) {
    // Utiliser le service role pour contourner les RLS
    supabase = createServiceClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } else {
    console.warn(
      "[fetchLeaseDetailsFallback] SUPABASE_SERVICE_ROLE_KEY manquant, utilisation du client standard (RLS actif)"
    );
    supabase = await createClient();
  }

  // 1. Récupérer le bail
  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("*")
    .eq("id", leaseId)
    .single();

  if (leaseError || !lease) {
    console.error("[fetchLeaseDetailsFallback] Lease error:", leaseError);
    return null;
  }

  // 2. Récupérer la propriété associée (directement ou via unit)
  let propertyRow: any | null = null;

  if (lease.property_id) {
    const { data, error } = await supabase
      .from("properties")
      .select("id, adresse_complete, adresse, ville, code_postal, type, owner_id")
      .eq("id", lease.property_id)
      .single();

    if (error || !data) {
      console.error("[fetchLeaseDetailsFallback] Property error:", error);
      return null;
    }
    propertyRow = data;
  } else if (lease.unit_id) {
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
      .select("id, adresse_complete, adresse, ville, code_postal, type, owner_id")
      .eq("id", unit.property_id)
      .single();

    if (error || !data) {
      console.error("[fetchLeaseDetailsFallback] Property from unit error:", error);
      return null;
    }
    propertyRow = data;
  } else {
    console.warn("[fetchLeaseDetailsFallback] Lease without property or unit", {
      leaseId,
    });
    return null;
  }

  // Vérifier l'accès propriétaire
  if (propertyRow.owner_id !== ownerId) {
    console.warn("[fetchLeaseDetailsFallback] Access denied: owner mismatch", {
      expected: ownerId,
      got: propertyRow.owner_id,
    });
    return null;
  }

  // 2. Récupérer les signataires
  const { data: signers } = await supabase
    .from("lease_signers")
    .select(`
      id,
      role,
      signature_status,
      signed_at,
      profiles (
        id,
        prenom,
        nom,
        telephone,
        avatar_url
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

  // Construire le résultat
  const property = {
    id: propertyRow.id,
    adresse_complete: propertyRow.adresse_complete || propertyRow.adresse || "",
    ville: propertyRow.ville || "",
    code_postal: propertyRow.code_postal || "",
    type: propertyRow.type || "",
    cover_url: mainPhoto?.url || null,
  };

  const cleanLease = lease;

  // Transformer les signataires
  const formattedSigners = (signers || []).map((s: any) => ({
    id: s.id,
    role: s.role,
    signature_status: s.signature_status,
    signed_at: s.signed_at,
    profile: s.profiles ? {
      id: s.profiles.id,
      prenom: s.profiles.prenom,
      nom: s.profiles.nom,
      telephone: s.profiles.telephone,
      avatar_url: s.profiles.avatar_url,
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

  return {
    lease: cleanLease,
    property,
    signers: formattedSigners,
    payments: formattedPayments,
    documents: documents || [],
  };
}
