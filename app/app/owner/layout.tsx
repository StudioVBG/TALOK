export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchProperties, fetchDashboard, fetchContracts } from "./_data";
import { OwnerDataProvider } from "./_data/OwnerDataProvider";
import { OwnerAppLayout } from "@/components/layout/owner-app-layout";
import { ErrorBoundary } from "@/components/error-boundary";

/**
 * Layout Owner - Server Component
 * Charge toutes les données nécessaires une seule fois et les propage via Context
 */
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/db008224-e4e1-4d8a-b3aa-f82f98e7a371',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1',location:'app/app/owner/layout.tsx:render',message:'Owner layout render invoked',data:{},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const supabase = await createClient();
  
  // Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // Récupérer le profil
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/auth/signin");
  }

  // Vérifier que c'est bien un propriétaire
  if (profile.role !== "owner") {
    if (profile.role === "tenant") {
      redirect("/app/tenant");
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

  // Log des erreurs en développement
  if (propertiesResult.status === "rejected") {
    console.error("[OwnerLayout] Error fetching properties:", propertiesResult.reason);
  }
  if (dashboardResult.status === "rejected") {
    console.error("[OwnerLayout] Error fetching dashboard:", dashboardResult.reason);
  }
  if (contractsResult.status === "rejected") {
    console.error("[OwnerLayout] Error fetching contracts:", contractsResult.reason);
  }

  return (
    <ErrorBoundary>
      <OwnerDataProvider 
        properties={properties} 
        dashboard={dashboard}
        contracts={contracts}
      >
        <OwnerAppLayout profile={profile}>{children}</OwnerAppLayout>
      </OwnerDataProvider>
    </ErrorBoundary>
  );
}

