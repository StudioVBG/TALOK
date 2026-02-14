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
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import Link from "next/link";
import {
  Building2, Euro, FileText, Calendar,
  MessageSquare, Bell, Home, Settings
} from "lucide-react";

// Navigation copropriétaire
const navigation = [
  { name: "Dashboard", href: "/copro/dashboard", icon: Home },
  { name: "Assemblées", href: "/copro/assemblies", icon: Calendar },
  { name: "Charges", href: "/copro/charges", icon: Euro },
  { name: "Documents", href: "/copro/documents", icon: FileText },
  { name: "Signalements", href: "/copro/tickets", icon: MessageSquare },
];

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

  // 3. Vérifier le rôle copropriétaire
  if (!COPRO_ROLES.includes(profile.role as typeof COPRO_ROLES[number])) {
    redirect(getRoleDashboardUrl(profile.role));
  }

  // 4. Rendre le layout avec la sidebar
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-background via-violet-50/10 to-background dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* Offline indicator - visible when device loses connectivity */}
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
                      Copropriétaire
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

              {/* Lien vers espace bailleur si applicable */}
              {profile.role === "coproprietaire_bailleur" && (
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

              {/* Footer avec profil */}
              <div className="flex-shrink-0 p-4 border-t border-border/50">
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
                      Copropriétaire
                    </p>
                  </div>
                </div>
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
              <button
                type="button"
                className="p-2 text-muted-foreground hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
              </button>
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

          {/* Mobile Bottom Navigation */}
          <nav
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50"
            role="navigation"
            aria-label="Navigation mobile"
          >
            <div className="pb-safe">
              <div className="grid grid-cols-5 h-14">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-muted-foreground hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    aria-label={item.name}
                  >
                    <item.icon className="w-5 h-5" aria-hidden="true" />
                    <span className="text-[10px] font-medium truncate max-w-[56px]">{item.name.slice(0, 8)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </nav>
          {/* Spacer pour bottom nav mobile */}
          <div className="h-14 lg:hidden" aria-hidden="true" />
        </div>
      </div>
    </ErrorBoundary>
  );
}
