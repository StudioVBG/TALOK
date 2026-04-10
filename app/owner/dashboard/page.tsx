export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Page Dashboard Owner - Server Component
 * Utilise les données déjà chargées dans le layout via Context
 */

import { DashboardClient } from "./DashboardClient";
import { fetchProfileCompletion } from "../_data/fetchProfileCompletion";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { redirect } from "next/navigation";

/**
 * Server Component - Les données sont déjà chargées dans le layout
 * On peut aussi les récupérer directement ici si besoin de données spécifiques
 */
export default async function OwnerDashboardPage() {
  let profileCompletion = null;

  try {
    const supabase = await createClient();

    // Récupérer l'utilisateur connecté
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      redirect("/auth/signin");
    }

    const serviceClient = getServiceClient();

    // Récupérer le profil
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profile) {
      // Récupérer les données de complétion
      profileCompletion = await fetchProfileCompletion(profile.id);
    }
  } catch (error) {
    console.error("[OwnerDashboardPage] Erreur lors du chargement du profil:", error);
    // profileCompletion reste null, le dashboard se charge sans la carte de complétion
  }

  return <DashboardClient profileCompletion={profileCompletion} />;
}
