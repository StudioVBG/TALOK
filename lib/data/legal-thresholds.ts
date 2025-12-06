// =====================================================
// Seuils légaux et obligations de vigilance
// Article L.8222-1 du Code du travail
// =====================================================

/**
 * Seuil de vigilance pour les prestations de service
 * Au-delà de ce montant, le donneur d'ordre doit vérifier :
 * - L'attestation de vigilance URSSAF
 * - L'immatriculation (Kbis/SIRET)
 */
export const VIGILANCE_THRESHOLD_HT = 5000; // 5 000 € HT

/**
 * Documents requis au-delà du seuil de vigilance
 */
export const VIGILANCE_REQUIRED_DOCUMENTS = [
  'urssaf',  // Attestation de vigilance URSSAF
  'kbis',    // Extrait Kbis (ou INSEE pour auto-entrepreneur)
] as const;

/**
 * Validité maximum des documents de vigilance (en mois)
 */
export const VIGILANCE_DOCUMENT_MAX_AGE = {
  urssaf: 6,   // 6 mois
  kbis: 3,     // 3 mois
} as const;

/**
 * Types de résultats de vérification de vigilance
 */
export type VigilanceStatus = 'not_required' | 'compliant' | 'non_compliant' | 'partial';

/**
 * Résultat de la vérification de vigilance
 */
export interface VigilanceCheckResult {
  /** Le seuil de vigilance est-il atteint ? */
  isRequired: boolean;
  
  /** Le prestataire est-il conforme ? */
  isCompliant: boolean;
  
  /** Statut global de la vérification */
  status: VigilanceStatus;
  
  /** Montant du devis/intervention */
  amount: number;
  
  /** Seuil applicable */
  threshold: number;
  
  /** Cumul annuel avec ce prestataire (si applicable) */
  yearlyTotal?: number;
  
  /** Documents manquants */
  missingDocuments: string[];
  
  /** Documents expirés */
  expiredDocuments: Array<{
    type: string;
    expiredAt: string;
  }>;
  
  /** Documents valides */
  validDocuments: Array<{
    type: string;
    validUntil: string;
  }>;
  
  /** Message d'avertissement pour le propriétaire */
  warningMessage?: string;
  
  /** Message légal à afficher */
  legalNotice?: string;
  
  /** Le propriétaire peut-il continuer ? */
  canProceed: boolean;
  
  /** Actions requises */
  requiredActions: string[];
}

/**
 * Configuration des messages légaux
 */
export const VIGILANCE_LEGAL_MESSAGES = {
  warning: `⚠️ OBLIGATION DE VIGILANCE : Le montant de cette prestation dépasse le seuil légal de ${VIGILANCE_THRESHOLD_HT.toLocaleString('fr-FR')} € HT.`,
  
  liability: `En tant que donneur d'ordre, vous pouvez être tenu solidairement responsable des cotisations sociales et fiscales impayées en cas de travail dissimulé si vous ne vérifiez pas les documents du prestataire.`,
  
  legalReference: `Article L.8222-1 du Code du travail`,
  
  missingUrssaf: `L'attestation de vigilance URSSAF est manquante ou expirée.`,
  
  missingKbis: `L'extrait Kbis (ou justificatif d'immatriculation) est manquant ou expiré.`,
  
  blocked: `Vous ne pouvez pas accepter ce devis tant que le prestataire n'a pas fourni les documents requis.`,
  
  requestDocuments: `Demander au prestataire de mettre à jour ses documents de conformité.`,
};

/**
 * Vérifie si un document est expiré
 */
export function isDocumentExpired(
  expirationDate: string | Date | null,
  documentType: keyof typeof VIGILANCE_DOCUMENT_MAX_AGE
): boolean {
  if (!expirationDate) return true;
  
  const expDate = new Date(expirationDate);
  const now = new Date();
  
  return expDate < now;
}

/**
 * Calcule la date d'expiration d'un document
 */
export function calculateDocumentExpiration(
  issueDate: string | Date,
  documentType: keyof typeof VIGILANCE_DOCUMENT_MAX_AGE
): Date {
  const maxAge = VIGILANCE_DOCUMENT_MAX_AGE[documentType];
  const date = new Date(issueDate);
  date.setMonth(date.getMonth() + maxAge);
  return date;
}

/**
 * Formate un montant en euros
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

