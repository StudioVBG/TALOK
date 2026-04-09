"use client";

/**
 * DepotsGarantieTab — Onglet dépôts de garantie dans la page Finances
 *
 * Charge les dépôts via /api/deposits et affiche DepositTracker + DepositRestitutionForm.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  DepositTracker,
  type SecurityDeposit,
} from "@/features/billing/components/deposit-tracker";
import { DepositRestitutionForm } from "@/features/billing/components/deposit-restitution-form";

export function DepotsGarantieTab() {
  const [deposits, setDeposits] = useState<SecurityDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeposit, setSelectedDeposit] = useState<SecurityDeposit | null>(null);

  const fetchDeposits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/deposits");
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.deposits || []);
      }
    } catch (err) {
      console.error("[DepotsGarantieTab] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  const handleRestitute = useCallback((deposit: SecurityDeposit) => {
    setSelectedDeposit(deposit);
  }, []);

  const handleSuccess = useCallback(() => {
    setSelectedDeposit(null);
    fetchDeposits();
  }, [fetchDeposits]);

  return (
    <>
      <DepositTracker
        deposits={deposits}
        loading={loading}
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
