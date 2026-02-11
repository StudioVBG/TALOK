/**
 * Configuration centralisée des buckets Supabase Storage
 *
 * Tous les noms de buckets doivent être référencés depuis ce fichier
 * pour éviter les chaînes hardcodées et faciliter un éventuel renommage.
 */

export const STORAGE_BUCKETS = {
  /** Documents privés : baux, EDL, quittances, assurances, etc. */
  DOCUMENTS: "documents",
  /** Photos de propriétés */
  PROPERTY_PHOTOS: "property-photos",
  /** Avatars utilisateurs (public) */
  AVATARS: "avatars",
  /** Documents d'identité (pièces d'identité, CNI, passeport) */
  IDENTITY: "identity",
  /** Documents d'assemblée de copropriété */
  ASSEMBLY_DOCUMENTS: "assembly-documents",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
