// =====================================================
// Layout Syndic - Server Component SOTA 2026
// Sécurisation serveur avec vérification des permissions
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { getRoleDashboardUrl } from "@/lib/helpers/role-redirects";
import { checkIdentityGate } from "@/lib/helpers/identity-gate";
import { PhoneVerificationBanner } from "@/components/identity/PhoneVerificationBanner";
import CsrfTokenInjector from "@/components/security/CsrfTokenInjector";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { SyndicPlanBanner } from "@/components/syndic/SyndicPlanBanner";
import { SyndicOnboardingWrapper } from "@/components/syndic/SyndicOnboardingWrapper";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PlatformBroadcastBanner } from "@/components/platform-broadcast-banner";
import { SharedBottomNav } from "@/components/layout/shared-bottom-nav";
import Link from "next/link";
import {
  Building2, Users, Calendar, Euro,
  FileText, Settings, Bell, HelpCircle,
  LayoutDashboard, ClipboardList, UserPlus,
  Calculator, AlertTriangle, Hammer, Scale, Briefcase, Inbox,
} from "lucide-react";

// Navigation syndic — `tour` cible les étapes de SyndicOnboardingWrapper.
const navigation = [
  { name: "Dashboard", href: "/syndic/dashboard", icon: LayoutDashboard, tour: "syndic-dashboard" },
  { name: "Copropriétés", href: "/syndic/sites", icon: Building2, tour: "syndic-sites" },
  { name: "Demandes", href: "/syndic/claims", icon: Inbox },
  { name: "Assemblées", href: "/syndic/assemblies", icon: Calendar, tour: "syndic-assemblies" },
  { name: "Mandats", href: "/syndic/mandates", icon: FileText, tour: "syndic-mandates" },
  { name: "Conseils syndicaux", href: "/syndic/councils", icon: Users },
  { name: "Comptabilité", href: "/syndic/accounting", icon: Calculator, tour: "syndic-accounting" },
  { name: "Appels de fonds", href: "/syndic/calls", icon: Euro, tour: "syndic-calls" },
  { name: "Fonds travaux", href: "/syndic/fonds-travaux", icon: Hammer },
  { name: "Dépenses", href: "/syndic/expenses", icon: FileText },
  { name: "Fournisseurs", href: "/syndic/suppliers", icon: Briefcase },
  { name: "Impayés", href: "/syndic/impayes", icon: AlertTriangle },
  { name: "Invitations", href: "/syndic/invites", icon: UserPlus },
  { name: "Paramètres", href: "/syndic/settings", icon: Settings },
];

/**
 * Layout Syndic - Server Component
 * Vérifie l'authentification et le rôle syndic côté serveur
 * SOTA 2026: Protection serveur obligatoire
 */
export default async function SyndicLayout({
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
    redirect("/auth/signin?redirect=/syndic/dashboard");
  }

  // 2. Récupérer le profil (avec fallback service role en cas de récursion RLS)
  const { profile } = await getServerProfile<{ id: string; role: string; prenom: string | null; nom: string | null; identity_status: string | null }>(
    user.id,
    "id, role, prenom, nom, identity_status"
  );

  if (!profile) {
    redirect("/auth/signin");
  }

  // 3. Vérifier le rôle syndic ou admin
  const allowedRoles = ["syndic", "admin", "platform_admin"];
  if (!allowedRoles.includes(profile.role)) {
    redirect(getRoleDashboardUrl(profile.role));
  }

  // 3.bis Identity Gate — redirige vers l'onboarding si le niveau requis n'est pas atteint
  const pathname = headers().get("x-pathname") || "/syndic";
  checkIdentityGate(pathname, profile.role, profile.identity_status);

  // 4. Rendre le layout - SOTA 2026: Thème light unifié + breakpoint lg
  const userName = profile.prenom || "";

  return (
    <ErrorBoundary>
      <CsrfTokenInjector />
      <PhoneVerificationBanner identityStatus={profile.identity_status} pathname={pathname} />
      <SyndicOnboardingWrapper profileId={profile.id} userName={userName}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/30">
        {/* Offline indicator - visible when device loses connectivity */}
        <OfflineIndicator />

        {/* Sidebar Desktop - Breakpoint lg unifié comme Owner/Tenant/Admin */}
        <aside
          className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0"
          role="navigation"
          aria-label="Navigation principale syndic"
          data-tour-sidebar
        >
          <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-card/80 backdrop-blur-xl border-r border-border/50">
            {/* Logo / Titre */}
            <div className="flex items-center flex-shrink-0 px-4 mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25"
                  aria-hidden="true"
                >
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                    Espace Syndic
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Talok Pro
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 space-y-1" aria-label="Menu syndic">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  data-tour={item.tour}
                  className="group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  aria-label={item.name}
                >
                  <item.icon
                    className="mr-3 h-5 w-5 flex-shrink-0 text-muted-foreground group-hover:text-cyan-600 transition-colors"
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Footer avec profil et déconnexion */}
            <div className="flex-shrink-0 p-4 border-t border-border/50 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold"
                  aria-hidden="true"
                >
                  {(profile.prenom?.[0] || 'S').toUpperCase()}
                  {(profile.nom?.[0] || '').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {profile.prenom} {profile.nom}
                  </p>
                  <p className="text-xs text-muted-foreground truncate capitalize">
                    {profile.role}
                  </p>
                </div>
              </div>
              <SignOutButton />
            </div>
          </div>
        </aside>

        {/* Mobile Header - Thème light unifié */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center"
                aria-hidden="true"
              >
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-foreground">Syndic</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-2 text-muted-foreground hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
              </button>
              <SignOutButton variant="mobile-icon" />
            </div>
          </div>
        </div>

        {/* Main content - Padding unifié comme autres layouts */}
        <main
          className="lg:pl-64 flex-1 pt-14 lg:pt-0"
          role="main"
          aria-label="Contenu principal"
        >
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            <PlatformBroadcastBanner />
            {/* S2-4 : bandeau persistant affiché aux syndics sur plan
                Gratuit/Starter (copro_module=false). Le composant ne
                rend rien si le plan actuel inclut copro_module. */}
            <SyndicPlanBanner />
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation — SharedBottomNav (parité 12/12 items via menu Plus) */}
        <SharedBottomNav
          items={[
            { href: "/syndic/dashboard", label: "Dashboard", icon: LayoutDashboard, tourId: "syndic-dashboard" },
            { href: "/syndic/sites", label: "Copros", icon: Building2, tourId: "syndic-sites" },
            { href: "/syndic/accounting", label: "Compta", icon: Calculator, tourId: "syndic-accounting" },
            { href: "/syndic/calls", label: "Appels", icon: Euro, tourId: "syndic-calls" },
          ]}
          moreItems={[
            { href: "/syndic/assemblies", label: "Assemblées", icon: Calendar, tourId: "syndic-assemblies" },
            { href: "/syndic/mandates", label: "Mandats", icon: FileText, tourId: "syndic-mandates" },
            { href: "/syndic/councils", label: "Conseils", icon: Users },
            { href: "/syndic/fonds-travaux", label: "Fonds travaux", icon: Hammer },
            { href: "/syndic/expenses", label: "Dépenses", icon: FileText },
            { href: "/syndic/impayes", label: "Impayés", icon: AlertTriangle },
            { href: "/syndic/invites", label: "Invitations", icon: UserPlus },
            { href: "/syndic/settings", label: "Paramètres", icon: Settings },
          ]}
          hideAbove="lg"
        />
      </div>
      </SyndicOnboardingWrapper>
    </ErrorBoundary>
  );
}
