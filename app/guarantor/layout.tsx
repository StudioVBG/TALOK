export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { getRoleDashboardUrl } from "@/lib/helpers/role-redirects";
import { checkIdentityGate } from "@/lib/helpers/identity-gate";
import { PhoneVerificationBanner } from "@/components/identity/PhoneVerificationBanner";
import { getSecondaryRoleManifest } from "@/lib/navigation/secondary-role-manifest";
import { ErrorBoundary } from "@/components/error-boundary";
import CsrfTokenInjector from "@/components/security/CsrfTokenInjector";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { GuarantorSignOutButton } from "./_components/GuarantorSignOutButton";
import { OnboardingWrapper } from "@/components/onboarding/OnboardingWrapper";
import { SharedBottomNav } from "@/components/layout/shared-bottom-nav";

/**
 * Layout Guarantor - Server Component
 * Vérifie l'authentification et le rôle garant côté serveur.
 * Utilise getServerProfile() pour éviter la récursion RLS.
 */
export default async function GuarantorLayout({ children }: { children: ReactNode }) {
  const manifest = getSecondaryRoleManifest("guarantor");
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
  const { profile } = await getServerProfile<{
    id: string;
    role: string;
    prenom: string | null;
    nom: string | null;
    avatar_url: string | null;
    identity_status: string | null;
  }>(user.id, "id, role, prenom, nom, avatar_url, identity_status");

  if (!profile) {
    redirect("/auth/signin");
  }

  // Vérifier que c'est bien un garant
  if (profile.role !== "guarantor") {
    redirect(getRoleDashboardUrl(profile.role));
  }

  // Identity Gate — redirige vers l'onboarding si le niveau requis n'est pas atteint
  const pathname = headers().get("x-pathname") || "/guarantor";
  checkIdentityGate(pathname, profile.role, profile.identity_status);

  return (
    <ErrorBoundary>
      <CsrfTokenInjector />
      <PhoneVerificationBanner identityStatus={profile.identity_status} pathname={pathname} />
      <OnboardingWrapper
        role="guarantor"
        profileId={profile.id}
        userName={profile.prenom || ""}
      >
      <div className="min-h-screen bg-background">
        <OfflineIndicator />

        {/* Header simplifié — nav horizontale cachée sur mobile, remplacée par bottom nav */}
        <header className="bg-card border-b border-border px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                {profile.prenom?.[0] || "G"}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  {profile.prenom} {profile.nom}
                </p>
                <p className="text-sm text-muted-foreground">Garant</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-4">
              {[...manifest.navigation, ...manifest.footerNavigation]
                .filter((item) => item.name !== "Aide")
                .map((item) => {
                  const tourId = item.href.endsWith("/dashboard")
                    ? "nav-dashboard"
                    : item.href.endsWith("/documents")
                    ? "nav-documents"
                    : undefined;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-tour={tourId}
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {item.name}
                    </Link>
                  );
                })}
              <GuarantorSignOutButton />
            </nav>
            <div className="md:hidden">
              <GuarantorSignOutButton />
            </div>
          </div>
        </header>

        {/* Contenu principal */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>

        {/* Mobile Bottom Navigation — accessibilité 100% sur mobile */}
        <SharedBottomNav
          items={manifest.navigation.map((item) => ({
            href: item.href,
            label: item.name,
            icon: item.icon,
            tourId: item.href.endsWith("/dashboard")
              ? "nav-dashboard"
              : item.href.endsWith("/documents")
              ? "nav-documents"
              : undefined,
          }))}
          moreItems={manifest.footerNavigation.map((item) => ({
            href: item.href,
            label: item.name,
            icon: item.icon,
          }))}
          hideAbove="md"
        />
      </div>
      </OnboardingWrapper>
    </ErrorBoundary>
  );
}
