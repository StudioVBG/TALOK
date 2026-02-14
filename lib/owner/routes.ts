/**
 * Helpers pour les routes du Compte Propriétaire
 * Utilise les constantes OWNER_ROUTES pour garantir la cohérence
 */

import { OWNER_ROUTES } from "@/lib/config/owner-routes";

/**
 * Routes pour les propriétés
 */
export const ownerPropertyRoutes = {
  list: () => OWNER_ROUTES.properties.path,
  new: () => `${OWNER_ROUTES.properties.path}/new`,
  detail: (id: string) => `${OWNER_ROUTES.properties.path}/${id}`,
  edit: (id: string) => `${OWNER_ROUTES.properties.path}/${id}/edit`,
  withFilter: (filters: { module?: string; type?: string; status?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters.module) params.append("module", filters.module);
    if (filters.type) params.append("type", filters.type);
    if (filters.status) params.append("status", filters.status);
    if (filters.search) params.append("search", filters.search);
    const queryString = params.toString();
    return `${OWNER_ROUTES.properties.path}${queryString ? `?${queryString}` : ""}`;
  },
};

/**
 * Routes pour les baux/contrats
 */
export const ownerContractRoutes = {
  list: () => OWNER_ROUTES.contracts.path,
  detail: (id: string) => `${OWNER_ROUTES.contracts.path}/${id}`,
  new: () => `${OWNER_ROUTES.contracts.path}/new`,
  newWithProperty: (propertyId: string) => `${OWNER_ROUTES.contracts.path}/new?propertyId=${propertyId}`,
  withFilter: (filters: { property_id?: string; status?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters.property_id) params.append("property_id", filters.property_id);
    if (filters.status) params.append("status", filters.status);
    if (filters.search) params.append("search", filters.search);
    const queryString = params.toString();
    return `${OWNER_ROUTES.contracts.path}${queryString ? `?${queryString}` : ""}`;
  },
};

/**
 * Routes pour les loyers/revenus
 */
export const ownerMoneyRoutes = {
  list: () => OWNER_ROUTES.money.path,
  withFilter: (filters: { property_id?: string; lease_id?: string; module?: string; status?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters.property_id) params.append("property_id", filters.property_id);
    if (filters.lease_id) params.append("lease_id", filters.lease_id);
    if (filters.module) params.append("module", filters.module);
    if (filters.status) params.append("status", filters.status);
    if (filters.search) params.append("search", filters.search);
    const queryString = params.toString();
    return `${OWNER_ROUTES.money.path}${queryString ? `?${queryString}` : ""}`;
  },
  invoiceDetail: (id: string) => `/owner/invoices/${id}`,
};

/**
 * Routes pour les documents
 */
export const ownerDocumentRoutes = {
  list: () => OWNER_ROUTES.documents.path,
  upload: () => `${OWNER_ROUTES.documents.path}/upload`,
  withFilter: (filters: { property_id?: string; lease_id?: string; type?: string; status?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters.property_id) params.append("property_id", filters.property_id);
    if (filters.lease_id) params.append("lease_id", filters.lease_id);
    if (filters.type) params.append("type", filters.type);
    if (filters.status) params.append("status", filters.status);
    if (filters.search) params.append("search", filters.search);
    const queryString = params.toString();
    return `${OWNER_ROUTES.documents.path}${queryString ? `?${queryString}` : ""}`;
  },
};

/**
 * Routes pour la GED
 */
export const ownerGedRoutes = {
  list: () => OWNER_ROUTES.ged.path,
  withFilter: (filters: { property_id?: string; lease_id?: string; type?: string }) => {
    const params = new URLSearchParams();
    if (filters.property_id) params.append("property_id", filters.property_id);
    if (filters.lease_id) params.append("lease_id", filters.lease_id);
    if (filters.type) params.append("type", filters.type);
    const queryString = params.toString();
    return `${OWNER_ROUTES.ged.path}${queryString ? `?${queryString}` : ""}`;
  },
};

/**
 * Routes pour le support
 */
export const ownerSupportRoutes = {
  list: () => OWNER_ROUTES.support.path,
  withProperty: (propertyId: string) => `${OWNER_ROUTES.support.path}?property_id=${propertyId}`,
};

/**
 * Routes principales
 */
export const ownerRoutes = {
  dashboard: OWNER_ROUTES.dashboard.path,
  properties: ownerPropertyRoutes,
  contracts: ownerContractRoutes,
  money: ownerMoneyRoutes,
  documents: ownerDocumentRoutes,
  ged: ownerGedRoutes,
  support: ownerSupportRoutes,
  profile: OWNER_ROUTES.profile.path,
};

