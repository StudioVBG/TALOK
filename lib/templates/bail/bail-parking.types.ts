/**
 * Types pour les contrats de location de parking
 * Conforme à la réglementation française (Code civil, articles 1709 et suivants)
 * 
 * Note juridique : Le contrat de parking n'est pas soumis à la loi du 6 juillet 1989
 * Il relève du droit commun des baux (Code civil)
 */

// ============================================
// TYPES DE PARKING
// ============================================

export type ParkingCategory = 
  | 'place_exterieure'      // Place en plein air
  | 'place_couverte'        // Place sous abri/toit
  | 'box_ferme'             // Box individuel fermé
  | 'garage_individuel'     // Garage privatif
  | 'souterrain'            // Place en sous-sol
  | 'aerien'                // Parking en étage (silo)
  | 'deux_roues';           // Emplacement moto/vélo

export type VehicleType = 
  | 'voiture_citadine'
  | 'voiture_berline'
  | 'voiture_suv'
  | 'utilitaire_leger'      // Fourgonnette
  | 'camping_car'
  | 'moto'
  | 'scooter'
  | 'velo'
  | 'velo_electrique'
  | 'trottinette';

export type AccessMethod = 
  | 'badge_rfid'
  | 'telecommande'
  | 'cle_physique'
  | 'digicode'
  | 'biometrie'
  | 'plaque_immatriculation'  // Lecture automatique
  | 'acces_libre';

export type SecurityFeature = 
  | 'barriere_automatique'
  | 'portail_securise'
  | 'video_surveillance'
  | 'gardiennage_24h'
  | 'gardiennage_jour'
  | 'eclairage_permanent'
  | 'detecteur_mouvement'
  | 'alarme_intrusion'
  | 'interphone'
  | 'residence_fermee';

// ============================================
// SPÉCIFICATIONS PARKING
// ============================================

export interface ParkingSpecifications {
  category: ParkingCategory;
  vehicleType: VehicleType;
  
  // Dimensions
  dimensions?: {
    longueur_m?: number;      // Longueur en mètres
    largeur_m?: number;       // Largeur en mètres
    hauteur_max_m?: number;   // Hauteur max (souterrain/box)
  };
  
  // Localisation
  location: {
    numero?: string;          // N° de l'emplacement
    niveau?: string;          // Étage/niveau (-1, 0, +1...)
    zone?: string;            // Zone A, B, C...
    batiment?: string;        // Bâtiment si résidence
    repere_visuel?: string;   // "Près de l'ascenseur", etc.
  };
  
  // Caractéristiques
  features: {
    couvert: boolean;
    ferme: boolean;           // Box avec porte
    eclaire: boolean;
    prise_electrique: boolean;     // Pour recharge VE
    borne_recharge_ve: boolean;    // Borne de recharge installée
    eau_disponible: boolean;       // Point d'eau
    local_rangement: boolean;      // Espace de rangement additionnel
  };
  
  // Accès et sécurité
  access: AccessMethod[];
  security: SecurityFeature[];
  
  // Horaires d'accès (si limités)
  accessHours?: {
    restricted: boolean;
    schedule?: string;        // "7h-22h" ou "24h/24"
    weekendAccess?: boolean;
  };
}

// ============================================
// CONDITIONS SPÉCIFIQUES PARKING
// ============================================

export interface ParkingLeaseConditions {
  // Type de location
  locationType: 'independant' | 'accessoire_logement';
  
  // Si accessoire à un logement
  linkedPropertyId?: string;
  
  // Durée
  duration: {
    type: 'indeterminee' | 'determinee';
    months?: number;          // Si déterminée
    startDate: string;
    endDate?: string;
  };
  
  // Préavis
  noticePeriod: {
    landlordMonths: number;   // Préavis du propriétaire (min 1 mois)
    tenantMonths: number;     // Préavis du locataire (min 1 mois)
  };
  
  // Financier
  financial: {
    rentMonthly: number;      // Loyer mensuel HT
    rentIncludesVAT: boolean; // TVA applicable si parking commercial
    vatRate?: number;         // Taux TVA si applicable
    chargesMonthly: number;   // Charges (si applicable)
    chargesType: 'forfait' | 'provisions' | 'incluses';
    deposit: number;          // Dépôt de garantie
    depositMonths: number;    // Équivalent en mois de loyer
  };
  
  // Paiement
  payment: {
    method: 'virement' | 'prelevement' | 'cheque' | 'especes';
    dayOfMonth: number;       // Jour de paiement (1-28)
    inAdvance: boolean;       // Terme à échoir ou échu
  };
  
  // Révision du loyer
  rentRevision: {
    allowed: boolean;
    index?: 'IRL' | 'ILC' | 'ICC';  // Indice de révision
    frequency?: 'annuelle';
  };
  
  // Assurance
  insurance: {
    tenantRequired: boolean;  // Assurance locataire obligatoire
    vehicleInsuranceRequired: boolean;
    responsabiliteCivile: boolean;
  };
  
  // Usage
  usage: {
    allowedVehicles: VehicleType[];
    storageAllowed: boolean;      // Stockage d'objets autorisé
    workshopForbidden: boolean;   // Interdiction travaux mécaniques
    commercialUseForbidden: boolean;
    sublettingAllowed: boolean;
  };
}

// ============================================
// PARTIES DU CONTRAT
// ============================================

export interface ParkingOwner {
  type: 'particulier' | 'societe' | 'copropriete';
  
  // Particulier
  civility?: 'M.' | 'Mme' | 'M. et Mme';
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  
  // Société
  companyName?: string;
  legalForm?: string;         // SARL, SCI, etc.
  siret?: string;
  representativeName?: string;
  representativeRole?: string;
  
  // Commun
  address: string;
  postalCode: string;
  city: string;
  phone?: string;
  email?: string;
}

export interface ParkingTenant {
  type: 'particulier' | 'societe';
  
  // Particulier
  civility?: 'M.' | 'Mme';
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  nationality?: string;
  
  // Société
  companyName?: string;
  legalForm?: string;
  siret?: string;
  representativeName?: string;
  
  // Commun
  currentAddress: string;
  postalCode: string;
  city: string;
  phone?: string;
  email?: string;
  
  // Véhicule principal
  vehicleInfo?: {
    type: VehicleType;
    brand?: string;
    model?: string;
    licensePlate: string;
    color?: string;
  };
}

// ============================================
// CONTRAT COMPLET
// ============================================

export interface ParkingLease {
  // Métadonnées
  reference: string;
  createdAt: string;
  statut: 'draft' | 'pending_signature' | 'active' | 'terminated' | 'expired';
  
  // Parties
  owner: ParkingOwner;
  tenant: ParkingTenant;
  
  // Bien
  parking: {
    propertyId?: string;      // Lien avec properties table
    address: string;
    postalCode: string;
    city: string;
    specifications: ParkingSpecifications;
  };
  
  // Conditions
  conditions: ParkingLeaseConditions;
  
  // Clauses particulières
  specialClauses?: string[];
  
  // Signatures
  signatures?: {
    owner?: { signedAt: string; signature?: string };
    tenant?: { signedAt: string; signature?: string };
  };
}

// ============================================
// PRESETS PAR TYPE DE PARKING
// ============================================

export interface ParkingPreset {
  category: ParkingCategory;
  label: string;
  icon: string;
  description: string;
  defaultConditions: Partial<ParkingLeaseConditions>;
  suggestedRent: { min: number; max: number };  // Fourchette indicative
  commonFeatures: Partial<ParkingSpecifications['features']>;
  commonSecurity: SecurityFeature[];
}

export const PARKING_PRESETS: ParkingPreset[] = [
  {
    category: 'place_exterieure',
    label: 'Place extérieure',
    icon: '🚗',
    description: 'Place de parking en plein air, non couverte',
    defaultConditions: {
      noticePeriod: { landlordMonths: 1, tenantMonths: 1 },
      financial: {
        rentMonthly: 50,
        rentIncludesVAT: false,
        chargesMonthly: 0,
        chargesType: 'incluses',
        deposit: 50,
        depositMonths: 1,
      },
    } as any,
    suggestedRent: { min: 30, max: 100 },
    commonFeatures: {
      couvert: false,
      ferme: false,
      eclaire: true,
      prise_electrique: false,
      borne_recharge_ve: false,
    },
    commonSecurity: ['eclairage_permanent'],
  },
  {
    category: 'place_couverte',
    label: 'Place couverte',
    icon: '🏢',
    description: 'Place sous abri ou toit, protégée des intempéries',
    defaultConditions: {
      noticePeriod: { landlordMonths: 1, tenantMonths: 1 },
      financial: {
        rentMonthly: 80,
        rentIncludesVAT: false,
        chargesMonthly: 5,
        chargesType: 'forfait',
        deposit: 80,
        depositMonths: 1,
      },
    } as any,
    suggestedRent: { min: 60, max: 150 },
    commonFeatures: {
      couvert: true,
      ferme: false,
      eclaire: true,
      prise_electrique: false,
    },
    commonSecurity: ['eclairage_permanent', 'video_surveillance'],
  },
  {
    category: 'box_ferme',
    label: 'Box fermé',
    icon: '🔐',
    description: 'Box individuel avec porte fermée à clé',
    defaultConditions: {
      noticePeriod: { landlordMonths: 2, tenantMonths: 1 },
      financial: {
        rentMonthly: 120,
        rentIncludesVAT: false,
        chargesMonthly: 10,
        chargesType: 'forfait',
        deposit: 120,
        depositMonths: 1,
      },
    } as any,
    suggestedRent: { min: 80, max: 250 },
    commonFeatures: {
      couvert: true,
      ferme: true,
      eclaire: true,
      prise_electrique: true,
    },
    commonSecurity: ['video_surveillance', 'portail_securise'],
  },
  {
    category: 'garage_individuel',
    label: 'Garage individuel',
    icon: '🏠',
    description: 'Garage privatif indépendant avec porte',
    defaultConditions: {
      noticePeriod: { landlordMonths: 3, tenantMonths: 1 },
      financial: {
        rentMonthly: 150,
        rentIncludesVAT: false,
        chargesMonthly: 15,
        chargesType: 'forfait',
        deposit: 150,
        depositMonths: 1,
      },
    } as any,
    suggestedRent: { min: 100, max: 350 },
    commonFeatures: {
      couvert: true,
      ferme: true,
      eclaire: true,
      prise_electrique: true,
      eau_disponible: false,
    },
    commonSecurity: ['portail_securise'],
  },
  {
    category: 'souterrain',
    label: 'Parking souterrain',
    icon: '⬇️',
    description: 'Place en sous-sol, hauteur limitée',
    defaultConditions: {
      noticePeriod: { landlordMonths: 1, tenantMonths: 1 },
      financial: {
        rentMonthly: 100,
        rentIncludesVAT: false,
        chargesMonthly: 10,
        chargesType: 'forfait',
        deposit: 100,
        depositMonths: 1,
      },
    } as any,
    suggestedRent: { min: 70, max: 200 },
    commonFeatures: {
      couvert: true,
      ferme: false,
      eclaire: true,
    },
    commonSecurity: ['barriere_automatique', 'video_surveillance', 'eclairage_permanent'],
  },
  {
    category: 'aerien',
    label: 'Parking aérien (silo)',
    icon: '🏗️',
    description: 'Place en parking silo ou étage',
    defaultConditions: {
      noticePeriod: { landlordMonths: 1, tenantMonths: 1 },
      financial: {
        rentMonthly: 90,
        rentIncludesVAT: false,
        chargesMonthly: 8,
        chargesType: 'forfait',
        deposit: 90,
        depositMonths: 1,
      },
    } as any,
    suggestedRent: { min: 60, max: 180 },
    commonFeatures: {
      couvert: true,
      ferme: false,
      eclaire: true,
    },
    commonSecurity: ['barriere_automatique', 'video_surveillance'],
  },
  {
    category: 'deux_roues',
    label: 'Emplacement 2 roues',
    icon: '🏍️',
    description: 'Place pour moto, scooter ou vélo',
    defaultConditions: {
      noticePeriod: { landlordMonths: 1, tenantMonths: 1 },
      financial: {
        rentMonthly: 30,
        rentIncludesVAT: false,
        chargesMonthly: 0,
        chargesType: 'incluses',
        deposit: 30,
        depositMonths: 1,
      },
    } as any,
    suggestedRent: { min: 20, max: 80 },
    commonFeatures: {
      couvert: true,
      ferme: false,
      eclaire: true,
      prise_electrique: true,  // Pour vélos électriques
    },
    commonSecurity: ['video_surveillance', 'portail_securise'],
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getParkingPreset(category: ParkingCategory): ParkingPreset | undefined {
  return PARKING_PRESETS.find(p => p.category === category);
}

export function calculateRecommendedDeposit(monthlyRent: number): number {
  // Pour les parkings : généralement 1 à 2 mois de loyer
  return monthlyRent;
}

export function getAccessMethodLabel(method: AccessMethod): string {
  const labels: Record<AccessMethod, string> = {
    badge_rfid: 'Badge RFID',
    telecommande: 'Télécommande',
    cle_physique: 'Clé',
    digicode: 'Digicode',
    biometrie: 'Biométrie',
    plaque_immatriculation: 'Reconnaissance de plaque',
    acces_libre: 'Accès libre',
  };
  return labels[method];
}

export function getSecurityFeatureLabel(feature: SecurityFeature): string {
  const labels: Record<SecurityFeature, string> = {
    barriere_automatique: 'Barrière automatique',
    portail_securise: 'Portail sécurisé',
    video_surveillance: 'Vidéosurveillance',
    gardiennage_24h: 'Gardiennage 24h/24',
    gardiennage_jour: 'Gardiennage de jour',
    eclairage_permanent: 'Éclairage permanent',
    detecteur_mouvement: 'Détecteurs de mouvement',
    alarme_intrusion: 'Alarme anti-intrusion',
    interphone: 'Interphone/Visiophone',
    residence_fermee: 'Résidence fermée',
  };
  return labels[feature];
}

export function getParkingCategoryLabel(category: ParkingCategory): string {
  const labels: Record<ParkingCategory, string> = {
    place_exterieure: 'Place extérieure',
    place_couverte: 'Place couverte',
    box_ferme: 'Box fermé',
    garage_individuel: 'Garage individuel',
    souterrain: 'Parking souterrain',
    aerien: 'Parking aérien',
    deux_roues: 'Emplacement 2 roues',
  };
  return labels[category];
}

export function getVehicleTypeLabel(type: VehicleType): string {
  const labels: Record<VehicleType, string> = {
    voiture_citadine: 'Voiture citadine',
    voiture_berline: 'Berline / Break',
    voiture_suv: 'SUV / 4x4',
    utilitaire_leger: 'Utilitaire léger',
    camping_car: 'Camping-car',
    moto: 'Moto',
    scooter: 'Scooter',
    velo: 'Vélo',
    velo_electrique: 'Vélo électrique',
    trottinette: 'Trottinette',
  };
  return labels[type];
}

