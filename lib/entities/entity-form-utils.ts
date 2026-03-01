/**
 * Utilitaires partagés pour les formulaires d'entités juridiques
 * Extraits de app/owner/entities/new/page.tsx pour éviter les exports
 * non-valides depuis une page Next.js App Router.
 */

export interface EntityFormData {
  // Step 1: Type
  entityType: string;

  // Step 2: Legal info
  nom: string;
  formeJuridique: string;
  regimeFiscal: string;
  siret: string;
  capitalSocial: string;
  nombreParts: string;
  rcsVille: string;
  dateCreation: string;
  numeroTva: string;
  objetSocial: string;

  // Step 3: Address
  adresseSiege: string;
  codePostalSiege: string;
  villeSiege: string;
  emailEntite: string;
  telephoneEntite: string;

  // Step 4: Representative
  representantMode: "self" | "other";
  representantPrenom: string;
  representantNom: string;
  representantQualite: string;
  representantDateNaissance: string;

  // Step 5: Bank
  iban: string;
  bic: string;
  banqueNom: string;
}

/** Entity types forcés en IS (impôt sur les sociétés) */
const FORCE_IS_TYPES = ["sci_is", "sas", "sasu", "sa"];

/** Vérifie si le régime fiscal est verrouillé pour ce type d'entité */
export function isRegimeFiscalLocked(entityType: string): boolean {
  return FORCE_IS_TYPES.includes(entityType);
}

/** Retourne le régime fiscal par défaut pour un type d'entité */
export function getDefaultRegimeFiscal(entityType: string): string {
  if (FORCE_IS_TYPES.includes(entityType)) return "is";
  return "ir";
}
