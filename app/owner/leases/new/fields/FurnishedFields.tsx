"use client";

import { useLeaseWizardStore, selectIsFurnished } from "@/features/leases/stores/lease-wizard.store";
import { FurnitureInventoryStep, createInitialInventory } from "../FurnitureInventoryStep";
import { TaxRegimeSelector, createInitialTaxRegime } from "../TaxRegimeSelector";

/**
 * SOTA 2026: Champs specifiques baux meubles / BIC
 * Inventaire mobilier obligatoire (Decret 2015-981) + Regime fiscal
 */
export function FurnishedFields() {
  const isFurnished = useLeaseWizardStore(selectIsFurnished);
  const { typeBail, loyer, furnitureInventory, taxRegime, setFurnished } = useLeaseWizardStore();

  if (!isFurnished) return null;

  return (
    <div className="space-y-6">
      <FurnitureInventoryStep
        value={furnitureInventory ?? createInitialInventory()}
        onChange={(data) => setFurnished({ furnitureInventory: data })}
        typeBail={typeBail || "meuble"}
      />
      <TaxRegimeSelector
        value={taxRegime ?? createInitialTaxRegime()}
        onChange={(data) => setFurnished({ taxRegime: data })}
        annualRent={(loyer || 0) * 12}
      />
    </div>
  );
}
