import { fetchAdminStats } from "../_data/fetchAdminStats";
import { DashboardClient } from "./DashboardClient";

export default async function AdminDashboardPage() {
  // Fetch non-bloquant pour le layout, mais bloquant pour cette page
  // Grâce à loading.tsx, l'utilisateur verra un skeleton immédiatement
  const stats = await fetchAdminStats();

  if (!stats) {
    return <div>Erreur lors du chargement des statistiques.</div>;
  }

  return <DashboardClient stats={stats} />;
}
