import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantDashboard } from "../_data/fetchTenantDashboard";
import { DashboardClient } from "./DashboardClient";

export default async function TenantDashboardPage() {
  // Les données sont déjà chargées dans le layout et disponibles via Context
  // Mais on peut aussi les recharger ici si on veut supporter l'accès direct sans layout data (optionnel)
  // Pour l'architecture SOTA, on s'appuie sur le Context du Layout pour éviter le double fetch
  // Donc cette page est très simple.
  
  return <DashboardClient />;
}

