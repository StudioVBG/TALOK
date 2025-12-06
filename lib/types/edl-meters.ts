/**
 * Types TypeScript pour les Relevés de Compteurs dans les États des Lieux (EDL)
 * 
 * Conforme au décret n°2016-382 du 30 mars 2016 qui impose
 * "les relevés des compteurs individuels de consommation d'eau et d'énergie"
 * dans les états des lieux d'entrée et de sortie.
 */

// ============================================
// TYPES DE BASE
// ============================================

/** Types de compteurs gérés */
export type MeterType = 'electricity' | 'gas' | 'water';

/** Unités de mesure */
export type MeterUnit = 'kWh' | 'm³' | 'L';

/** Provider OCR utilisé */
export type OCRProvider = 'tesseract' | 'google_vision' | 'mindee';

/** Rôle de la personne qui a effectué le relevé */
export type RecorderRole = 'owner' | 'tenant';

// ============================================
// INTERFACES PRINCIPALES
// ============================================

/**
 * Relevé de compteur associé à un EDL
 */
export interface EDLMeterReading {
  id: string;
  edl_id: string;
  meter_id: string;
  
  // Valeur du relevé
  reading_value: number;
  reading_unit: MeterUnit;
  
  // Photo preuve (obligatoire)
  photo_path: string;
  photo_taken_at: string;
  
  // Résultat OCR
  ocr_value: number | null;
  ocr_confidence: number | null;
  ocr_provider: OCRProvider | null;
  ocr_raw_text: string | null;
  
  // Validation humaine
  is_validated: boolean;
  validated_by: string | null;
  validated_at: string | null;
  validation_comment: string | null;
  
  // Qui a effectué le relevé
  recorded_by: string;
  recorded_by_role: RecorderRole;
  
  // Métadonnées
  created_at: string;
  updated_at: string;
  
  // Relations (pour les jointures)
  meter?: MeterInfo;
}

/**
 * Informations sur un compteur
 */
export interface MeterInfo {
  id: string;
  property_id: string;
  type: MeterType;
  meter_number: string | null;
  location: string | null;
  provider: string | null;
  unit: MeterUnit;
  is_active: boolean;
}

/**
 * Relevé avec détails complets (jointure)
 */
export interface EDLMeterReadingWithDetails extends EDLMeterReading {
  meter: MeterInfo;
  edl_type: 'entree' | 'sortie';
  edl_status: string;
  lease_id: string;
  property_id: string;
  recorded_by_name: string | null;
  recorded_by_email: string | null;
}

/**
 * Comparaison entre relevés d'entrée et de sortie
 */
export interface MeterConsumption {
  meter_id: string;
  meter_type: MeterType;
  meter_number: string | null;
  entry_value: number | null;
  entry_date: string | null;
  exit_value: number | null;
  exit_date: string | null;
  consumption: number | null;
  unit: MeterUnit;
}

// ============================================
// DTOs POUR LES APIs
// ============================================

/**
 * Créer un relevé de compteur
 */
export interface CreateEDLMeterReadingDTO {
  edl_id: string;
  meter_id: string;
  
  // Photo obligatoire
  photo: File;
  
  // Valeur manuelle (optionnelle, utilisée si OCR échoue)
  manual_value?: number;
  
  // Commentaire (optionnel)
  comment?: string;
}

/**
 * Réponse de création avec résultat OCR
 */
export interface CreateEDLMeterReadingResponse {
  reading: EDLMeterReading;
  ocr: {
    detected_value: number | null;
    confidence: number;
    needs_validation: boolean;
    raw_text: string;
    processing_time_ms: number;
  };
}

/**
 * Valider manuellement un relevé
 */
export interface ValidateEDLMeterReadingDTO {
  reading_id: string;
  corrected_value: number;
  comment?: string;
}

/**
 * Obtenir les relevés d'un EDL
 */
export interface GetEDLMeterReadingsDTO {
  edl_id: string;
}

/**
 * Réponse avec tous les relevés d'un EDL
 */
export interface GetEDLMeterReadingsResponse {
  readings: EDLMeterReadingWithDetails[];
  all_meters_recorded: boolean;
  missing_meters: MeterInfo[];
}

/**
 * Comparer la consommation entre EDL entrée et sortie
 */
export interface CompareMeterConsumptionDTO {
  lease_id: string;
}

export interface CompareMeterConsumptionResponse {
  consumptions: MeterConsumption[];
  totals: {
    electricity_kwh: number | null;
    gas_m3: number | null;
    water_m3: number | null;
  };
}

// ============================================
// CONSTANTES
// ============================================

/** Configuration par type de compteur */
export const METER_TYPE_CONFIG: Record<MeterType, {
  label: string;
  icon: string;
  unit: MeterUnit;
  expectedDigits: number;
  maxValue: number;
  color: string;
}> = {
  electricity: {
    label: 'Électricité',
    icon: '⚡',
    unit: 'kWh',
    expectedDigits: 6,
    maxValue: 999999,
    color: 'yellow',
  },
  gas: {
    label: 'Gaz',
    icon: '🔥',
    unit: 'm³',
    expectedDigits: 5,
    maxValue: 99999,
    color: 'orange',
  },
  water: {
    label: 'Eau',
    icon: '💧',
    unit: 'm³',
    expectedDigits: 5,
    maxValue: 99999,
    color: 'blue',
  },
};

/** Seuils de confiance OCR */
export const OCR_CONFIDENCE_THRESHOLDS = {
  /** En dessous: validation manuelle obligatoire */
  LOW: 60,
  /** Entre LOW et HIGH: validation recommandée */
  MEDIUM: 80,
  /** Au dessus: validation automatique */
  HIGH: 90,
};

/** Messages d'aide pour l'utilisateur */
export const METER_READING_HELP = {
  photo: "Prenez une photo claire du compteur, en incluant l'afficheur complet.",
  ocr_low_confidence: "La valeur n'a pas pu être lue automatiquement. Veuillez saisir la valeur manuellement.",
  ocr_medium_confidence: "La valeur a été détectée mais avec une faible certitude. Veuillez vérifier et corriger si nécessaire.",
  ocr_high_confidence: "La valeur a été détectée automatiquement.",
  validation_required: "Ce relevé nécessite une validation par les deux parties.",
};

/** Providers de compteurs connus */
export const METER_PROVIDERS = {
  electricity: ['Enedis', 'EDF', 'Linky'],
  gas: ['GRDF', 'Gazpar', 'Engie'],
  water: ['Veolia', 'Suez', 'Saur', 'Syndic'],
};

