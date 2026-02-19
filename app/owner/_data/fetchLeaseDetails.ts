import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, PropertyRow, LeaseRow, LeaseSignerRow, PaymentRow, InvoiceRow, DocumentRow, EDLItemRow, ProfileRow } from "@/lib/supabase/database.types";

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
  /** Stats de progression (pré-calculées côté serveur) */
  total_items?: number;
  completed_items?: number;
  total_photos?: number;
  signatures_count?: number;
}

/**
 * Statuts possibles d'un bail — alignés avec @/lib/types/status.ts
 * Migration : 20260108400000_lease_lifecycle_sota2026.sql
 */
import type { LeaseStatus } from "@/lib/types/status";
export type { LeaseStatus };

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

/** Structure de la propriété — inclut tous les champs utilisés par mapLeaseToTemplate */
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
  loyer_base?: number;
  charges_mensuelles?: number;
  // Surface
  surface?: number;
  surface_habitable_m2?: number;
  nb_pieces?: number;
  etage?: number | null;
  // DPE / Diagnostics — champs critiques pour la validation du bail
  energie?: string | null;
  ges?: string | null;
  dpe_classe_energie?: string | null;
  dpe_classe_climat?: string | null;
  dpe_consommation?: number | null;
  dpe_emissions?: number | null;
  dpe_estimation_conso_min?: number | null;
  dpe_estimation_conso_max?: number | null;
  dpe_date?: string | null;
  dpe_date_validite?: string | null;
  dpe_cout_min?: number | null;
  dpe_cout_max?: number | null;
  // Caractéristiques du logement
  annee_construction?: number | null;
  chauffage_type?: string | null;
  chauffage_energie?: string | null;
  eau_chaude_type?: string | null;
  eau_chaude_energie?: string | null;
  regime?: string | null;
  // Annexes / équipements
  has_balcon?: boolean;
  has_terrasse?: boolean;
  has_jardin?: boolean;
  has_cave?: boolean;
  has_parking?: boolean;
  clim_presence?: boolean | string;
  clim_type?: string | null;
  cuisine_equipee?: boolean;
  interphone?: boolean;
  digicode?: boolean;
  fibre_optique?: boolean;
  // Diagnostics complémentaires (CREP, élec, gaz, ERP, bruit)
  crep_date?: string | null;
  crep_plomb?: boolean;
  elec_date?: string | null;
  elec_anomalies?: boolean;
  elec_nb_anomalies?: number | null;
  gaz_date?: string | null;
  gaz_anomalies?: boolean;
  gaz_type_anomalie?: string | null;
  erp_date?: string | null;
  bruit_date?: string | null;
  bruit_zone?: string | null;
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

  type SupabaseClientType = ReturnType<typeof createSupabaseClient<Database>>;
  let supabase: SupabaseClientType;
  if (supabaseUrl && serviceRoleKey) {
    supabase = createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } else {
    console.warn(
      "[fetchLeaseDetailsFallback] SUPABASE_SERVICE_ROLE_KEY manquant, utilisation du client standard (RLS actif)"
    );
    supabase = (await createClient()) as SupabaseClientType;
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
    const { data: unitData, error: unitError } = await supabase
      .from("units")
      .select("id, property_id")
      .eq("id", leaseData.unit_id)
      .single();

    if (unitError || !unitData) {
      console.error("[fetchLeaseDetailsFallback] Unit error:", unitError);
      return null;
    }

    const unit = unitData as { id: string; property_id: string };
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
  // ✅ FIX: FK hint explicite profiles!profile_id pour éviter les ambiguïtés PostgREST
  // Avec fallback si le hint échoue (compatibilité schemas variés)
  const profilesJoinFields = `id, prenom, nom, email, telephone, avatar_url, date_naissance, lieu_naissance, nationalite, adresse`;
  const signerBaseFields = `id, role, signature_status, signed_at, signature_image, signature_image_path, proof_id, ip_inet, invited_email, invited_name, invited_at, profile_id`;

  let signers: any[] | null = null;
  let signersError: any = null;

  // Tentative 1: Avec FK hint explicite
  const result1 = await supabase
    .from("lease_signers")
    .select(`${signerBaseFields}, profiles!profile_id (${profilesJoinFields})`)
    .eq("lease_id", leaseId);

  if (!result1.error) {
    signers = result1.data;
  } else {
    console.warn("[fetchLeaseDetails] FK hint failed, trying without:", result1.error.message);
    // Tentative 2: Sans FK hint
    const result2 = await supabase
      .from("lease_signers")
      .select(`${signerBaseFields}, profiles (${profilesJoinFields})`)
      .eq("lease_id", leaseId);

    if (!result2.error) {
      signers = result2.data;
    } else {
      console.warn("[fetchLeaseDetails] profiles join failed, fetching without profiles:", result2.error.message);
      // Tentative 3: Sans join profiles (dernier recours — les noms viennent de invited_name/email)
      const result3 = await supabase
        .from("lease_signers")
        .select(signerBaseFields)
        .eq("lease_id", leaseId);

      signers = result3.data;
      signersError = result3.error;
    }
  }

  if (signersError) {
    console.error("[fetchLeaseDetails] Erreur récupération signataires:", signersError);
  }
  if (!signers || signers.length === 0) {
    console.warn("[fetchLeaseDetails] ⚠️ Aucun signataire trouvé pour le bail:", leaseId,
      "— Vérifiez que lease_signers contient des entrées pour ce bail.");
  }

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
    .select("id, periode, montant_total, montant_loyer, montant_charges, statut, created_at")
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

  // 7. Récupérer l'EDL le plus récent pour ce bail + stats de progression
  const { data: edlRaw } = await supabase
    .from("edl")
    .select("id, status, type, scheduled_at, completed_date")
    .eq("lease_id", leaseId)
    .eq("type", "entree")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type EDLQueryResult = { id: string; status: string; type: string; scheduled_at?: string | null; completed_date?: string | null };
  const edl = edlRaw as EDLQueryResult | null;

  // 7b. Si un EDL existe, récupérer les stats de progression (items inspectés, photos, signatures)
  let edlStats: { total_items: number; completed_items: number; total_photos: number; signatures_count: number } | null = null;
  if (edl?.id) {
    const [itemsResult, photosResult, sigsResult] = await Promise.all([
      supabase
        .from("edl_items")
        .select("condition", { count: "exact" })
        .eq("edl_id", edl.id),
      supabase
        .from("edl_media")
        .select("id", { count: "exact", head: true })
        .eq("edl_id", edl.id),
      supabase
        .from("edl_signatures")
        .select("id", { count: "exact", head: true })
        .eq("edl_id", edl.id)
        .not("signed_at", "is", null),
    ]);

    const allItems = (itemsResult.data ?? []) as EDLItemRow[];
    edlStats = {
      total_items: itemsResult.count ?? allItems.length,
      completed_items: allItems.filter((i) => i.condition != null && String(i.condition) !== "null").length,
      total_photos: photosResult.count ?? 0,
      signatures_count: sigsResult.count ?? 0,
    };
  }

  // 8. Vérifier si la première facture est payée (SSOT 2026)
  const { data: initialInvoice } = await supabase
    .from("invoices")
    .select("statut")
    .eq("lease_id", leaseId)
    .eq("metadata->>type", "initial_invoice")
    .maybeSingle();

  // Construire le résultat — on mappe TOUS les champs utilisés par mapLeaseToTemplate
  type PropertyRowExtended = PropertyRow & { numero_rue?: string; nom_rue?: string; dpe_date_validite?: string | null; dpe_cout_min?: number | null; dpe_cout_max?: number | null; has_parking?: boolean; cuisine_equipee?: boolean; interphone?: boolean; digicode?: boolean; fibre_optique?: boolean; crep_date?: string | null; crep_plomb?: boolean; elec_date?: string | null; elec_anomalies?: boolean; elec_nb_anomalies?: number | null; gaz_date?: string | null; gaz_anomalies?: boolean; gaz_type_anomalie?: string | null; erp_date?: string | null; bruit_date?: string | null; bruit_zone?: string | null; eau_chaude_energie?: string | null };
  const prop = propertyRow as PropertyRowExtended;
  const property: Property = {
    id: propertyRow.id,
    owner_id: propertyRow.owner_id,
    adresse_complete: propertyRow.adresse_complete,
    numero_rue: prop.numero_rue,
    nom_rue: prop.nom_rue,
    ville: propertyRow.ville,
    code_postal: propertyRow.code_postal,
    type: propertyRow.type,
    cover_url: (mainPhoto as { url?: string } | null)?.url ?? null,
    loyer_hc: propertyRow.loyer_hc ?? undefined,
    loyer_base: propertyRow.loyer_base ?? undefined,
    charges_mensuelles: propertyRow.charges_mensuelles ?? undefined,
    // Surface
    surface: propertyRow.surface ?? undefined,
    surface_habitable_m2: propertyRow.surface_habitable_m2 ?? undefined,
    nb_pieces: propertyRow.nb_pieces ?? undefined,
    etage: propertyRow.etage,
    // DPE / Diagnostics
    energie: propertyRow.energie,
    ges: propertyRow.ges,
    dpe_classe_energie: propertyRow.dpe_classe_energie,
    dpe_classe_climat: propertyRow.dpe_classe_climat,
    dpe_consommation: propertyRow.dpe_consommation,
    dpe_emissions: propertyRow.dpe_emissions,
    dpe_estimation_conso_min: propertyRow.dpe_estimation_conso_min,
    dpe_estimation_conso_max: propertyRow.dpe_estimation_conso_max,
    dpe_date: propertyRow.dpe_date,
    dpe_date_validite: prop.dpe_date_validite,
    dpe_cout_min: prop.dpe_cout_min,
    dpe_cout_max: prop.dpe_cout_max,
    // Caractéristiques
    annee_construction: propertyRow.annee_construction,
    chauffage_type: propertyRow.chauffage_type,
    chauffage_energie: propertyRow.chauffage_energie,
    eau_chaude_type: propertyRow.eau_chaude_type,
    eau_chaude_energie: prop.eau_chaude_energie,
    regime: propertyRow.regime,
    // Annexes / équipements
    has_balcon: propertyRow.has_balcon ?? prop.has_balcon,
    has_terrasse: propertyRow.has_terrasse ?? prop.has_terrasse,
    has_jardin: propertyRow.has_jardin ?? prop.has_jardin,
    has_cave: propertyRow.has_cave,
    has_parking: prop.has_parking,
    clim_presence: propertyRow.clim_presence as boolean | string | undefined,
    clim_type: propertyRow.clim_type,
    cuisine_equipee: prop.cuisine_equipee,
    interphone: prop.interphone,
    digicode: prop.digicode,
    fibre_optique: prop.fibre_optique,
    // Diagnostics complémentaires
    crep_date: prop.crep_date,
    crep_plomb: prop.crep_plomb,
    elec_date: prop.elec_date,
    elec_anomalies: prop.elec_anomalies,
    elec_nb_anomalies: prop.elec_nb_anomalies,
    gaz_date: prop.gaz_date,
    gaz_anomalies: prop.gaz_anomalies,
    gaz_type_anomalie: prop.gaz_type_anomalie,
    erp_date: prop.erp_date,
    bruit_date: prop.bruit_date,
    bruit_zone: prop.bruit_zone,
  };

  // SSOT 2026 : Consolider les données financières
  const initialInvoiceTyped = initialInvoice as { statut?: string } | null;
  const cleanLease: Lease = {
    ...leaseData,
    statut: leaseData.statut as LeaseStatus,
    sealed_at: leaseData.sealed_at ?? null,
    signed_pdf_path: leaseData.signed_pdf_path ?? null,
    loyer: property.loyer_hc ?? leaseData.loyer ?? 0,
    charges_forfaitaires: property.charges_mensuelles ?? leaseData.charges_forfaitaires ?? 0,
    has_signed_edl: edl?.status === "signed",
    has_paid_initial: initialInvoiceTyped?.statut === "paid",
    property_id: leaseData.property_id,
    unit_id: leaseData.unit_id,
    properties: propertyRow,
  };

  // ✅ SOTA 2026: Générer des URLs signées pour les images de signature (bucket privé)
  // Durée de validité: 1 heure
  type SignerWithProfile = LeaseSignerRow & {
    profiles?: ProfileRow | ProfileRow[] | null;
  };
  const signersArray = (signers ?? []) as SignerWithProfile[];
  const signersWithSignedUrls = await Promise.all(
    signersArray.map(async (s) => {
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
        signature_status: s.signature_status as SignatureStatus,
        signed_at: s.signed_at,
        signature_image: signatureImageUrl,
        signature_image_path: s.signature_image_path ?? null,
        proof_id: s.proof_id ?? null,
        ip_inet: s.ip_inet ?? null,
        invited_email: s.invited_email,
        invited_name: s.invited_name,
        invited_at: s.invited_at,
        profile: (() => {
          const p = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
          return p ? {
            id: p.id,
            prenom: p.prenom,
            nom: p.nom,
            email: p.email ?? null,
            telephone: p.telephone,
            avatar_url: p.avatar_url,
            date_naissance: p.date_naissance,
            lieu_naissance: p.lieu_naissance ?? null,
            nationalite: p.nationalite ?? null,
            adresse: p.adresse ?? null,
          } : null;
        })(),
      };
    })
  );

  const formattedSigners: Signer[] = signersWithSignedUrls;

  // Transformer les paiements
  type PaymentWithInvoice = PaymentRow & {
    invoices: { periode: string; lease_id: string };
  };
  const paymentsArray = (payments ?? []) as PaymentWithInvoice[];
  const formattedPayments: Payment[] = paymentsArray.map((p) => ({
    id: p.id,
    date_paiement: p.date_paiement ?? null,
    montant: p.montant,
    statut: p.statut as Payment["statut"],
    periode: p.invoices?.periode ?? null,
  }));

  const invoicesArray = (invoices ?? []) as InvoiceRow[];
  const formattedInvoices: Invoice[] = invoicesArray.map((inv) => ({
    id: inv.id,
    periode: inv.periode,
    montant_total: inv.montant_total,
    montant_loyer: inv.montant_loyer,
    montant_charges: inv.montant_charges,
    statut: inv.statut as Invoice["statut"],
    created_at: inv.created_at,
    metadata: null,
  }));

  const result: LeaseDetails = {
    lease: cleanLease,
    property,
    signers: formattedSigners,
    payments: formattedPayments,
    invoices: formattedInvoices,
    documents: (documents ?? []).map((doc: DocumentRow) => ({
      id: doc.id,
      type: doc.type,
      storage_path: doc.storage_path ?? doc.url ?? "",
      created_at: doc.created_at,
      title: doc.nom ?? undefined,
      name: doc.nom_fichier ?? undefined,
    })),
    edl: edl ? ({ ...edl, ...edlStats } as EDLEntry) : null,
  };

  return result;
}
