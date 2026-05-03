// =====================================================
// Layout Copropriétaire - Server Component SOTA 2026
// Sécurisation serveur avec vérification des permissions
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
import { getRoleDashboardUrl, COPRO_ROLES } from "@/lib/helpers/role-redirects";
import { getSecondaryRoleManifest } from "@/lib/navigation/secondary-role-manifest";
import { ErrorBoundary } from "@/components/error-boundary";
import CsrfTokenInjector from "@/components/security/CsrfTokenInjector";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SharedBottomNav } from "@/components/layout/shared-bottom-nav";
import Link from "next/link";
import {
  Building2, Euro, FileText, Calendar,
  MessageSquare, Bell, Home, Settings
} from "lucide-react";

const { navigation, footerNavigation } = getSecondaryRoleManifest("copro");

// COPRO_ROLES importé depuis lib/helpers/role-redirects.ts

/**
 * Layout Copropriétaire - Server Component
 * Vérifie l'authentification et le rôle copro côté serveur
 * SOTA 2026: Protection serveur obligatoire
 */
export default async function CoproLayout({
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
    redirect("/auth/signin?redirect=/copro/dashboard");
  }

  // 2. Récupérer le profil (avec fallback service role en cas de récursion RLS)
  const { profile } = await getServerProfile<{ id: string; role: string; prenom: string | null; nom: string | null }>(
    user.id,
    "id, role, prenom, nom"
  );

  if (!profile) {
    redirect("/auth/signin");
  }

  // 3. Vérifier l'éligibilité au namespace /copro.
  //
  // Deux sources légitimes :
  //   a) profiles.role IN COPRO_ROLES (coproprietaire_*, syndic, admin…)
  //   b) user_site_roles : utilisateur invité comme locataire_copro,
  //      coproprietaire, conseil_syndical, etc., sans que profiles.role
  //      ait été muté (cohérent avec le pattern P0 owner-bénévole).
  //
  // Cas (b) couvre notamment les locataires invités par leur syndic via
  // /api/copro/invites (target_role='locataire' → role_code='locataire_copro').
  // Avant ce fix, ces locataires étaient redirigés silencieusement vers
  // /tenant/dashboard car 'tenant' n'est pas dans COPRO_ROLES.
  let allowed = COPRO_ROLES.includes(profile.role as typeof COPRO_ROLES[number]);

  if (!allowed) {
    const { count: siteRolesCount } = await supabase
      .from("user_site_roles")
      .select("site_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("role_code", [
        "syndic",
        "tresorier",
        "conseil_syndical",
        "coproprietaire",
        "coproprietaire_bailleur",
        "locataire_copro",
      ]);
    allowed = (siteRolesCount ?? 0) > 0;
  }

  if (!allowed) {
    redirect(getRoleDashboardUrl(profile.role));
  }

  // 4. Déterminer le libellé du rôle effectif sur la copro pour adapter
  //    l'UI (sidebar, footer). Un locataire_copro ne doit pas voir
  //    "Copropriétaire" écrit partout — sinon le label ment et trahit
  //    l'incohérence du parcours.
  const ROLE_LABELS: Record<string, string> = {
    syndic: "Syndic",
    tresorier: "Trésorier",
    conseil_syndical: "Conseil syndical",
    coproprietaire: "Copropriétaire",
    coproprietaire_bailleur: "Copropriétaire bailleur",
    coproprietaire_occupant: "Copropriétaire occupant",
    coproprietaire_nu: "Copropriétaire (nue-propriété)",
    usufruitier: "Usufruitier",
    locataire_copro: "Locataire en copropriété",
  };
  // Priorité au rôle primaire si déjà copro, sinon le rôle granulaire le
  // plus élevé dans user_site_roles (syndic > tresorier > conseil > copro > locataire).
  let effectiveCoproLabel: string =
    ROLE_LABELS[profile.role] ?? "Copropriétaire";
  if (!ROLE_LABELS[profile.role]) {
    const { data: userRoles } = await supabase
      .from("user_site_roles")
      .select("role_code")
      .eq("user_id", user.id)
      .in("role_code", Object.keys(ROLE_LABELS));
    const codes = ((userRoles ?? []) as Array<{ role_code: string }>).map(
      (r) => r.role_code
    );
    const priority = [
      "syndic",
      "tresorier",
      "conseil_syndical",
      "coproprietaire_bailleur",
      "coproprietaire",
      "coproprietaire_occupant",
      "coproprietaire_nu",
      "usufruitier",
      "locataire_copro",
    ];
    const top = priority.find((p) => codes.includes(p));
    if (top) effectiveCoproLabel = ROLE_LABELS[top];
  }

  // 5. Rendre le layout avec la sidebar
  return (
    <ErrorBoundary>
      <CsrfTokenInjector />
      <div className="min-h-screen bg-gradient-to-br from-background via-violet-50/10 to-background dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <OfflineIndicator />

        <div className="flex">
          {/* Sidebar Desktop */}
          <aside
            className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0"
            role="navigation"
            aria-label="Navigation principale copropriétaire"
          >
            <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-card/80 backdrop-blur-xl border-r border-border/50">
              {/* Logo / Titre */}
              <div className="flex items-center flex-shrink-0 px-4 mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25"
                    aria-hidden="true"
                  >
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                      Mon Espace
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      {effectiveCoproLabel}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex-1 px-3 space-y-1" aria-label="Menu copropriétaire">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    aria-label={item.name}
                  >
                    <item.icon
                      className="mr-3 h-5 w-5 flex-shrink-0 text-muted-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors"
                      aria-hidden="true"
                    />
                    {item.name}
                  </Link>
                ))}
              </nav>

              {/* Lien vers espace bailleur — affiché si le user est
                  bailleur soit par profile.role (cas legacy), soit par
                  user_site_roles (cas standard owner avec rôle granulaire). */}
              {(profile.role === "coproprietaire_bailleur" ||
                effectiveCoproLabel === "Copropriétaire bailleur") && (
                <div className="px-3 pb-4">
                  <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/30">
                    <p className="text-xs text-violet-400 mb-2">
                      Vous êtes copropriétaire bailleur
                    </p>
                    <Link
                      href="/owner/copro/charges"
                      className="text-sm text-violet-300 hover:text-white flex items-center gap-1"
                    >
                      <Euro className="w-4 h-4" aria-hidden="true" />
                      Gérer les charges récupérables
                    </Link>
                  </div>
                </div>
              )}

              {/* Footer avec profil et déconnexion */}
              <div className="flex-shrink-0 p-4 border-t border-border/50 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold"
                    aria-hidden="true"
                  >
                    {(profile.prenom?.[0] || 'C').toUpperCase()}
                    {(profile.nom?.[0] || '').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {profile.prenom} {profile.nom}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {effectiveCoproLabel}
                    </p>
                  </div>
                </div>
                <SignOutButton />
              </div>
            </div>
          </aside>

          {/* Mobile Header */}
          <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-foreground">Mon espace</span>
              </div>
              <div className="flex items-center gap-1">
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

          {/* Main content */}
          <main
            className="lg:pl-64 flex-1 pt-16 lg:pt-0"
            role="main"
            aria-label="Contenu principal"
          >
            {children}
          </main>

          {/* Mobile Bottom Navigation — SharedBottomNav (parité 6/6 + footer via menu Plus) */}
          <SharedBottomNav
            items={navigation.slice(0, 4).map((item) => ({
              href: item.href,
              label: item.name,
              icon: item.icon,
            }))}
            moreItems={[
              ...navigation.slice(4).map((item) => ({
                href: item.href,
                label: item.name,
                icon: item.icon,
              })),
              ...footerNavigation.map((item) => ({
                href: item.href,
                label: item.name,
                icon: item.icon,
              })),
            ]}
            hideAbove="lg"
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
