/**
 * Page Dashboard Owner - Server Component
 * Utilise les données déjà chargées dans le layout via Context
 */

import { DashboardClient } from "./DashboardClient";
import { fetchDashboard } from "../_data";

/**
 * Server Component - Les données sont déjà chargées dans le layout
 * On peut aussi les récupérer directement ici si besoin de données spécifiques
 */
export default async function OwnerDashboardPage() {
  // Les données sont déjà dans le Context via le layout
  // On peut les récupérer ici aussi si besoin de données supplémentaires
  // Pour l'instant, on passe null et le Client Component utilisera le Context
  
  return <DashboardClient dashboardData={null} />;
}
