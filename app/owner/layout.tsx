export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { fetchProperties, fetchDashboard, fetchContracts } from "./_data";
import { OwnerDataProvider } from "./_data/OwnerDataProvider";
import { OwnerAppLayout } from "@/components/layout/owner-app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { EntityProvider } from "@/providers/EntityProvider";

/**
 * Layout Owner - Server Component
 * Charge toutes les données nécessaires une seule fois et les propage via Context
 */
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  
  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Récupérer le profil (avec fallback service role en cas de récursion RLS)
  const { profile } = await getServerProfile<{ id: string; role: string; prenom: string | null; nom: string | null }>(
    user.id,
    "id, role, prenom, nom"
  );

  if (!profile) {
    redirect("/auth/signin");
  }

  // Vérifier que c'est bien un propriétaire
  if (profile.role !== "owner") {
    if (profile.role === "tenant") {
      redirect("/tenant");
    } else {
      redirect("/dashboard");
    }
  }

  // Charger toutes les données en parallèle
  // Utiliser Promise.allSettled pour ne pas bloquer si une requête échoue
  const [propertiesResult, dashboardResult, contractsResult] = await Promise.allSettled([
    fetchProperties(profile.id),
    fetchDashboard(profile.id),
    fetchContracts({ ownerId: profile.id }),
  ]);

  const properties = propertiesResult.status === "fulfilled" ? propertiesResult.value : null;
  const dashboard = dashboardResult.status === "fulfilled" ? dashboardResult.value : null;
  const contracts = contractsResult.status === "fulfilled" ? contractsResult.value : null;

  // Collecter les erreurs pour les transmettre au client
  const errors: string[] = [];
  if (propertiesResult.status === "rejected") {
    console.error("[OwnerLayout] Error fetching properties:", propertiesResult.reason);
    errors.push("propriétés");
  }
  if (dashboardResult.status === "rejected") {
    console.error("[OwnerLayout] Error fetching dashboard:", dashboardResult.reason);
    errors.push("tableau de bord");
  }
  if (contractsResult.status === "rejected") {
    console.error("[OwnerLayout] Error fetching contracts:", contractsResult.reason);
    errors.push("contrats");
  }

  const dataError = errors.length > 0
    ? `Impossible de charger : ${errors.join(", ")}. Veuillez rafraîchir la page.`
    : null;

  return (
    <ErrorBoundary>
      <OwnerDataProvider
        properties={properties}
        dashboard={dashboard}
        contracts={contracts}
        error={dataError}
      >
        <EntityProvider>
          <OwnerAppLayout profile={profile}>{children}</OwnerAppLayout>
        </EntityProvider>
      </OwnerDataProvider>
    </ErrorBoundary>
  );
}

