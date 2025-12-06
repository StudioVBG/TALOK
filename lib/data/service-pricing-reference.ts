// =====================================================
// Grille tarifaire de référence par corps de métier
// France métropolitaine et DROM
// =====================================================

/**
 * Zone géographique
 */
export type PricingZone = 'france_metro' | 'guadeloupe' | 'martinique' | 'guyane' | 'reunion' | 'mayotte';

/**
 * Type de service
 */
export type ServiceType = 
  | 'plomberie'
  | 'electricite'
  | 'serrurerie'
  | 'chauffage_clim'
  | 'peinture'
  | 'menuiserie'
  | 'maconnerie'
  | 'jardinage'
  | 'nettoyage'
  | 'demenagement'
  | 'vitrier'
  | 'couverture'
  | 'isolation'
  | 'domotique';

/**
 * Tarif de référence
 */
export interface ServicePricing {
  service_type: ServiceType;
  label: string;
  description: string;
  hourly_rate_min: number;
  hourly_rate_max: number;
  average_rate: number;
  unit: 'hour' | 'day' | 'sqm' | 'unit';
  includes_travel: boolean;
  emergency_multiplier: number; // Majoration urgence
}

/**
 * Coefficient par zone DROM
 */
export const DROM_COEFFICIENTS: Record<PricingZone, number> = {
  france_metro: 1.00,
  guadeloupe: 1.18,
  martinique: 1.20,
  guyane: 1.25,
  reunion: 1.15,
  mayotte: 1.30,
};

/**
 * Labels des zones
 */
export const ZONE_LABELS: Record<PricingZone, string> = {
  france_metro: 'France métropolitaine',
  guadeloupe: 'Guadeloupe',
  martinique: 'Martinique',
  guyane: 'Guyane',
  reunion: 'La Réunion',
  mayotte: 'Mayotte',
};

/**
 * Grille tarifaire de référence (France métropolitaine)
 * Source : CAPEB, FFB, études de marché 2024-2025
 */
export const SERVICE_PRICING_REFERENCE: ServicePricing[] = [
  {
    service_type: 'plomberie',
    label: 'Plomberie',
    description: 'Réparation fuites, installation sanitaires, débouchage',
    hourly_rate_min: 40,
    hourly_rate_max: 65,
    average_rate: 52,
    unit: 'hour',
    includes_travel: false,
    emergency_multiplier: 1.5,
  },
  {
    service_type: 'electricite',
    label: 'Électricité',
    description: 'Dépannage, installation, mise aux normes',
    hourly_rate_min: 35,
    hourly_rate_max: 60,
    average_rate: 48,
    unit: 'hour',
    includes_travel: false,
    emergency_multiplier: 1.5,
  },
  {
    service_type: 'serrurerie',
    label: 'Serrurerie',
    description: 'Ouverture de porte, changement serrure, blindage',
    hourly_rate_min: 45,
    hourly_rate_max: 80,
    average_rate: 62,
    unit: 'hour',
    includes_travel: true,
    emergency_multiplier: 1.8,
  },
  {
    service_type: 'chauffage_clim',
    label: 'Chauffage / Climatisation',
    description: 'Entretien chaudière, installation clim, dépannage',
    hourly_rate_min: 45,
    hourly_rate_max: 70,
    average_rate: 58,
    unit: 'hour',
    includes_travel: false,
    emergency_multiplier: 1.5,
  },
  {
    service_type: 'peinture',
    label: 'Peinture',
    description: 'Peinture intérieure/extérieure, ravalement',
    hourly_rate_min: 25,
    hourly_rate_max: 45,
    average_rate: 35,
    unit: 'hour',
    includes_travel: false,
    emergency_multiplier: 1.2,
  },
  {
    service_type: 'menuiserie',
    label: 'Menuiserie',
    description: 'Portes, fenêtres, placards, parquet',
    hourly_rate_min: 35,
    hourly_rate_max: 55,
    average_rate: 45,
    unit: 'hour',
    includes_travel: false,
    emergency_multiplier: 1.3,
  },
  {
    service_type: 'maconnerie',
    label: 'Maçonnerie',
    description: 'Gros œuvre, réparation murs, terrasse',
    hourly_rate_min: 35,
    hourly_rate_max: 50,
    average_rate: 42,
    unit: 'hour',
    includes_travel: false,
    emergency_multiplier: 1.3,
  },
  {
    service_type: 'jardinage',
    label: 'Jardinage / Espaces verts',
    description: 'Entretien jardin, élagage, tonte',
    hourly_rate_min: 25,
    hourly_rate_max: 40,
    average_rate: 32,
    unit: 'hour',
    includes_travel: false,
    emergency_multiplier: 1.2,
  },
  {
    service_type: 'nettoyage',
    label: 'Nettoyage',
    description: 'Nettoyage professionnel, remise en état',
    hourly_rate_min: 20,
    hourly_rate_max: 35,
    average_rate: 27,
    unit: 'hour',
    includes_travel: false,
    emergency_multiplier: 1.3,
  },
  {
    service_type: 'demenagement',
    label: 'Déménagement',
    description: 'Déménagement, manutention, garde-meuble',
    hourly_rate_min: 30,
    hourly_rate_max: 50,
    average_rate: 40,
    unit: 'hour',
    includes_travel: true,
    emergency_multiplier: 1.4,
  },
  {
    service_type: 'vitrier',
    label: 'Vitrerie',
    description: 'Remplacement vitres, miroirs, double vitrage',
    hourly_rate_min: 40,
    hourly_rate_max: 60,
    average_rate: 50,
    unit: 'hour',
    includes_travel: true,
    emergency_multiplier: 1.5,
  },
  {
    service_type: 'couverture',
    label: 'Couverture / Toiture',
    description: 'Réparation toiture, gouttières, étanchéité',
    hourly_rate_min: 40,
    hourly_rate_max: 65,
    average_rate: 52,
    unit: 'hour',
    includes_travel: false,
    emergency_multiplier: 1.6,
  },
  {
    service_type: 'isolation',
    label: 'Isolation',
    description: 'Isolation thermique, phonique, combles',
    hourly_rate_min: 35,
    hourly_rate_max: 55,
    average_rate: 45,
    unit: 'hour',
    includes_travel: false,
    emergency_multiplier: 1.2,
  },
  {
    service_type: 'domotique',
    label: 'Domotique',
    description: 'Installation connectée, alarme, vidéosurveillance',
    hourly_rate_min: 45,
    hourly_rate_max: 75,
    average_rate: 60,
    unit: 'hour',
    includes_travel: false,
    emergency_multiplier: 1.4,
  },
];

/**
 * Obtient le tarif de référence pour un service et une zone
 */
export function getServicePricing(
  serviceType: ServiceType,
  zone: PricingZone = 'france_metro'
): ServicePricing | null {
  const basePricing = SERVICE_PRICING_REFERENCE.find(p => p.service_type === serviceType);
  if (!basePricing) return null;
  
  const coefficient = DROM_COEFFICIENTS[zone];
  
  return {
    ...basePricing,
    hourly_rate_min: Math.round(basePricing.hourly_rate_min * coefficient),
    hourly_rate_max: Math.round(basePricing.hourly_rate_max * coefficient),
    average_rate: Math.round(basePricing.average_rate * coefficient),
  };
}

/**
 * Obtient tous les tarifs pour une zone
 */
export function getAllPricingForZone(zone: PricingZone = 'france_metro'): ServicePricing[] {
  const coefficient = DROM_COEFFICIENTS[zone];
  
  return SERVICE_PRICING_REFERENCE.map(pricing => ({
    ...pricing,
    hourly_rate_min: Math.round(pricing.hourly_rate_min * coefficient),
    hourly_rate_max: Math.round(pricing.hourly_rate_max * coefficient),
    average_rate: Math.round(pricing.average_rate * coefficient),
  }));
}

/**
 * Évalue un tarif par rapport à la moyenne du marché
 */
export type PriceEvaluation = 'below_average' | 'average' | 'above_average' | 'expensive' | 'suspicious';

export interface PriceEvaluationResult {
  evaluation: PriceEvaluation;
  label: string;
  color: string;
  percentFromAverage: number;
  referenceMin: number;
  referenceMax: number;
  referenceAverage: number;
  message: string;
}

export function evaluatePrice(
  serviceType: ServiceType,
  hourlyRate: number,
  zone: PricingZone = 'france_metro',
  isEmergency: boolean = false
): PriceEvaluationResult {
  const pricing = getServicePricing(serviceType, zone);
  
  if (!pricing) {
    return {
      evaluation: 'average',
      label: 'Non évalué',
      color: 'gray',
      percentFromAverage: 0,
      referenceMin: 0,
      referenceMax: 0,
      referenceAverage: 0,
      message: 'Aucune donnée de référence disponible',
    };
  }
  
  // Ajuster pour l'urgence
  const effectiveMin = isEmergency ? pricing.hourly_rate_min * pricing.emergency_multiplier : pricing.hourly_rate_min;
  const effectiveMax = isEmergency ? pricing.hourly_rate_max * pricing.emergency_multiplier : pricing.hourly_rate_max;
  const effectiveAvg = isEmergency ? pricing.average_rate * pricing.emergency_multiplier : pricing.average_rate;
  
  const percentFromAverage = Math.round(((hourlyRate - effectiveAvg) / effectiveAvg) * 100);
  
  let evaluation: PriceEvaluation;
  let label: string;
  let color: string;
  let message: string;
  
  if (hourlyRate < effectiveMin * 0.8) {
    evaluation = 'suspicious';
    label = 'Prix très bas';
    color = 'orange';
    message = '⚠️ Ce tarif est inhabituellement bas. Vérifiez les prestations incluses.';
  } else if (hourlyRate < effectiveMin) {
    evaluation = 'below_average';
    label = 'En dessous du marché';
    color = 'green';
    message = '✅ Tarif compétitif, en dessous de la moyenne du marché.';
  } else if (hourlyRate <= effectiveMax) {
    evaluation = 'average';
    label = 'Dans la moyenne';
    color = 'blue';
    message = '✅ Tarif conforme aux prix du marché.';
  } else if (hourlyRate <= effectiveMax * 1.5) {
    evaluation = 'above_average';
    label = 'Au-dessus du marché';
    color = 'amber';
    message = '⚠️ Tarif supérieur à la moyenne. Justifié pour une expertise particulière.';
  } else {
    evaluation = 'expensive';
    label = 'Tarif élevé';
    color = 'red';
    message = '🚨 Tarif très supérieur au marché (>' + Math.round(effectiveMax * 1.5) + '€/h). Demandez des explications.';
  }
  
  return {
    evaluation,
    label,
    color,
    percentFromAverage,
    referenceMin: Math.round(effectiveMin),
    referenceMax: Math.round(effectiveMax),
    referenceAverage: Math.round(effectiveAvg),
    message,
  };
}

/**
 * Labels des types de service
 */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  plomberie: 'Plomberie',
  electricite: 'Électricité',
  serrurerie: 'Serrurerie',
  chauffage_clim: 'Chauffage / Clim',
  peinture: 'Peinture',
  menuiserie: 'Menuiserie',
  maconnerie: 'Maçonnerie',
  jardinage: 'Jardinage',
  nettoyage: 'Nettoyage',
  demenagement: 'Déménagement',
  vitrier: 'Vitrerie',
  couverture: 'Couverture',
  isolation: 'Isolation',
  domotique: 'Domotique',
};

/**
 * Icônes des types de service (Lucide)
 */
export const SERVICE_TYPE_ICONS: Record<ServiceType, string> = {
  plomberie: 'Droplets',
  electricite: 'Zap',
  serrurerie: 'Key',
  chauffage_clim: 'Thermometer',
  peinture: 'Paintbrush',
  menuiserie: 'DoorOpen',
  maconnerie: 'Brick',
  jardinage: 'TreePine',
  nettoyage: 'Sparkles',
  demenagement: 'Truck',
  vitrier: 'Square',
  couverture: 'Home',
  isolation: 'Shield',
  domotique: 'Smartphone',
};

