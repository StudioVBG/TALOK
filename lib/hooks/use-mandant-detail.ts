/**
 * Hook React Query pour le detail d'un mandant
 *
 * Recupere les informations du mandant, ses ecritures, loyers,
 * reversements, CRGs et documents.
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";

// -- Types -------------------------------------------------------------------

export interface MandantInfo {
  id: string;
  name: string;
  commissionRate: number;
  mandateRef: string;
  email: string | null;
  phone: string | null;
  nbProperties: number;
}

export interface MandantProperty {
  id: string;
  address: string;
  type: string;
  loyerCents: number;
  tenantName: string | null;
  isOccupied: boolean;
}

export interface MandantEntry {
  id: string;
  entryDate: string;
  label: string;
  journalCode: string;
  debitCents: number;
  creditCents: number;
  isValidated: boolean;
}

export interface MandantLoyerRow {
  month: string;
  loyerBrutCents: number;
  commissionCents: number;
  netReverseCents: number;
  dateReversement: string | null;
}

export interface MandantReversement {
  id: string;
  date: string;
  amountCents: number;
  period: string;
  status: "effectue" | "en_attente" | "en_retard";
  reference: string;
}

export type CRGStatus = "genere" | "envoye" | "vu_par_mandant";

export interface MandantCRG {
  id: string;
  period: string;
  generatedAt: string;
  status: CRGStatus;
  totalLoyersCents: number;
  totalCommissionCents: number;
  totalReverseCents: number;
  downloadUrl: string | null;
}

export interface MandantDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  url: string;
}

// -- Hook --------------------------------------------------------------------

export function useMandantDetail(mandantId: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const infoQuery = useQuery({
    queryKey: ["agency", "mandant", mandantId, "info"],
    queryFn: async (): Promise<MandantInfo | null> => {
      if (!mandantId) return null;
      try {
        return await apiClient.get<MandantInfo>(
          `/agency/accounting/mandants/${mandantId}`
        );
      } catch {
        return null;
      }
    },
    enabled: !!profile && !!mandantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const propertiesQuery = useQuery({
    queryKey: ["agency", "mandant", mandantId, "properties"],
    queryFn: async (): Promise<MandantProperty[]> => {
      if (!mandantId) return [];
      try {
        const data = await apiClient.get<MandantProperty[]>(
          `/agency/accounting/mandants/${mandantId}/properties`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!mandantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const entriesQuery = useQuery({
    queryKey: ["agency", "mandant", mandantId, "entries"],
    queryFn: async (): Promise<MandantEntry[]> => {
      if (!mandantId) return [];
      try {
        const data = await apiClient.get<MandantEntry[]>(
          `/agency/accounting/mandants/${mandantId}/entries?limit=50&sort=entry_date:desc`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!mandantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const loyersQuery = useQuery({
    queryKey: ["agency", "mandant", mandantId, "loyers"],
    queryFn: async (): Promise<MandantLoyerRow[]> => {
      if (!mandantId) return [];
      try {
        const data = await apiClient.get<MandantLoyerRow[]>(
          `/agency/accounting/mandants/${mandantId}/loyers`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!mandantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const reversementsQuery = useQuery({
    queryKey: ["agency", "mandant", mandantId, "reversements"],
    queryFn: async (): Promise<MandantReversement[]> => {
      if (!mandantId) return [];
      try {
        const data = await apiClient.get<MandantReversement[]>(
          `/agency/accounting/mandants/${mandantId}/reversements`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!mandantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const crgsQuery = useQuery({
    queryKey: ["agency", "mandant", mandantId, "crgs"],
    queryFn: async (): Promise<MandantCRG[]> => {
      if (!mandantId) return [];
      try {
        const data = await apiClient.get<MandantCRG[]>(
          `/agency/accounting/mandants/${mandantId}/crgs`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!mandantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const documentsQuery = useQuery({
    queryKey: ["agency", "mandant", mandantId, "documents"],
    queryFn: async (): Promise<MandantDocument[]> => {
      if (!mandantId) return [];
      try {
        const data = await apiClient.get<MandantDocument[]>(
          `/agency/accounting/mandants/${mandantId}/documents`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!mandantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // -- Mutations ---------------------------------------------------------------

  const generateCrgMutation = useMutation({
    mutationFn: async (params: { period: string }) => {
      return apiClient.post(`/agency/accounting/mandants/${mandantId}/crg/generate`, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency", "mandant", mandantId, "crgs"] });
    },
  });

  const sendCrgMutation = useMutation({
    mutationFn: async (crgId: string) => {
      return apiClient.post(`/agency/accounting/crg/${crgId}/send`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency", "mandant", mandantId, "crgs"] });
    },
  });

  const reverserMutation = useMutation({
    mutationFn: async (params: { amountCents: number; period: string }) => {
      return apiClient.post(`/agency/accounting/mandants/${mandantId}/reverser`, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency", "mandant", mandantId] });
    },
  });

  return {
    info: infoQuery.data ?? null,
    properties: propertiesQuery.data ?? [],
    entries: entriesQuery.data ?? [],
    loyers: loyersQuery.data ?? [],
    reversements: reversementsQuery.data ?? [],
    crgs: crgsQuery.data ?? [],
    documents: documentsQuery.data ?? [],
    isLoading:
      infoQuery.isLoading ||
      propertiesQuery.isLoading ||
      entriesQuery.isLoading,
    error:
      infoQuery.error || propertiesQuery.error || entriesQuery.error,
    generateCrg: generateCrgMutation.mutateAsync,
    isGeneratingCrg: generateCrgMutation.isPending,
    sendCrg: sendCrgMutation.mutateAsync,
    isSendingCrg: sendCrgMutation.isPending,
    reverser: reverserMutation.mutateAsync,
    isReversing: reverserMutation.isPending,
  };
}
