"use client";

/**
 * Hooks React pour la comptabilité
 */

import { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { apiClient } from "@/lib/api-client";

// ============================================================================
// Types
// ============================================================================

interface CRGData {
  numero: string;
  date_emission: string;
  periode: { debut: string; fin: string; libelle: string };
  proprietaire: { nom: string; prenom?: string };
  bien: { adresse: string; ville: string };
  locataire?: { nom: string; prenom?: string };
  mouvements: any[];
  totaux: { total_debits: number; total_credits: number };
  solde_fin_periode: number;
  recapitulatif: any;
}

interface BalanceData {
  date: string;
  comptes_proprietaires: any[];
  comptes_locataires: any[];
  total_proprietaires: { debit: number; credit: number };
  total_locataires: { debit: number; credit: number };
  verification: {
    equilibre: boolean;
    ecart: number;
  };
}

interface FiscalData {
  annee: number;
  proprietaire: { nom: string; prenom?: string };
  biens: any[];
  revenus_bruts: { loyers: number; charges_recuperees: number; total: number };
  charges_deductibles: any;
  revenu_foncier_net: number;
}

interface RegularisationData {
  id: string;
  lease_id: string;
  year: number;
  provisions_received: number;
  actual_charges: number;
  balance: number;
  status: string;
}

interface DepositData {
  lease_id: string;
  tenant_id: string;
  property_address: string;
  initial_amount: number;
  current_balance: number;
  operations: any[];
  status: string;
}

// ============================================================================
// Hooks CRG
// ============================================================================

export function useCRG(ownerId?: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (ownerId) params.append("owner_id", ownerId);
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);

  const { data, error, isLoading, mutate } = useSWR<{ data: CRGData[] }>(
    startDate && endDate ? `/api/accounting/crg?${params.toString()}` : null,
    apiClient.get
  );

  return {
    crgs: data?.data || [],
    isLoading,
    error,
    refresh: mutate,
  };
}

// ============================================================================
// Hooks Balance
// ============================================================================

export function useBalance(date?: string) {
  const params = date ? `?date=${date}` : "";

  const { data, error, isLoading, mutate } = useSWR<{ data: BalanceData }>(
    `/api/accounting/balance${params}`,
    apiClient.get
  );

  return {
    balance: data?.data,
    isLoading,
    error,
    refresh: mutate,
  };
}

// ============================================================================
// Hooks Fiscal
// ============================================================================

export function useFiscal(year?: number, ownerId?: string) {
  const params = new URLSearchParams();
  if (year) params.append("year", year.toString());
  if (ownerId) params.append("owner_id", ownerId);

  const { data, error, isLoading, mutate } = useSWR<{ data: FiscalData }>(
    `/api/accounting/fiscal?${params.toString()}`,
    apiClient.get
  );

  return {
    recap: data?.data,
    isLoading,
    error,
    refresh: mutate,
  };
}

// ============================================================================
// Hooks Régularisation
// ============================================================================

export function useRegularisations(leaseId: string) {
  const { data, error, isLoading, mutate } = useSWR<{ data: RegularisationData[] }>(
    leaseId ? `/api/accounting/charges/regularisation?lease_id=${leaseId}` : null,
    apiClient.get
  );

  const createRegularisation = useCallback(
    async (year: number, chargesReelles?: any[]) => {
      const result = await apiClient.post<{ data: any }>(
        "/api/accounting/charges/regularisation",
        {
          lease_id: leaseId,
          year,
          charges_reelles: chargesReelles,
        }
      );
      mutate();
      return result.data;
    },
    [leaseId, mutate]
  );

  const applyRegularisation = useCallback(
    async (regularisationId: string) => {
      const result = await apiClient.post<{ data: any }>(
        `/api/accounting/charges/regularisation/${regularisationId}/apply`,
        {}
      );
      mutate();
      return result.data;
    },
    [mutate]
  );

  return {
    regularisations: data?.data || [],
    isLoading,
    error,
    refresh: mutate,
    createRegularisation,
    applyRegularisation,
  };
}

// ============================================================================
// Hooks Dépôts de garantie
// ============================================================================

export function useDeposits(leaseId?: string) {
  const params = leaseId ? `?lease_id=${leaseId}` : "";

  const { data, error, isLoading, mutate } = useSWR<{ data: DepositData[] }>(
    `/api/accounting/deposits${params}`,
    apiClient.get
  );

  const recordDeposit = useCallback(
    async (params: {
      lease_id: string;
      operation_type: "encaissement" | "restitution" | "retenue";
      amount: number;
      date?: string;
      description?: string;
      deductions?: any[];
    }) => {
      const result = await apiClient.post<{ data: any }>(
        "/api/accounting/deposits",
        params
      );
      mutate();
      return result.data;
    },
    [mutate]
  );

  return {
    deposits: data?.data || [],
    isLoading,
    error,
    refresh: mutate,
    recordDeposit,
  };
}

// ============================================================================
// Hook de calcul honoraires
// ============================================================================

export function useHonorairesCalculator() {
  const [result, setResult] = useState<{
    loyer_hc: number;
    taux_ht: number;
    montant_ht: number;
    tva_taux: number;
    tva_montant: number;
    total_ttc: number;
    net_proprietaire: number;
  } | null>(null);

  const calculate = useCallback(
    (loyerHC: number, tauxHT: number = 0.07, codePostal: string = "75000") => {
      // Calcul local côté client
      const tauxTVA = getTauxTVA(codePostal);
      const montantHT = loyerHC * tauxHT;
      const tvaMontant = montantHT * tauxTVA;
      const totalTTC = montantHT + tvaMontant;
      const netProprietaire = loyerHC - totalTTC;

      const calcul = {
        loyer_hc: Math.round(loyerHC * 100) / 100,
        taux_ht: tauxHT,
        montant_ht: Math.round(montantHT * 100) / 100,
        tva_taux: tauxTVA,
        tva_montant: Math.round(tvaMontant * 100) / 100,
        total_ttc: Math.round(totalTTC * 100) / 100,
        net_proprietaire: Math.round(netProprietaire * 100) / 100,
      };

      setResult(calcul);
      return calcul;
    },
    []
  );

  return {
    result,
    calculate,
  };
}

// Helper pour le taux TVA
function getTauxTVA(codePostal: string): number {
  if (!codePostal) return 0.2;

  const prefix = codePostal.substring(0, 3);

  // Antilles (971 Guadeloupe, 972 Martinique)
  if (prefix === "971" || prefix === "972") return 0.085;
  // Réunion (974)
  if (prefix === "974") return 0.085;
  // Guyane (973)
  if (prefix === "973") return 0;
  // Mayotte (976)
  if (prefix === "976") return 0;

  return 0.2; // Métropole
}

// ============================================================================
// Hook de situation locataire
// ============================================================================

export function useTenantSituation(tenantId?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    tenantId ? `/api/accounting/situation/${tenantId}` : null,
    apiClient.get
  );

  return {
    situation: data?.data,
    isLoading,
    error,
    refresh: mutate,
  };
}

// ============================================================================
// Hook export FEC
// ============================================================================

export function useFECExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportFEC = useCallback(async (year: number) => {
    setIsExporting(true);
    setError(null);

    try {
      const response = await fetch(`/api/accounting/fec/export?year=${year}`, {
        method: "GET",
        headers: {
          Accept: "text/csv",
        },
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'export FEC");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FEC_${year}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    exportFEC,
    isExporting,
    error,
  };
}
