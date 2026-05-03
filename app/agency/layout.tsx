// =====================================================
// Layout Agency - Server Component SOTA 2026
// Sécurisation serveur avec vérification des permissions
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { checkIdentityGate } from "@/lib/helpers/identity-gate";
import { PhoneVerificationBanner } from "@/components/identity/PhoneVerificationBanner";
import { ErrorBoundary } from "@/components/error-boundary";
import CsrfTokenInjector from "@/components/security/CsrfTokenInjector";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { AgencySidebar } from "./_components/AgencySidebar";
import { AgencyThemeWrapper } from "./_components/AgencyThemeWrapper";
import { PlatformBroadcastBanner } from "@/components/platform-broadcast-banner";
import { OnboardingWrapper } from "@/components/onboarding/OnboardingWrapper";
import type { TourRole } from "@/components/onboarding/OnboardingTour";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Building2 } from "lucide-react";

/**
 * Layout Agency - Server Component
 * Vérifie l'authentification et le rôle agency côté serveur
 * SOTA 2026: Protection serveur obligatoire
 */
export default async function AgencyLayout({
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
    redirect("/auth/signin?redirect=/agency/dashboard");
  }

  // 2. Récupérer le profil (avec fallback service role en cas de récursion RLS)
  const { profile } = await getServerProfile<{ id: string; role: string; prenom: string | null; nom: string | null; identity_status: string | null }>(
    user.id,
    "id, role, prenom, nom, identity_status"
  );

  if (!profile) {
    redirect("/auth/signin");
  }

  // 3. Vérifier le rôle agency ou admin
  const allowedRoles = ["agency", "admin", "platform_admin"];
  if (!allowedRoles.includes(profile.role)) {
    // Rediriger vers le bon dashboard selon le rôle
    const roleRedirects: Record<string, string> = {
      owner: "/owner/dashboard",
      tenant: "/tenant/dashboard",
      provider: "/provider/dashboard",
      syndic: "/syndic/dashboard",
    };
    redirect(roleRedirects[profile.role] || "/dashboard");
  }

  // 3.bis Identity Gate — redirige vers l'onboarding si le niveau requis n'est pas atteint
  const pathname = headers().get("x-pathname") || "/agency";
  checkIdentityGate(pathname, profile.role, profile.identity_status);

  // 4. Récupérer les données de l'agence (parent ou propre selon le rôle).
  //
  // Distinction critique : un team member (gestionnaire, assistant,
  // comptable...) a profile.role='agency' MAIS son propre agency_profiles
  // est vide — l'agence "réelle" est référencée par agency_managers.
  // Sans cette résolution, la sidebar/header affichait un nom d'agence
  // vide à tous les employés invités.
  //
  // On utilise le service-role pour bypass les RLS croisées
  // agency_managers ↔ agency_profiles (évite la récursion).
  const serviceClient = getServiceClient();
  const { data: managerRow } = await serviceClient
    .from("agency_managers")
    .select("agency_profile_id")
    .eq("user_profile_id", profile.id)
    .eq("is_active", true)
    .maybeSingle();

  const targetAgencyProfileId =
    (managerRow as { agency_profile_id: string } | null)?.agency_profile_id ??
    profile.id;

  // Note : la colonne réelle est `raison_sociale` (pas nom_agence). Schéma
  // dans migration 20251206700000 ; on retombe sur "Mon Agence" si vide
  // (cas du compte fraîchement inscrit avant onboarding /agency/onboarding/profile).
  const { data: agencyProfile } = await serviceClient
    .from("agency_profiles")
    .select("raison_sociale, logo_url, siret, profile_id")
    .eq("profile_id", targetAgencyProfileId)
    .maybeSingle();

  // 5. Rendre le layout
  // admin / platform_admin → tour admin (0 étape) pour ne pas polluer l'UI agence
  const tourRole: TourRole = profile.role === "agency" ? "agency" : "admin";
  return (
    <ErrorBoundary>
      <CsrfTokenInjector />
      <PhoneVerificationBanner identityStatus={profile.identity_status} pathname={pathname} />
      <OnboardingWrapper
        role={tourRole}
        profileId={profile.id}
        userName={profile.prenom || ""}
      >
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30">
        <OfflineIndicator />

        {/* Mobile Header — déconnexion accessible sur mobile (sidebar cachée < lg) */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"
                aria-hidden="true"
              >
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-foreground truncate">
                {(agencyProfile?.raison_sociale as string) || "Mon Agence"}
              </span>
            </div>
            <SignOutButton variant="mobile-icon" />
          </div>
        </div>

        <div className="flex">
          {/* Sidebar Client Component pour interactivité */}
          <AgencySidebar
            profile={profile}
            agencyName={(agencyProfile?.raison_sociale as string) || "Mon Agence"}
          />

          {/* Main content - SOTA 2026: lg breakpoint unifié */}
          <main
            className="lg:pl-64 flex-1 pt-14 lg:pt-0"
            role="main"
            aria-label="Contenu principal"
          >
            <div className="py-6 px-4 sm:px-6 lg:px-8">
              <AgencyThemeWrapper>
                <PlatformBroadcastBanner />
                {children}
              </AgencyThemeWrapper>
            </div>
          </main>
        </div>
      </div>
      </OnboardingWrapper>
    </ErrorBoundary>
  );
}
