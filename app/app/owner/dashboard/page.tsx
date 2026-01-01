export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
/**
 * Page Dashboard Owner - Server Component
 * Utilise les données déjà chargées dans le layout via Context
 */

import { DashboardClient } from "./DashboardClient";
import { fetchDashboard } from "../_data";
import { fetchProfileCompletion } from "../_data/fetchProfileCompletion";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Component - Les données sont déjà chargées dans le layout
 * On peut aussi les récupérer directement ici si besoin de données spécifiques
 */
export default async function OwnerDashboardPage() {
  const supabase = await createClient();
  
  // Récupérer l'utilisateur connecté
  const { data: { user } } = await supabase.auth.getUser();
  
  let profileCompletion = null;
  
  if (user) {
    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (profile) {
      // Récupérer les données de complétion
      profileCompletion = await fetchProfileCompletion(profile.id);
    }
  }
  
  return <DashboardClient dashboardData={null} profileCompletion={profileCompletion} />;
}
