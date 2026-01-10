// =====================================================
// Layout Copropriétaire - Server Component SOTA 2026
// Sécurisation serveur avec vérification des permissions
// =====================================================

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ErrorBoundary } from "@/components/error-boundary";
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

// Rôles copropriétaires autorisés
const COPRO_ROLES = [
  "coproprietaire_occupant",
  "coproprietaire_bailleur",
  "coproprietaire_nu",
  "usufruitier",
  "president_cs",
  "conseil_syndical",
  "syndic",
  "admin",
  "platform_admin",
];

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

  // 2. Récupérer le profil avec le rôle
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/auth/signin");
  }

  // 3. Vérifier le rôle copropriétaire
  if (!COPRO_ROLES.includes(profile.role)) {
    // Rediriger vers le bon dashboard selon le rôle
    const roleRedirects: Record<string, string> = {
      owner: "/owner/dashboard",
      tenant: "/tenant/dashboard",
      provider: "/provider/dashboard",
    };
    redirect(roleRedirects[profile.role] || "/dashboard");
  }

  // 4. Rendre le layout avec la sidebar
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex">
          {/* Sidebar Desktop */}
          <aside
            className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0"
            role="navigation"
            aria-label="Navigation principale copropriétaire"
          >
            <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-slate-900/80 backdrop-blur-xl border-r border-white/10">
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
                    <h1 className="text-lg font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                      Mon Espace
                    </h1>
                    <p className="text-xs text-slate-400">
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
                    className="group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 text-slate-300 hover:bg-white/5 hover:text-white"
                    aria-label={item.name}
                  >
                    <item.icon
                      className="mr-3 h-5 w-5 flex-shrink-0 text-slate-400 group-hover:text-violet-400 transition-colors"
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
              <div className="flex-shrink-0 p-4 border-t border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold"
                    aria-hidden="true"
                  >
                    {(profile.prenom?.[0] || 'C').toUpperCase()}
                    {(profile.nom?.[0] || '').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {profile.prenom} {profile.nom}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      Copropriétaire
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Mobile Header */}
          <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-white">Mon espace</span>
              </div>
              <button
                type="button"
                className="p-2 text-slate-400 hover:text-white"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Main content */}
          <main
            className="md:pl-64 flex-1 pt-16 md:pt-0"
            role="main"
            aria-label="Contenu principal"
          >
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          <nav
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-xl border-t border-white/10"
            role="navigation"
            aria-label="Navigation mobile"
          >
            <div className="flex justify-around py-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex flex-col items-center gap-1 p-2 text-slate-400 hover:text-violet-400 transition-colors"
                  aria-label={item.name}
                >
                  <item.icon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-xs">{item.name.slice(0, 8)}</span>
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </ErrorBoundary>
  );
}
