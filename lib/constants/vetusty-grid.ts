/**
 * Grille de Vétusté - Conformité aux accords collectifs de location
 *
 * Basé sur les grilles types des accords collectifs (ex: ANIL, FNAIM, UNPI)
 * La vétusté est la dépréciation d'un bien due à l'usage normal dans le temps.
 *
 * Références légales :
 * - Loi ALUR du 24 mars 2014 (art. 7-1)
 * - Décret du 30 mars 2016 (état des lieux)
 * - Accords collectifs locaux de location
 *
 * Formule de calcul :
 * Vétusté = (Âge de l'élément - Franchise) / (Durée de vie - Franchise) × 100
 * Retenue locataire = Coût réparation × (1 - Taux de vétusté)
 */

// ============================================
// TYPES
// ============================================

export type VetustyCategory =
  | "revetements_muraux"
  | "revetements_sols"
  | "menuiseries"
  | "plomberie"
  | "electricite"
  | "chauffage"
  | "equipements_cuisine"
  | "equipements_sdb"
  | "mobilier"
  | "exterieur";

export type VetustyItemCondition =
  | "neuf"
  | "bon"
  | "usage_normal"
  | "usage_intensif"
  | "vetuste";

export interface VetustyGridItem {
  id: string;
  category: VetustyCategory;
  name: string;
  description: string;
  /** Durée de vie en années */
  lifespan_years: number;
  /** Franchise en années (période sans dépréciation) */
  franchise_years: number;
  /** Taux de vétusté annuel après franchise (%) */
  annual_rate: number;
  /** Taux de vétusté maximum applicable (%) */
  max_vetusty_rate: number;
  /** Part résiduelle minimale à charge du locataire (%) */
  min_tenant_share: number;
}

export interface VetustyCalculationInput {
  item_id: string;
  /** Âge de l'élément en années (depuis dernière rénovation/installation) */
  age_years: number;
  /** Coût de la réparation ou remplacement (€) */
  repair_cost: number;
  /** Condition constatée à la sortie */
  condition_at_exit?: VetustyItemCondition;
}

export interface VetustyCalculationResult {
  item_id: string;
  item_name: string;
  category: VetustyCategory;
  age_years: number;
  lifespan_years: number;
  franchise_years: number;
  /** Taux de vétusté calculé (0-100%) */
  vetusty_rate: number;
  /** Coût total de la réparation */
  repair_cost: number;
  /** Part à charge du propriétaire (vétusté) */
  owner_share: number;
  /** Part à charge du locataire (dégradation) */
  tenant_share: number;
  /** Détail du calcul pour transparence */
  calculation_details: string;
}

// ============================================
// GRILLE DE VÉTUSTÉ OFFICIELLE
// ============================================

/**
 * Grille de vétusté basée sur les accords collectifs types
 * Sources : ANIL, FNAIM, UNPI, accords locaux
 */
export const VETUSTY_GRID: VetustyGridItem[] = [
  // ============================================
  // REVÊTEMENTS MURAUX
  // ============================================
  {
    id: "peinture_standard",
    category: "revetements_muraux",
    name: "Peinture murale standard",
    description: "Peinture acrylique ou glycéro standard",
    lifespan_years: 7,
    franchise_years: 1,
    annual_rate: 15,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "peinture_lessivable",
    category: "revetements_muraux",
    name: "Peinture lessivable / laquée",
    description: "Peinture haute résistance, cuisine, SDB",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "papier_peint",
    category: "revetements_muraux",
    name: "Papier peint",
    description: "Papier peint standard ou vinyle",
    lifespan_years: 7,
    franchise_years: 1,
    annual_rate: 15,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "faience_murale",
    category: "revetements_muraux",
    name: "Faïence / Carrelage mural",
    description: "Carrelage mural cuisine, SDB",
    lifespan_years: 20,
    franchise_years: 5,
    annual_rate: 6,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "lambris",
    category: "revetements_muraux",
    name: "Lambris bois ou PVC",
    description: "Revêtement mural en lambris",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },

  // ============================================
  // REVÊTEMENTS SOLS
  // ============================================
  {
    id: "moquette",
    category: "revetements_sols",
    name: "Moquette",
    description: "Moquette standard ou épaisse",
    lifespan_years: 7,
    franchise_years: 1,
    annual_rate: 15,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "parquet_massif",
    category: "revetements_sols",
    name: "Parquet massif",
    description: "Parquet bois massif (hors vitrification)",
    lifespan_years: 25,
    franchise_years: 5,
    annual_rate: 4,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "parquet_stratifie",
    category: "revetements_sols",
    name: "Parquet stratifié / flottant",
    description: "Sol stratifié, parquet contrecollé",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "vitrification_parquet",
    category: "revetements_sols",
    name: "Vitrification parquet",
    description: "Vitrification ou huile parquet",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "carrelage_sol",
    category: "revetements_sols",
    name: "Carrelage sol",
    description: "Carrelage céramique ou grès",
    lifespan_years: 20,
    franchise_years: 5,
    annual_rate: 6,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "lino_pvc",
    category: "revetements_sols",
    name: "Linoléum / Sol PVC",
    description: "Revêtement souple PVC ou lino",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "jonc_mer_sisal",
    category: "revetements_sols",
    name: "Jonc de mer / Sisal",
    description: "Revêtement naturel",
    lifespan_years: 7,
    franchise_years: 1,
    annual_rate: 15,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },

  // ============================================
  // MENUISERIES
  // ============================================
  {
    id: "porte_interieure",
    category: "menuiseries",
    name: "Porte intérieure",
    description: "Porte intérieure bois ou composite",
    lifespan_years: 20,
    franchise_years: 5,
    annual_rate: 6,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "porte_entree",
    category: "menuiseries",
    name: "Porte d'entrée",
    description: "Porte palière blindée ou standard",
    lifespan_years: 25,
    franchise_years: 5,
    annual_rate: 4,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "fenetre_bois",
    category: "menuiseries",
    name: "Fenêtre bois",
    description: "Menuiserie bois simple ou double vitrage",
    lifespan_years: 25,
    franchise_years: 5,
    annual_rate: 4,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "fenetre_pvc_alu",
    category: "menuiseries",
    name: "Fenêtre PVC / Aluminium",
    description: "Menuiserie PVC ou alu double vitrage",
    lifespan_years: 25,
    franchise_years: 5,
    annual_rate: 4,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "volets_roulants",
    category: "menuiseries",
    name: "Volets roulants",
    description: "Volets roulants manuels ou électriques",
    lifespan_years: 20,
    franchise_years: 5,
    annual_rate: 6,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "volets_battants",
    category: "menuiseries",
    name: "Volets battants",
    description: "Volets battants bois, PVC ou alu",
    lifespan_years: 25,
    franchise_years: 5,
    annual_rate: 4,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "stores_interieurs",
    category: "menuiseries",
    name: "Stores intérieurs",
    description: "Stores vénitiens, enrouleurs, californiens",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "placards_integres",
    category: "menuiseries",
    name: "Placards intégrés",
    description: "Placards et rangements intégrés",
    lifespan_years: 20,
    franchise_years: 5,
    annual_rate: 6,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },

  // ============================================
  // PLOMBERIE
  // ============================================
  {
    id: "robinetterie_standard",
    category: "plomberie",
    name: "Robinetterie standard",
    description: "Mitigeur, mélangeur standard",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "robinetterie_thermostatique",
    category: "plomberie",
    name: "Robinetterie thermostatique",
    description: "Mitigeur thermostatique douche/baignoire",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "wc_ceramique",
    category: "plomberie",
    name: "WC céramique",
    description: "Cuvette et réservoir WC",
    lifespan_years: 25,
    franchise_years: 5,
    annual_rate: 4,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "abattant_wc",
    category: "plomberie",
    name: "Abattant WC",
    description: "Abattant et lunette WC",
    lifespan_years: 7,
    franchise_years: 1,
    annual_rate: 15,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "lavabo",
    category: "plomberie",
    name: "Lavabo / Vasque",
    description: "Lavabo céramique ou vasque",
    lifespan_years: 20,
    franchise_years: 5,
    annual_rate: 6,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "baignoire",
    category: "plomberie",
    name: "Baignoire",
    description: "Baignoire fonte, acrylique ou acier",
    lifespan_years: 25,
    franchise_years: 5,
    annual_rate: 4,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "douche_receveur",
    category: "plomberie",
    name: "Receveur de douche",
    description: "Bac à douche céramique ou résine",
    lifespan_years: 20,
    franchise_years: 5,
    annual_rate: 6,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "paroi_douche",
    category: "plomberie",
    name: "Paroi de douche",
    description: "Paroi fixe ou coulissante",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "chauffe_eau",
    category: "plomberie",
    name: "Chauffe-eau électrique",
    description: "Cumulus électrique",
    lifespan_years: 12,
    franchise_years: 3,
    annual_rate: 10,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },

  // ============================================
  // ÉLECTRICITÉ
  // ============================================
  {
    id: "interrupteur_prise",
    category: "electricite",
    name: "Interrupteurs / Prises",
    description: "Appareillage électrique standard",
    lifespan_years: 20,
    franchise_years: 5,
    annual_rate: 6,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "tableau_electrique",
    category: "electricite",
    name: "Tableau électrique",
    description: "Tableau et disjoncteurs",
    lifespan_years: 30,
    franchise_years: 10,
    annual_rate: 4,
    max_vetusty_rate: 75,
    min_tenant_share: 25,
  },
  {
    id: "luminaire_plafonnier",
    category: "electricite",
    name: "Luminaires / Plafonniers",
    description: "Éclairage fixe fourni par le bailleur",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "vmc",
    category: "electricite",
    name: "VMC",
    description: "Ventilation mécanique contrôlée",
    lifespan_years: 20,
    franchise_years: 5,
    annual_rate: 6,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "interphone_digicode",
    category: "electricite",
    name: "Interphone / Digicode",
    description: "Système d'accès privatif",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },

  // ============================================
  // CHAUFFAGE
  // ============================================
  {
    id: "radiateur_electrique",
    category: "chauffage",
    name: "Radiateur électrique",
    description: "Convecteur, panneau rayonnant, inertie",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "radiateur_eau",
    category: "chauffage",
    name: "Radiateur eau chaude",
    description: "Radiateur fonte ou acier",
    lifespan_years: 25,
    franchise_years: 5,
    annual_rate: 4,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "chaudiere_gaz",
    category: "chauffage",
    name: "Chaudière gaz",
    description: "Chaudière murale ou au sol",
    lifespan_years: 15,
    franchise_years: 5,
    annual_rate: 8,
    max_vetusty_rate: 75,
    min_tenant_share: 25,
  },
  {
    id: "climatisation",
    category: "chauffage",
    name: "Climatisation",
    description: "Split, réversible, gainable",
    lifespan_years: 12,
    franchise_years: 3,
    annual_rate: 10,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "thermostat",
    category: "chauffage",
    name: "Thermostat",
    description: "Thermostat programmable ou connecté",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },

  // ============================================
  // ÉQUIPEMENTS CUISINE
  // ============================================
  {
    id: "plan_travail",
    category: "equipements_cuisine",
    name: "Plan de travail",
    description: "Plan de travail stratifié ou pierre",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "evier",
    category: "equipements_cuisine",
    name: "Évier",
    description: "Évier inox, résine ou céramique",
    lifespan_years: 20,
    franchise_years: 5,
    annual_rate: 6,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "meubles_cuisine",
    category: "equipements_cuisine",
    name: "Meubles de cuisine",
    description: "Éléments hauts et bas",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "plaque_cuisson",
    category: "equipements_cuisine",
    name: "Plaques de cuisson",
    description: "Plaques gaz, vitro ou induction",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "four",
    category: "equipements_cuisine",
    name: "Four encastrable",
    description: "Four traditionnel ou multifonction",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "hotte",
    category: "equipements_cuisine",
    name: "Hotte aspirante",
    description: "Hotte extraction ou recyclage",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "refrigerateur",
    category: "equipements_cuisine",
    name: "Réfrigérateur",
    description: "Réfrigérateur avec congélateur",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "lave_vaisselle",
    category: "equipements_cuisine",
    name: "Lave-vaisselle",
    description: "Lave-vaisselle intégrable ou pose libre",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },

  // ============================================
  // ÉQUIPEMENTS SDB
  // ============================================
  {
    id: "meuble_sdb",
    category: "equipements_sdb",
    name: "Meuble de salle de bain",
    description: "Meuble vasque et rangements",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "miroir_sdb",
    category: "equipements_sdb",
    name: "Miroir salle de bain",
    description: "Miroir simple ou avec éclairage",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "seche_serviette",
    category: "equipements_sdb",
    name: "Sèche-serviettes",
    description: "Radiateur sèche-serviettes",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "lave_linge",
    category: "equipements_sdb",
    name: "Lave-linge",
    description: "Machine à laver fournie",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },

  // ============================================
  // MOBILIER (Meublé)
  // ============================================
  {
    id: "lit_matelas",
    category: "mobilier",
    name: "Lit et matelas",
    description: "Literie complète (sommier + matelas)",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "canape",
    category: "mobilier",
    name: "Canapé / Fauteuil",
    description: "Mobilier de salon",
    lifespan_years: 10,
    franchise_years: 2,
    annual_rate: 12,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },
  {
    id: "table_chaises",
    category: "mobilier",
    name: "Table et chaises",
    description: "Ensemble repas",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "bureau",
    category: "mobilier",
    name: "Bureau",
    description: "Bureau et chaise de bureau",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "commode_armoire",
    category: "mobilier",
    name: "Commode / Armoire",
    description: "Rangements chambre",
    lifespan_years: 20,
    franchise_years: 5,
    annual_rate: 6,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "rideaux_voilages",
    category: "mobilier",
    name: "Rideaux / Voilages",
    description: "Occultation textile",
    lifespan_years: 7,
    franchise_years: 1,
    annual_rate: 15,
    max_vetusty_rate: 85,
    min_tenant_share: 15,
  },

  // ============================================
  // EXTÉRIEUR
  // ============================================
  {
    id: "portail_cloture",
    category: "exterieur",
    name: "Portail / Clôture",
    description: "Portail et clôture privatifs",
    lifespan_years: 25,
    franchise_years: 5,
    annual_rate: 4,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "terrasse_bois",
    category: "exterieur",
    name: "Terrasse bois",
    description: "Lames de terrasse composite ou bois",
    lifespan_years: 15,
    franchise_years: 3,
    annual_rate: 8,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
  {
    id: "store_banne",
    category: "exterieur",
    name: "Store banne",
    description: "Store extérieur rétractable",
    lifespan_years: 12,
    franchise_years: 3,
    annual_rate: 10,
    max_vetusty_rate: 80,
    min_tenant_share: 20,
  },
];

// ============================================
// LABELS ET HELPERS
// ============================================

export const VETUSTY_CATEGORY_LABELS: Record<VetustyCategory, string> = {
  revetements_muraux: "Revêtements muraux",
  revetements_sols: "Revêtements de sols",
  menuiseries: "Menuiseries",
  plomberie: "Plomberie / Sanitaires",
  electricite: "Électricité",
  chauffage: "Chauffage / Climatisation",
  equipements_cuisine: "Équipements cuisine",
  equipements_sdb: "Équipements salle de bain",
  mobilier: "Mobilier (meublé)",
  exterieur: "Extérieur",
};

export const VETUSTY_CATEGORY_ICONS: Record<VetustyCategory, string> = {
  revetements_muraux: "🎨",
  revetements_sols: "🏠",
  menuiseries: "🚪",
  plomberie: "🚿",
  electricite: "💡",
  chauffage: "🌡️",
  equipements_cuisine: "🍳",
  equipements_sdb: "🛁",
  mobilier: "🛋️",
  exterieur: "🌳",
};

/**
 * Récupère un élément de la grille par son ID
 */
export function getVetustyItem(itemId: string): VetustyGridItem | undefined {
  return VETUSTY_GRID.find((item) => item.id === itemId);
}

/**
 * Récupère tous les éléments d'une catégorie
 */
export function getVetustyItemsByCategory(category: VetustyCategory): VetustyGridItem[] {
  return VETUSTY_GRID.filter((item) => item.category === category);
}

/**
 * Récupère les catégories disponibles avec leur nombre d'éléments
 */
export function getVetustyCategories(): { category: VetustyCategory; label: string; icon: string; count: number }[] {
  const categories = Object.keys(VETUSTY_CATEGORY_LABELS) as VetustyCategory[];
  return categories.map((category) => ({
    category,
    label: VETUSTY_CATEGORY_LABELS[category],
    icon: VETUSTY_CATEGORY_ICONS[category],
    count: getVetustyItemsByCategory(category).length,
  }));
}
