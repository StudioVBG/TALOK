/**
 * Types pour les états des lieux (EDL)
 */

export type EDLType = "entree" | "sortie";

export type ItemCondition = "neuf" | "bon" | "moyen" | "mauvais" | "tres_mauvais";

export interface EDLItem {
  id?: string;
  room_name: string;
  item_name: string;
  condition: ItemCondition | null;
  notes?: string;
  photos?: string[]; // URLs des photos
}

export interface EDLMeterReading {
  type: "electricity" | "gas" | "water" | "water_hot";
  meter_number?: string;
  reading: string;
  unit: string;
  photo_url?: string;
}

export interface EDLSignature {
  signer_type: "proprietaire" | "locataire" | "owner" | "tenant";
  signer_profile_id?: string;
  signer_name: string;
  signature_image?: string;
  signed_at?: string;
  ip_address?: string;
  invitation_sent_at?: string;
  invitation_token?: string;
  proof_id?: string;
  proof_metadata?: any;
  document_hash?: string;
}

export interface EDLComplet {
  // Identifiants
  id: string;
  reference: string;
  
  // Type et dates
  type: EDLType;
  scheduled_date?: string;
  completed_date?: string;
  created_at: string;
  
  // Logement
  logement: {
    adresse_complete: string;
    code_postal: string;
    ville: string;
    type_bien: string;
    surface?: number;
    nb_pieces?: number;
    etage?: string;
    numero_lot?: string;
  };
  
  // Bailleur
  bailleur: {
    type: "particulier" | "societe";
    nom_complet: string;
    raison_sociale?: string;
    representant?: string;
    adresse?: string;
    telephone?: string;
    email?: string;
  };
  
  // Locataire(s)
  locataires: Array<{
    nom: string;
    prenom: string;
    nom_complet: string;
    date_naissance?: string;
    lieu_naissance?: string;
    telephone?: string;
    email?: string;
  }>;
  
  // Bail associé
  bail: {
    id: string;
    reference?: string;
    type_bail: string;
    date_debut: string;
    date_fin?: string;
    loyer_hc: number;
    charges: number;
  };
  
  // Compteurs
  compteurs: EDLMeterReading[];
  
  // Pièces et items
  pieces: Array<{
    nom: string;
    items: EDLItem[];
  }>;
  
  // Observations générales
  observations_generales?: string;
  
  // Clés remises
  cles_remises?: Array<{
    type: string;
    quantite: number;
    notes?: string;
  }>;
  
  // Signatures
  signatures: EDLSignature[];
  
  // Métadonnées
  is_complete: boolean;
  is_signed: boolean;
  status: "draft" | "in_progress" | "completed" | "signed" | "disputed";
}

export interface EDLTemplateVariables {
  // Header
  EDL_REFERENCE: string;
  EDL_TYPE: string;
  EDL_TYPE_LABEL: string;
  DATE_EDL: string;
  DATE_CREATION: string;
  
  // Logement
  LOGEMENT_ADRESSE: string;
  LOGEMENT_CODE_POSTAL: string;
  LOGEMENT_VILLE: string;
  LOGEMENT_TYPE: string;
  LOGEMENT_SURFACE: string;
  LOGEMENT_NB_PIECES: string;
  LOGEMENT_ETAGE: string;
  LOGEMENT_NUMERO_LOT: string;
  
  // Bailleur
  BAILLEUR_NOM_COMPLET: string;
  BAILLEUR_TYPE: string;
  BAILLEUR_ADRESSE: string;
  BAILLEUR_TELEPHONE: string;
  BAILLEUR_EMAIL: string;
  IS_SOCIETE: boolean;
  BAILLEUR_REPRESENTANT: string;
  
  // Locataires
  LOCATAIRES_NOM_COMPLET: string;
  LOCATAIRES_LISTE: string;
  NB_LOCATAIRES: number;
  
  // Bail
  BAIL_REFERENCE: string;
  BAIL_TYPE: string;
  BAIL_DATE_DEBUT: string;
  BAIL_DATE_FIN: string;
  BAIL_LOYER_HC: string;
  BAIL_CHARGES: string;
  BAIL_TOTAL: string;
  
  // Compteurs HTML
  COMPTEURS_HTML: string;
  HAS_COMPTEURS: boolean;
  
  // Pièces HTML
  PIECES_HTML: string;
  NB_PIECES_INSPECTEES: number;
  
  // Observations
  OBSERVATIONS_GENERALES: string;
  HAS_OBSERVATIONS: boolean;
  
  // Clés
  CLES_HTML: string;
  HAS_CLES: boolean;
  
  // Signatures
  SIGNATURES_HTML: string;
  IS_SIGNED: boolean;
  DATE_SIGNATURE_BAILLEUR: string;
  DATE_SIGNATURE_LOCATAIRE: string;
  SIGNATURE_IMAGE_BAILLEUR: string;
  SIGNATURE_IMAGE_LOCATAIRE: string;
  CERTIFICATE_HTML?: string;
  
  // État global
  RESUME_ETAT: string;
  NB_ELEMENTS_NEUF: number;
  NB_ELEMENTS_BON: number;
  NB_ELEMENTS_MOYEN: number;
  NB_ELEMENTS_MAUVAIS: number;
  NB_ELEMENTS_TRES_MAUVAIS: number;
  POURCENTAGE_BON_ETAT: number;
}

// Labels pour les conditions
export const CONDITION_LABELS: Record<ItemCondition, string> = {
  neuf: "Neuf",
  bon: "Bon état",
  moyen: "État moyen",
  mauvais: "Mauvais état",
  tres_mauvais: "Très mauvais état",
};

export const CONDITION_COLORS: Record<ItemCondition, string> = {
  neuf: "#3b82f6", // blue-500 (bleu pour neuf)
  bon: "#22c55e", // green-500
  moyen: "#eab308", // yellow-500
  mauvais: "#f97316", // orange-500
  tres_mauvais: "#ef4444", // red-500
};

// Labels pour les types de compteurs
export const METER_TYPE_LABELS: Record<string, string> = {
  electricity: "Électricité",
  gas: "Gaz",
  water: "Eau froide",
  water_hot: "Eau chaude sanitaire",
};

export const METER_TYPE_ICONS: Record<string, string> = {
  electricity: "⚡",
  gas: "🔥",
  water: "💧",
  water_hot: "🚿",
};


