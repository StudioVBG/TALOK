"use client";

/**
 * DepotsGarantieTab — Onglet dépôts de garantie dans la page Finances
 *
 * Charge les dépôts via /api/deposits et affiche DepositTracker + DepositRestitutionForm.
 */

import React, { useState, useCallback } from "react";
import useSWR from "swr";
import {
  DepositTracker,
  type SecurityDeposit,
} from "@/features/billing/components/deposit-tracker";
import { DepositRestitutionForm } from "@/features/billing/components/deposit-restitution-form";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function DepotsGarantieTab() {
  const { data, isLoading, mutate } = useSWR<{
    deposits: SecurityDeposit[];
    pagination: { page: number; limit: number; total: number };
  }>("/api/deposits", fetcher);

  const [selectedDeposit, setSelectedDeposit] = useState<SecurityDeposit | null>(null);

  const handleRestitute = useCallback((deposit: SecurityDeposit) => {
    setSelectedDeposit(deposit);
  }, []);

  const handleSuccess = useCallback(() => {
    setSelectedDeposit(null);
    mutate();
  }, [mutate]);

  return (
    <>
      <DepositTracker
        deposits={data?.deposits || []}
        loading={isLoading}
        onRestitute={handleRestitute}
      />

      {selectedDeposit && (
        <DepositRestitutionForm
          deposit={selectedDeposit}
          open={!!selectedDeposit}
          onOpenChange={(open) => {
            if (!open) setSelectedDeposit(null);
          }}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
