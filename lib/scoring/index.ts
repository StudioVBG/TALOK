/**
 * Module de Scoring de Solvabilité
 * 
 * Ce module fournit un algorithme complet pour évaluer la solvabilité
 * d'un candidat locataire selon les normes françaises.
 * 
 * Sources:
 * - ANIL (Agence Nationale pour l'Information sur le Logement)
 * - Loi ALUR (liste des documents autorisés)
 * - Banque de France (critères GLI)
 * - INSEE (statistiques emploi)
 */

export * from './types';
export * from './calculate-score';

// Re-export principal pour usage simplifié
export { calculateSolvabilityScore as calculateScore } from './calculate-score';

