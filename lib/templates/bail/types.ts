/**
 * Types pour les templates de bail locatif
 * Conforme à la loi ALUR et aux décrets 2015-587 et 2015-981
 */

// ============================================
// TYPES DES PARTIES
// ============================================

export interface Bailleur {
  nom: string;
  prenom: string;
  adresse: string;
  code_postal: string;
  ville: string;
  telephone?: string;
  email?: string;
  type: 'particulier' | 'societe';
  date_naissance?: string;
  lieu_naissance?: string;
  // Si société
  raison_sociale?: string;
  siret?: string;
  representant_nom?: string;
  representant_qualite?: string;
  // Si mandataire
  est_mandataire: boolean;
  mandataire_nom?: string;
  mandataire_adresse?: string;
  mandataire_siret?: string;
}

export interface Locataire {
  nom: string;
  prenom: string;
  date_naissance: string;
  lieu_naissance: string;
  nationalite: string;
  adresse_actuelle?: string;
  telephone?: string;
  email?: string;
}

export interface Garant {
  nom: string;
  prenom: string;
  adresse: string;
  code_postal: string;
  ville: string;
  telephone?: string;
  email?: string;
  type_garantie: 'personne_physique' | 'personne_morale' | 'visale' | 'glj';
  // Si personne physique
  date_naissance?: string;
  lieu_naissance?: string;
  lien_parente?: string;
  // Si personne morale
  raison_sociale?: string;
  siret?: string;
}

// ============================================
// DESCRIPTION DU LOGEMENT
// ============================================

export interface Logement {
  adresse_complete: string;
  complement_adresse?: string;
  code_postal: string;
  ville: string;
  
  // Caractéristiques
  type: 'appartement' | 'maison' | 'studio' | 'chambre' | 'loft';
  surface_habitable: number; // Loi Boutin
  surface_carrez?: number;
  nb_pieces_principales: number;
  nb_chambres?: number;
  etage?: number;
  nb_etages_immeuble?: number;
  ascenseur?: boolean;
  
  // Régime juridique
  regime: 'mono_propriete' | 'copropriete' | 'indivision';
  lot_copropriete?: string;
  
  // Construction
  annee_construction?: number;
  epoque_construction?: 'avant_1949' | '1949_1974' | '1975_1989' | '1990_2005' | 'apres_2005';
  
  // Équipements privatifs
  equipements_privatifs: string[];
  
  // Parties communes accessibles
  parties_communes?: string[];
  
  // Annexes
  annexes: Annexe[];
  
  // Éléments de confort
  chauffage_type?: 'individuel' | 'collectif' | 'aucun';
  chauffage_energie?: 'gaz' | 'electricite' | 'fioul' | 'bois' | 'pompe_chaleur' | 'solaire' | 'autre';
  eau_chaude_type?: 'individuel' | 'collectif' | 'solaire' | 'electrique_indiv' | 'gaz_indiv' | 'autre';
  eau_chaude_energie?: 'gaz' | 'electricite' | 'fioul' | 'solaire' | 'autre';
  
  // Accès technologies
  acces_fibre?: boolean;
  acces_cable?: boolean;
  antenne_collective?: boolean;
}

export interface Annexe {
  type: 'cave' | 'parking' | 'box' | 'garage' | 'jardin' | 'terrasse' | 'balcon' | 'grenier' | 'autre';
  description?: string;
  surface?: number;
  numero?: string;
}

// ============================================
// CONDITIONS DU BAIL
// ============================================

export type TypeBail = 'nu' | 'meuble' | 'colocation' | 'saisonnier' | 'mobilite';

export interface ConditionsBail {
  type_bail: TypeBail;
  usage: 'habitation_principale' | 'mixte_professionnel';
  
  // Durée
  date_debut: string;
  date_fin?: string;
  duree_mois: number;
  tacite_reconduction: boolean;
  
  // Loyer
  loyer_hc: number;
  loyer_en_lettres: string;
  
  // Charges
  charges_type: 'provisions' | 'forfait';
  charges_montant: number;
  charges_periodicite_regularisation?: 'annuelle' | 'trimestrielle';
  
  // Complément
  complement_loyer?: number;
  complement_loyer_justification?: string;
  
  // Dépôt de garantie
  depot_garantie: number;
  depot_garantie_en_lettres: string;
  
  // Paiement
  mode_paiement: 'virement' | 'prelevement' | 'cheque' | 'especes';
  jour_paiement: number; // 1-31
  periodicite_paiement: 'mensuelle' | 'trimestrielle';
  paiement_avance: boolean; // Terme à échoir ou échu
  
  // Révision
  revision_autorisee: boolean;
  indice_reference: 'IRL' | 'ICC' | 'ILAT';
  trimestre_reference?: string; // ex: "T2 2024"
  
  // Historique
  loyer_precedent_locataire?: number;
  date_depart_precedent?: string;
}

// ============================================
// ENCADREMENT DES LOYERS
// ============================================

export interface EncadrementLoyers {
  zone_tendue: boolean;
  commune_encadrement: boolean;
  
  // Références (si encadrement applicable)
  loyer_reference?: number;
  loyer_reference_majore?: number;
  loyer_reference_minore?: number;
  
  // Complément de loyer
  complement_loyer?: number;
  justification_complement?: string;
  
  // Décret applicable
  decret_reference?: string;
  date_decret?: string;
}

// ============================================
// DIAGNOSTICS TECHNIQUES
// ============================================

export interface DiagnosticsTechniques {
  // DPE (toujours obligatoire)
  dpe: {
    date_realisation: string;
    date_validite: string;
    classe_energie: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
    classe_ges: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
    consommation_energie: number; // kWh/m²/an
    emissions_ges: number; // kg CO2/m²/an
    estimation_cout_min?: number;
    estimation_cout_max?: number;
  };
  
  // CREP - Plomb (si construction avant 1949)
  crep?: {
    date_realisation: string;
    presence_plomb: boolean;
    concentration_max?: number;
  };
  
  // État électricité (si installation > 15 ans)
  electricite?: {
    date_realisation: string;
    date_validite: string;
    anomalies_detectees: boolean;
    nb_anomalies?: number;
  };
  
  // État gaz (si installation > 15 ans)
  gaz?: {
    date_realisation: string;
    date_validite: string;
    anomalies_detectees: boolean;
    type_anomalie?: 'DGI' | 'A1' | 'A2';
  };
  
  // ERP - État des Risques et Pollutions
  erp?: {
    date_realisation: string;
    zone_sismique?: '1' | '2' | '3' | '4' | '5';
    zone_radon?: '1' | '2' | '3';
    risques_identifies: string[];
    sinistres_indemnises?: string[];
  };
  
  // Diagnostic bruit (zones aéroportuaires)
  bruit?: {
    date_realisation: string;
    zone_exposition: 'A' | 'B' | 'C' | 'D';
  };
  
  // Amiante (si construction avant 1997)
  amiante?: {
    date_realisation: string;
    presence_amiante: boolean;
    localisation?: string[];
  };
}

// ============================================
// TRAVAUX
// ============================================

export interface TravauxRealises {
  nature: string;
  montant: number;
  date_realisation: string;
  a_charge_de: 'bailleur' | 'locataire';
}

// ============================================
// INVENTAIRE MEUBLÉ
// ============================================

export interface InventaireMeuble {
  // Éléments obligatoires (décret 2015-981)
  literie_couette_couverture: boolean;
  volets_rideaux_chambres: boolean;
  plaques_cuisson: boolean;
  four_ou_micro_ondes: boolean;
  refrigerateur_congelateur: boolean;
  vaisselle_ustensiles: boolean;
  table_sieges: boolean;
  rangements: boolean;
  luminaires: boolean;
  materiel_entretien: boolean;
  
  // Détail des meubles
  meubles: MeubleInventaire[];
}

export interface MeubleInventaire {
  designation: string;
  quantite: number;
  etat: 'neuf' | 'bon_etat' | 'usage' | 'mauvais_etat';
  observations?: string;
}

// ============================================
// COLOCATION
// ============================================

export interface OptionsColocation {
  type_bail: 'unique' | 'individuel';
  clause_solidarite: boolean;
  duree_solidarite_apres_depart?: number; // en mois, max 6
  fin_solidarite_si_remplacant: boolean;
  
  // Si bail unique
  colocataires: Locataire[];
  quote_parts?: { locataire_id: string; pourcentage: number }[];
  
  // Espaces
  parties_privatives?: string[];
  parties_communes_colocation?: string[];
}

// ============================================
// CLAUSES PARTICULIÈRES
// ============================================

export interface ClausesParticulieres {
  // Activité professionnelle
  activite_professionnelle_autorisee: boolean;
  type_activite_autorisee?: string;
  
  // Animaux
  animaux_autorises: boolean;
  restrictions_animaux?: string;
  
  // Sous-location
  sous_location_autorisee: boolean;
  conditions_sous_location?: string;
  
  // Travaux locataire
  travaux_autorises: boolean;
  travaux_specifiques?: string;
  
  // Assurance
  assurance_obligatoire: boolean;
  
  // Clauses libres (validées comme non abusives)
  clauses_additionnelles?: string[];
}

// ============================================
// DOCUMENT COMPLET
// ============================================

export interface BailComplet {
  // Métadonnées
  reference: string;
  date_signature: string;
  lieu_signature: string;
  version: number;
  
  // Parties
  bailleur: Bailleur;
  locataires: Locataire[];
  garants?: Garant[];
  signers?: any[]; // Ajouté pour le dossier de preuve
  
  // Logement
  logement: Logement;
  
  // Conditions
  conditions: ConditionsBail;
  encadrement?: EncadrementLoyers;
  
  // Diagnostics
  diagnostics: DiagnosticsTechniques;
  
  // Travaux
  travaux_realises?: TravauxRealises[];
  
  // Spécifique meublé
  inventaire?: InventaireMeuble;
  
  // Spécifique colocation
  colocation?: OptionsColocation;
  
  // Clauses
  clauses: ClausesParticulieres;
}

// ============================================
// VARIABLES TEMPLATE
// ============================================

export interface TemplateVariables {
  // Système
  '{{DATE_JOUR}}': string;
  '{{REFERENCE_BAIL}}': string;
  
  // Bailleur
  '{{BAILLEUR_NOM_COMPLET}}': string;
  '{{BAILLEUR_ADRESSE}}': string;
  '{{BAILLEUR_TYPE}}': string;
  '{{BAILLEUR_SIRET}}': string;
  
  // Locataire
  '{{LOCATAIRE_NOM_COMPLET}}': string;
  '{{LOCATAIRE_DATE_NAISSANCE}}': string;
  '{{LOCATAIRE_LIEU_NAISSANCE}}': string;
  
  // Logement
  '{{LOGEMENT_ADRESSE}}': string;
  '{{LOGEMENT_TYPE}}': string;
  '{{LOGEMENT_SURFACE}}': string;
  '{{LOGEMENT_NB_PIECES}}': string;
  '{{LOGEMENT_ETAGE}}': string;
  '{{LOGEMENT_EQUIPEMENTS}}': string;
  '{{LOGEMENT_ANNEXES}}': string;
  
  // Bail
  '{{BAIL_TYPE}}': string;
  '{{BAIL_DUREE}}': string;
  '{{BAIL_DATE_DEBUT}}': string;
  '{{BAIL_DATE_FIN}}': string;
  
  // Financier
  '{{LOYER_HC}}': string;
  '{{LOYER_LETTRES}}': string;
  '{{CHARGES_MONTANT}}': string;
  '{{CHARGES_TYPE}}': string;
  '{{LOYER_TOTAL}}': string;
  '{{DEPOT_GARANTIE}}': string;
  '{{DEPOT_LETTRES}}': string;
  
  // Encadrement
  '{{LOYER_REFERENCE}}': string;
  '{{LOYER_REFERENCE_MAJORE}}': string;
  '{{COMPLEMENT_LOYER}}': string;
  '{{COMPLEMENT_JUSTIFICATION}}': string;
  
  // Diagnostics
  '{{DPE_CLASSE}}': string;
  '{{DPE_GES}}': string;
  '{{DPE_CONSOMMATION}}': string;
  
  // Autres
  [key: string]: string;
}

// ============================================
// CONFIGURATION TEMPLATE
// ============================================

export interface LeaseTemplateConfig {
  id: string;
  name: string;
  type_bail: TypeBail;
  version: number;
  is_active: boolean;
  
  // Contenu
  template_content: string; // HTML
  
  // Variables disponibles
  variables: string[];
  
  // Sections optionnelles
  sections: {
    encadrement_loyers: boolean;
    inventaire_meuble: boolean;
    clause_colocation: boolean;
    clause_solidarite: boolean;
  };
  
  // Métadonnées
  created_at: string;
  updated_at: string;
}

