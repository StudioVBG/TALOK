export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { getRoleDashboardUrl } from "@/lib/helpers/role-redirects";
import { fetchProperties, fetchDashboard, fetchContracts } from "./_data";
import { OwnerDataProvider } from "./_data/OwnerDataProvider";
import { OwnerAppLayout } from "@/components/layout/owner-app-layout";
import { ErrorBoundary } from "@/components/error-boundary";
import { EntityProvider } from "@/providers/EntityProvider";
import CsrfTokenInjector from "@/components/security/CsrfTokenInjector";

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
    redirect(getRoleDashboardUrl(profile.role));
  }

  // Filet de sécurité : s'assurer que owner_profiles existe (évite "aucune entité")
  const serviceClient = getServiceClient();
  const { data: ownerProfile } = await serviceClient
    .from("owner_profiles")
    .select("profile_id")
    .eq("profile_id", profile.id)
    .maybeSingle();

  if (!ownerProfile) {
    const { error: opError } = await serviceClient.from("owner_profiles").insert({
      profile_id: profile.id,
      type: "particulier",
    });
    if (opError) {
      console.error("[OwnerLayout] Failed to create owner_profiles:", opError.message);
    }
  }

  // Filet de sécurité : s'assurer qu'au moins une entité juridique existe (évite "Aucune entité juridique")
  const { data: hasEntity } = await serviceClient
    .from("legal_entities")
    .select("id")
    .eq("owner_profile_id", profile.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!hasEntity) {
    const nom = [profile.prenom, profile.nom].filter(Boolean).join(" ") || "Patrimoine personnel";
    const { data: newEntity, error: leError } = await serviceClient
      .from("legal_entities")
      .insert({
        owner_profile_id: profile.id,
        entity_type: "particulier",
        nom,
        regime_fiscal: "ir",
        is_active: true,
      })
      .select("id")
      .single();

    if (leError) {
      console.error("[OwnerLayout] Failed to create legal_entity:", leError.message);
    } else if (newEntity) {
      // Lier les propriétés orphelines à la nouvelle entité
      const { error: linkError } = await serviceClient
        .from("properties")
        .update({ legal_entity_id: newEntity.id })
        .eq("owner_id", profile.id)
        .is("legal_entity_id", null)
        .is("deleted_at", null);
      if (linkError) {
        console.error("[OwnerLayout] Failed to link orphan properties:", linkError.message);
      }
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
      {/* Injection du token CSRF pour les mutations sécurisées */}
      <CsrfTokenInjector />
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

