/**
 * Types TypeScript pour le support multi-sociétés propriétaire
 *
 * Ce fichier contient les types pour:
 * - Organizations (SCI, SARL, nom propre, etc.)
 * - Buildings (Immeubles)
 * - Caretakers (Gardiens)
 * - Insurance policies (Assurances)
 * - Permis de louer
 * - Meters (Compteurs Linky, etc.)
 * - Diagnostics immobiliers
 *
 * Migration: 20260107000000_multi_company_owner_complete.sql
 */

// ============================================
// 1. ORGANISATIONS / SOCIÉTÉS
// ============================================

export type OrganizationType =
  | 'particulier'      // Bien en nom propre
  | 'sci_ir'           // SCI à l'IR (transparence fiscale)
  | 'sci_is'           // SCI à l'IS (opaque fiscalement)
  | 'sarl_famille'     // SARL de famille
  | 'sas'              // SAS immobilière
  | 'indivision'       // Indivision successorale ou achat conjoint
  | 'usufruit'         // Démembrement: usufruitier
  | 'nue_propriete'    // Démembrement: nu-propriétaire
  | 'lmnp'             // LMNP (Loueur Meublé Non Professionnel)
  | 'lmp';             // LMP (Loueur Meublé Professionnel)

export type RegimeFiscal =
  | 'micro_foncier'        // Revenus fonciers < 15000€
  | 'reel_simplifie'       // Régime réel simplifié
  | 'reel_normal'          // Régime réel normal
  | 'micro_bic'            // LMNP micro-BIC
  | 'bic_reel'             // LMNP/LMP réel
  | 'is';                  // Impôt sur les sociétés

export interface OrganizationAssocie {
  nom: string;
  prenom: string;
  parts_pct: number;
  role?: string; // 'gérant', 'associé', etc.
}

export interface Organization {
  id: string;
  owner_profile_id: string;

  // Identification
  nom_entite: string;
  type: OrganizationType;

  // Informations légales
  siret?: string | null;
  siren?: string | null;
  tva_intracom?: string | null;
  rcs_ville?: string | null;
  capital_social?: number | null;
  date_creation?: string | null; // Date ISO

  // Forme juridique
  forme_juridique?: string | null;
  objet_social?: string | null;

  // Coordonnées siège
  adresse_siege?: string | null;
  code_postal_siege?: string | null;
  ville_siege?: string | null;
  pays_siege: string;

  // Contact
  email_contact?: string | null;
  telephone_contact?: string | null;

  // Bancaire
  iban?: string | null;
  bic?: string | null;
  banque_nom?: string | null;
  titulaire_compte?: string | null;

  // Représentant légal
  representant_nom?: string | null;
  representant_prenom?: string | null;
  representant_fonction?: string | null;

  // Associés
  associes: OrganizationAssocie[];

  // Fiscalité
  regime_fiscal?: RegimeFiscal | null;
  tva_applicable: boolean;
  tva_taux: number;
  cfe_exonere: boolean;

  // Statut
  is_default: boolean;
  is_active: boolean;

  // Métadonnées
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationFormData {
  nom_entite: string;
  type: OrganizationType;
  siret?: string;
  siren?: string;
  tva_intracom?: string;
  forme_juridique?: string;
  capital_social?: number;
  date_creation?: string;
  adresse_siege?: string;
  code_postal_siege?: string;
  ville_siege?: string;
  email_contact?: string;
  telephone_contact?: string;
  iban?: string;
  bic?: string;
  banque_nom?: string;
  representant_nom?: string;
  representant_prenom?: string;
  representant_fonction?: string;
  associes?: OrganizationAssocie[];
  regime_fiscal?: RegimeFiscal;
  tva_applicable?: boolean;
  notes?: string;
}

// Labels pour affichage
export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  particulier: 'Nom propre',
  sci_ir: 'SCI à l\'IR',
  sci_is: 'SCI à l\'IS',
  sarl_famille: 'SARL de famille',
  sas: 'SAS immobilière',
  indivision: 'Indivision',
  usufruit: 'Usufruitier',
  nue_propriete: 'Nu-propriétaire',
  lmnp: 'LMNP',
  lmp: 'LMP',
};

export const REGIME_FISCAL_LABELS: Record<RegimeFiscal, string> = {
  micro_foncier: 'Micro-foncier',
  reel_simplifie: 'Réel simplifié',
  reel_normal: 'Réel normal',
  micro_bic: 'Micro-BIC',
  bic_reel: 'BIC réel',
  is: 'Impôt sur les sociétés',
};

// ============================================
// 2. IMMEUBLES
// ============================================

export type BuildingType =
  | 'residence'            // Résidence classique
  | 'copropriete'          // Copropriété avec syndic
  | 'mono_proprietaire'    // Immeuble entier (1 seul proprio)
  | 'mixte'                // Habitation + Commercial
  | 'bureaux'              // Immeuble de bureaux
  | 'commercial';          // Centre commercial / Galerie

export interface Building {
  id: string;
  organization_id?: string | null;
  owner_profile_id: string;

  // Identification
  nom: string;
  code_interne?: string | null;

  // Adresse
  adresse: string;
  complement_adresse?: string | null;
  code_postal: string;
  ville: string;
  departement?: string | null;
  pays: string;
  latitude?: number | null;
  longitude?: number | null;

  // Caractéristiques
  annee_construction?: number | null;
  nb_etages?: number | null;
  nb_lots_total?: number | null;
  nb_lots_proprio?: number | null;
  surface_totale_m2?: number | null;

  // Type
  type_immeuble?: BuildingType | null;

  // Copropriété
  syndic_nom?: string | null;
  syndic_contact?: string | null;
  syndic_email?: string | null;
  syndic_telephone?: string | null;
  numero_immatriculation_copro?: string | null;
  tantieme_total?: number | null;

  // Équipements communs
  has_ascenseur: boolean;
  has_parking_commun: boolean;
  has_local_velo: boolean;
  has_local_poubelles: boolean;
  has_interphone: boolean;
  has_digicode: boolean;
  has_videosurveillance: boolean;

  // Gardien
  has_gardien: boolean;
  gardien_id?: string | null;

  // Assurance MRI
  assurance_mri_id?: string | null;

  // Métadonnées
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// 3. GARDIENS D'IMMEUBLE
// ============================================

export type CaretakerContractType = 'cdi' | 'cdd' | 'prestataire' | 'benevole';

export type CaretakerMission =
  | 'entretien_parties_communes'
  | 'sortie_poubelles'
  | 'reception_colis'
  | 'surveillance'
  | 'petits_travaux'
  | 'distribution_courrier'
  | 'accueil_visiteurs';

export interface CaretakerSchedule {
  lundi?: { debut: string; fin: string };
  mardi?: { debut: string; fin: string };
  mercredi?: { debut: string; fin: string };
  jeudi?: { debut: string; fin: string };
  vendredi?: { debut: string; fin: string };
  samedi?: { debut: string; fin: string };
  dimanche?: { debut: string; fin: string };
}

export interface Caretaker {
  id: string;
  building_id: string;

  // Identité
  civilite?: 'M.' | 'Mme' | 'Mlle' | null;
  nom: string;
  prenom: string;

  // Contact
  telephone?: string | null;
  telephone_urgence?: string | null;
  email?: string | null;

  // Logement de fonction
  has_logement_fonction: boolean;
  logement_etage?: string | null;
  logement_porte?: string | null;

  // Horaires
  horaires: CaretakerSchedule;
  jours_presence: string[];

  // Missions
  missions: CaretakerMission[];

  // Contrat
  type_contrat?: CaretakerContractType | null;
  date_debut_contrat?: string | null;
  date_fin_contrat?: string | null;
  employeur?: 'syndic' | 'proprietaire' | 'prestataire' | null;

  // Statut
  is_active: boolean;
  notes?: string | null;

  created_at: string;
  updated_at: string;
}

// ============================================
// 4. ASSURANCES
// ============================================

export type InsuranceType =
  | 'pno'              // Propriétaire Non Occupant
  | 'mri'              // Multirisque Immeuble
  | 'habitation'       // Assurance habitation locataire
  | 'loyers_impayes'   // Garantie Loyers Impayés (GLI)
  | 'protection_juridique'
  | 'rc_proprietaire'  // Responsabilité Civile Propriétaire
  | 'dommages_ouvrage'; // Garantie décennale travaux

export type InsuranceProviderType =
  | 'traditionnel'     // AXA, Allianz, etc.
  | 'digital'          // Luko, Lovys, etc.
  | 'mutuelle'         // MAIF, MACIF, etc.
  | 'courtier';        // Via courtier

export type InsuranceStatus =
  | 'active'
  | 'en_attente'
  | 'resiliee'
  | 'expiree'
  | 'suspendue';

export type PaymentPeriodicity =
  | 'mensuelle'
  | 'trimestrielle'
  | 'semestrielle'
  | 'annuelle';

export interface InsuranceGuarantee {
  nom: string;
  plafond?: number;
  franchise?: number;
}

export interface InsurancePolicy {
  id: string;

  // Rattachement
  property_id?: string | null;
  building_id?: string | null;
  lease_id?: string | null;
  organization_id?: string | null;
  owner_profile_id: string;

  // Type
  type_assurance: InsuranceType;

  // Assureur
  assureur_nom: string;
  assureur_type?: InsuranceProviderType | null;

  // Contrat
  numero_contrat?: string | null;
  date_effet: string;
  date_echeance: string;
  date_resiliation?: string | null;

  // Primes
  prime_annuelle?: number | null;
  prime_mensuelle?: number | null;
  periodicite_paiement?: PaymentPeriodicity | null;
  jour_prelevement?: number | null;

  // Garanties
  garanties: InsuranceGuarantee[];
  franchise_generale?: number | null;
  plafond_general?: number | null;

  // Documents
  attestation_document_id?: string | null;
  conditions_generales_document_id?: string | null;

  // Contact assureur
  contact_nom?: string | null;
  contact_telephone?: string | null;
  contact_email?: string | null;
  espace_client_url?: string | null;

  // Rappels
  rappel_echeance_jours: number;
  rappel_envoye: boolean;

  // Statut
  statut: InsuranceStatus;

  // Métadonnées
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export const INSURANCE_TYPE_LABELS: Record<InsuranceType, string> = {
  pno: 'Propriétaire Non Occupant (PNO)',
  mri: 'Multirisque Immeuble (MRI)',
  habitation: 'Assurance Habitation',
  loyers_impayes: 'Garantie Loyers Impayés (GLI)',
  protection_juridique: 'Protection Juridique',
  rc_proprietaire: 'Responsabilité Civile',
  dommages_ouvrage: 'Dommages Ouvrage',
};

// ============================================
// 5. PERMIS DE LOUER
// ============================================

export type PermisObligationType = 'declaration' | 'autorisation';

export type PermisComplianceStatus =
  | 'non_verifie'
  | 'non_requis'
  | 'en_cours'
  | 'approuve'
  | 'refuse'
  | 'expire'
  | 'a_renouveler';

export interface PermisLouerZone {
  id: string;
  commune: string;
  code_insee?: string | null;
  code_postal: string;
  departement: string;
  region?: string | null;
  zone_nom?: string | null;
  zone_description?: string | null;
  type_obligation: PermisObligationType;
  date_entree_vigueur: string;
  date_fin_vigueur?: string | null;
  deliberation_reference?: string | null;
  lien_deliberation?: string | null;
  duree_validite_mois: number;
  documents_requis: Array<{
    type: string;
    obligatoire: boolean;
    description?: string;
  }>;
  mairie_service?: string | null;
  mairie_adresse?: string | null;
  mairie_telephone?: string | null;
  mairie_email?: string | null;
  mairie_url?: string | null;
  cout_dossier: number;
  amende_non_declaration: number;
  amende_recidive: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PropertyPermisCompliance {
  id: string;
  property_id: string;
  permis_zone_id?: string | null;
  permis_requis: boolean;
  permis_type?: 'declaration' | 'autorisation' | 'non_requis' | null;
  date_soumission?: string | null;
  numero_dossier?: string | null;
  numero_autorisation?: string | null;
  date_obtention?: string | null;
  date_expiration?: string | null;
  documents_soumis: Array<{
    document_id: string;
    type: string;
    date_soumis: string;
  }>;
  documents_manquants?: string[] | null;
  statut: PermisComplianceStatus;
  motif_refus?: string | null;
  date_inspection?: string | null;
  rapport_inspection_document_id?: string | null;
  rappel_expiration_envoye: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 6. COMPTEURS / LINKY
// ============================================

export type MeterType =
  | 'electricite'
  | 'gaz'
  | 'eau_froide'
  | 'eau_chaude'
  | 'chauffage';

export type ElectricMeterType =
  | 'linky'
  | 'electronique'
  | 'electromecanique'
  | 'inconnu';

export type TariffOption =
  | 'base'
  | 'hp_hc'
  | 'tempo'
  | 'ejp';

export type MeterReadingType =
  | 'entree'
  | 'sortie'
  | 'periodique'
  | 'estimation'
  | 'auto'
  | 'telereleve';

export type MeterReadingSource =
  | 'manuel'
  | 'enedis_api'
  | 'grdf_api'
  | 'photo'
  | 'fournisseur';

export interface PropertyMeter {
  id: string;
  property_id: string;

  // Type
  type_compteur: MeterType;

  // Identification
  numero_compteur?: string | null;
  prm?: string | null;        // Point Référence Mesure (Linky)
  pce?: string | null;        // Point de Comptage (Gaz)
  pdl?: string | null;        // Point De Livraison (ancien)

  // Type compteur électrique
  type_compteur_elec?: ElectricMeterType | null;

  // Localisation
  emplacement?: string | null;
  etage?: string | null;
  acces_notes?: string | null;

  // Puissance (électricité)
  puissance_souscrite?: number | null;
  option_tarifaire?: TariffOption | null;

  // Dernier relevé
  dernier_releve_date?: string | null;
  dernier_releve_index?: number | null;
  dernier_releve_index_hp?: number | null;
  dernier_releve_index_hc?: number | null;

  // Fournisseur
  fournisseur_actuel?: string | null;
  contrat_locataire: boolean;

  // Enedis Data Connect
  enedis_consent: boolean;
  enedis_consent_date?: string | null;
  last_sync_date?: string | null;

  // Métadonnées
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MeterReading {
  id: string;
  meter_id: string;
  lease_id?: string | null;

  date_releve: string;
  type_releve: MeterReadingType;

  // Valeurs
  index_kwh?: number | null;
  index_hp?: number | null;
  index_hc?: number | null;
  index_m3?: number | null;

  consommation_depuis_dernier?: number | null;

  source: MeterReadingSource;
  photo_document_id?: string | null;
  releve_par_profile_id?: string | null;

  notes?: string | null;
  created_at: string;
}

// ============================================
// 7. DIAGNOSTICS IMMOBILIERS
// ============================================

export type DiagnosticType =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'electricite'
  | 'gaz'
  | 'termites'
  | 'erp'
  | 'assainissement'
  | 'merule'
  | 'bruit'
  | 'carrez'
  | 'boutin';

export interface PropertyDiagnostic {
  id: string;
  property_id: string;
  type_diagnostic: DiagnosticType;
  date_realisation: string;
  date_validite?: string | null;
  numero_rapport?: string | null;
  diagnostiqueur_nom?: string | null;
  diagnostiqueur_societe?: string | null;
  diagnostiqueur_certification?: string | null;
  diagnostiqueur_assurance?: string | null;
  resultat?: string | null;
  observations?: string | null;
  document_id?: string | null;
  is_valid: boolean;
  created_at: string;
  updated_at: string;
}

export const DIAGNOSTIC_TYPE_LABELS: Record<DiagnosticType, string> = {
  dpe: 'Diagnostic de Performance Énergétique',
  amiante: 'État Amiante',
  plomb: 'Constat de Risque d\'Exposition au Plomb',
  electricite: 'Diagnostic Électricité',
  gaz: 'Diagnostic Gaz',
  termites: 'État Termites',
  erp: 'État des Risques et Pollutions',
  assainissement: 'Diagnostic Assainissement',
  merule: 'État Mérule',
  bruit: 'État des Nuisances Sonores',
  carrez: 'Mesurage Loi Carrez',
  boutin: 'Surface Habitable (Boutin)',
};

// Durées de validité par diagnostic (en années, null = illimité si pas de travaux)
export const DIAGNOSTIC_VALIDITY_YEARS: Record<DiagnosticType, number | null> = {
  dpe: 10,
  amiante: null, // Illimité si négatif
  plomb: null,   // Illimité si négatif, 6 ans si positif (location)
  electricite: 6,
  gaz: 6,
  termites: 0.5, // 6 mois
  erp: 0.5,      // 6 mois
  assainissement: 3,
  merule: null,  // Pas de durée légale
  bruit: null,   // Illimité
  carrez: null,  // Illimité sauf travaux
  boutin: null,  // Illimité sauf travaux
};

// ============================================
// 8. TAILLE DE LOGEMENT
// ============================================

export type TailleLogement =
  | 'studio'
  | 'T1'
  | 'T1_bis'
  | 'T2'
  | 'T3'
  | 'T4'
  | 'T5'
  | 'T6'
  | 'T7_plus'
  | 'loft'
  | 'duplex'
  | 'triplex'
  | 'maison_plain_pied'
  | 'maison_etage'
  | 'local_pro'
  | 'autre';

export const TAILLE_LOGEMENT_LABELS: Record<TailleLogement, string> = {
  studio: 'Studio',
  T1: 'T1 (1 pièce)',
  T1_bis: 'T1 bis',
  T2: 'T2 (2 pièces)',
  T3: 'T3 (3 pièces)',
  T4: 'T4 (4 pièces)',
  T5: 'T5 (5 pièces)',
  T6: 'T6 (6 pièces)',
  T7_plus: 'T7 et plus',
  loft: 'Loft',
  duplex: 'Duplex',
  triplex: 'Triplex',
  maison_plain_pied: 'Maison plain-pied',
  maison_etage: 'Maison à étages',
  local_pro: 'Local professionnel',
  autre: 'Autre',
};

// ============================================
// 9. CLAUSE RÉSOLUTOIRE
// ============================================

export interface ClauseResolutoire {
  delai_commandement_jours: number;           // Délai avant commandement de payer
  delai_paiement_apres_commandement_jours: number; // Délai pour payer après commandement
  montant_minimum_impaye_euros?: number | null;    // Seuil déclenchement (null = tout impayé)
  clause_penale_pct: number;                       // % clause pénale
  interets_retard_pct?: number | null;            // % intérêts de retard
  frais_recouvrement_euros?: number | null;       // Frais de recouvrement forfaitaires
  exclusion_treve_hivernale: boolean;             // Si true, ne s'applique pas (rare)
  procedure_automatique: boolean;                  // Lancer procédure auto si conditions réunies
}

export const DEFAULT_CLAUSE_RESOLUTOIRE: ClauseResolutoire = {
  delai_commandement_jours: 30,
  delai_paiement_apres_commandement_jours: 60,
  montant_minimum_impaye_euros: null,
  clause_penale_pct: 10,
  interets_retard_pct: null,
  frais_recouvrement_euros: null,
  exclusion_treve_hivernale: false,
  procedure_automatique: true,
};

// ============================================
// 10. PROFIL PROPRIÉTAIRE ÉTENDU
// ============================================

export type SituationFamiliale =
  | 'celibataire'
  | 'marie'
  | 'pacse'
  | 'divorce'
  | 'veuf'
  | 'union_libre';

export type RegimeMatrimonial =
  | 'communaute_reduite_acquets'
  | 'communaute_universelle'
  | 'separation_biens'
  | 'participation_acquets';

export interface OwnerProfileExtended {
  profile_id: string;

  // Informations de base (existantes)
  type: 'particulier' | 'societe';
  siret?: string | null;
  tva?: string | null;
  iban?: string | null;
  adresse_facturation?: string | null;

  // Nouvelles informations personnelles
  civilite?: 'M.' | 'Mme' | 'Mlle' | null;
  nom_naissance?: string | null;
  lieu_naissance?: string | null;
  nationalite: string;

  // Adresse personnelle
  adresse_personnelle?: string | null;
  code_postal_personnel?: string | null;
  ville_personnelle?: string | null;
  pays_personnel: string;

  // Contact
  telephone_fixe?: string | null;
  telephone_mobile?: string | null;
  email_secondaire?: string | null;

  // Profession
  profession?: string | null;

  // Situation familiale
  situation_familiale?: SituationFamiliale | null;
  regime_matrimonial?: RegimeMatrimonial | null;
  conjoint_nom?: string | null;
  conjoint_prenom?: string | null;
  conjoint_accepte_caution: boolean;

  // Préférences
  preferences_communication: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };

  // Onboarding
  onboarding_multi_societe_complete: boolean;
  date_derniere_connexion?: string | null;

  created_at: string;
  updated_at: string;
}

// ============================================
// 11. HELPERS & UTILITAIRES
// ============================================

/**
 * Vérifie si une classe DPE permet la location
 */
export function isDPERentalEligible(classeEnergie: string | null | undefined): {
  eligible: boolean;
  reason?: string;
  futureRestriction?: Date;
} {
  if (!classeEnergie) {
    return { eligible: true };
  }

  switch (classeEnergie.toUpperCase()) {
    case 'G':
      return {
        eligible: false,
        reason: 'Les logements classés G sont interdits à la location depuis le 1er janvier 2025',
      };
    case 'F':
      return {
        eligible: true,
        reason: 'Attention: location interdite à partir du 1er janvier 2028',
        futureRestriction: new Date('2028-01-01'),
      };
    case 'E':
      return {
        eligible: true,
        reason: 'Attention: location interdite à partir du 1er janvier 2034',
        futureRestriction: new Date('2034-01-01'),
      };
    default:
      return { eligible: true };
  }
}

/**
 * Calcule la date d'expiration d'un diagnostic
 */
export function getDiagnosticExpirationDate(
  type: DiagnosticType,
  dateRealisation: Date,
  resultat?: string
): Date | null {
  const validityYears = DIAGNOSTIC_VALIDITY_YEARS[type];

  if (validityYears === null) {
    return null; // Pas d'expiration
  }

  // Cas particulier: plomb positif = 6 ans pour location
  if (type === 'plomb' && resultat === 'presence') {
    const expDate = new Date(dateRealisation);
    expDate.setFullYear(expDate.getFullYear() + 6);
    return expDate;
  }

  const expirationDate = new Date(dateRealisation);
  if (validityYears < 1) {
    expirationDate.setMonth(expirationDate.getMonth() + Math.round(validityYears * 12));
  } else {
    expirationDate.setFullYear(expirationDate.getFullYear() + validityYears);
  }

  return expirationDate;
}

/**
 * Formate le type d'organisation pour affichage
 */
export function formatOrganizationType(type: OrganizationType): string {
  return ORGANIZATION_TYPE_LABELS[type] || type;
}

/**
 * Génère le libellé complet d'une organisation
 */
export function getOrganizationDisplayName(org: Organization): string {
  if (org.type === 'particulier') {
    return org.nom_entite;
  }

  const typeLabel = formatOrganizationType(org.type);
  return `${org.nom_entite} (${typeLabel})`;
}
