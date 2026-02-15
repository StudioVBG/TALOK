/**
 * resolveOwnerIdentity — Fonction centrale de résolution des données propriétaire
 *
 * Remplace tous les accès directs à `profiles`/`owner_profiles` pour les documents.
 * Pattern de migration : si `legal_entity` existe → l'utiliser, sinon fallback `owner_profiles`.
 *
 * @module lib/entities/resolveOwnerIdentity
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================
// TYPES
// ============================================

export interface OwnerAddress {
  street: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface OwnerRepresentative {
  firstName: string;
  lastName: string;
  role: string;
}

export type OwnerEntityType =
  | "individual"
  | "company"
  | "indivision"
  | "dismemberment";

export interface OwnerIdentity {
  /** Nom affiché sur les documents — "SCI ATOMGISTE" ou "Marie-Line VOLBERG" */
  displayName: string;
  /** Caption légale complète — "SCI ATOMGISTE, représentée par Marie-Line VOLBERG, Gérante" */
  legalCaption: string;
  /** Nom court — "ATOMGISTE" ou "VOLBERG" */
  shortName: string;

  // Personne physique (toujours présentes)
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthDate: string | null;
  birthPlace: string | null;

  // Entité juridique (null si particulier sans entité)
  entityId: string | null;
  entityType: OwnerEntityType;
  companyName: string | null;
  legalForm: string | null;
  fiscalRegime: "IR" | "IS" | null;
  siret: string | null;
  tvaNumber: string | null;
  capitalSocial: number | null;
  registrationDate: string | null;

  // Adresse
  address: OwnerAddress;

  // Bancaire
  iban: string | null;
  bic: string | null;
  bankName: string | null;

  // Représentant légal
  representative: OwnerRepresentative | null;

  // Stripe
  stripeAccountId: string | null;
  stripePayoutsEnabled: boolean;

  // Facturation
  billingAddress: string | null;

  // DOM-TOM
  isDomTom: boolean;
  tvaRate: number;

  // Meta
  source: "legal_entity" | "owner_profile_fallback";
  completionPercent: number;
  missingFields: string[];
}

export interface ResolveOwnerParams {
  propertyId?: string;
  leaseId?: string;
  entityId?: string;
  profileId?: string;
}

// ============================================
// HELPERS
// ============================================

/**
 * Détermine le taux de TVA selon le code postal (DOM-TOM aware)
 */
export function getTvaRate(postalCode: string | null | undefined): number {
  if (!postalCode) return 20;
  const cp = postalCode.trim();
  if (cp.startsWith("971")) return 8.5; // Guadeloupe
  if (cp.startsWith("972")) return 8.5; // Martinique
  if (cp.startsWith("974")) return 8.5; // Réunion
  if (cp.startsWith("973")) return 0; // Guyane
  if (cp.startsWith("976")) return 0; // Mayotte
  return 20; // Métropole
}

/**
 * Vérifie si un code postal est dans les DOM-TOM
 */
export function isDomTomPostalCode(
  postalCode: string | null | undefined
): boolean {
  if (!postalCode) return false;
  return postalCode.trim().startsWith("97");
}

/**
 * Mappe le entity_type DB vers le type UX simplifié
 */
function mapEntityType(
  dbType: string | null | undefined
): OwnerEntityType {
  if (!dbType || dbType === "particulier") return "individual";
  if (dbType === "indivision") return "indivision";
  if (
    dbType === "demembrement_usufruit" ||
    dbType === "demembrement_nue_propriete"
  )
    return "dismemberment";
  return "company";
}

/**
 * Mappe le régime fiscal DB vers le label simplifié
 */
function mapFiscalRegime(
  regime: string | null | undefined
): "IR" | "IS" | null {
  if (!regime) return null;
  if (regime === "ir" || regime === "ir_option_is") return "IR";
  if (regime === "is" || regime === "is_option_ir") return "IS";
  return null;
}

/**
 * Construit le legalCaption selon le type d'entité
 */
function buildLegalCaption(
  entityType: OwnerEntityType,
  companyName: string | null,
  legalForm: string | null,
  representative: OwnerRepresentative | null,
  firstName: string,
  lastName: string
): string {
  if (entityType === "individual") {
    return `${firstName} ${lastName}`.trim();
  }

  if (entityType === "company" && companyName) {
    const prefix = legalForm ? `${legalForm} ${companyName}` : companyName;
    if (representative) {
      return `${prefix}, représentée par ${representative.firstName} ${representative.lastName}, ${representative.role}`;
    }
    return prefix;
  }

  if (entityType === "indivision" && companyName) {
    if (representative) {
      return `Indivision ${companyName}, représentée par ${representative.firstName} ${representative.lastName}`;
    }
    return `Indivision ${companyName}`;
  }

  if (entityType === "dismemberment") {
    return `${firstName} ${lastName}`.trim();
  }

  return `${firstName} ${lastName}`.trim();
}

/**
 * Calcule le % de complétion et les champs manquants
 */
function computeCompletion(identity: Partial<OwnerIdentity>): {
  percent: number;
  missing: string[];
} {
  const required: Array<{ field: string; label: string; value: unknown }> = [
    { field: "displayName", label: "Nom", value: identity.displayName },
    { field: "address", label: "Adresse", value: identity.address?.street },
    { field: "email", label: "Email", value: identity.email },
  ];

  if (identity.entityType !== "individual") {
    required.push(
      { field: "siret", label: "SIRET", value: identity.siret },
      {
        field: "legalForm",
        label: "Forme juridique",
        value: identity.legalForm,
      },
      {
        field: "representative",
        label: "Représentant légal",
        value: identity.representative,
      }
    );
  }

  const recommended: Array<{
    field: string;
    label: string;
    value: unknown;
  }> = [
    { field: "phone", label: "Téléphone", value: identity.phone },
    { field: "iban", label: "IBAN", value: identity.iban },
  ];

  const allFields = [...required, ...recommended];
  const missing: string[] = [];
  let filled = 0;

  for (const f of allFields) {
    if (f.value) {
      filled++;
    } else {
      missing.push(f.label);
    }
  }

  const percent =
    allFields.length > 0 ? Math.round((filled / allFields.length) * 100) : 0;
  return { percent, missing };
}

// ============================================
// MAIN RESOLVER
// ============================================

/**
 * Résout l'identité du propriétaire pour les documents et l'affichage.
 *
 * Ordre de résolution :
 * 1. entityId fourni → fetch legal_entities
 * 2. leaseId fourni → lease.signatory_entity_id → legal_entities (ou fallback)
 * 3. propertyId fourni → property.legal_entity_id → legal_entities
 * 4. profileId → fallback owner_profiles + profiles
 */
export async function resolveOwnerIdentity(
  supabase: SupabaseClient,
  params: ResolveOwnerParams
): Promise<OwnerIdentity> {
  // 1. Résolution directe par entityId
  if (params.entityId) {
    const result = await resolveFromEntity(supabase, params.entityId);
    if (result) return result;
  }

  // 2. Résolution via le bail
  if (params.leaseId) {
    const result = await resolveFromLease(supabase, params.leaseId);
    if (result) return result;
  }

  // 3. Résolution via la propriété
  if (params.propertyId) {
    const result = await resolveFromProperty(supabase, params.propertyId);
    if (result) return result;
  }

  // 4. Fallback : owner_profiles + profiles
  if (params.profileId) {
    return resolveFromOwnerProfile(supabase, params.profileId);
  }

  // Aucun paramètre → identité vide
  return buildEmptyIdentity();
}

// ============================================
// RESOLUTION STRATEGIES
// ============================================

async function resolveFromEntity(
  supabase: SupabaseClient,
  entityId: string
): Promise<OwnerIdentity | null> {
  const { data: entity, error } = await supabase
    .from("legal_entities")
    .select(
      `
      *,
      owner_profile:owner_profiles!legal_entities_owner_profile_id_fkey (
        profile_id,
        profile:profiles (
          id, prenom, nom, email, telephone, date_naissance
        )
      )
    `
    )
    .eq("id", entityId)
    .single();

  if (error || !entity) return null;

  // Fetch gérant
  const { data: associates } = await supabase
    .from("entity_associates")
    .select("nom, prenom, is_gerant, is_president")
    .eq("legal_entity_id", entityId)
    .eq("is_current", true)
    .order("is_gerant", { ascending: false });

  const gerant =
    associates?.find((a: Record<string, unknown>) => a.is_gerant) ||
    associates?.find((a: Record<string, unknown>) => a.is_president);

  // Fetch Stripe
  const ownerProfileId = (entity.owner_profile as Record<string, unknown>)
    ?.profile_id as string | undefined;
  let stripeAccountId: string | null = null;
  let stripePayoutsEnabled = false;

  if (ownerProfileId) {
    const { data: stripe } = await supabase
      .from("stripe_connect_accounts")
      .select("stripe_account_id, payouts_enabled")
      .eq("profile_id", ownerProfileId)
      .maybeSingle();

    stripeAccountId =
      (stripe?.stripe_account_id as string | null) ?? null;
    stripePayoutsEnabled = (stripe?.payouts_enabled as boolean) ?? false;
  }

  const ownerProfile = entity.owner_profile as Record<string, unknown> | null;
  const profile = (ownerProfile?.profile ?? null) as Record<
    string,
    unknown
  > | null;

  const entityType = mapEntityType(entity.entity_type as string);
  const postalCode = entity.code_postal_siege as string | null;

  const representative: OwnerRepresentative | null = gerant
    ? {
        firstName: (gerant.prenom as string) || "",
        lastName: (gerant.nom as string) || "",
        role: gerant.is_gerant ? "Gérant(e)" : "Président(e)",
      }
    : null;

  const firstName = (profile?.prenom as string) || "";
  const lastName = (profile?.nom as string) || "";
  const companyName = (entity.nom as string) || null;
  const legalForm = (entity.forme_juridique as string) || null;

  const legalCaption = buildLegalCaption(
    entityType,
    companyName,
    legalForm,
    representative,
    firstName,
    lastName
  );

  const identity: OwnerIdentity = {
    displayName:
      entityType !== "individual" && companyName
        ? companyName
        : `${firstName} ${lastName}`.trim(),
    legalCaption,
    shortName:
      entityType !== "individual" && companyName
        ? companyName
        : lastName || firstName,

    firstName,
    lastName,
    email: (profile?.email as string) || "",
    phone: (profile?.telephone as string) || null,
    birthDate: (profile?.date_naissance as string) || null,
    birthPlace: null,

    entityId: entity.id as string,
    entityType,
    companyName,
    legalForm,
    fiscalRegime: mapFiscalRegime(entity.regime_fiscal as string),
    siret: (entity.siret as string) || null,
    tvaNumber: (entity.numero_tva as string) || null,
    capitalSocial: (entity.capital_social as number) || null,
    registrationDate: (entity.date_creation as string) || null,

    address: {
      street: (entity.adresse_siege as string) || "",
      postalCode: postalCode || "",
      city: (entity.ville_siege as string) || "",
      country: (entity.pays_siege as string) || "France",
    },

    iban: (entity.iban as string) || null,
    bic: (entity.bic as string) || null,
    bankName: (entity.banque_nom as string) || null,

    representative,

    stripeAccountId,
    stripePayoutsEnabled,

    billingAddress: (entity.adresse_siege as string) || null,

    isDomTom: isDomTomPostalCode(postalCode),
    tvaRate: getTvaRate(postalCode),

    source: "legal_entity",
    completionPercent: 0,
    missingFields: [],
  };

  const { percent, missing } = computeCompletion(identity);
  identity.completionPercent = percent;
  identity.missingFields = missing;

  return identity;
}

async function resolveFromLease(
  supabase: SupabaseClient,
  leaseId: string
): Promise<OwnerIdentity | null> {
  const { data: lease } = await supabase
    .from("leases")
    .select(
      `
      signatory_entity_id,
      property:properties!inner (
        owner_id,
        legal_entity_id
      )
    `
    )
    .eq("id", leaseId)
    .single();

  if (!lease) return null;

  const propertyData = lease.property as unknown as Record<string, unknown> | Record<string, unknown>[] | null;
  const prop = Array.isArray(propertyData) ? propertyData[0] : propertyData;
  const entityId =
    (lease.signatory_entity_id as string) ||
    (prop?.legal_entity_id as string);

  if (entityId) {
    return resolveFromEntity(supabase, entityId);
  }

  // Fallback vers owner_profiles
  const ownerId = prop?.owner_id as string;
  if (ownerId) {
    return resolveFromOwnerProfile(supabase, ownerId);
  }

  return null;
}

async function resolveFromProperty(
  supabase: SupabaseClient,
  propertyId: string
): Promise<OwnerIdentity | null> {
  const { data: property } = await supabase
    .from("properties")
    .select("owner_id, legal_entity_id")
    .eq("id", propertyId)
    .single();

  if (!property) return null;

  const entityId = property.legal_entity_id as string | null;
  if (entityId) {
    return resolveFromEntity(supabase, entityId);
  }

  // Fallback vers owner_profiles
  const ownerId = property.owner_id as string;
  if (ownerId) {
    return resolveFromOwnerProfile(supabase, ownerId);
  }

  return null;
}

async function resolveFromOwnerProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<OwnerIdentity> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, prenom, nom, email, telephone, date_naissance")
    .eq("id", profileId)
    .single();

  const { data: ownerProfile } = await supabase
    .from("owner_profiles")
    .select(
      "type, raison_sociale, forme_juridique, siret, tva, iban, adresse_facturation, adresse_siege, representant_nom, representant_qualite"
    )
    .eq("profile_id", profileId)
    .single();

  // Stripe
  let stripeAccountId: string | null = null;
  let stripePayoutsEnabled = false;
  const { data: stripe } = await supabase
    .from("stripe_connect_accounts")
    .select("stripe_account_id, payouts_enabled")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (stripe) {
    stripeAccountId =
      (stripe.stripe_account_id as string | null) ?? null;
    stripePayoutsEnabled = (stripe.payouts_enabled as boolean) ?? false;
  }

  const firstName = (profile?.prenom as string) || "";
  const lastName = (profile?.nom as string) || "";
  const isCompany =
    ownerProfile?.type === "societe" && ownerProfile?.raison_sociale;
  const entityType: OwnerEntityType = isCompany ? "company" : "individual";
  const companyName = isCompany
    ? (ownerProfile.raison_sociale as string)
    : null;
  const legalForm = isCompany
    ? (ownerProfile.forme_juridique as string) || null
    : null;

  const representative: OwnerRepresentative | null =
    isCompany && ownerProfile?.representant_nom
      ? {
          firstName: "",
          lastName: ownerProfile.representant_nom as string,
          role:
            (ownerProfile.representant_qualite as string) || "Gérant(e)",
        }
      : isCompany
        ? {
            firstName,
            lastName,
            role: "Gérant(e)",
          }
        : null;

  const legalCaption = buildLegalCaption(
    entityType,
    companyName,
    legalForm,
    representative,
    firstName,
    lastName
  );

  // Déduire le code postal de l'adresse si possible
  const addressStr =
    (ownerProfile?.adresse_facturation as string) ||
    (ownerProfile?.adresse_siege as string) ||
    "";
  const cpMatch = addressStr.match(/\b(97\d{3}|\d{5})\b/);
  const postalCode = cpMatch ? cpMatch[1] : "";

  const identity: OwnerIdentity = {
    displayName: isCompany
      ? (companyName as string)
      : `${firstName} ${lastName}`.trim(),
    legalCaption,
    shortName: isCompany
      ? (companyName as string)
      : lastName || firstName,

    firstName,
    lastName,
    email: (profile?.email as string) || "",
    phone: (profile?.telephone as string) || null,
    birthDate: (profile?.date_naissance as string) || null,
    birthPlace: null,

    entityId: null,
    entityType,
    companyName,
    legalForm,
    fiscalRegime: null,
    siret: (ownerProfile?.siret as string) || null,
    tvaNumber: (ownerProfile?.tva as string) || null,
    capitalSocial: null,
    registrationDate: null,

    address: {
      street: addressStr,
      postalCode,
      city: "",
      country: "France",
    },

    iban: (ownerProfile?.iban as string) || null,
    bic: null,
    bankName: null,

    representative,

    stripeAccountId,
    stripePayoutsEnabled,

    billingAddress:
      (ownerProfile?.adresse_facturation as string) || null,

    isDomTom: isDomTomPostalCode(postalCode),
    tvaRate: getTvaRate(postalCode),

    source: "owner_profile_fallback",
    completionPercent: 0,
    missingFields: [],
  };

  const { percent, missing } = computeCompletion(identity);
  identity.completionPercent = percent;
  identity.missingFields = missing;

  return identity;
}

function buildEmptyIdentity(): OwnerIdentity {
  return {
    displayName: "[Propriétaire]",
    legalCaption: "[Propriétaire]",
    shortName: "[Propriétaire]",
    firstName: "",
    lastName: "",
    email: "",
    phone: null,
    birthDate: null,
    birthPlace: null,
    entityId: null,
    entityType: "individual",
    companyName: null,
    legalForm: null,
    fiscalRegime: null,
    siret: null,
    tvaNumber: null,
    capitalSocial: null,
    registrationDate: null,
    address: { street: "", postalCode: "", city: "", country: "France" },
    iban: null,
    bic: null,
    bankName: null,
    representative: null,
    stripeAccountId: null,
    stripePayoutsEnabled: false,
    billingAddress: null,
    isDomTom: false,
    tvaRate: 20,
    source: "owner_profile_fallback",
    completionPercent: 0,
    missingFields: [
      "Nom",
      "Adresse",
      "Email",
      "Téléphone",
      "IBAN",
    ],
  };
}
