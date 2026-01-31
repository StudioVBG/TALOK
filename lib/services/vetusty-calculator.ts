/**
 * Service de calcul de la vétusté
 *
 * Implémente la formule officielle de calcul de vétusté
 * conformément aux accords collectifs de location.
 *
 * Formule :
 * Taux de vétusté = min(
 *   ((Âge - Franchise) / (Durée de vie - Franchise)) × 100,
 *   Taux max
 * )
 *
 * Part locataire = Coût réparation × (1 - Taux de vétusté / 100)
 * Part locataire = max(Part locataire, Coût × Part résiduelle min)
 */

import {
  VETUSTY_GRID,
  VetustyGridItem,
  VetustyCalculationInput,
  VetustyCalculationResult,
  VetustyCategory,
  getVetustyItem,
  VETUSTY_CATEGORY_LABELS,
} from "@/lib/constants/vetusty-grid";

// ============================================
// TYPES ADDITIONNELS
// ============================================

export interface VetustyReportItem extends VetustyCalculationResult {
  is_degradation: boolean;
  is_normal_wear: boolean;
  notes?: string;
}

export interface VetustyReport {
  lease_id: string;
  edl_entry_id: string;
  edl_exit_id: string;
  edl_entry_date: string;
  edl_exit_date: string;
  lease_duration_years: number;
  items: VetustyReportItem[];
  summary: VetustySummary;
  generated_at: string;
}

export interface VetustySummary {
  total_items: number;
  total_repair_cost: number;
  total_owner_share: number;
  total_tenant_share: number;
  average_vetusty_rate: number;
  items_by_category: Record<VetustyCategory, CategorySummary>;
}

export interface CategorySummary {
  category: VetustyCategory;
  label: string;
  item_count: number;
  repair_cost: number;
  owner_share: number;
  tenant_share: number;
}

export interface BatchCalculationInput {
  items: VetustyCalculationInput[];
  lease_start_date: string;
  lease_end_date: string;
  edl_entry_date?: string;
  edl_exit_date?: string;
}

// ============================================
// FONCTIONS DE CALCUL PRINCIPALES
// ============================================

/**
 * Calcule le taux de vétusté pour un élément
 *
 * @param age_years - Âge de l'élément en années
 * @param lifespan_years - Durée de vie totale
 * @param franchise_years - Franchise (période sans dépréciation)
 * @param max_rate - Taux maximum de vétusté
 * @returns Taux de vétusté en pourcentage (0-100)
 */
export function calculateVetustyRate(
  age_years: number,
  lifespan_years: number,
  franchise_years: number,
  max_rate: number
): number {
  // Si l'élément est neuf ou dans la période de franchise
  if (age_years <= franchise_years) {
    return 0;
  }

  // Calcul du taux de vétusté linéaire
  const effectiveAge = age_years - franchise_years;
  const effectiveLifespan = lifespan_years - franchise_years;

  if (effectiveLifespan <= 0) {
    return max_rate;
  }

  const calculatedRate = (effectiveAge / effectiveLifespan) * 100;

  // Plafonner au taux maximum
  return Math.min(Math.round(calculatedRate * 100) / 100, max_rate);
}

/**
 * Calcule la répartition des coûts entre propriétaire et locataire
 *
 * @param repair_cost - Coût total de la réparation
 * @param vetusty_rate - Taux de vétusté (0-100)
 * @param min_tenant_share - Part résiduelle minimale du locataire (%)
 * @returns { owner_share, tenant_share }
 */
export function calculateCostShares(
  repair_cost: number,
  vetusty_rate: number,
  min_tenant_share: number
): { owner_share: number; tenant_share: number } {
  // Part du propriétaire = vétusté
  const ownerSharePercent = vetusty_rate;

  // Part du locataire = 100 - vétusté, mais au minimum min_tenant_share
  const tenantSharePercent = Math.max(100 - vetusty_rate, min_tenant_share);

  // Calcul des montants
  const owner_share = Math.round((repair_cost * ownerSharePercent) / 100 * 100) / 100;
  const tenant_share = Math.round((repair_cost * tenantSharePercent) / 100 * 100) / 100;

  // Ajustement pour que la somme = repair_cost (gestion des arrondis)
  const total = owner_share + tenant_share;
  if (total !== repair_cost) {
    // On ajuste la part propriétaire pour absorber la différence d'arrondi
    return {
      owner_share: Math.round((repair_cost - tenant_share) * 100) / 100,
      tenant_share,
    };
  }

  return { owner_share, tenant_share };
}

/**
 * Calcule la vétusté complète pour un élément
 */
export function calculateVetusty(input: VetustyCalculationInput): VetustyCalculationResult {
  const item = getVetustyItem(input.item_id);

  if (!item) {
    throw new Error(`Élément de vétusté inconnu: ${input.item_id}`);
  }

  const vetusty_rate = calculateVetustyRate(
    input.age_years,
    item.lifespan_years,
    item.franchise_years,
    item.max_vetusty_rate
  );

  const { owner_share, tenant_share } = calculateCostShares(
    input.repair_cost,
    vetusty_rate,
    item.min_tenant_share
  );

  // Génération du détail de calcul pour transparence
  const calculation_details = generateCalculationDetails(input, item, vetusty_rate);

  return {
    item_id: input.item_id,
    item_name: item.name,
    category: item.category,
    age_years: input.age_years,
    lifespan_years: item.lifespan_years,
    franchise_years: item.franchise_years,
    vetusty_rate,
    repair_cost: input.repair_cost,
    owner_share,
    tenant_share,
    calculation_details,
  };
}

/**
 * Calcule la vétusté pour plusieurs éléments
 */
export function calculateBatchVetusty(
  inputs: VetustyCalculationInput[]
): VetustyCalculationResult[] {
  return inputs.map((input) => calculateVetusty(input));
}

/**
 * Génère un rapport de vétusté complet
 */
export function generateVetustyReport(input: BatchCalculationInput): VetustyReport {
  const results = calculateBatchVetusty(input.items);

  // Calculer la durée du bail en années
  const leaseStart = new Date(input.lease_start_date);
  const leaseEnd = new Date(input.lease_end_date);
  const leaseDurationMs = leaseEnd.getTime() - leaseStart.getTime();
  const leaseDurationYears = Math.round((leaseDurationMs / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10;

  // Transformer en report items
  const reportItems: VetustyReportItem[] = results.map((result) => ({
    ...result,
    is_degradation: result.tenant_share > 0,
    is_normal_wear: result.vetusty_rate >= 50,
  }));

  // Générer le résumé
  const summary = generateSummary(reportItems);

  return {
    lease_id: "", // À remplir par l'appelant
    edl_entry_id: "", // À remplir par l'appelant
    edl_exit_id: "", // À remplir par l'appelant
    edl_entry_date: input.edl_entry_date || input.lease_start_date,
    edl_exit_date: input.edl_exit_date || input.lease_end_date,
    lease_duration_years: leaseDurationYears,
    items: reportItems,
    summary,
    generated_at: new Date().toISOString(),
  };
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Génère le détail du calcul pour affichage
 */
function generateCalculationDetails(
  input: VetustyCalculationInput,
  item: VetustyGridItem,
  vetusty_rate: number
): string {
  const lines: string[] = [];

  lines.push(`Élément : ${item.name}`);
  lines.push(`Catégorie : ${VETUSTY_CATEGORY_LABELS[item.category]}`);
  lines.push(`---`);
  lines.push(`Durée de vie : ${item.lifespan_years} ans`);
  lines.push(`Franchise : ${item.franchise_years} ans`);
  lines.push(`Âge constaté : ${input.age_years} ans`);
  lines.push(`---`);

  if (input.age_years <= item.franchise_years) {
    lines.push(`Dans la période de franchise → Vétusté = 0%`);
  } else {
    const effectiveAge = input.age_years - item.franchise_years;
    const effectiveLifespan = item.lifespan_years - item.franchise_years;
    const rawRate = (effectiveAge / effectiveLifespan) * 100;

    lines.push(`Calcul : (${effectiveAge} / ${effectiveLifespan}) × 100 = ${rawRate.toFixed(2)}%`);

    if (rawRate > item.max_vetusty_rate) {
      lines.push(`Plafonné à ${item.max_vetusty_rate}%`);
    }
  }

  lines.push(`---`);
  lines.push(`Taux de vétusté appliqué : ${vetusty_rate}%`);
  lines.push(`Part résiduelle min locataire : ${item.min_tenant_share}%`);

  return lines.join("\n");
}

/**
 * Génère le résumé du rapport
 */
function generateSummary(items: VetustyReportItem[]): VetustySummary {
  const total_items = items.length;
  const total_repair_cost = items.reduce((sum, item) => sum + item.repair_cost, 0);
  const total_owner_share = items.reduce((sum, item) => sum + item.owner_share, 0);
  const total_tenant_share = items.reduce((sum, item) => sum + item.tenant_share, 0);

  // Moyenne pondérée par le coût
  const weighted_vetusty = items.reduce(
    (sum, item) => sum + item.vetusty_rate * item.repair_cost,
    0
  );
  const average_vetusty_rate =
    total_repair_cost > 0 ? Math.round((weighted_vetusty / total_repair_cost) * 100) / 100 : 0;

  // Résumé par catégorie
  const items_by_category: Record<VetustyCategory, CategorySummary> = {} as Record<
    VetustyCategory,
    CategorySummary
  >;

  const categories = [...new Set(items.map((item) => item.category))];

  for (const category of categories) {
    const categoryItems = items.filter((item) => item.category === category);
    items_by_category[category] = {
      category,
      label: VETUSTY_CATEGORY_LABELS[category],
      item_count: categoryItems.length,
      repair_cost: categoryItems.reduce((sum, item) => sum + item.repair_cost, 0),
      owner_share: categoryItems.reduce((sum, item) => sum + item.owner_share, 0),
      tenant_share: categoryItems.reduce((sum, item) => sum + item.tenant_share, 0),
    };
  }

  return {
    total_items,
    total_repair_cost: Math.round(total_repair_cost * 100) / 100,
    total_owner_share: Math.round(total_owner_share * 100) / 100,
    total_tenant_share: Math.round(total_tenant_share * 100) / 100,
    average_vetusty_rate,
    items_by_category,
  };
}

/**
 * Estime l'âge d'un élément basé sur les dates
 *
 * @param installation_date - Date d'installation ou de dernière rénovation
 * @param reference_date - Date de référence (EDL sortie)
 * @returns Âge en années (arrondi au dixième)
 */
export function estimateAge(installation_date: string, reference_date: string): number {
  const install = new Date(installation_date);
  const reference = new Date(reference_date);
  const diffMs = reference.getTime() - install.getTime();
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(diffYears * 10) / 10;
}

/**
 * Estime l'âge basé sur la durée du bail si pas d'info sur l'installation
 * Hypothèse : élément installé au début du bail
 */
export function estimateAgeFromLease(
  lease_start_date: string,
  lease_end_date: string,
  is_new_at_entry: boolean = false
): number {
  if (is_new_at_entry) {
    return estimateAge(lease_start_date, lease_end_date);
  }

  // Si pas neuf à l'entrée, on ajoute une estimation
  // Par défaut, on considère l'élément comme ayant 3 ans d'âge à l'entrée
  const leaseDuration = estimateAge(lease_start_date, lease_end_date);
  return leaseDuration + 3; // Hypothèse conservative
}

/**
 * Suggère les éléments de vétusté pertinents pour une pièce donnée
 */
export function suggestVetustyItemsForRoom(
  roomType: string
): VetustyGridItem[] {
  const suggestions: string[] = [];

  // Éléments communs à toutes les pièces
  const commonItems = [
    "peinture_standard",
    "interrupteur_prise",
    "porte_interieure",
  ];

  suggestions.push(...commonItems);

  switch (roomType.toLowerCase()) {
    case "sejour":
    case "salon":
    case "chambre":
      suggestions.push(
        "parquet_stratifie",
        "parquet_massif",
        "moquette",
        "stores_interieurs",
        "radiateur_electrique"
      );
      break;

    case "cuisine":
      suggestions.push(
        "carrelage_sol",
        "faience_murale",
        "peinture_lessivable",
        "plan_travail",
        "evier",
        "meubles_cuisine",
        "plaque_cuisson",
        "four",
        "hotte",
        "robinetterie_standard"
      );
      break;

    case "salle_de_bain":
    case "sdb":
      suggestions.push(
        "carrelage_sol",
        "faience_murale",
        "peinture_lessivable",
        "lavabo",
        "robinetterie_standard",
        "robinetterie_thermostatique",
        "douche_receveur",
        "paroi_douche",
        "baignoire",
        "meuble_sdb",
        "miroir_sdb",
        "seche_serviette",
        "vmc"
      );
      break;

    case "wc":
    case "toilettes":
      suggestions.push(
        "carrelage_sol",
        "faience_murale",
        "wc_ceramique",
        "abattant_wc",
        "vmc"
      );
      break;

    case "entree":
    case "couloir":
      suggestions.push("carrelage_sol", "lino_pvc", "placards_integres");
      break;

    case "balcon":
    case "terrasse":
      suggestions.push("terrasse_bois", "store_banne");
      break;

    default:
      // Retourner les éléments communs uniquement
      break;
  }

  return suggestions
    .map((id) => getVetustyItem(id))
    .filter((item): item is VetustyGridItem => item !== undefined);
}

/**
 * Formate un montant en euros
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Formate un taux en pourcentage
 */
export function formatPercentage(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

// ============================================
// EXPORTS
// ============================================

export {
  VetustyGridItem,
  VetustyCalculationInput,
  VetustyCalculationResult,
  VetustyCategory,
} from "@/lib/constants/vetusty-grid";
