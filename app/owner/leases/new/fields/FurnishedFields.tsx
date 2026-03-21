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
  const { furnitureInventory, taxRegime, setFurnished } = useLeaseWizardStore();

  if (!isFurnished) return null;

  return (
    <div className="space-y-6">
      <FurnitureInventoryStep
        data={furnitureInventory ?? createInitialInventory()}
        onChange={(data) => setFurnished({ furnitureInventory: data })}
      />
      <TaxRegimeSelector
        data={taxRegime ?? createInitialTaxRegime()}
        onChange={(data) => setFurnished({ taxRegime: data })}
      />
    </div>
  );
}
