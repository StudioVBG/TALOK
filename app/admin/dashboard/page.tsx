export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { fetchAdminStatsV2 } from "../_data/fetchAdminStats";
import { DashboardClientV2 } from "./DashboardClientV2";

export default async function AdminDashboardPage() {
  // Fetch non-bloquant pour le layout, mais bloquant pour cette page
  // Grâce à loading.tsx, l'utilisateur verra un skeleton immédiatement
  const stats = await fetchAdminStatsV2();

  if (!stats) {
    return <div>Erreur lors du chargement des statistiques.</div>;
  }

  return <DashboardClientV2 stats={stats} />;
}
