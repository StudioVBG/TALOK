import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { PropertyRow, LeaseRow, LeaseSignerRow, PaymentRow, InvoiceRow, DocumentRow, EDLRow, ProfileRow } from "@/lib/supabase/database.types";

// ✅ SOTA 2026: Types stricts pour l'intégrité des données

/** Statuts possibles d'un EDL */
export type EDLStatus = "draft" | "scheduled" | "in_progress" | "completed" | "signed" | "disputed";

/** Type d'EDL */
export type EDLType = "entree" | "sortie";

/** Structure d'un État des Lieux */
export interface EDLEntry {
  id: string;
  status: EDLStatus;
  type: EDLType;
  scheduled_at?: string | null;
  completed_date?: string | null;
}

/**
 * Statuts possibles d'un bail — alignés avec la CHECK DB
 * Migration : 20260108400000_lease_lifecycle_sota2026.sql
 */
export type LeaseStatus =
  | "draft"
  | "pending_signature"
  | "partially_signed"
  | "fully_signed"
  | "active"
  | "terminated"
  | "archived"
  | "cancelled";

/** Statuts possibles d'une signature */
export type SignatureStatus = "pending" | "signed" | "refused" | "expired";

/** Structure d'un signataire */
export interface Signer {
  id: string;
  role: "proprietaire" | "locataire_principal" | "colocataire" | "garant";
  signature_status: SignatureStatus;
  signed_at: string | null;
  signature_image: string | null;
  signature_image_path: string | null;
  proof_id: string | null;
  ip_inet: string | null;
  invited_email: string | null;
  invited_name: string | null;
  invited_at: string | null;
  profile: {
    id: string;
    prenom: string | null;
    nom: string | null;
    email: string | null;
    telephone: string | null;
    avatar_url: string | null;
    date_naissance: string | null;
    lieu_naissance: string | null;
    nationalite: string | null;
    adresse: string | null;
  } | null;
}

/** Structure d'un paiement */
export interface Payment {
  id: string;
  date_paiement: string | null;
  montant: number;
  statut: "pending" | "succeeded" | "paid" | "failed" | "refunded";
  periode: string | null;
}

/** Structure d'une facture */
export interface Invoice {
  id: string;
  periode: string;
  montant_total: number;
  montant_loyer: number;
  montant_charges: number;
  statut: "draft" | "sent" | "paid" | "late";
  created_at: string;
  metadata?: Record<string, any> | null;
}

/** Structure du bail avec données SSOT */
export interface Lease {
  id: string;
  statut: LeaseStatus;
  type_bail: string;
  loyer: number;
  charges_forfaitaires: number;
  depot_de_garantie: number;
  date_debut: string;
  date_fin: string | null;
  sealed_at: string | null;
  signed_pdf_path: string | null;
  // ✅ SSOT 2026: Données pré-calculées
  has_signed_edl: boolean;
  has_paid_initial: boolean;
  property_id?: string | null;
  unit_id?: string | null;
  properties?: PropertyRow | null;
}

/** Structure de la propriété */
export interface Property {
  id: string;
  owner_id: string;
  adresse_complete: string;
  numero_rue?: string;
  nom_rue?: string;
  ville: string;
  code_postal: string;
  type: string;
  cover_url: string | null;
  loyer_hc?: number;
  charges_mensuelles?: number;
}

/** Structure d'un document */
export interface Document {
  id: string;
  type: string;
  storage_path: string;
  created_at: string;
  title?: string;
  name?: string;
}

/** Interface principale des détails du bail - TYPAGE STRICT */
export interface LeaseDetails {
  lease: Lease;
  property: Property;
  signers: Signer[];
  payments: Payment[];
  invoices: Invoice[];
  documents: Document[];
  /** EDL est un OBJET UNIQUE ou null, PAS un tableau ! */
  edl: EDLEntry | null;
}

export async function fetchLeaseDetails(leaseId: string, ownerId: string): Promise<LeaseDetails | null> {
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

  // 1. Récupérer le bail avec la propriété en une seule requête
  type LeaseWithProperty = LeaseRow & {
    properties: PropertyRow | null;
  };
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

  const leaseData = lease as LeaseWithProperty;

  // 2. Récupérer la propriété associée (directement ou via unit)
  let propertyRow: PropertyRow | null = null;

  // Si la propriété est déjà jointe
  if (leaseData.properties) {
    propertyRow = leaseData.properties;
  } else if (leaseData.property_id) {
    // Fallback: requête séparée
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", leaseData.property_id)
      .single();

    if (error || !data) {
      console.error("[fetchLeaseDetailsFallback] Property error:", error);
      return null;
    }
    propertyRow = data;
  } else if (leaseData.unit_id) {
    const { data: unit, error: unitError } = await supabase
      .from("units")
      .select("id, property_id")
      .eq("id", leaseData.unit_id)
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
  // ✅ SOTA 2026: Récupérer TOUS les champs de signature (image ET path)
  const { data: signers } = await supabase
    .from("lease_signers")
    .select(`
      id,
      role,
      signature_status,
      signed_at,
      signature_image,
      signature_image_path,
      proof_id,
      ip_inet,
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

  // 4. Récupérer les factures du bail (SSOT 2026)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, periode, montant_total, montant_loyer, montant_charges, statut, created_at, metadata")
    .eq("lease_id", leaseId)
    .order("periode", { ascending: false })
    .limit(24);

  // 5. Récupérer les documents
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("lease_id", leaseId);

  // 6. Récupérer la photo principale
  const { data: mainPhoto } = await supabase
    .from("property_photos")
    .select("url")
    .eq("property_id", propertyRow.id)
    .eq("is_main", true)
    .limit(1)
    .maybeSingle();

  // 7. Récupérer l'EDL le plus récent pour ce bail
  const { data: edl } = await supabase
    .from("edl")
    .select("id, status, type, scheduled_at, completed_date")
    .eq("lease_id", leaseId)
    .eq("type", "entree")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 8. Vérifier si la première facture est payée (SSOT 2026)
  const { data: initialInvoice } = await supabase
    .from("invoices")
    .select("statut")
    .eq("lease_id", leaseId)
    .eq("metadata->>type", "initial_invoice")
    .maybeSingle();

  // Construire le résultat
  const property: Property = {
    id: propertyRow.id,
    owner_id: propertyRow.owner_id,
    adresse_complete: propertyRow.adresse_complete,
    numero_rue: (propertyRow as PropertyRow & { numero_rue?: string }).numero_rue,
    nom_rue: (propertyRow as PropertyRow & { nom_rue?: string }).nom_rue,
    ville: propertyRow.ville,
    code_postal: propertyRow.code_postal,
    type: propertyRow.type,
    cover_url: mainPhoto?.url || null,
    loyer_hc: (propertyRow as PropertyRow & { loyer_hc?: number }).loyer_hc,
    charges_mensuelles: (propertyRow as PropertyRow & { charges_mensuelles?: number }).charges_mensuelles,
  };

  // SSOT 2026 : Consolider les données financières
  const cleanLease: Lease = {
    ...leaseData,
    loyer: property.loyer_hc ?? leaseData.loyer ?? 0,
    charges_forfaitaires: property.charges_mensuelles ?? leaseData.charges_forfaitaires ?? 0,
    has_signed_edl: edl?.status === "signed",
    has_paid_initial: initialInvoice?.statut === "paid",
    property_id: leaseData.property_id,
    unit_id: leaseData.unit_id,
    properties: propertyRow,
  };

  // ✅ SOTA 2026: Générer des URLs signées pour les images de signature (bucket privé)
  // Durée de validité: 1 heure
  type SignerWithProfile = LeaseSignerRow & {
    profiles: ProfileRow | null;
  };
  const signersWithSignedUrls = await Promise.all(
    (signers || []).map(async (s: SignerWithProfile) => {
      let signatureImageUrl: string | null = null;
      
      // 1. Si signature_image est déjà une data URL ou URL HTTP, l'utiliser
      if (s.signature_image) {
        if (s.signature_image.startsWith("data:") || s.signature_image.startsWith("http")) {
          signatureImageUrl = s.signature_image;
        }
      }
      
      // 2. Si signature_image_path existe, générer une URL signée
      if (!signatureImageUrl && s.signature_image_path) {
        try {
          const { data: signedUrlData } = await supabase.storage
            .from("documents")
            .createSignedUrl(s.signature_image_path, 3600); // 1 heure
          
          if (signedUrlData?.signedUrl) {
            signatureImageUrl = signedUrlData.signedUrl;
          }
        } catch (err) {
          console.error("[fetchLeaseDetails] Error generating signed URL:", err);
        }
      }
      
      return {
        id: s.id,
        role: s.role,
        signature_status: s.signature_status,
        signed_at: s.signed_at,
        signature_image: signatureImageUrl,
        signature_image_path: s.signature_image_path,
        proof_id: s.proof_id,
        ip_inet: s.ip_inet,
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
      };
    })
  );

  const formattedSigners = signersWithSignedUrls;

  // Transformer les paiements
  type PaymentWithInvoice = PaymentRow & {
    invoices: { periode: string } | null;
  };
  const formattedPayments = (payments || []).map((p: PaymentWithInvoice) => ({
    id: p.id,
    date_paiement: p.date_paiement,
    montant: p.montant,
    statut: p.statut,
    periode: p.invoices?.periode ?? null,
  }));

  const formattedInvoices = (invoices || []).map((inv: InvoiceRow) => ({
    id: inv.id,
    periode: inv.periode,
    montant_total: inv.montant_total,
    montant_loyer: inv.montant_loyer,
    montant_charges: inv.montant_charges,
    statut: inv.statut,
    created_at: inv.created_at,
    metadata: inv.metadata ?? null,
  }));

  const result: LeaseDetails = {
    lease: cleanLease,
    property,
    signers: formattedSigners,
    payments: formattedPayments,
    invoices: formattedInvoices,
    documents: (documents || []) as Document[],
    edl: edl || null,
  };

  return result;
}
