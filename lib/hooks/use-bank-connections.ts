/**
 * Hook React Query pour les connexions bancaires
 *
 * Recupere les connexions bancaires (bank_connections) de l'entite selectionnee.
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";

// ── Types ───────────────────────────────────────────────────────────

export interface BankConnection {
  id: string;
  entity_id: string;
  provider: "nordigen" | "bridge" | "manual";
  institution_id: string | null;
  institution_name: string | null;
  account_type: "exploitation" | "epargne" | "depot_garantie";
  account_number: string; // ex: 512100
  iban: string | null;
  iban_hash: string | null;
  bic: string | null;
  balance_cents: number;
  currency: string;
  sync_status: "active" | "syncing" | "expired" | "error";
  last_sync_at: string | null;
  consent_expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UseBankConnectionsOptions {
  entityId?: string;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useBankConnections(options: UseBankConnectionsOptions = {}) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const entityId =
    options.entityId ??
    (profile as { default_entity_id?: string | null } | null)?.default_entity_id ??
    undefined;

  const query = useQuery({
    queryKey: ["bank", "connections", entityId],
    queryFn: async (): Promise<BankConnection[]> => {
      if (!entityId) return [];
      try {
        const data = await apiClient.get<{ connections: BankConnection[] }>(
          `/bank-connect/connections?entityId=${entityId}`
        );
        return data?.connections ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!entityId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const mutate = () => {
    queryClient.invalidateQueries({
      queryKey: ["bank", "connections", entityId],
    });
  };

  return {
    connections: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    mutate,
  };
}
