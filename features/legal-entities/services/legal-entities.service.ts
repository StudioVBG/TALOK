/**
 * Service pour la gestion des entités juridiques (SCI, SARL, etc.)
 * SOTA 2026 - Architecture multi-entités
 */

import { createClient } from "@/lib/supabase/server";
import type {
  LegalEntity,
  LegalEntityWithStats,
  LegalEntityWithAssociates,
  EntityAssociate,
  EntityAssociateWithProfile,
  PropertyOwnership,
  PropertyOwnershipWithDetails,
  CreateLegalEntityDTO,
  UpdateLegalEntityDTO,
  CreateEntityAssociateDTO,
  CreatePropertyOwnershipDTO,
  LegalEntityType,
  FiscalRegime,
} from "@/lib/types/legal-entity";

// ============================================
// LEGAL ENTITIES - CRUD
// ============================================

/**
 * Récupère toutes les entités juridiques d'un propriétaire
 */
export async function getLegalEntities(
  ownerProfileId: string,
  options?: {
    includeInactive?: boolean;
    entityType?: LegalEntityType;
  }
): Promise<LegalEntity[]> {
  const supabase = await createClient();

  let query = supabase
    .from("legal_entities")
    .select("*")
    .eq("owner_profile_id", ownerProfileId)
    .order("nom");

  if (!options?.includeInactive) {
    query = query.eq("is_active", true);
  }

  if (options?.entityType) {
    query = query.eq("entity_type", options.entityType);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching legal entities:", error);
    throw new Error(`Erreur lors de la récupération des entités: ${error.message}`);
  }

  return data as LegalEntity[];
}

/**
 * Récupère une entité juridique par ID
 */
export async function getLegalEntityById(
  entityId: string
): Promise<LegalEntity | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("legal_entities")
    .select("*")
    .eq("id", entityId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Erreur: ${error.message}`);
  }

  return data as LegalEntity;
}

/**
 * Récupère les entités avec leurs statistiques
 */
export async function getLegalEntitiesWithStats(
  ownerProfileId: string
): Promise<LegalEntityWithStats[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_entity_stats", {
    p_owner_profile_id: ownerProfileId,
  });

  if (error) {
    console.error("Error fetching entity stats:", error);
    // Fallback: récupérer les entités sans stats
    const entities = await getLegalEntities(ownerProfileId);
    return entities.map((e) => ({
      ...e,
      properties_count: 0,
      total_value: 0,
      monthly_rent: 0,
      active_leases: 0,
      associates_count: 0,
    }));
  }

  // Récupérer les entités complètes
  const entities = await getLegalEntities(ownerProfileId);

  // Fusionner les stats
  return entities.map((entity) => {
    const stats = (data as any[])?.find((s: Record<string, unknown>) => s.entity_id === entity.id);
    return {
      ...entity,
      properties_count: stats?.properties_count ?? 0,
      total_value: stats?.total_value ?? 0,
      monthly_rent: stats?.monthly_rent ?? 0,
      active_leases: stats?.active_leases ?? 0,
      associates_count: stats?.associates_count ?? 0,
    };
  });
}

/**
 * Crée une nouvelle entité juridique
 */
export async function createLegalEntity(
  ownerProfileId: string,
  data: CreateLegalEntityDTO
): Promise<LegalEntity> {
  const supabase = await createClient();

  const { data: entity, error } = await supabase
    .from("legal_entities")
    .insert({
      owner_profile_id: ownerProfileId,
      entity_type: data.entity_type,
      nom: data.nom,
      nom_commercial: data.nom_commercial,
      siren: data.siren,
      siret: data.siret,
      rcs_ville: data.rcs_ville,
      numero_tva: data.numero_tva,
      adresse_siege: data.adresse_siege,
      code_postal_siege: data.code_postal_siege,
      ville_siege: data.ville_siege,
      forme_juridique: data.forme_juridique,
      capital_social: data.capital_social,
      nombre_parts: data.nombre_parts,
      regime_fiscal: data.regime_fiscal,
      tva_assujetti: data.tva_assujetti ?? false,
      tva_regime: data.tva_regime,
      date_creation: data.date_creation,
      date_cloture_exercice: data.date_cloture_exercice,
      iban: data.iban,
      bic: data.bic,
      banque_nom: data.banque_nom,
      couleur: data.couleur,
      notes: data.notes,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating legal entity:", error);
    throw new Error(`Erreur lors de la création: ${error.message}`);
  }

  return entity as LegalEntity;
}

/**
 * Met à jour une entité juridique
 */
export async function updateLegalEntity(
  entityId: string,
  data: UpdateLegalEntityDTO,
  ownerProfileId?: string
): Promise<LegalEntity> {
  const supabase = await createClient();

  // Construire la requête avec filtre ownership si fourni
  let query = supabase
    .from("legal_entities")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entityId);

  // Sécurité : filtrer par owner_profile_id si fourni
  if (ownerProfileId) {
    query = query.eq("owner_profile_id", ownerProfileId);
  }

  const { data: entity, error } = await query.select().single();

  if (error) {
    console.error("Error updating legal entity:", error);
    throw new Error(`Erreur lors de la mise à jour: ${error.message}`);
  }

  return entity as LegalEntity;
}

/**
 * Désactive une entité juridique (soft delete)
 */
export async function deactivateLegalEntity(
  entityId: string,
  motif?: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("legal_entities")
    .update({
      is_active: false,
      date_radiation: new Date().toISOString().split("T")[0],
      motif_radiation: motif,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entityId);

  if (error) {
    throw new Error(`Erreur lors de la désactivation: ${error.message}`);
  }
}

/**
 * Supprime définitivement une entité juridique
 * (uniquement si pas de biens associés)
 */
export async function deleteLegalEntity(entityId: string, ownerProfileId?: string): Promise<void> {
  const supabase = await createClient();

  // Vérifier qu'il n'y a pas de biens associés
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("legal_entity_id", entityId);

  if (count && count > 0) {
    throw new Error(
      "Impossible de supprimer cette entité: des biens y sont associés"
    );
  }

  let query = supabase
    .from("legal_entities")
    .delete()
    .eq("id", entityId);

  // Sécurité : filtrer par owner_profile_id si fourni
  if (ownerProfileId) {
    query = query.eq("owner_profile_id", ownerProfileId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la suppression: ${error.message}`);
  }
}

// ============================================
// ENTITY ASSOCIATES - CRUD
// ============================================

/**
 * Récupère les associés d'une entité
 */
export async function getEntityAssociates(
  entityId: string,
  options?: {
    currentOnly?: boolean;
    gerantsOnly?: boolean;
  }
): Promise<EntityAssociateWithProfile[]> {
  const supabase = await createClient();

  let query = supabase
    .from("entity_associates")
    .select(`
      *,
      profile:profiles (
        prenom,
        nom,
        email,
        avatar_url
      ),
      parent_entity:legal_entities!entity_associates_parent_entity_id_fkey (
        nom,
        entity_type
      )
    `)
    .eq("legal_entity_id", entityId)
    .order("pourcentage_capital", { ascending: false });

  if (options?.currentOnly !== false) {
    query = query.eq("is_current", true);
  }

  if (options?.gerantsOnly) {
    query = query.eq("is_gerant", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching associates:", error);
    throw new Error(`Erreur: ${error.message}`);
  }

  return data as unknown as EntityAssociateWithProfile[];
}

/**
 * Crée un nouvel associé
 */
export async function createEntityAssociate(
  data: CreateEntityAssociateDTO
): Promise<EntityAssociate> {
  const supabase = await createClient();

  // Calculer le pourcentage si non fourni
  let pourcentage = data.pourcentage_capital;
  if (!pourcentage && data.nombre_parts) {
    // Récupérer le nombre total de parts de l'entité
    const { data: entity } = await supabase
      .from("legal_entities")
      .select("nombre_parts")
      .eq("id", data.legal_entity_id)
      .single();

    if (entity?.nombre_parts) {
      pourcentage = (data.nombre_parts / entity.nombre_parts) * 100;
    }
  }

  const { data: associate, error } = await supabase
    .from("entity_associates")
    .insert({
      legal_entity_id: data.legal_entity_id,
      profile_id: data.profile_id,
      parent_entity_id: data.parent_entity_id,
      civilite: data.civilite,
      nom: data.nom,
      prenom: data.prenom,
      date_naissance: data.date_naissance,
      adresse: data.adresse,
      denomination_sociale: data.denomination_sociale,
      siren_associe: data.siren_associe,
      nombre_parts: data.nombre_parts,
      pourcentage_capital: pourcentage,
      type_apport: data.type_apport,
      apport_initial: data.apport_initial,
      date_apport: data.date_apport,
      is_gerant: data.is_gerant ?? false,
      is_president: data.is_president ?? false,
      date_debut_mandat: data.date_debut_mandat,
      type_detention: data.type_detention ?? "pleine_propriete",
      is_current: true,
      date_entree: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating associate:", error);
    throw new Error(`Erreur: ${error.message}`);
  }

  return associate as EntityAssociate;
}

/**
 * Met à jour un associé
 */
export async function updateEntityAssociate(
  associateId: string,
  data: Partial<EntityAssociate>
): Promise<EntityAssociate> {
  const supabase = await createClient();

  const { data: associate, error } = await supabase
    .from("entity_associates")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", associateId)
    .select()
    .single();

  if (error) {
    throw new Error(`Erreur: ${error.message}`);
  }

  return associate as EntityAssociate;
}

/**
 * Fait sortir un associé (ne supprime pas, marque comme sorti)
 */
export async function removeEntityAssociate(
  associateId: string,
  motif?: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("entity_associates")
    .update({
      is_current: false,
      date_sortie: new Date().toISOString().split("T")[0],
      motif_sortie: motif,
      updated_at: new Date().toISOString(),
    })
    .eq("id", associateId);

  if (error) {
    throw new Error(`Erreur: ${error.message}`);
  }
}

// ============================================
// PROPERTY OWNERSHIP - CRUD
// ============================================

/**
 * Récupère les détenteurs d'un bien
 */
export async function getPropertyOwnership(
  propertyId: string,
  options?: {
    currentOnly?: boolean;
  }
): Promise<PropertyOwnershipWithDetails[]> {
  const supabase = await createClient();

  let query = supabase
    .from("property_ownership")
    .select(`
      *,
      legal_entity:legal_entities (
        nom,
        entity_type,
        regime_fiscal
      ),
      profile:profiles (
        prenom,
        nom
      )
    `)
    .eq("property_id", propertyId)
    .order("pourcentage_detention", { ascending: false });

  if (options?.currentOnly !== false) {
    query = query.eq("is_current", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching ownership:", error);
    throw new Error(`Erreur: ${error.message}`);
  }

  return data as PropertyOwnershipWithDetails[];
}

/**
 * Récupère les biens d'une entité juridique
 *
 * Combine deux sources de données :
 * 1. property_ownership (détentions explicites avec quote-part, acquisition, etc.)
 * 2. properties.legal_entity_id (lien direct, ex: biens créés via wizard sans ownership record)
 *
 * Les biens trouvés uniquement via properties.legal_entity_id sont renvoyés
 * comme des détentions synthétiques en pleine propriété.
 */
export async function getPropertiesByEntity(
  entityId: string
): Promise<PropertyOwnershipWithDetails[]> {
  const supabase = await createClient();

  // 1. Fetch explicit property_ownership records
  const { data: ownerships, error: ownershipError } = await supabase
    .from("property_ownership")
    .select(`
      *,
      property:properties (
        id,
        adresse_complete,
        ville,
        type,
        loyer_hc,
        surface
      )
    `)
    .eq("legal_entity_id", entityId)
    .eq("is_current", true)
    .order("date_acquisition", { ascending: false });

  if (ownershipError) {
    throw new Error(`Erreur: ${ownershipError.message}`);
  }

  // 2. Find properties linked via legal_entity_id but missing from property_ownership
  const ownershipPropertyIds = (ownerships || [])
    .map((o: Record<string, unknown>) => {
      const prop = o.property as Record<string, unknown> | null;
      return prop?.id as string | undefined;
    })
    .filter(Boolean) as string[];

  let directQuery = supabase
    .from("properties")
    .select("id, adresse_complete, ville, type, loyer_hc, surface")
    .eq("legal_entity_id", entityId)
    .is("deleted_at", null);

  if (ownershipPropertyIds.length > 0) {
    directQuery = directQuery.not("id", "in", `(${ownershipPropertyIds.join(",")})`);
  }

  const { data: directProperties } = await directQuery;

  // 3. Create synthetic ownership records for direct properties (default: pleine propriété 100%)
  const syntheticOwnerships: PropertyOwnershipWithDetails[] = (directProperties || []).map(
    (p: Record<string, unknown>) => ({
      id: `direct-${p.id as string}`,
      property_id: p.id as string,
      legal_entity_id: entityId,
      profile_id: null,
      quote_part_numerateur: 1,
      quote_part_denominateur: 1,
      pourcentage_detention: 100,
      detention_type: "pleine_propriete" as const,
      is_current: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      property: {
        id: p.id as string,
        adresse_complete: (p.adresse_complete as string) || "",
        ville: (p.ville as string) || "",
        type: (p.type as string) || "",
        loyer_hc: (p.loyer_hc as number) || null,
        surface: (p.surface as number) || null,
      },
    })
  );

  // 4. Merge: explicit ownerships first, then synthetic ones
  return [
    ...(ownerships as PropertyOwnershipWithDetails[]),
    ...syntheticOwnerships,
  ];
}

/**
 * Crée une nouvelle détention de propriété
 */
export async function createPropertyOwnership(
  data: CreatePropertyOwnershipDTO
): Promise<PropertyOwnership> {
  const supabase = await createClient();

  const { data: ownership, error } = await supabase
    .from("property_ownership")
    .insert({
      property_id: data.property_id,
      legal_entity_id: data.legal_entity_id,
      profile_id: data.profile_id,
      quote_part_numerateur: data.quote_part_numerateur ?? 1,
      quote_part_denominateur: data.quote_part_denominateur ?? 1,
      detention_type: data.detention_type,
      date_acquisition: data.date_acquisition,
      mode_acquisition: data.mode_acquisition,
      prix_acquisition: data.prix_acquisition,
      frais_acquisition: data.frais_acquisition,
      notaire_nom: data.notaire_nom,
      reference_acte: data.reference_acte,
      finance_par_emprunt: data.finance_par_emprunt ?? false,
      montant_emprunt: data.montant_emprunt,
      banque_emprunt: data.banque_emprunt,
      is_current: true,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating ownership:", error);
    throw new Error(`Erreur: ${error.message}`);
  }

  // Mettre à jour la propriété avec l'entité
  if (data.legal_entity_id) {
    await supabase
      .from("properties")
      .update({
        legal_entity_id: data.legal_entity_id,
        detention_mode: "societe",
      })
      .eq("id", data.property_id);
  }

  return ownership as PropertyOwnership;
}

/**
 * Transfère un bien à une autre entité.
 * Vérifie les baux actifs et met à jour signatory_entity_id si nécessaire.
 */
export async function transferPropertyOwnership(
  propertyId: string,
  fromEntityId: string | null,
  toEntityId: string,
  transferData: {
    date_cession: string;
    prix_cession?: number;
    mode_cession?: string;
    // Nouvelle acquisition
    prix_acquisition?: number;
    mode_acquisition?: string;
    notaire_nom?: string;
    reference_acte?: string;
    /** Si true, met à jour les baux actifs avec la nouvelle entité signataire */
    updateActiveLeases?: boolean;
  }
): Promise<void> {
  const supabase = await createClient();

  // Vérifier les baux en cours de signature (bloquant)
  if (fromEntityId) {
    const { count: pendingCount } = await supabase
      .from("leases")
      .select("id", { count: "exact", head: true })
      .eq("property_id", propertyId)
      .eq("signatory_entity_id", fromEntityId)
      .in("statut", ["pending_signature", "fully_signed"]);

    if (pendingCount && pendingCount > 0) {
      throw new Error(
        `Transfert impossible : ${pendingCount} bail(aux) en cours de signature sur ce bien. Finalisez ou annulez les signatures avant de transférer.`
      );
    }

    // Vérifier les baux actifs (avertissement mais autorisé avec flag)
    const { data: activeLeases, count: activeCount } = await supabase
      .from("leases")
      .select("id", { count: "exact" })
      .eq("property_id", propertyId)
      .eq("signatory_entity_id", fromEntityId)
      .eq("statut", "active");

    if (activeCount && activeCount > 0 && !transferData.updateActiveLeases) {
      throw new Error(
        `Ce bien a ${activeCount} bail(aux) actif(s) sous l'ancienne entité. ` +
        `Passez updateActiveLeases: true pour mettre à jour le signataire des baux.`
      );
    }

    // Mettre à jour les baux actifs si demandé
    if (activeLeases && activeLeases.length > 0 && transferData.updateActiveLeases) {
      const leaseIds = activeLeases.map((l) => l.id);
      await supabase
        .from("leases")
        .update({ signatory_entity_id: toEntityId })
        .in("id", leaseIds);
    }
  }

  // 1. Clôturer l'ancienne détention
  if (fromEntityId) {
    await supabase
      .from("property_ownership")
      .update({
        is_current: false,
        date_cession: transferData.date_cession,
        prix_cession: transferData.prix_cession,
        mode_cession: transferData.mode_cession as any,
        updated_at: new Date().toISOString(),
      })
      .eq("property_id", propertyId)
      .eq("legal_entity_id", fromEntityId)
      .eq("is_current", true);
  }

  // 2. Créer la nouvelle détention
  await createPropertyOwnership({
    property_id: propertyId,
    legal_entity_id: toEntityId,
    detention_type: "pleine_propriete",
    date_acquisition: transferData.date_cession,
    mode_acquisition: (transferData.mode_acquisition as "achat" | "apport" | "donation" | "succession" | "echange" | "construction" | "licitation" | undefined) ?? "apport",
    prix_acquisition: transferData.prix_acquisition,
    notaire_nom: transferData.notaire_nom,
    reference_acte: transferData.reference_acte,
  });
}

// ============================================
// UTILITAIRES
// ============================================

/**
 * Vérifie si une entité peut être supprimée
 */
export async function canDeleteEntity(
  entityId: string
): Promise<{ canDelete: boolean; reason?: string }> {
  const supabase = await createClient();

  // Vérifier les biens associés
  const { count: propertiesCount } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("legal_entity_id", entityId)
    .is("deleted_at", null);

  if (propertiesCount && propertiesCount > 0) {
    return {
      canDelete: false,
      reason: `${propertiesCount} bien(s) sont associés à cette entité`,
    };
  }

  // Vérifier les détentions actives (property_ownership)
  const { count: ownershipCount } = await supabase
    .from("property_ownership")
    .select("id", { count: "exact", head: true })
    .eq("legal_entity_id", entityId)
    .eq("is_current", true);

  if (ownershipCount && ownershipCount > 0) {
    return {
      canDelete: false,
      reason: "Des détentions de biens sont encore actives. Transférez-les d'abord.",
    };
  }

  // Vérifier les baux en cours
  const { count: leasesCount } = await supabase
    .from("leases")
    .select("id", { count: "exact", head: true })
    .eq("signatory_entity_id", entityId)
    .in("statut", ["active", "pending_signature", "fully_signed"]);

  if (leasesCount && leasesCount > 0) {
    return {
      canDelete: false,
      reason: `${leasesCount} bail(aux) actif(s) sont associés à cette entité. Vous pouvez désactiver l'entité à la place.`,
    };
  }

  // Vérifier les factures non payées
  const { count: invoicesCount } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("issuer_entity_id", entityId)
    .in("statut", ["draft", "sent", "overdue"]);

  if (invoicesCount && invoicesCount > 0) {
    return {
      canDelete: false,
      reason: `${invoicesCount} facture(s) impayée(s) sont émises par cette entité. Vous pouvez désactiver l'entité à la place.`,
    };
  }

  return { canDelete: true };
}

/**
 * Récupère le récapitulatif fiscal d'une entité
 */
export async function getEntityFiscalSummary(
  entityId: string,
  year: number
): Promise<{
  entity: LegalEntity;
  totalRent: number;
  totalCharges: number;
  netIncome: number;
  propertiesCount: number;
}> {
  const supabase = await createClient();

  // Récupérer l'entité
  const entity = await getLegalEntityById(entityId);
  if (!entity) {
    throw new Error("Entité non trouvée");
  }

  // Récupérer les revenus
  const { data: invoices } = await supabase
    .from("invoices")
    .select("montant_loyer, montant_charges")
    .eq("issuer_entity_id", entityId)
    .gte("periode", `${year}-01`)
    .lte("periode", `${year}-12`)
    .eq("statut", "paid");

  const totalRent = invoices?.reduce((sum, i) => sum + (i.montant_loyer || 0), 0) ?? 0;
  const totalCharges = invoices?.reduce((sum, i) => sum + (i.montant_charges || 0), 0) ?? 0;

  // Compter les biens — depuis properties.legal_entity_id (source de vérité)
  const { count: propertiesCount } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("legal_entity_id", entityId)
    .is("deleted_at", null);

  return {
    entity,
    totalRent,
    totalCharges,
    netIncome: totalRent - totalCharges,
    propertiesCount: propertiesCount ?? 0,
  };
}

/**
 * Recherche d'entités par SIREN/SIRET.
 * ownerProfileId est obligatoire pour éviter les fuites cross-tenant.
 */
export async function searchEntitiesBySiren(
  siren: string,
  ownerProfileId: string
): Promise<LegalEntity[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("legal_entities")
    .select("*")
    .eq("owner_profile_id", ownerProfileId)
    .or(`siren.eq.${siren},siret.ilike.${siren}%`);

  if (error) {
    throw new Error(`Erreur: ${error.message}`);
  }

  return data as LegalEntity[];
}

/**
 * Vérifie si un SIRET existe déjà (cross-tenant, pour détection de doublons globaux).
 * Retourne uniquement le nom de l'entité existante, pas de données sensibles.
 */
export async function checkSiretExists(
  siret: string,
  excludeEntityId?: string
): Promise<{ exists: boolean; entityName?: string }> {
  const supabase = await createClient();

  let query = supabase
    .from("legal_entities")
    .select("nom")
    .eq("siret", siret)
    .eq("is_active", true)
    .limit(1);

  if (excludeEntityId) {
    query = query.neq("id", excludeEntityId);
  }

  const { data } = await query.maybeSingle();

  return {
    exists: !!data,
    entityName: data?.nom as string | undefined,
  };
}

// ============================================
// EXPORTS
// ============================================

export const legalEntitiesService = {
  // Legal Entities
  getLegalEntities,
  getLegalEntityById,
  getLegalEntitiesWithStats,
  createLegalEntity,
  updateLegalEntity,
  deactivateLegalEntity,
  deleteLegalEntity,

  // Associates
  getEntityAssociates,
  createEntityAssociate,
  updateEntityAssociate,
  removeEntityAssociate,

  // Property Ownership
  getPropertyOwnership,
  getPropertiesByEntity,
  createPropertyOwnership,
  transferPropertyOwnership,

  // Utilities
  canDeleteEntity,
  getEntityFiscalSummary,
  searchEntitiesBySiren,
  checkSiretExists,
};

export default legalEntitiesService;
