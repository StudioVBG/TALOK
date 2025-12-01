"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/**
 * Hook pour précharger les données des pages suivantes
 * Améliore significativement les temps de navigation perçus
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  /**
   * Précharge les détails d'une propriété
   */
  const prefetchProperty = useCallback(
    async (propertyId: string) => {
      await queryClient.prefetchQuery({
        queryKey: ["property", propertyId],
        queryFn: async () => {
          const response = await fetch(`/api/properties/${propertyId}`);
          if (!response.ok) throw new Error("Failed to fetch property");
          return response.json();
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
    },
    [queryClient]
  );

  /**
   * Précharge la liste des propriétés
   */
  const prefetchProperties = useCallback(async () => {
    await queryClient.prefetchQuery({
      queryKey: ["properties"],
      queryFn: async () => {
        const response = await fetch("/api/owner/properties");
        if (!response.ok) throw new Error("Failed to fetch properties");
        return response.json();
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });
  }, [queryClient]);

  /**
   * Précharge les détails d'un bail
   */
  const prefetchLease = useCallback(
    async (leaseId: string) => {
      await queryClient.prefetchQuery({
        queryKey: ["lease", leaseId],
        queryFn: async () => {
          const response = await fetch(`/api/leases/${leaseId}`);
          if (!response.ok) throw new Error("Failed to fetch lease");
          return response.json();
        },
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  /**
   * Précharge les factures d'un bail
   */
  const prefetchInvoices = useCallback(
    async (leaseId?: string) => {
      const queryKey = leaseId ? ["invoices", leaseId] : ["invoices"];
      await queryClient.prefetchQuery({
        queryKey,
        queryFn: async () => {
          const url = leaseId ? `/api/invoices?lease_id=${leaseId}` : "/api/invoices";
          const response = await fetch(url);
          if (!response.ok) throw new Error("Failed to fetch invoices");
          return response.json();
        },
        staleTime: 2 * 60 * 1000,
      });
    },
    [queryClient]
  );

  /**
   * Précharge le dashboard owner
   */
  const prefetchOwnerDashboard = useCallback(async () => {
    await queryClient.prefetchQuery({
      queryKey: ["owner", "dashboard"],
      queryFn: async () => {
        const response = await fetch("/api/owner/dashboard");
        if (!response.ok) throw new Error("Failed to fetch dashboard");
        return response.json();
      },
      staleTime: 60 * 1000, // 1 minute
    });
  }, [queryClient]);

  /**
   * Invalide et refetch une query spécifique
   */
  const invalidateAndRefetch = useCallback(
    async (queryKey: string[]) => {
      await queryClient.invalidateQueries({ queryKey });
    },
    [queryClient]
  );

  return {
    prefetchProperty,
    prefetchProperties,
    prefetchLease,
    prefetchInvoices,
    prefetchOwnerDashboard,
    invalidateAndRefetch,
  };
}

/**
 * HOC pour ajouter le prefetch au hover des liens
 */
export function withPrefetchOnHover<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  prefetchFn: () => Promise<void>
) {
  return function WithPrefetch(props: P) {
    return (
      <div
        onMouseEnter={() => {
          // Précharger après un délai court pour éviter les appels inutiles
          const timeout = setTimeout(prefetchFn, 100);
          return () => clearTimeout(timeout);
        }}
      >
        <WrappedComponent {...props} />
      </div>
    );
  };
}

