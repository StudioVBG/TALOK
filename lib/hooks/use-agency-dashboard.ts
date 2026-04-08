/**
 * Hook React Query pour le dashboard comptabilite agence
 *
 * Recupere les KPIs agence (CA honoraires, charges, resultat, mandants actifs)
 * et la liste des mandants avec leur statut CRG/reversement.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "./use-auth";

// -- Types -------------------------------------------------------------------

export interface AgencyKPIs {
  caHonorairesCents: number;
  chargesAgenceCents: number;
  resultatCents: number;
  nbMandantsActifs: number;
}

export interface AgencyRecentEntry {
  id: string;
  entryDate: string;
  label: string;
  journalCode: string;
  totalDebitCents: number;
  totalCreditCents: number;
  source: "manual" | "stripe" | "ocr" | "import";
  isValidated: boolean;
}

export type MandantStatus = "a_jour" | "crg_en_retard" | "reversement_en_retard";

export interface MandantCard {
  id: string;
  name: string;
  nbProperties: number;
  commissionRate: number;
  loyersCollectesCents: number;
  soldeAReverserCents: number;
  dernierCrgDate: string | null;
  status: MandantStatus;
  mandateRef: string;
}

interface UseAgencyDashboardOptions {
  agencyId?: string;
}

// -- Hook --------------------------------------------------------------------

export function useAgencyDashboard(options: UseAgencyDashboardOptions = {}) {
  const { profile } = useAuth();
  const agencyId = options.agencyId ?? profile?.id;

  const kpisQuery = useQuery({
    queryKey: ["agency", "accounting", "kpis", agencyId],
    queryFn: async (): Promise<AgencyKPIs> => {
      if (!agencyId) {
        return {
          caHonorairesCents: 0,
          chargesAgenceCents: 0,
          resultatCents: 0,
          nbMandantsActifs: 0,
        };
      }
      try {
        return await apiClient.get<AgencyKPIs>(
          `/agency/accounting/kpis?agencyId=${agencyId}`
        );
      } catch {
        return {
          caHonorairesCents: 0,
          chargesAgenceCents: 0,
          resultatCents: 0,
          nbMandantsActifs: 0,
        };
      }
    },
    enabled: !!profile && !!agencyId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const mandantsQuery = useQuery({
    queryKey: ["agency", "accounting", "mandants", agencyId],
    queryFn: async (): Promise<MandantCard[]> => {
      if (!agencyId) return [];
      try {
        const data = await apiClient.get<MandantCard[]>(
          `/agency/accounting/mandants?agencyId=${agencyId}`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!agencyId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const recentEntriesQuery = useQuery({
    queryKey: ["agency", "accounting", "recent-entries", agencyId],
    queryFn: async (): Promise<AgencyRecentEntry[]> => {
      if (!agencyId) return [];
      try {
        const data = await apiClient.get<AgencyRecentEntry[]>(
          `/agency/accounting/entries?agencyId=${agencyId}&limit=10&sort=created_at:desc`
        );
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!profile && !!agencyId,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return {
    kpis: kpisQuery.data ?? null,
    mandants: mandantsQuery.data ?? [],
    recentEntries: recentEntriesQuery.data ?? [],
    isLoading:
      kpisQuery.isLoading || mandantsQuery.isLoading || recentEntriesQuery.isLoading,
    error: kpisQuery.error || mandantsQuery.error || recentEntriesQuery.error,
  };
}
