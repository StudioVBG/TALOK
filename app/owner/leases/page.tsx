// @ts-nocheck
/**
 * Page Contracts Owner - Server Component
 * Utilise les données déjà chargées dans le layout via Context
 */

import { ContractsClient } from "./ContractsClient";

export default async function OwnerContractsPage() {
  // Les données sont déjà dans le Context via le layout
  return <ContractsClient />;
}
