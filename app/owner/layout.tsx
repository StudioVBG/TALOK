export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchProperties, fetchDashboard, fetchContracts } from "./_data";
import { OwnerDataProvider } from "./_data/OwnerDataProvider";
import { OwnerAppLayout } from "@/components/layout/owner-app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { OrganizationProvider } from "@/lib/hooks/use-organization";
import type { Organization } from "@/lib/types/multi-company";

// Fonction pour charger les organisations
async function fetchOrganizations(profileId: string) {
  const supabase = await createClient();

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("owner_profile_id", profileId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[fetchOrganizations] Error:", error);
    return { organizations: [], propertyCountByOrg: {} };
  }

  // Compter les biens par organisation
  const { data: propertyCounts } = await supabase
    .from("properties")
    .select("organization_id")
    .eq("owner_id", profileId);

  const propertyCountByOrg: Record<string, number> = {};
  if (propertyCounts) {
    propertyCounts.forEach((p: any) => {
      if (p.organization_id) {
        propertyCountByOrg[p.organization_id] = (propertyCountByOrg[p.organization_id] || 0) + 1;
      }
    });
  }

  return {
    organizations: (organizations || []) as Organization[],
    propertyCountByOrg
  };
}

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
      redirect("/tenant");
    } else {
      redirect("/dashboard");
    }
  }

  // Charger toutes les données en parallèle
  // Utiliser Promise.allSettled pour ne pas bloquer si une requête échoue
  const [propertiesResult, dashboardResult, contractsResult, organizationsResult] = await Promise.allSettled([
    fetchProperties(profile.id),
    fetchDashboard(profile.id),
    fetchContracts({ ownerId: profile.id }),
    fetchOrganizations(profile.id),
  ]);

  const properties = propertiesResult.status === "fulfilled" ? propertiesResult.value : null;
  const dashboard = dashboardResult.status === "fulfilled" ? dashboardResult.value : null;
  const contracts = contractsResult.status === "fulfilled" ? contractsResult.value : null;
  const organizationsData = organizationsResult.status === "fulfilled"
    ? organizationsResult.value
    : { organizations: [], propertyCountByOrg: {} };

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
  if (organizationsResult.status === "rejected") {
    console.error("[OwnerLayout] Error fetching organizations:", organizationsResult.reason);
  }

  return (
    <ErrorBoundary>
      <OrganizationProvider
        initialOrganizations={organizationsData.organizations}
        initialPropertyCounts={organizationsData.propertyCountByOrg}
      >
        <OwnerDataProvider
          properties={properties}
          dashboard={dashboard}
          contracts={contracts}
        >
          <OwnerAppLayout profile={profile}>{children}</OwnerAppLayout>
        </OwnerDataProvider>
      </OrganizationProvider>
    </ErrorBoundary>
  );
}

