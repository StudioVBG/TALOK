// =====================================================
// Layout Syndic - Server Component SOTA 2026
// Sécurisation serveur avec vérification des permissions
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ErrorBoundary } from "@/components/error-boundary";
import Link from "next/link";
import {
  Building2, Users, Calendar, Euro,
  FileText, Settings, Bell, HelpCircle,
  LayoutDashboard, ClipboardList, UserPlus
} from "lucide-react";

// Navigation syndic
const navigation = [
  { name: "Dashboard", href: "/syndic/dashboard", icon: LayoutDashboard },
  { name: "Copropriétés", href: "/syndic/sites", icon: Building2 },
  { name: "Assemblées", href: "/syndic/assemblies", icon: Calendar },
  { name: "Appels de fonds", href: "/syndic/calls/new", icon: Euro },
  { name: "Dépenses", href: "/syndic/expenses/new", icon: FileText },
  { name: "Invitations", href: "/syndic/invites", icon: UserPlus },
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

  // 2. Récupérer le profil avec le rôle
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/auth/signin");
  }

  // 3. Vérifier le rôle syndic ou admin
  const allowedRoles = ["syndic", "admin", "platform_admin"];
  if (!allowedRoles.includes(profile.role)) {
    // Rediriger vers le bon dashboard selon le rôle
    const roleRedirects: Record<string, string> = {
      owner: "/owner/dashboard",
      tenant: "/tenant/dashboard",
      provider: "/provider/dashboard",
      coproprietaire_occupant: "/copro/dashboard",
      coproprietaire_bailleur: "/copro/dashboard",
    };
    redirect(roleRedirects[profile.role] || "/dashboard");
  }

  // 4. Rendre le layout - SOTA 2026: Thème light unifié + breakpoint lg
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/30">
        {/* Sidebar Desktop - Breakpoint lg unifié comme Owner/Tenant/Admin */}
        <aside
          className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0"
          role="navigation"
          aria-label="Navigation principale syndic"
        >
          <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-700/50">
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
                  className="group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                  aria-label={item.name}
                >
                  <item.icon
                    className="mr-3 h-5 w-5 flex-shrink-0 text-slate-400 group-hover:text-cyan-600 transition-colors"
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              ))}
            </nav>

            {/* Footer avec profil */}
            <div className="flex-shrink-0 p-4 border-t border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-sm font-semibold"
                  aria-hidden="true"
                >
                  {(profile.prenom?.[0] || 'S').toUpperCase()}
                  {(profile.nom?.[0] || '').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {profile.prenom} {profile.nom}
                  </p>
                  <p className="text-xs text-muted-foreground truncate capitalize">
                    {profile.role}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Header - Thème light unifié */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center"
                aria-hidden="true"
              >
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">Syndic</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
              </button>
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
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation - Thème light + safe area + touch targets */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-700/50"
          role="navigation"
          aria-label="Navigation mobile"
        >
          <div className="pb-safe">
            <div className="grid grid-cols-5 h-14">
              {navigation.slice(0, 5).map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-400 transition-colors"
                  aria-label={item.name}
                >
                  <item.icon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[9px] xs:text-[10px] font-medium truncate max-w-[56px]">{item.name.slice(0, 8)}</span>
                </Link>
              ))}
            </div>
          </div>
        </nav>

        {/* Spacer pour bottom nav mobile */}
        <div className="h-14 lg:hidden" aria-hidden="true" />
      </div>
    </ErrorBoundary>
  );
}
