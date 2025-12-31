export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchTenantDashboard } from "./_data/fetchTenantDashboard";
import { TenantDataProvider } from "./_data/TenantDataProvider";
import { TenantAppLayout } from "@/components/layout/tenant-app-layout";
import { ErrorBoundary } from "@/components/error-boundary";

/**
 * Layout Tenant - Server Component
 * Charge les données dashboard une seule fois
 */
export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/db008224-e4e1-4d8a-b3aa-f82f98e7a371',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'pre-fix',hypothesisId:'H1',location:'app/app/tenant/layout.tsx:render',message:'Tenant layout render invoked',data:{},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const supabase = await createClient();
  
  // 1. Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // 2. Récupérer le profil
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom, avatar_url")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/auth/signin");
  }

  // 3. Vérifier le rôle
  if (profile.role !== "tenant") {
    if (profile.role === "owner") {
      redirect("/app/owner/dashboard");
    } else {
      redirect("/");
    }
  }

  // 4. Charger les données du dashboard (RPC)
  // On utilise un try/catch pour ne pas bloquer tout le layout si la RPC échoue
  // mais idéalement on voudrait afficher une erreur
  let dashboardData = null;
  try {
    dashboardData = await fetchTenantDashboard(user.id);
  } catch (err) {
    console.error("Error fetching tenant dashboard:", err);
  }

  return (
    <ErrorBoundary>
      <TenantDataProvider dashboard={dashboardData}>
        <TenantAppLayout profile={profile}>{children}</TenantAppLayout>
      </TenantDataProvider>
    </ErrorBoundary>
  );
}

