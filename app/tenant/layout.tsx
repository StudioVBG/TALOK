export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
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
  const supabase = await createClient();
  
  // 1. Vérifier l'authentification
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  // 2. Récupérer le profil (avec fallback service role en cas de récursion RLS)
  const { profile } = await getServerProfile<{ id: string; role: string; prenom: string | null; nom: string | null; avatar_url: string | null }>(
    user.id,
    "id, role, prenom, nom, avatar_url"
  );

  if (!profile) {
    redirect("/auth/signin");
  }

  // 3. Vérifier le rôle
  if (profile.role !== "tenant") {
    if (profile.role === "owner") {
      redirect("/owner/dashboard");
    } else {
      redirect("/");
    }
  }

  // 4. Charger les données du dashboard (RPC)
  let dashboardData = null;
  let dataError: string | null = null;
  try {
    dashboardData = await fetchTenantDashboard(user.id);
  } catch (err) {
    console.error("Error fetching tenant dashboard:", err);
    dataError = "Impossible de charger votre tableau de bord. Veuillez rafraîchir la page.";
  }

  return (
    <ErrorBoundary>
      <TenantDataProvider dashboard={dashboardData} profile={profile} error={dataError}>
        <TenantAppLayout profile={profile}>{children}</TenantAppLayout>
      </TenantDataProvider>
    </ErrorBoundary>
  );
}

