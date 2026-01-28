// Types TypeScript pour le domaine métier

export type UserRole = "admin" | "owner" | "tenant" | "provider" | "guarantor";

// ============================================
// PROPERTY TYPES - Migration V3
// ============================================
// ⚠️ DEPRECATED: Utiliser PropertyTypeV3 depuis @/lib/types/property-v3
// Ce type est conservé pour compatibilité avec l'ancien code.
// Migration progressive vers PropertyTypeV3 en cours.
/**
 * @deprecated Utiliser PropertyTypeV3 depuis @/lib/types/property-v3
 * Ce type sera supprimé dans une version future.
 * Utilisez: import { PropertyTypeV3 as PropertyType } from "@/lib/types/property-v3"
 */
export type PropertyType =
  | "appartement"
  | "maison"
  | "studio"
  | "colocation"
  | "saisonnier"
  | "local_commercial"
  | "bureaux"
  | "entrepot"
  | "parking"
  | "box"
  | "fonds_de_commerce";

// Alias vers PropertyTypeV3 pour migration progressive
// Les nouveaux développements doivent utiliser PropertyTypeV3 directement
// (exporté plus bas dans EXPORTS V3)

export type PropertyUsage =
  | "habitation"
  | "local_commercial"
  | "bureaux"
  | "entrepot"
  | "parking"
  | "fonds_de_commerce";

// ============================================
// PROPERTY STATUS - Migration V3
// ============================================
/**
 * @deprecated Utiliser PropertyStatusV3 depuis @/lib/types/property-v3
 * PropertyStatus a des valeurs dupliquées (fr/en). PropertyStatusV3 utilise uniquement les valeurs anglaises.
 */
export type PropertyStatus = "brouillon" | "en_attente" | "published" | "publie" | "rejete" | "rejected" | "archive" | "archived";

// Alias vers PropertyStatusV3
// (exporté plus bas dans EXPORTS V3)

export type HeatingType = "individuel" | "collectif" | "aucun";
export type HeatingEnergy = "electricite" | "gaz" | "fioul" | "bois" | "reseau_urbain" | "autre" | null;
export type HotWaterType = "electrique_indiv" | "gaz_indiv" | "collectif" | "solaire" | "autre" | null;
export type ClimatePresence = "aucune" | "fixe" | "mobile";
export type ClimateType = "split" | "gainable" | null;

// ============================================
// ROOM TYPES - Migration V3
// ============================================
/**
 * @deprecated Utiliser RoomTypeV3 depuis @/lib/types/property-v3
 * RoomTypeV3 ajoute "jardin", "bureau", "dressing"
 */
export type RoomType =
  | "sejour"
  | "chambre"
  | "cuisine"
  | "salle_de_bain"
  | "wc"
  | "entree"
  | "couloir"
  | "balcon"
  | "terrasse"
  | "cave"
  | "autre";

// Alias vers RoomTypeV3
// (exporté plus bas dans EXPORTS V3)

// ============================================
// PHOTO TAGS - Migration V3
// ============================================
/**
 * @deprecated Utiliser PhotoTagV3 depuis @/lib/types/property-v3
 * PhotoTagV3 ajoute "emplacement", "acces", "façade", "interieur", "vitrine", "autre"
 */
export type PhotoTag = "vue_generale" | "plan" | "detail" | "exterieur" | null;

// Alias vers PhotoTagV3
// (exporté plus bas dans EXPORTS V3)

export type ParkingPlacementType = "outdoor" | "covered" | "box" | "underground";
export type ParkingVehicleProfile = "city" | "berline" | "suv" | "utility" | "two_wheels";
export type ParkingAccessType = "badge" | "remote" | "key" | "digicode" | "free";
export type ParkingSecurityFeature = "gate" | "camera" | "guard" | "residence" | "lighting";

export interface ParkingAccessWindow {
  mode: "24_7" | "limited";
  open_at?: string | null; // HH:mm
  close_at?: string | null; // HH:mm
}

export interface ParkingManoeuvreFlags {
  narrow_ramp: boolean;
  sharp_turn: boolean;
  suitable_large_vehicle: boolean;
}

export interface ParkingDimensions {
  length?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface ParkingDetails {
  placement_type: ParkingPlacementType;
  linked_property_id: string | null;
  reference_label: string | null;
  level: string | null;
  vehicle_profile: ParkingVehicleProfile;
  dimensions?: ParkingDimensions | null;
  manoeuvre: ParkingManoeuvreFlags;
  surface_type: "beton" | "asphalte" | "gravier" | "autre" | null;
  access_types: ParkingAccessType[];
  access_window: ParkingAccessWindow;
  security_features: ParkingSecurityFeature[];
  description_hint: string | null;
  extra_badge_fees?: number | null;
}

export type LeaseType =
  | "nu"
  | "meuble"
  | "colocation"
  | "saisonnier"
  | "bail_mobilite"
  | "commercial_3_6_9"
  | "commercial_derogatoire"
  | "professionnel"
  | "contrat_parking"
  | "location_gerance";

// ✅ SOTA 2026: Tous les statuts de bail légaux
export type LeaseStatus = 
  | "draft"                   // Brouillon
  | "sent"                    // Envoyé pour signature
  | "pending_signature"       // En attente de signatures
  | "partially_signed"        // Partiellement signé
  | "pending_owner_signature" // Locataire signé, attente propriétaire
  | "fully_signed"            // Entièrement signé (avant EDL)
  | "active"                  // Bail actif
  | "notice_given"            // Congé donné (préavis en cours)
  | "amended"                 // Avenant en cours
  | "terminated"              // Terminé
  | "archived";               // Archivé

export type InvoiceStatus = "draft" | "sent" | "paid" | "late";

// ✅ SOTA 2026: Tous les moyens de paiement synchronisés avec la DB
// Synchronisé avec: payments_moyen_check dans 20241129000002_cash_payments.sql
export type PaymentMethod =
  | "cb"           // Carte bancaire
  | "virement"     // Virement bancaire
  | "prelevement"  // Prélèvement SEPA
  | "especes"      // Espèces (avec reçu signé obligatoire)
  | "cheque"       // Chèque bancaire
  | "autre";       // Autre moyen

export type PaymentStatus = "pending" | "succeeded" | "failed";

export type TicketPriority = "basse" | "normale" | "haute";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type WorkOrderStatus = "assigned" | "scheduled" | "done" | "cancelled";

export type SignerRole = "proprietaire" | "locataire_principal" | "colocataire" | "garant";

export type SignatureStatus = "pending" | "signed" | "refused";

export type OwnerType = "particulier" | "societe";

export type OwnerUsageStrategie = "habitation_only" | "mixte_B2C_B2B" | "B2B_only";

export type TenantType = "particulier_habitation" | "profession_liberale" | "commercant_artisan" | "entreprise";

export type LeaseIndex = "IRL" | "ILC" | "ILAT";

export type LeaseIndexPeriodicity = "annuelle" | "triennale" | "quinquennale";

export type ChargeType =
  | "eau"
  | "electricite"
  | "copro"
  | "taxe"
  | "ordures"
  | "assurance"
  | "travaux"
  | "energie"
  | "autre";

export type ChargePeriodicity = "mensuelle" | "trimestrielle" | "annuelle";

export type ChargeCategorie =
  | "charges_locatives"
  | "charges_non_recuperables"
  | "taxes"
  | "travaux_proprietaire"
  | "travaux_locataire"
  | "assurances"
  | "energie";

// ============================================
// DOCUMENT TYPES - SOTA 2026
// Synchronisé avec migration 20251228000000_documents_sota.sql
// ============================================
export type DocumentType =
  // Contrats
  | "bail"
  | "avenant"
  | "engagement_garant"
  | "bail_signe_locataire"
  | "bail_signe_proprietaire"

  // Identité
  | "piece_identite"
  | "cni_recto"
  | "cni_verso"
  | "passeport"
  | "titre_sejour"

  // Finance
  | "quittance"
  | "facture"
  | "rib"
  | "avis_imposition"
  | "bulletin_paie"
  | "attestation_loyer"
  | "justificatif_revenus"

  // Assurance
  | "attestation_assurance"
  | "assurance_pno"

  // Diagnostics
  | "diagnostic"
  | "dpe"
  | "diagnostic_gaz"
  | "diagnostic_electricite"
  | "diagnostic_plomb"
  | "diagnostic_amiante"
  | "diagnostic_termites"
  | "diagnostic_tertiaire"
  | "diagnostic_performance"
  | "erp"

  // États des lieux
  | "EDL_entree"
  | "EDL_sortie"
  | "inventaire"

  // Candidature locataire
  | "candidature_identite"
  | "candidature_revenus"
  | "candidature_domicile"
  | "candidature_garantie"

  // Garant
  | "garant_identite"
  | "garant_revenus"
  | "garant_domicile"
  | "garant_engagement"

  // Prestataire
  | "devis"
  | "ordre_mission"
  | "rapport_intervention"

  // Copropriété
  | "taxe_fonciere"
  | "taxe_sejour"
  | "copropriete"
  | "proces_verbal"
  | "appel_fonds"

  // Divers
  | "annexe_pinel"
  | "etat_travaux"
  | "publication_jal"
  | "consentement"
  | "courrier"
  | "photo"
  | "autre";

// Catégories de documents pour classification automatique
export type DocumentCategory =
  | "contrat"
  | "identite"
  | "finance"
  | "assurance"
  | "diagnostic"
  | "edl"
  | "candidature"
  | "garant"
  | "prestataire"
  | "copropriete"
  | "autre";

// Mapping type -> catégorie
export const DOCUMENT_TYPE_TO_CATEGORY: Record<DocumentType, DocumentCategory> = {
  // Contrats
  bail: "contrat",
  avenant: "contrat",
  engagement_garant: "contrat",
  bail_signe_locataire: "contrat",
  bail_signe_proprietaire: "contrat",

  // Identité
  piece_identite: "identite",
  cni_recto: "identite",
  cni_verso: "identite",
  passeport: "identite",
  titre_sejour: "identite",

  // Finance
  quittance: "finance",
  facture: "finance",
  rib: "finance",
  avis_imposition: "finance",
  bulletin_paie: "finance",
  attestation_loyer: "finance",
  justificatif_revenus: "finance",

  // Assurance
  attestation_assurance: "assurance",
  assurance_pno: "assurance",

  // Diagnostics
  diagnostic: "diagnostic",
  dpe: "diagnostic",
  diagnostic_gaz: "diagnostic",
  diagnostic_electricite: "diagnostic",
  diagnostic_plomb: "diagnostic",
  diagnostic_amiante: "diagnostic",
  diagnostic_termites: "diagnostic",
  diagnostic_tertiaire: "diagnostic",
  diagnostic_performance: "diagnostic",
  erp: "diagnostic",

  // EDL
  EDL_entree: "edl",
  EDL_sortie: "edl",
  inventaire: "edl",

  // Candidature
  candidature_identite: "candidature",
  candidature_revenus: "candidature",
  candidature_domicile: "candidature",
  candidature_garantie: "candidature",

  // Garant
  garant_identite: "garant",
  garant_revenus: "garant",
  garant_domicile: "garant",
  garant_engagement: "garant",

  // Prestataire
  devis: "prestataire",
  ordre_mission: "prestataire",
  rapport_intervention: "prestataire",

  // Copropriété
  taxe_fonciere: "copropriete",
  taxe_sejour: "copropriete",
  copropriete: "copropriete",
  proces_verbal: "copropriete",
  appel_fonds: "copropriete",

  // Divers
  annexe_pinel: "autre",
  etat_travaux: "autre",
  publication_jal: "autre",
  consentement: "autre",
  courrier: "autre",
  photo: "autre",
  autre: "autre",
};

// Labels pour l'affichage
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  bail: "Contrat de bail",
  avenant: "Avenant au bail",
  engagement_garant: "Engagement de caution",
  bail_signe_locataire: "Bail signé (locataire)",
  bail_signe_proprietaire: "Bail signé (propriétaire)",
  piece_identite: "Pièce d'identité",
  cni_recto: "CNI (recto)",
  cni_verso: "CNI (verso)",
  passeport: "Passeport",
  titre_sejour: "Titre de séjour",
  quittance: "Quittance de loyer",
  facture: "Facture",
  rib: "RIB",
  avis_imposition: "Avis d'imposition",
  bulletin_paie: "Bulletin de paie",
  attestation_loyer: "Attestation de loyer",
  justificatif_revenus: "Justificatif de revenus",
  attestation_assurance: "Attestation d'assurance",
  assurance_pno: "Assurance PNO",
  diagnostic: "Diagnostic",
  dpe: "DPE",
  diagnostic_gaz: "Diagnostic gaz",
  diagnostic_electricite: "Diagnostic électricité",
  diagnostic_plomb: "Diagnostic plomb",
  diagnostic_amiante: "Diagnostic amiante",
  diagnostic_termites: "Diagnostic termites",
  diagnostic_tertiaire: "Diagnostic tertiaire",
  diagnostic_performance: "Diagnostic de performance",
  erp: "État des risques (ERP)",
  EDL_entree: "État des lieux d'entrée",
  EDL_sortie: "État des lieux de sortie",
  inventaire: "Inventaire mobilier",
  candidature_identite: "Candidature - Identité",
  candidature_revenus: "Candidature - Revenus",
  candidature_domicile: "Candidature - Domicile",
  candidature_garantie: "Candidature - Garantie",
  garant_identite: "Garant - Identité",
  garant_revenus: "Garant - Revenus",
  garant_domicile: "Garant - Domicile",
  garant_engagement: "Garant - Engagement",
  devis: "Devis",
  ordre_mission: "Ordre de mission",
  rapport_intervention: "Rapport d'intervention",
  taxe_fonciere: "Taxe foncière",
  taxe_sejour: "Taxe de séjour",
  copropriete: "Document copropriété",
  proces_verbal: "Procès-verbal",
  appel_fonds: "Appel de fonds",
  annexe_pinel: "Annexe Pinel",
  etat_travaux: "État des travaux",
  publication_jal: "Publication JAL",
  consentement: "Consentement",
  courrier: "Courrier",
  photo: "Photo",
  autre: "Autre document",
};

// Interfaces pour les entités principales

export interface Profile {
  id: string;
  user_id: string;
  role: UserRole;
  prenom: string | null;
  nom: string | null;
  telephone: string | null;
  avatar_url: string | null;
  date_naissance: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerProfile {
  profile_id: string;
  type: OwnerType;
  siret: string | null;
  tva: string | null;
  iban: string | null;
  adresse_facturation: string | null;
  usage_strategie: OwnerUsageStrategie;
  tva_optionnelle: boolean;
  tva_taux: number | null;
  notes_fiscales: string | null;
  raison_sociale?: string | null;
  adresse_siege?: string | null;
  forme_juridique?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantProfile {
  profile_id: string;
  situation_pro: string | null;
  revenus_mensuels: number | null;
  nb_adultes: number;
  nb_enfants: number;
  garant_required: boolean;
  locataire_type: TenantType;
  siren: string | null;
  rcs: string | null;
  rm: string | null;
  rne: string | null;
  activite_ape: string | null;
  raison_sociale: string | null;
  representant_legal: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderProfile {
  profile_id: string;
  type_services: string[];
  certifications: string | null;
  zones_intervention: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// PROPERTY INTERFACE - Migration V3
// ============================================
/**
 * @deprecated Utiliser PropertyV3 depuis @/lib/types/property-v3
 * PropertyV3 inclut de nouveaux champs structurés (parking, locaux pro, équipements)
 * Utilisez toPropertyV3() pour convertir depuis Property legacy
 */
export interface Property {
  id: string;
  owner_id: string;
  type: PropertyType;
  usage_principal: PropertyUsage;
  sous_usage: string | null;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement: string;
  latitude?: number | null;
  longitude?: number | null;
  surface: number;
  surface_habitable_m2?: number | null;
  nb_pieces: number;
  nb_chambres?: number | null;
  etage: number | null;
  ascenseur: boolean;
  meuble?: boolean;
  energie: string | null; // Classe énergétique
  ges: string | null; // GES
  erp_type: string | null;
  erp_categorie: string | null;
  erp_accessibilite: boolean;
  plan_url: string | null;
  has_irve: boolean;
  places_parking: number;
  parking_badge_count: number;
  commercial_previous_activity: string | null;
  loyer_base: number;
  loyer_hc?: number | null;
  charges_mensuelles: number;
  depot_garantie: number;
  zone_encadrement: boolean;
  encadrement_loyers?: boolean;
  loyer_reference_majoré: number | null;
  complement_loyer: number | null;
  complement_justification: string | null;
  chauffage_type?: HeatingType | null;
  chauffage_energie?: HeatingEnergy;
  eau_chaude_type?: HotWaterType;
  clim_presence?: ClimatePresence;
  clim_type?: ClimateType;
  dpe_classe_energie: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  dpe_classe_climat: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  dpe_consommation: number | null;
  dpe_emissions: number | null;
  dpe_estimation_conso_min: number | null;
  dpe_estimation_conso_max: number | null;
  permis_louer_requis: boolean;
  permis_louer_numero: string | null;
  permis_louer_date: string | null;
  parking_details: ParkingDetails | null;
  unique_code: string; // Code unique, jamais réattribué
  visite_virtuelle_url?: string | null; // URL externe vers visite virtuelle (Matterport, Nodalview, etc.)
  etat: "draft" | "pending" | "published" | "rejected" | "archived";
  status?: PropertyStatus;
  submitted_at: string | null;
  validated_at: string | null;
  validated_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  cover_document_id?: string | null;
  cover_url?: string | null;
  documents_count?: number;
}

export interface PropertyHeating {
  chauffage_type: HeatingType | null;
  chauffage_energie: HeatingEnergy;
  eau_chaude_type: HotWaterType | null;
  clim_presence: ClimatePresence;
  clim_type: ClimateType;
}

export interface Room {
  id: string;
  property_id: string;
  type_piece: RoomType;
  label_affiche: string;
  surface_m2: number | null;
  chauffage_present: boolean;
  chauffage_type_emetteur: "radiateur" | "plancher" | "convecteur" | "poele" | null;
  clim_presente: boolean;
  ordre: number;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  property_id: string;
  room_id: string | null;
  url: string;
  is_main: boolean;
  tag: PhotoTag;
  ordre: number;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  nom: string;
  capacite_max: number; // Max 10 colocataires
  surface: number | null;
  created_at: string;
  updated_at: string;
}

export interface Lease {
  id: string;
  property_id: string | null;
  unit_id: string | null;
  type_bail: LeaseType;
  loyer: number;
  charges_forfaitaires: number;
  depot_de_garantie: number;
  date_debut: string;
  date_fin: string | null;
  indice_reference: LeaseIndex | null;
  indice_base: number | null;
  indice_courant: number | null;
  indexation_periodicite: LeaseIndexPeriodicity | null;
  indexation_lissage_deplafonnement: boolean;
  tva_applicable: boolean;
  tva_taux: number | null;
  loyer_ht: number | null;
  loyer_ttc: number | null;
  pinel_travaux_3_derniers: Record<string, unknown>[];
  pinel_travaux_3_prochains: Record<string, unknown>[];
  pinel_repartition_charges: Record<string, unknown> | null;
  droit_preference_active: boolean;
  last_diagnostic_check: string | null;
  next_indexation_date: string | null;
  statut: LeaseStatus;
  created_at: string;
  updated_at: string;
}

export interface LeaseSigner {
  id: string;
  lease_id: string;
  profile_id: string;
  role: SignerRole;
  signature_status: SignatureStatus;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  lease_id: string;
  owner_id: string;
  tenant_id: string;
  periode: string; // Format "YYYY-MM"
  montant_total: number;
  montant_loyer: number;
  montant_charges: number;
  montant_ht: number;
  montant_tva: number;
  taux_tva: number | null;
  is_professional_lease: boolean;
  statut: InvoiceStatus;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  montant: number;
  moyen: PaymentMethod;
  montant_ht: number | null;
  montant_tva: number | null;
  montant_ttc: number | null;
  provider_ref: string | null; // ID paiement Stripe, etc.
  date_paiement: string | null;
  statut: PaymentStatus;
  created_at: string;
  updated_at: string;
}

export interface Charge {
  id: string;
  property_id: string;
  type: ChargeType;
  montant: number;
  periodicite: ChargePeriodicity;
  refacturable_locataire: boolean;
  categorie_charge: ChargeCategorie | null;
  eligible_pinel: boolean;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  property_id: string;
  lease_id: string | null;
  created_by_profile_id: string;
  titre: string;
  description: string;
  priorite: TicketPriority;
  statut: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  ticket_id: string;
  provider_id: string;
  date_intervention_prevue: string | null;
  date_intervention_reelle: string | null;
  cout_estime: number | null;
  cout_final: number | null;
  statut: WorkOrderStatus;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  type: DocumentType;
  owner_id: string | null;
  tenant_id: string | null;
  property_id: string | null;
  lease_id: string | null;
  collection: string | null;
  position: number | null;
  title: string | null;
  notes: string | null;
  preview_url: string | null;
  is_cover: boolean;
  uploaded_by: string | null;
  storage_path: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPost {
  id: string;
  author_id: string; // Admin uniquement
  slug: string;
  titre: string;
  contenu: string;
  tags: string[];
  published_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// EXPORTS V3 - Types et interfaces V3
// ============================================
// Ré-exporter les types V3 pour faciliter les imports
export type {
  PropertyTypeV3,
  PropertyStatusV3,
  PropertyV3,
  RoomTypeV3,
  PhotoTagV3,
  ParkingTypeV3,
  ParkingGabaritV3,
  ParkingAccesV3,
  LocalTypeV3,
  TypeBailV3,
  TypeBailHabitationV3,
  TypeBailParkingV3,
  TypeBailProV3,
  EquipmentV3,
} from "./property-v3";

export {
  PROPERTY_TYPE_GROUPS,
  ROOM_TYPES,
  PHOTO_TAGS,
  HAB_EQUIPMENTS,
} from "./property-v3";

// ============================================
// EXPORTS COMPATIBILITY - Fonctions de conversion
// ============================================
export {
  toPropertyTypeV3,
  fromPropertyTypeV3,
  isValidPropertyTypeV3,
  toRoomTypeV3,
  fromRoomTypeV3,
  toPhotoTagV3,
  fromPhotoTagV3,
  toPropertyStatusV3,
  fromPropertyStatusV3,
  toPropertyV3,
  isPropertyV3,
} from "./compatibility";

// ============================================
// EXPORTS EDL - Relevés de compteurs
// ============================================
export type {
  MeterType,
  MeterUnit,
  OCRProvider,
  RecorderRole,
  EDLMeterReading,
  MeterInfo,
  EDLMeterReadingWithDetails,
  MeterConsumption,
  CreateEDLMeterReadingDTO,
  CreateEDLMeterReadingResponse,
  ValidateEDLMeterReadingDTO,
  GetEDLMeterReadingsDTO,
  GetEDLMeterReadingsResponse,
  CompareMeterConsumptionDTO,
  CompareMeterConsumptionResponse,
} from "./edl-meters";

export {
  METER_TYPE_CONFIG,
  OCR_CONFIDENCE_THRESHOLDS,
  METER_READING_HELP,
  METER_PROVIDERS,
} from "./edl-meters";

// ============================================
// EXPORTS GARANT - Module Garant complet
// ============================================
export type {
  GuarantorRelation,
  GuarantorSituationPro,
  CautionType,
  EngagementStatus,
  GuarantorDocumentType,
  PaymentIncidentType,
  GuarantorProfile,
  GuarantorEngagement,
  GuarantorDocument,
  GuarantorPaymentIncident,
  CreateGuarantorProfileDTO,
  UpdateGuarantorProfileDTO,
  CreateEngagementDTO,
  UploadGuarantorDocumentDTO,
  GuarantorDashboardData,
  GuarantorDashboardEngagement,
  GuarantorDashboardIncident,
  GuarantorDashboardStats,
  GuarantorEligibilityResult,
} from "./guarantor";

export {
  GUARANTOR_RELATION_LABELS,
  GUARANTOR_SITUATION_LABELS,
  CAUTION_TYPE_LABELS,
  ENGAGEMENT_STATUS_LABELS,
  GUARANTOR_DOCUMENT_TYPE_LABELS,
  INCIDENT_TYPE_LABELS,
  REQUIRED_GUARANTOR_DOCUMENTS,
  OPTIONAL_GUARANTOR_DOCUMENTS,
} from "./guarantor";

// ============================================
// EXPORTS FIN DE BAIL
// ============================================
export type {
  DepartureInitiator,
  DepartureReason,
  DepartureNoticeStatus,
  AcknowledgmentMethod,
  SettlementStatus,
  DeductionType,
  PaymentMethod,
  DepartureNotice,
  DGSettlement,
  DeductionItem,
  SettlementDeductionItem,
  CreateDepartureNoticeDTO,
  UpdateDepartureNoticeDTO,
  ContestDepartureDTO,
  CreateSettlementDTO,
  UpdateSettlementDTO,
  AddDeductionDTO,
  SettlementCalculation,
  DepartureNoticeWithDetails,
  SettlementWithDetails,
} from "./end-of-lease";

export {
  DEPARTURE_REASON_LABELS,
  DEPARTURE_STATUS_LABELS,
  SETTLEMENT_STATUS_LABELS,
  DEDUCTION_TYPE_LABELS,
  ACKNOWLEDGMENT_METHOD_LABELS,
  REDUCED_NOTICE_REASONS,
  OWNER_NOTICE_REASONS,
} from "./end-of-lease";

// ============================================
// TAX VERIFICATION TYPES
// ============================================
export type {
  TaxNoticeVerificationRequest,
  TaxVerificationConfig,
  TaxVerificationMode,
  TaxDeclarant,
  TaxFoyerFiscal,
  TaxSituationFamille,
  TaxNoticeApiResponse,
  TaxNoticeConformityStatus,
  TaxNoticeVerificationResult,
  TaxNoticeSummary,
  TaxVerificationErrorCode,
  TaxVerificationError,
  TaxNotice2DDocData,
  TaxNotice2DDocResult,
  TaxVerificationLog,
} from "./tax-verification";

// ============================================
// EXPORTS LEGAL ENTITIES - Multi-SCI/Sociétés
// ============================================
export type {
  LegalEntityType,
  FiscalRegime,
  TvaRegime,
  GeranceType,
  LegalEntity,
  ApportType,
  DetentionPartsType,
  Civilite,
  EntityAssociate,
  PropertyDetentionType,
  AcquisitionMode,
  CessionMode,
  PropertyOwnership,
  PropertyDetentionMode,
  CreateLegalEntityDTO,
  UpdateLegalEntityDTO,
  CreateEntityAssociateDTO,
  CreatePropertyOwnershipDTO,
  LegalEntityWithStats,
  LegalEntityWithAssociates,
  EntityAssociateWithProfile,
  PropertyOwnershipWithDetails,
} from "./legal-entity";

export {
  ENTITY_TYPE_LABELS,
  FISCAL_REGIME_LABELS,
  DETENTION_TYPE_LABELS,
  ACQUISITION_MODE_LABELS,
  APPORT_TYPE_LABELS,
  ENTITY_TYPE_COLORS,
  ENTITY_TYPE_GROUPS,
  ENTITIES_REQUIRING_SIRET,
  ENTITIES_MIN_2_ASSOCIATES,
  ENTITIES_IR_OPTION,
  ENTITIES_IS_MANDATORY,
} from "./legal-entity";

// ============================================
// EXPORTS BAUX COMMERCIAUX - GAP-003 SOTA 2026
// Code de commerce Articles L145-1 à L145-60
// ============================================
export type {
  CommercialLeaseType,
  CommercialIndex,
  CommercialTVARegime,
  DestinationClause,
  IndexationClause,
  PasDePorte,
  DroitAuBail,
  ClauseResolutoire,
  CommercialGuarantees,
  CommercialLeaseConfig,
  DerogtoireLeaseConfig,
  TriennialPeriod,
  CommercialLeaseTemplateData,
} from "./commercial-lease";

export {
  COMMERCIAL_LEASE_DEFAULTS,
  DEFAULT_COMMERCIAL_369_CONFIG,
  DEFAULT_DEROGATOIRE_CONFIG,
  COMMERCIAL_INDEX_LABELS,
  DESTINATION_CLAUSE_EXAMPLES,
  MAX_DEROGATOIRE_MONTHS,
} from "./commercial-lease";

// ============================================
// EXPORTS BAUX PROFESSIONNELS - GAP-004 SOTA 2026
// Article 57 A de la loi n°86-1290 du 23 décembre 1986
// ============================================
export type {
  ProfessionLiberaleCategory,
  ProfessionalFiscalRegime,
  ProfessionalLegalForm,
  ProfessionalActivityType,
  ProfessionalTenantInfo,
  ProfessionalPremisesConfig,
  ProfessionalIndexation,
  ProfessionalFinancialTerms,
  ProfessionalLeaseConfig,
  ProfessionalLeaseData,
  CreateProfessionalLeaseDTO,
  ProfessionalLeaseTemplateData,
} from "./professional-lease";

export {
  PROFESSION_CATEGORY_LABELS,
  PROFESSION_ACTIVITY_LABELS,
  LEGAL_FORM_LABELS,
  FISCAL_REGIME_LABELS,
  ORDRES_PROFESSIONNELS,
  DEFAULT_PROFESSIONAL_LEASE_CONFIG,
  DEFAULT_PROFESSIONAL_FINANCIAL_TERMS,
  PROFESSIONAL_LEASE_DURATION,
  PROFESSIONS_WITH_ORDER,
  HEALTH_PROFESSIONS,
  isOrderedProfession,
  isHealthProfession,
  getOrdreForProfession,
} from "./professional-lease";

// ============================================
// EXPORTS EDL COMMERCIAL - GAP-007 SOTA 2026
// État des lieux pour locaux commerciaux/professionnels
// ============================================
export type {
  CommercialInspectionCategory,
  ProfessionalInspectionCategory,
  EDLCommercialCategory,
  CommercialPremiseType,
  CommercialItemCondition,
  ComplianceLevel,
  CommercialInspectionItem,
  FacadeVitrineInspection,
  EnseigneInspection,
  InstallationsTechniquesInspection,
  SecuriteIncendieInspection,
  AccessibilitePMRInspection,
  CabinetMedicalInspection,
  CompteursReseauxInspection,
  EDLCommercial,
  EquipementBailleur,
  CleRemise,
  DocumentAnnexe,
  DifferenceConstatee,
  CreateEDLCommercialDTO,
  AddInspectionItemDTO,
  ValidateEDLCommercialDTO,
} from "./edl-commercial";

export {
  COMMERCIAL_INSPECTION_CATEGORY_LABELS,
  PROFESSIONAL_INSPECTION_CATEGORY_LABELS,
  COMMERCIAL_CONDITION_LABELS,
  COMPLIANCE_LEVEL_LABELS,
  COMMERCIAL_PREMISE_TYPE_LABELS,
  CLE_TYPE_LABELS,
  COMMERCIAL_CONDITION_COLORS,
  COMPLIANCE_LEVEL_COLORS,
  ERP_CATEGORIES,
  ERP_TYPES,
  COMMERCIAL_COMPLIANCE_CHECKLIST,
  COMMERCIAL_INSPECTION_ITEMS_BY_CATEGORY,
  MEDICAL_INSPECTION_ITEMS,
} from "./edl-commercial";

// ============================================
// EXPORTS LOCATION-GÉRANCE - GAP-005 SOTA 2026
// Code de commerce Articles L144-1 à L144-13
// ============================================
export type {
  FondsDeCommerceType,
  LicenceType,
  LoueurFondsType,
  GerantType,
  RedevanceType,
  LoueurFonds,
  GerantFonds,
  LicenceExploitation,
  EquipementFonds,
  ElementCorporel,
  ElementIncorporel,
  FondsDeCommerce,
  RedevanceConfig,
  CautionnementGerance,
  ObligationsGerant,
  ClausesParticulieres,
  SolidariteFiscale,
  PublicationJAL,
  LocationGeranceContract,
  CreateLocationGeranceDTO,
  LocationGeranceTemplateData,
} from "./location-gerance";

export {
  FONDS_TYPE_LABELS,
  LICENCE_TYPE_LABELS,
  REDEVANCE_TYPE_LABELS,
  LOUEUR_TYPE_LABELS,
  GERANT_TYPE_LABELS,
  FONDS_TYPE_COLORS,
  FONDS_TYPE_ICONS,
  OBLIGATIONS_LEGALES_GERANT,
  OBLIGATIONS_LEGALES_LOUEUR,
  DOCUMENTS_REQUIS_LOCATION_GERANCE,
  CLAUSES_RECOMMANDEES,
  DEFAULT_LOCATION_GERANCE_CONFIG,
  LOCATION_GERANCE_DURATION,
  requiresLicence,
  getFondsTypeGroup,
} from "./location-gerance";

// ============================================
// EXPORTS TAXE DE SÉJOUR - GAP-006 SOTA 2026
// Article L2333-26 à L2333-47 du CGCT
// ============================================
export type {
  HebergementTouristiqueType,
  ModePerceptionTaxe,
  DeclarationTaxeStatus,
  MotifExoneration,
  TaxeSejourCommuneConfig,
  OccupantSejour,
  SejourTouristique,
  DeclarationTaxeSejour,
  CreateSejourTouristiqueDTO,
  UpdateSejourTouristiqueDTO,
  CreateDeclarationDTO,
  CalculTaxeSejourResult,
  TaxeSejourStats,
} from "./taxe-sejour";

export {
  TARIFS_PLAFONDS_2024,
  HEBERGEMENT_TYPE_LABELS,
  EXONERATION_LABELS,
  HEBERGEMENT_TYPE_GROUPS,
  HEBERGEMENT_TYPES_TALOK,
  DEFAULT_TAXE_SEJOUR_CONFIG,
  VILLES_ENREGISTREMENT_OBLIGATOIRE,
  calculerTaxeSejour,
  estMineurALaDate,
  getTarifPlafond,
  validerTauxCommunal,
  requiresNumeroEnregistrement,
} from "./taxe-sejour";

