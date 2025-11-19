/**
 * Export centralisé de tous les hooks React Query
 * 
 * Tous les hooks utilisent les types Database générés depuis Supabase
 * pour une connexion type-safe BDD → Frontend
 */

export * from "./use-properties";
export * from "./use-rooms";
export * from "./use-photos";
// use-properties-infinite et use-properties-optimistic sont maintenant intégrés dans use-properties
export * from "./use-leases";
export * from "./use-invoices";
export * from "./use-tickets";
export * from "./use-payments";
export * from "./use-work-orders";
export * from "./use-documents";
export * from "./use-auth";
export * from "./use-pagination";
export * from "./use-dashboard";
export * from "./use-mutation-with-toast";
export * from "./use-debounce";

