/**
 * Schémas Zod pour la validation des paramètres de routes API
 * 
 * Ces schémas sont utilisés pour valider les paramètres d'URL (params.id, query params, etc.)
 * et garantir la sécurité des endpoints.
 */

import { z } from "zod";

// ============================================
// PARAMÈTRES D'URL (params)
// ============================================

/**
 * Schéma pour valider un UUID (ID de ressource)
 */
export const uuidParamSchema = z.string().uuid({
  message: "L'ID doit être un UUID valide",
});

/**
 * Schéma pour valider un ID de propriété
 */
export const propertyIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID de bail
 */
export const leaseIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID de facture
 */
export const invoiceIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID de ticket
 */
export const ticketIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID de profil
 */
export const profileIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID d'utilisateur
 */
export const userIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID de document
 */
export const documentIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID de pièce (room)
 */
export const roomIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID de photo
 */
export const photoIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID d'unité (colocation)
 */
export const unitIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID de prestataire
 */
export const providerIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID de work order
 */
export const workOrderIdParamSchema = uuidParamSchema;

/**
 * Schéma pour valider un ID de signataire de bail
 */
export const signerIdParamSchema = uuidParamSchema;

// ============================================
// QUERY PARAMETERS
// ============================================

/**
 * Schéma pour les query params de pagination
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/**
 * Schéma pour les query params de filtrage de propriétés
 * Recherche avancée avec filtres combinables
 */
export const propertiesQuerySchema = z.object({
  // Filtres par ID
  propertyId: uuidParamSchema.optional(),
  property_id: uuidParamSchema.optional(),
  ownerId: uuidParamSchema.optional(),
  owner_id: uuidParamSchema.optional(),
  tenantId: uuidParamSchema.optional(),
  tenant_id: uuidParamSchema.optional(),
  
  // Filtres par type de bien
  type: z.enum([
    "appartement",
    "maison",
    "studio",
    "colocation",
    "saisonnier",
    "parking",
    "box",
    "local_commercial",
    "bureaux",
    "entrepot",
    "fonds_de_commerce",
  ]).optional(),
  type_bien: z.enum([
    "appartement",
    "maison",
    "studio",
    "colocation",
    "saisonnier",
    "parking",
    "box",
    "local_commercial",
    "bureaux",
    "entrepot",
    "fonds_de_commerce",
  ]).optional(),
  
  // Filtres par statut
  etat: z.enum(["draft", "pending_review", "published", "rejected", "archived"]).optional(),
  status: z.enum(["draft", "pending_review", "published", "rejected", "archived"]).optional(),
  
  // Recherche textuelle (adresse, ville, code postal)
  search: z.string().optional(),
  q: z.string().optional(), // Alias pour search
  
  // Filtres géographiques
  ville: z.string().optional(),
  code_postal: z.string().regex(/^\d{5}$/).optional(),
  departement: z.string().min(2).max(3).optional(),
  
  // Filtres numériques (surface, pièces, loyer)
  surface_min: z.coerce.number().min(0).optional(),
  surface_max: z.coerce.number().min(0).optional(),
  nb_pieces_min: z.coerce.number().int().min(1).optional(),
  nb_pieces_max: z.coerce.number().int().min(1).optional(),
  loyer_min: z.coerce.number().min(0).optional(),
  loyer_max: z.coerce.number().min(0).optional(),
  
  // Filtres booléens
  meuble: z.enum(["true", "false"]).transform(v => v === "true").optional(),
  ascenseur: z.enum(["true", "false"]).transform(v => v === "true").optional(),
  
  // Tri
  sort_by: z.enum(["created_at", "loyer_hc", "surface", "ville", "type"]).optional(),
  sort_order: z.enum(["asc", "desc"]).default("desc").optional(),
  
  // Occupancy filter
  occupancy: z.enum(["vacant", "occupied", "all"]).optional(),
}).merge(paginationQuerySchema);

/**
 * Schéma pour les query params de filtrage de baux
 */
export const leasesQuerySchema = z.object({
  propertyId: uuidParamSchema.optional(),
  property_id: uuidParamSchema.optional(),
  ownerId: uuidParamSchema.optional(),
  owner_id: uuidParamSchema.optional(),
  tenantId: uuidParamSchema.optional(),
  tenant_id: uuidParamSchema.optional(),
  status: z.enum([
    "draft",
    "sent",
    "pending_signature",
    "partially_signed",
    "pending_owner_signature",
    "fully_signed",
    "active",
    "notice_given",
    "amended",
    "terminated",
    "archived"
  ]).optional(),
}).merge(paginationQuerySchema);

/**
 * Schéma pour les query params de filtrage de factures
 */
export const invoicesQuerySchema = z.object({
  leaseId: uuidParamSchema.optional(),
  lease_id: uuidParamSchema.optional(),
  ownerId: uuidParamSchema.optional(),
  owner_id: uuidParamSchema.optional(),
  tenantId: uuidParamSchema.optional(),
  tenant_id: uuidParamSchema.optional(),
  status: z.enum(["draft", "sent", "paid", "late"]).optional(),
  periode: z.string().regex(/^\d{4}-\d{2}$/, "Format période invalide (YYYY-MM)").optional(),
}).merge(paginationQuerySchema);

/**
 * Schéma pour les query params de filtrage de tickets
 */
export const ticketsQuerySchema = z.object({
  propertyId: uuidParamSchema.optional(),
  property_id: uuidParamSchema.optional(),
  leaseId: uuidParamSchema.optional(),
  lease_id: uuidParamSchema.optional(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["basse", "normale", "haute"]).optional(),
}).merge(paginationQuerySchema);

// ============================================
// HELPERS
// ============================================

/**
 * Valide un paramètre UUID et retourne l'ID validé
 * @throws ApiError si invalide
 */
export function validateUuidParam(id: string): string {
  return uuidParamSchema.parse(id);
}

/**
 * Valide les query params et retourne les paramètres validés
 */
export function validateQueryParams<T extends z.ZodSchema>(
  schema: T,
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>
): z.infer<T> {
  // Convertir URLSearchParams en objet
  const params: Record<string, string> = {};
  
  if (searchParams instanceof URLSearchParams) {
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
  } else {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (typeof value === "string") {
        params[key] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        params[key] = value[0]; // Prendre le premier élément
      }
    });
  }
  
  return schema.parse(params);
}

