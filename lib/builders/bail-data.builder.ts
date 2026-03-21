/**
 * SOTA 2026 — Builder unifie des donnees du bail
 *
 * Unique source de verite pour la construction de BailComplet.
 * Remplace les constructions dupliquees dans :
 *   - app/api/leases/[id]/pdf/route.ts
 *   - app/api/leases/[id]/html/route.ts
 *   - lib/services/lease-pdf-generator.ts
 */

import { resolveOwnerIdentity } from "@/lib/entities/resolveOwnerIdentity";
import { resolveTenantDisplay } from "@/lib/helpers/resolve-tenant-display";
import type {
  TypeBail,
  BailComplet,
  DiagnosticsTechniques,
  Logement,
  Bailleur,
  Annexe,
} from "@/lib/templates/bail/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupabaseLike = {
  from: (table: string) => any;
  storage: { from: (bucket: string) => any };
};

export interface BuildBailDataOptions {
  includeSignatures?: boolean;
  includeDiagnostics?: boolean;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildBailData(
  supabase: SupabaseLike,
  leaseId: string,
  options: BuildBailDataOptions = {}
): Promise<{ bailData: Partial<BailComplet>; typeBail: TypeBail; property: any; lease: any }> {
  const { includeSignatures = false, includeDiagnostics = true } = options;

  // 1. Fetch lease with full property + signers
  const signerSelect = includeSignatures
    ? `id, role, signature_status, signed_at, profile_id, invited_email, invited_name, signature_image_path, ip_inet, user_agent, proof_id, document_hash, proof_metadata, profile:profiles(id, prenom, nom, email, telephone, date_naissance, lieu_naissance)`
    : `id, role, signature_status, signed_at, profile_id, invited_email, invited_name, profile:profiles(id, prenom, nom, email, telephone, date_naissance, lieu_naissance)`;

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select(`*, property:properties(*), signers:lease_signers(${signerSelect})`)
    .eq("id", leaseId)
    .single();

  if (leaseError || !lease) throw new Error("Bail non trouvé");

  const property = lease.property as Record<string, any> | null;
  if (!property) throw new Error("Propriété non trouvée pour ce bail");

  // 2. Resolve owner identity (ALWAYS via resolveOwnerIdentity, never owner_profiles directly)
  const ownerIdentity = await resolveOwnerIdentity(supabase as any, {
    leaseId,
    propertyId: property.id,
    profileId: property.owner_id,
  });

  // 3. Diagnostics
  const diagnostics = includeDiagnostics
    ? await buildDiagnostics(supabase, property, leaseId)
    : undefined;

  // 4. Resolve tenant
  const sortedSigners = ((lease.signers as any[]) || []).sort((a, b) => {
    if (a.signature_status === "signed" && b.signature_status !== "signed") return -1;
    if (a.signature_status !== "signed" && b.signature_status === "signed") return 1;
    if (a.profile?.id && !b.profile?.id) return -1;
    if (!a.profile?.id && b.profile?.id) return 1;
    return 0;
  });

  const tenantSigner = sortedSigners.find((s) => {
    const role = (s.role || "").toLowerCase();
    return role.includes("locataire") || role.includes("tenant") || role === "principal";
  });

  const tenantDisplay = resolveTenantDisplay(tenantSigner);
  const locataires = [
    {
      nom: tenantDisplay.nom,
      prenom: tenantDisplay.prenom,
      email: tenantDisplay.email,
      telephone: tenantDisplay.telephone,
      date_naissance: tenantDisplay.dateNaissance,
      lieu_naissance: tenantDisplay.lieuNaissance,
      nationalite: tenantDisplay.nationalite || "Française",
    },
  ];

  // 5. Resolve signature image URLs if needed
  if (includeSignatures && lease.signers) {
    for (const signer of lease.signers as any[]) {
      if (signer.signature_image_path) {
        try {
          const { data: signedUrl } = await supabase.storage
            .from("documents")
            .createSignedUrl(signer.signature_image_path, 3600);
          if (signedUrl?.signedUrl) signer.signature_image = signedUrl.signedUrl;
        } catch { /* non-blocking */ }
      }
    }
  }

  // 6. Build logement
  const logement = buildLogement(property, lease);

  // 7. Build bailleur
  const isCompany = ownerIdentity.entityType === "company";
  const bailleur: Bailleur = {
    nom: isCompany ? (ownerIdentity.companyName || "") : ownerIdentity.lastName,
    prenom: isCompany ? "" : ownerIdentity.firstName,
    adresse: ownerIdentity.address.street || property.adresse_complete || "",
    code_postal: ownerIdentity.address.postalCode || property.code_postal || "",
    ville: ownerIdentity.address.city || property.ville || "",
    telephone: ownerIdentity.phone || "",
    type: (isCompany ? "societe" : "particulier") as Bailleur["type"],
    est_mandataire: false,
    raison_sociale: ownerIdentity.companyName || "",
    siret: ownerIdentity.siret ?? undefined,
    representant_nom: ownerIdentity.representative
      ? `${ownerIdentity.representative.firstName} ${ownerIdentity.representative.lastName}`.trim()
      : `${ownerIdentity.firstName} ${ownerIdentity.lastName}`.trim(),
    representant_qualite: ownerIdentity.representative?.role || (isCompany ? "Gérant" : undefined),
    date_naissance: isCompany ? undefined : (ownerIdentity.birthDate ?? undefined),
  };

  // 8. Build conditions
  const typeBail = (lease.type_bail || "meuble") as TypeBail;
  const isDraft = lease.statut === "draft";
  const finalLoyer = isDraft
    ? (property.loyer_hc ?? property.loyer_base ?? lease.loyer ?? 0)
    : (lease.loyer ?? 0);
  const finalCharges = isDraft
    ? (property.charges_forfaitaires ?? property.charges_mensuelles ?? lease.charges_forfaitaires ?? 0)
    : (lease.charges_forfaitaires ?? 0);
  const finalDepot = isDraft
    ? (lease.depot_de_garantie ?? finalLoyer)
    : (lease.depot_de_garantie ?? 0);

  const conditions = {
    type_bail: typeBail,
    usage: "habitation_principale" as const,
    date_debut: lease.date_debut,
    date_fin: lease.date_fin ?? undefined,
    duree_mois: typeBail === "nu" ? 36 : typeBail === "meuble" ? 12 : 12,
    tacite_reconduction: true,
    loyer_hc: parseFloat(String(finalLoyer)) || 0,
    loyer_en_lettres: numberToWords(parseFloat(String(finalLoyer)) || 0),
    charges_type: "forfait" as const,
    charges_montant: parseFloat(String(finalCharges)) || 0,
    depot_garantie: parseFloat(String(finalDepot)) || 0,
    depot_garantie_en_lettres: numberToWords(parseFloat(String(finalDepot)) || 0),
    mode_paiement: "virement" as const,
    periodicite_paiement: "mensuelle" as const,
    jour_paiement: 5,
    paiement_avance: true,
    revision_autorisee: true,
    indice_reference: "IRL",
  };

  const bailData: Partial<BailComplet> = {
    reference: leaseId.slice(0, 8).toUpperCase(),
    date_signature: lease.date_signature || lease.created_at,
    lieu_signature: property.ville || "",
    bailleur,
    locataires,
    logement,
    conditions: conditions as any,
    diagnostics: diagnostics && Object.keys(diagnostics).length > 0 ? (diagnostics as DiagnosticsTechniques) : undefined,
    signers: includeSignatures ? lease.signers : undefined,
  };

  return { bailData, typeBail, property, lease };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildDiagnostics(
  supabase: SupabaseLike,
  property: Record<string, any>,
  leaseId: string
): Promise<Partial<DiagnosticsTechniques>> {
  const diagnostics: Partial<DiagnosticsTechniques> = {};

  if (property.dpe_classe_energie || property.energie) {
    diagnostics.dpe = {
      date_realisation: new Date().toISOString(),
      date_validite: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      classe_energie: (property.dpe_classe_energie || property.energie || "D") as any,
      classe_ges: (property.dpe_classe_climat || property.ges || "D") as any,
      consommation_energie: property.dpe_consommation || 0,
      emissions_ges: property.dpe_emissions || 0,
      estimation_cout_min: property.dpe_estimation_conso_min ?? undefined,
      estimation_cout_max: property.dpe_estimation_conso_max ?? undefined,
    };
  }

  const { data: docs } = await supabase
    .from("documents")
    .select("*")
    .or(`property_id.eq.${property.id},lease_id.eq.${leaseId}`)
    .in("type", ["diagnostic_performance", "dpe", "crep", "plomb", "electricite", "gaz", "erp", "risques", "amiante", "bruit"])
    .eq("is_archived", false);

  if (docs) {
    for (const doc of docs as any[]) {
      const docType = (doc.type || "").toLowerCase();
      const metadata = (doc.metadata || {}) as Record<string, any>;

      if (docType.includes("dpe") || docType.includes("performance")) {
        diagnostics.dpe = {
          date_realisation: doc.created_at,
          date_validite: doc.expiry_date || new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          classe_energie: metadata.classe_energie || diagnostics.dpe?.classe_energie || "D",
          classe_ges: metadata.classe_ges || diagnostics.dpe?.classe_ges || "D",
          consommation_energie: metadata.consommation ?? diagnostics.dpe?.consommation_energie ?? 0,
          emissions_ges: metadata.emissions ?? diagnostics.dpe?.emissions_ges ?? 0,
        };
      }
      if (docType.includes("crep") || docType.includes("plomb")) {
        diagnostics.crep = { date_realisation: doc.created_at, presence_plomb: metadata.presence_plomb || false };
      }
      if (docType.includes("electricite")) {
        diagnostics.electricite = { date_realisation: doc.created_at, date_validite: doc.expiry_date || "", anomalies_detectees: metadata.anomalies || false, nb_anomalies: metadata.nb_anomalies || 0 };
      }
      if (docType.includes("gaz")) {
        diagnostics.gaz = { date_realisation: doc.created_at, date_validite: doc.expiry_date || "", anomalies_detectees: metadata.anomalies || false, type_anomalie: metadata.type_anomalie };
      }
      if (docType.includes("erp") || docType.includes("risque")) {
        diagnostics.erp = { date_realisation: doc.created_at, risques_identifies: metadata.risques || [] };
      }
    }
  }

  return diagnostics;
}

function buildLogement(property: Record<string, any>, lease: any): Logement {
  const year = typeof property.annee_construction === "number" ? property.annee_construction : undefined;
  let epoque: Logement["epoque_construction"] | undefined;
  if (year != null) {
    if (year < 1949) epoque = "avant_1949";
    else if (year <= 1974) epoque = "1949_1974";
    else if (year <= 1989) epoque = "1975_1989";
    else if (year <= 2005) epoque = "1990_2005";
    else epoque = "apres_2005";
  }

  const annexes: Annexe[] = [];
  if (property.has_balcon) annexes.push({ type: "balcon" });
  if (property.has_terrasse) annexes.push({ type: "terrasse" });
  if (property.has_cave) annexes.push({ type: "cave" });
  if (property.has_jardin) annexes.push({ type: "jardin" });
  if (property.has_parking) annexes.push({ type: "parking" });

  return {
    adresse_complete: property.adresse_complete || "",
    code_postal: property.code_postal || "",
    ville: property.ville || "",
    type: (property.type || "appartement") as Logement["type"],
    surface_habitable: property.surface || property.surface_habitable_m2 || 0,
    nb_pieces_principales: property.nb_pieces || 1,
    etage: property.etage ?? undefined,
    nb_etages_immeuble: property.nb_etages_immeuble ?? undefined,
    ascenseur: property.ascenseur,
    regime: (property.regime || "mono_propriete") as Logement["regime"],
    annee_construction: property.annee_construction ?? undefined,
    epoque_construction: epoque,
    chauffage_type: property.chauffage_type as Logement["chauffage_type"],
    chauffage_energie: property.chauffage_energie as Logement["chauffage_energie"],
    eau_chaude_type: property.eau_chaude_type as Logement["eau_chaude_type"],
    eau_chaude_energie: "electricite",
    equipements_privatifs: (property.equipments as string[] | null) || [],
    parties_communes: [],
    annexes,
  };
}

function numberToWords(n: number): string {
  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
  if (n < 20) return units[Math.floor(n)];
  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = Math.floor(n % 10);
    if (t === 7 || t === 9) return tens[t] + (u === 1 && t === 7 ? "-et-" : "-") + units[10 + u];
    return tens[t] + (u === 1 && t !== 8 ? "-et-" : u ? "-" : "") + units[u];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = Math.floor(n % 100);
    return (h === 1 ? "cent" : units[h] + " cent") + (r ? " " + numberToWords(r) : h > 1 ? "s" : "");
  }
  if (n < 10000) {
    const m = Math.floor(n / 1000);
    const r = Math.floor(n % 1000);
    return (m === 1 ? "mille" : units[m] + " mille") + (r ? " " + numberToWords(r) : "");
  }
  return `${n.toFixed(2)} euros`;
}
