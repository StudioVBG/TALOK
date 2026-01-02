export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { DashboardClient } from "./DashboardClient";

export default async function TenantDashboardPage() {
  // Les données sont déjà chargées dans le layout et disponibles via Context
  return <DashboardClient />;
}

