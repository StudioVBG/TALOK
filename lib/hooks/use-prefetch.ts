"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook pour prefetcher les données et pages de manière intelligente
 * Améliore la navigation perçue en préchargeant les données à l'avance
 */

interface PrefetchOptions {
  /** Délai avant le prefetch (ms) - évite les prefetch sur hover rapide */
  delay?: number;
  /** Prefetch uniquement si l'utilisateur a une bonne connexion */
  checkConnection?: boolean;
}

/**
 * Prefetch une page Next.js au hover
 */
export function usePrefetchPage(href: string, options: PrefetchOptions = {}) {
  const router = useRouter();
  const { delay = 100, checkConnection = true } = options;
  const timeoutRef = useRef<NodeJS.Timeout>();

  const prefetch = useCallback(() => {
    // Vérifier la connexion si demandé
    if (checkConnection && typeof navigator !== "undefined") {
      const connection = (navigator as any).connection;
      if (connection?.saveData || connection?.effectiveType === "2g") {
        return; // Ne pas prefetch sur connexion lente ou mode économie
      }
    }

    timeoutRef.current = setTimeout(() => {
      router.prefetch(href);
    }, delay);
  }, [href, delay, checkConnection, router]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    onMouseEnter: prefetch,
    onMouseLeave: cancel,
    onFocus: prefetch,
    onBlur: cancel,
  };
}

/**
 * Prefetch des données React Query au hover
 */
export function usePrefetchQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options: PrefetchOptions = {}
) {
  const queryClient = useQueryClient();
  const { delay = 150, checkConnection = true } = options;
  const timeoutRef = useRef<NodeJS.Timeout>();

  const prefetch = useCallback(() => {
    // Vérifier la connexion
    if (checkConnection && typeof navigator !== "undefined") {
      const connection = (navigator as any).connection;
      if (connection?.saveData || connection?.effectiveType === "2g") {
        return;
      }
    }

    // Vérifier si les données sont déjà en cache et fraîches
    const cached = queryClient.getQueryData(queryKey);
    if (cached) {
      return; // Données déjà en cache
    }

    timeoutRef.current = setTimeout(() => {
      queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
    }, delay);
  }, [queryKey, queryFn, delay, checkConnection, queryClient]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    onMouseEnter: prefetch,
    onMouseLeave: cancel,
    onFocus: prefetch,
    onBlur: cancel,
  };
}

/**
 * Prefetch multiple pages quand le composant est visible
 */
export function usePrefetchOnMount(hrefs: string[]) {
  const router = useRouter();

  useEffect(() => {
    // Attendre que la page soit idle avant de prefetch
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(() => {
        hrefs.forEach((href) => router.prefetch(href));
      });
      return () => cancelIdleCallback(id);
    } else {
      // Fallback pour Safari
      const timeout = setTimeout(() => {
        hrefs.forEach((href) => router.prefetch(href));
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [hrefs, router]);
}

/**
 * Hook pour prefetch basé sur l'Intersection Observer
 * Prefetch quand un élément devient visible dans le viewport
 */
export function usePrefetchOnVisible(
  href: string,
  options: { rootMargin?: string; threshold?: number } = {}
) {
  const router = useRouter();
  const elementRef = useRef<HTMLElement>(null);
  const hasPrefetched = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || hasPrefetched.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasPrefetched.current) {
          router.prefetch(href);
          hasPrefetched.current = true;
          observer.disconnect();
        }
      },
      {
        rootMargin: options.rootMargin || "100px",
        threshold: options.threshold || 0,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [href, options.rootMargin, options.threshold, router]);

  return elementRef;
}

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
 * Retourne les props à ajouter à un élément pour déclencher le prefetch
 */
export function withPrefetchOnHover(prefetchFn: () => Promise<void>) {
  let timeout: NodeJS.Timeout | null = null;
  
  return {
    onMouseEnter: () => {
      // Précharger après un délai court pour éviter les appels inutiles
      timeout = setTimeout(prefetchFn, 100);
    },
    onMouseLeave: () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    },
  };
}

export default usePrefetchPage;
