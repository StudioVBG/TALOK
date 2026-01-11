/**
 * Types pour le service de vérification d'avis d'imposition français
 *
 * Ce module permet de vérifier l'authenticité des avis d'imposition
 * via l'API publique impots.gouv.fr (SVAIR) et l'API Particulier.
 *
 * @see https://www.impots.gouv.fr/verifavis2-api/front
 * @see https://particulier.api.gouv.fr
 */

// ============================================================================
// TYPES D'ENTRÉE
// ============================================================================

/**
 * Paramètres de vérification d'un avis d'imposition
 */
export interface TaxNoticeVerificationRequest {
  /** Numéro fiscal du contribuable (13 chiffres) */
  numeroFiscal: string;
  /** Référence de l'avis d'imposition (13 caractères alphanumériques) */
  referenceAvis: string;
}

/**
 * Configuration du service de vérification
 */
export interface TaxVerificationConfig {
  /** Mode d'API à utiliser */
  mode: TaxVerificationMode;
  /** Token API Particulier (requis pour mode 'api_particulier') */
  apiToken?: string;
  /** Timeout en millisecondes (défaut: 10000) */
  timeout?: number;
  /** Environnement API Particulier */
  environment?: "test" | "production";
}

/**
 * Modes de vérification disponibles
 */
export type TaxVerificationMode =
  | "web_scraping"      // Via interface web impots.gouv.fr (limité)
  | "api_particulier"   // Via API Particulier officielle (recommandé)
  | "2d_doc";           // Via scan du code 2D-Doc

// ============================================================================
// TYPES DE RÉPONSE - API PARTICULIER
// ============================================================================

/**
 * Informations d'un déclarant (contribuable)
 */
export interface TaxDeclarant {
  /** Nom de famille */
  nom: string;
  /** Nom de naissance (si différent) */
  nomNaissance: string;
  /** Prénoms */
  prenoms: string;
  /** Date de naissance au format JJ/MM/AAAA */
  dateNaissance: string;
}

/**
 * Informations du foyer fiscal
 */
export interface TaxFoyerFiscal {
  /** Année d'imposition */
  annee: number;
  /** Adresse complète du foyer fiscal */
  adresse: string;
}

/**
 * Situation familiale du foyer fiscal
 */
export type TaxSituationFamille =
  | "Célibataire"
  | "Marié(e)"
  | "Pacsé(e)"
  | "Divorcé(e)"
  | "Séparé(e)"
  | "Veuf(ve)";

/**
 * Réponse complète de l'API Particulier pour un avis d'imposition
 */
export interface TaxNoticeApiResponse {
  /** Premier déclarant */
  declarant1: TaxDeclarant;
  /** Second déclarant (si déclaration commune) */
  declarant2?: TaxDeclarant;
  /** Informations du foyer fiscal */
  foyerFiscal: TaxFoyerFiscal;
  /** Date de mise en recouvrement (JJ/MM/AAAA) */
  dateRecouvrement: string;
  /** Date d'établissement de l'avis (JJ/MM/AAAA) */
  dateEtablissement: string;
  /** Nombre de parts fiscales */
  nombreParts: number;
  /** Situation familiale */
  situationFamille: TaxSituationFamille;
  /** Nombre de personnes à charge */
  nombrePersonnesCharge: number;
  /** Revenu brut global en euros */
  revenuBrutGlobal: number;
  /** Revenu imposable en euros */
  revenuImposable: number;
  /** Montant de l'impôt sur le revenu en euros (peut être null si non imposable) */
  montantImpot: number | null;
  /** Revenu fiscal de référence en euros */
  revenuFiscalReference: number;
  /** Année d'imposition (format AAAA) */
  anneeImpots: string;
  /** Année des revenus déclarés (format AAAA) */
  anneeRevenus: string;
}

// ============================================================================
// TYPES DE RÉPONSE - SERVICE TALOK
// ============================================================================

/**
 * Statut de conformité de l'avis d'imposition
 */
export type TaxNoticeConformityStatus =
  | "conforme"           // L'avis correspond au dernier avis connu
  | "non_conforme"       // Un avis plus récent existe ou données invalides
  | "situation_partielle" // Cas de veuvage avec deux déclarations
  | "introuvable"        // Aucun avis trouvé avec ces identifiants
  | "erreur";            // Erreur technique

/**
 * Résultat de la vérification d'un avis d'imposition
 */
export interface TaxNoticeVerificationResult {
  /** Vérification réussie */
  success: boolean;
  /** Statut de conformité */
  status: TaxNoticeConformityStatus;
  /** Message explicatif */
  message: string;
  /** Données de l'avis (si disponibles et conformes) */
  data?: TaxNoticeApiResponse;
  /** Informations simplifiées pour affichage */
  summary?: TaxNoticeSummary;
  /** Date et heure de la vérification */
  verifiedAt: string;
  /** Mode de vérification utilisé */
  verificationMode: TaxVerificationMode;
}

/**
 * Résumé simplifié d'un avis d'imposition pour affichage
 */
export interface TaxNoticeSummary {
  /** Nom complet du/des déclarant(s) */
  nomComplet: string;
  /** Année des revenus */
  anneeRevenus: string;
  /** Revenu fiscal de référence formaté */
  revenuFiscalReference: string;
  /** Nombre de parts fiscales */
  nombreParts: number;
  /** Situation familiale */
  situationFamille: string;
  /** Adresse du foyer fiscal */
  adresse: string;
  /** L'avis est-il récent (moins de 2 ans) */
  isRecent: boolean;
}

// ============================================================================
// TYPES D'ERREUR
// ============================================================================

/**
 * Codes d'erreur du service de vérification
 */
export type TaxVerificationErrorCode =
  | "INVALID_NUMERO_FISCAL"      // Numéro fiscal invalide (format)
  | "INVALID_REFERENCE_AVIS"     // Référence d'avis invalide (format)
  | "AVIS_NOT_FOUND"            // Avis non trouvé
  | "API_UNAVAILABLE"           // API indisponible
  | "API_TOKEN_INVALID"         // Token API invalide
  | "API_TOKEN_MISSING"         // Token API manquant
  | "RATE_LIMITED"              // Trop de requêtes
  | "NETWORK_ERROR"             // Erreur réseau
  | "TIMEOUT"                   // Délai dépassé
  | "UNKNOWN_ERROR";            // Erreur inconnue

/**
 * Erreur de vérification d'avis d'imposition
 */
export interface TaxVerificationError {
  /** Code d'erreur */
  code: TaxVerificationErrorCode;
  /** Message d'erreur lisible */
  message: string;
  /** Détails techniques (pour debug) */
  details?: string;
  /** Peut-on réessayer */
  retryable: boolean;
}

// ============================================================================
// TYPES POUR LE 2D-DOC
// ============================================================================

/**
 * Données extraites d'un code 2D-Doc d'avis d'imposition
 */
export interface TaxNotice2DDocData {
  /** Version du format 2D-Doc */
  version: string;
  /** Autorité émettrice (DGFIP) */
  authority: string;
  /** Date de création du document */
  dateCreation: string;
  /** Numéro fiscal (partiellement masqué) */
  numeroFiscalMasque: string;
  /** Revenu fiscal de référence */
  revenuFiscalReference: number;
  /** Nombre de parts */
  nombreParts: number;
  /** Signature cryptographique valide */
  signatureValide: boolean;
}

/**
 * Résultat de la vérification via 2D-Doc
 */
export interface TaxNotice2DDocResult {
  /** Scan réussi */
  success: boolean;
  /** Document authentique */
  authentic: boolean;
  /** Données extraites */
  data?: TaxNotice2DDocData;
  /** Message d'erreur si échec */
  error?: string;
}

// ============================================================================
// TYPES POUR L'HISTORIQUE
// ============================================================================

/**
 * Enregistrement d'une vérification dans l'historique
 */
export interface TaxVerificationLog {
  /** Identifiant unique */
  id: string;
  /** Identifiant de l'utilisateur qui a effectué la vérification */
  userId: string;
  /** Identifiant du locataire vérifié (si applicable) */
  tenantId?: string;
  /** Identifiant du dossier de candidature (si applicable) */
  applicationId?: string;
  /** Numéro fiscal (hashé pour confidentialité) */
  numeroFiscalHash: string;
  /** Référence de l'avis (hashée) */
  referenceAvisHash: string;
  /** Statut de conformité obtenu */
  status: TaxNoticeConformityStatus;
  /** Mode de vérification utilisé */
  verificationMode: TaxVerificationMode;
  /** Date et heure de la vérification */
  createdAt: string;
  /** Adresse IP de la requête (pour audit) */
  ipAddress?: string;
}
