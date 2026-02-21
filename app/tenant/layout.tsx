export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { getRoleDashboardUrl } from "@/lib/helpers/role-redirects";
import { getServiceClient } from "@/lib/supabase/service-client";
import { fetchTenantDashboard } from "./_data/fetchTenantDashboard";
import { TenantDataProvider } from "./_data/TenantDataProvider";
import { TenantAppLayout } from "@/components/layout/tenant-app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import CsrfTokenInjector from "@/components/security/CsrfTokenInjector";

/**
 * Auto-link les lease_signers orphelins pour un locataire existant.
 * Cas couvert : un utilisateur déjà inscrit est invité sur un nouveau bail
 * → le trigger `on_profile_created_auto_link` ne se déclenche pas car le profil existe déjà.
 * Cette fonction rattrape le lien à chaque chargement du layout tenant.
 */
async function autoLinkLeaseSigners(profileId: string, userEmail: string) {
  try {
    const serviceClient = getServiceClient();
    const { data: orphanSigners } = await serviceClient
      .from("lease_signers")
      .select("id, lease_id")
      .ilike("invited_email", userEmail)
      .is("profile_id", null);

    if (orphanSigners && orphanSigners.length > 0) {
      const { error } = await serviceClient
        .from("lease_signers")
        .update({ profile_id: profileId } as Record<string, unknown>)
        .ilike("invited_email", userEmail)
        .is("profile_id", null);

      if (error) {
        console.error("[auto-link] Erreur liaison lease_signers:", error);
      } else {
        console.log(`[auto-link] ${orphanSigners.length} lease_signers liés au profil ${profileId}`);
        // Backfill invoices.tenant_id pour les baux liés
        const leaseIds = orphanSigners.map((s) => s.lease_id).filter(Boolean);
        if (leaseIds.length > 0) {
          await serviceClient
            .from("invoices")
            .update({ tenant_id: profileId })
            .in("lease_id", leaseIds)
            .is("tenant_id", null);
        }
      }
    }
  } catch (err) {
    // Ne jamais bloquer le chargement de la page pour cette opération
    console.error("[auto-link] Erreur inattendue:", err);
  }
}

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
    redirect(getRoleDashboardUrl(profile.role));
  }

  // 3b. Auto-link : rattacher les lease_signers orphelins (email match, profile_id NULL)
  if (user.email) {
    await autoLinkLeaseSigners(profile.id, user.email);
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
      <CsrfTokenInjector />
      <TenantDataProvider dashboard={dashboardData} profile={profile} error={dataError}>
        <TenantAppLayout profile={profile}>{children}</TenantAppLayout>
      </TenantDataProvider>
    </ErrorBoundary>
  );
}

