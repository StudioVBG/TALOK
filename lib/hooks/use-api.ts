"use client";

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from "@tanstack/react-query";
import { useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";

/**
 * Configuration des clés de cache pour React Query
 */
export const queryKeys = {
  // Propriétés
  properties: {
    all: ["properties"] as const,
    list: (ownerId: string) => [...queryKeys.properties.all, "list", ownerId] as const,
    detail: (id: string) => [...queryKeys.properties.all, "detail", id] as const,
    rooms: (propertyId: string) => [...queryKeys.properties.all, "rooms", propertyId] as const,
    photos: (propertyId: string) => [...queryKeys.properties.all, "photos", propertyId] as const,
  },
  // Baux
  leases: {
    all: ["leases"] as const,
    list: (ownerId?: string) => [...queryKeys.leases.all, "list", ownerId] as const,
    detail: (id: string) => [...queryKeys.leases.all, "detail", id] as const,
    byProperty: (propertyId: string) => [...queryKeys.leases.all, "property", propertyId] as const,
  },
  // Factures
  invoices: {
    all: ["invoices"] as const,
    list: (ownerId: string) => [...queryKeys.invoices.all, "list", ownerId] as const,
    detail: (id: string) => [...queryKeys.invoices.all, "detail", id] as const,
    byLease: (leaseId: string) => [...queryKeys.invoices.all, "lease", leaseId] as const,
  },
  // Paiements
  payments: {
    all: ["payments"] as const,
    list: (tenantId?: string) => [...queryKeys.payments.all, "list", tenantId] as const,
    byInvoice: (invoiceId: string) => [...queryKeys.payments.all, "invoice", invoiceId] as const,
  },
  // Tickets
  tickets: {
    all: ["tickets"] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.tickets.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.tickets.all, "detail", id] as const,
  },
  // Documents
  documents: {
    all: ["documents"] as const,
    list: (entityId?: string, entityType?: string) => [...queryKeys.documents.all, "list", entityId, entityType] as const,
    detail: (id: string) => [...queryKeys.documents.all, "detail", id] as const,
  },
  // Profils
  profiles: {
    current: ["profiles", "current"] as const,
    detail: (id: string) => ["profiles", "detail", id] as const,
  },
  // Dashboard
  dashboard: {
    owner: (ownerId: string) => ["dashboard", "owner", ownerId] as const,
    tenant: (tenantId: string) => ["dashboard", "tenant", tenantId] as const,
    admin: ["dashboard", "admin"] as const,
  },
} as const;

/**
 * Hook générique pour les requêtes API GET
 */
interface UseApiQueryOptions<T> extends Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn"> {
  queryKey: readonly unknown[];
  fetcher: () => Promise<T>;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useApiQuery<T>({
  queryKey,
  fetcher,
  onSuccess,
  onError,
  ...options
}: UseApiQueryOptions<T>) {
  return useQuery<T, Error>({
    queryKey,
    queryFn: fetcher,
    staleTime: 5 * 60 * 1000, // 5 minutes par défaut
    gcTime: 10 * 60 * 1000, // 10 minutes (anciennement cacheTime)
    refetchOnWindowFocus: false,
    retry: 2,
    ...options,
  });
}

/**
 * Hook générique pour les mutations API (POST, PUT, DELETE)
 */
interface UseApiMutationOptions<TData, TVariables> extends Omit<UseMutationOptions<TData, Error, TVariables>, "mutationFn"> {
  mutator: (variables: TVariables) => Promise<TData>;
  invalidateKeys?: readonly unknown[][];
  successMessage?: string;
  errorMessage?: string;
  onSuccessCallback?: (data: TData, variables: TVariables) => void;
  onErrorCallback?: (error: Error, variables: TVariables) => void;
}

export function useApiMutation<TData, TVariables>({
  mutator,
  invalidateKeys,
  successMessage,
  errorMessage,
  onSuccessCallback,
  onErrorCallback,
  ...options
}: UseApiMutationOptions<TData, TVariables>) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<TData, Error, TVariables>({
    mutationFn: mutator,
    onSuccess: (data, variables) => {
      // Invalider les caches spécifiés
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }

      // Toast de succès
      if (successMessage) {
        toast({
          title: "Succès",
          description: successMessage,
        });
      }

      // Callback personnalisé
      onSuccessCallback?.(data, variables);
    },
    onError: (error, variables) => {
      // Toast d'erreur
      toast({
        title: "Erreur",
        description: errorMessage || error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });

      // Callback personnalisé
      onErrorCallback?.(error, variables);
    },
    ...options,
  });
}

/**
 * Hook pour les opérations CRUD sur les propriétés
 */
export function usePropertyApi(ownerId: string) {
  const queryClient = useQueryClient();

  // Liste des propriétés
  const list = useApiQuery({
    queryKey: queryKeys.properties.list(ownerId),
    fetcher: async () => {
      const res = await fetch(`/api/owner/properties?owner_id=${ownerId}`);
      if (!res.ok) throw new Error("Erreur lors du chargement des propriétés");
      return res.json();
    },
  });

  // Créer une propriété
  const create = useApiMutation({
    mutator: async (data: any) => {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erreur lors de la création");
      return res.json();
    },
    invalidateKeys: [queryKeys.properties.list(ownerId)],
    successMessage: "Propriété créée avec succès",
  });

  // Mettre à jour une propriété
  const update = useApiMutation({
    mutator: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/properties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erreur lors de la mise à jour");
      return res.json();
    },
    invalidateKeys: [queryKeys.properties.list(ownerId)],
    successMessage: "Propriété mise à jour",
    onSuccessCallback: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.properties.detail(id) });
    },
  });

  // Supprimer une propriété
  const remove = useApiMutation({
    mutator: async (id: string) => {
      const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      return res.json();
    },
    invalidateKeys: [queryKeys.properties.list(ownerId)],
    successMessage: "Propriété supprimée",
  });

  // Prefetch une propriété
  const prefetch = useCallback(
    (id: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.properties.detail(id),
        queryFn: async () => {
          const res = await fetch(`/api/properties/${id}`);
          if (!res.ok) throw new Error("Erreur");
          return res.json();
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  return {
    list,
    create,
    update,
    remove,
    prefetch,
  };
}

/**
 * Hook pour les opérations sur les factures
 */
export function useInvoiceApi(ownerId: string) {
  const queryClient = useQueryClient();

  const list = useApiQuery({
    queryKey: queryKeys.invoices.list(ownerId),
    fetcher: async () => {
      const res = await fetch(`/api/owner/invoices?owner_id=${ownerId}`);
      if (!res.ok) throw new Error("Erreur lors du chargement des factures");
      return res.json();
    },
  });

  const markAsPaid = useApiMutation({
    mutator: async (invoiceId: string) => {
      const res = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    invalidateKeys: [queryKeys.invoices.list(ownerId)],
    successMessage: "Facture marquée comme payée",
  });

  const sendReminder = useApiMutation({
    mutator: async (invoiceId: string) => {
      const res = await fetch(`/api/invoices/${invoiceId}/send-reminder`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    successMessage: "Rappel envoyé",
  });

  return { list, markAsPaid, sendReminder };
}

/**
 * Hook pour les opérations sur les tickets
 */
export function useTicketApi(filters?: Record<string, any>) {
  const queryClient = useQueryClient();

  const list = useApiQuery({
    queryKey: queryKeys.tickets.list(filters),
    fetcher: async () => {
      const params = new URLSearchParams(filters as any).toString();
      const res = await fetch(`/api/tickets?${params}`);
      if (!res.ok) throw new Error("Erreur lors du chargement des tickets");
      return res.json();
    },
  });

  const create = useApiMutation({
    mutator: async (data: any) => {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erreur lors de la création");
      return res.json();
    },
    invalidateKeys: [queryKeys.tickets.all],
    successMessage: "Ticket créé",
  });

  const updateStatus = useApiMutation({
    mutator: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/tickets/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    invalidateKeys: [queryKeys.tickets.all],
    successMessage: "Statut mis à jour",
  });

  return { list, create, updateStatus };
}

export default {
  queryKeys,
  useApiQuery,
  useApiMutation,
  usePropertyApi,
  useInvoiceApi,
  useTicketApi,
};

