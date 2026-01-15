"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Euro,
  FileCheck,
  HelpCircle,
  Menu,
  X,
  User,
  LogOut,
  ChevronDown,
  CalendarClock,
  Wrench,
  Shield,
  CreditCard,
  ClipboardCheck,
} from "lucide-react";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";
import { OwnerBottomNav } from "./owner-bottom-nav";
import { cn } from "@/lib/utils";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";
import { UnifiedFAB } from "@/components/layout/unified-fab";
import { SubscriptionProvider } from "@/components/subscription";
import { CommandPalette } from "@/components/command-palette";
import { NotificationCenter } from "@/components/notifications";
import { FavoritesList } from "@/components/ui/favorites-list";
import { KeyboardShortcutsHelp } from "@/components/ui/keyboard-shortcuts-help";
import { OnboardingTourProvider, AutoTourPrompt, StartTourButton } from "@/components/onboarding";

const navigation = [
  { name: "Tableau de bord", href: OWNER_ROUTES.dashboard.path, icon: LayoutDashboard, tourId: "nav-dashboard" },
  { name: "Mes biens", href: OWNER_ROUTES.properties.path, icon: Building2, tourId: "nav-properties" },
  { name: "Baux & locataires", href: OWNER_ROUTES.contracts.path, icon: FileText, tourId: "nav-leases" },
  { name: "États des lieux", href: "/owner/inspections", icon: ClipboardCheck, tourId: "nav-inspections" },
  { name: "Loyers & revenus", href: OWNER_ROUTES.money.path, icon: Euro, tourId: "nav-money" },
  { name: "Fin de bail", href: "/owner/end-of-lease", icon: CalendarClock, badge: "Premium" },
  { name: "Tickets", href: OWNER_ROUTES.tickets.path, icon: Wrench, tourId: "nav-tickets" },
  { name: "Documents", href: OWNER_ROUTES.documents.path, icon: FileCheck },
  { name: "Protocoles juridiques", href: "/owner/legal-protocols", icon: Shield },
  { name: "Facturation", href: "/settings/billing", icon: CreditCard },
  { name: "Aide & services", href: OWNER_ROUTES.support.path, icon: HelpCircle },
];

interface OwnerAppLayoutProps {
  children: React.ReactNode;
  profile?: {
    id: string;
    role: string;
    prenom?: string | null;
    nom?: string | null;
  } | null;
}

export function OwnerAppLayout({ children, profile: serverProfile }: OwnerAppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile: clientProfile, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  // Hook SOTA 2026 pour la déconnexion avec loading state et redirection forcée
  const { signOut: handleSignOut, isLoading: isSigningOut } = useSignOut({
    redirectTo: "/auth/signin",
  });

  // Utiliser le profil du serveur si disponible, sinon celui du client
  const profile = serverProfile || clientProfile;

  // Rediriger si pas propriétaire (seulement côté client si pas de profil serveur)
  useEffect(() => {
    if (!serverProfile && !loading && clientProfile?.role !== "owner") {
      if (clientProfile?.role === "tenant") {
        router.replace("/tenant");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [clientProfile, loading, router, serverProfile]);

  // Si pas de profil serveur et chargement côté client, afficher loading
  if (!serverProfile && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si pas de profil du tout, ne rien afficher (redirection en cours)
  if (!profile || profile.role !== "owner") {
    return null;
  }

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <SubscriptionProvider>
      <OnboardingTourProvider role="owner">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        {/* Desktop Sidebar - Visible sur lg+ (tablettes paysage et desktop) */}
        <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 xl:w-72 lg:flex-col">
          <div className="flex grow flex-col gap-y-4 lg:gap-y-5 overflow-y-auto bg-white border-r border-slate-200 px-4 lg:px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Talok</h1>
                <p className="text-xs text-slate-500">Compte Propriétaire</p>
              </div>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        data-tour={(item as any).tourId}
                        className={cn(
                          "group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 transition-all duration-200",
                          isActive
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </aside>

        {/* Mobile Sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white">
              <div className="flex h-16 items-center justify-between px-6 border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-white" />
                    </div>
                    <h1 className="text-lg font-bold text-slate-900">Talok</h1>
                  </div>
                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <nav className="px-4 py-4">
                <ul className="space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            "group flex gap-x-3 rounded-lg p-3 text-sm font-semibold",
                            isActive
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                              : "text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </div>
        )}

        {/* Main Content - Adapté au sidebar responsive */}
        <div className="lg:pl-64 xl:pl-72">
          {/* Top Header - Hauteur et padding adaptatifs */}
          <header className="sticky top-0 z-40 flex h-14 xs:h-16 shrink-0 items-center gap-x-2 xs:gap-x-3 sm:gap-x-4 lg:gap-x-6 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-3 xs:px-4 sm:px-6 lg:px-8 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-6 w-6" />
            </Button>

            <div className="flex flex-1 gap-x-2 xs:gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1 items-center gap-2 xs:gap-4 min-w-0">
                {/* Titre - Tronqué sur mobile */}
                <h2 className="text-sm xs:text-base sm:text-lg font-semibold text-slate-900 truncate">
                  {navigation.find((item) => pathname === item.href || pathname?.startsWith(item.href + "/"))?.name || "Tableau de bord"}
                </h2>
                {/* SOTA 2025 - Bouton recherche rapide qui ouvre Command Palette */}
                <button
                  data-tour="search-button"
                  onClick={() => {
                    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
                    document.dispatchEvent(event);
                  }}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <span className="text-slate-400">Recherche rapide...</span>
                  <kbd className="px-1.5 py-0.5 text-xs font-mono bg-white rounded border shadow-sm">⌘K</kbd>
                </button>
              </div>
              <div className="flex items-center gap-x-2 xs:gap-x-3 lg:gap-x-4">
                {/* SOTA 2026 - Éléments masqués sur mobile pour désencombrer */}
                <div className="hidden md:flex items-center gap-x-3">
                  <KeyboardShortcutsHelp />
                  <FavoritesList />
                </div>
                {/* Notifications - Toujours visible */}
                <NotificationCenter />
                {/* Dark mode - Masqué sur mobile */}
                <div className="hidden sm:block">
                  <DarkModeToggle />
                </div>
                {/* Aide - Version compacte sur mobile */}
                <Button variant="outline" size="sm" asChild className="hidden xs:flex">
                  <Link href={OWNER_ROUTES.support.path}>
                    <HelpCircle className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Aide</span>
                  </Link>
                </Button>

                {/* User Menu */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-slate-700">
                      {profile?.prenom || "Propriétaire"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </Button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 z-50 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                        <Link
                          href="/owner/profile"
                          className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          Mon profil
                        </Link>
                        <button
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                          className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSigningOut ? (
                            <>
                              <span className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                              Déconnexion...
                            </>
                          ) : (
                            <>
                              <LogOut className="h-4 w-4 inline mr-2" />
                              Déconnexion
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          {/* Page Content - Padding adaptatif mobile → tablet → desktop */}
          <main className="py-4 xs:py-5 sm:py-6 px-3 xs:px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>

        {/* Mobile Bottom Navigation - Masquée dans les wizards */}
        {!pathname?.includes('/properties/new') && !pathname?.includes('/leases/new') && !pathname?.includes('/onboarding') && (
          <>
            <OwnerBottomNav />
            {/* Spacer pour éviter que le contenu soit caché derrière la bottom nav */}
            <div className="h-14 xs:h-16 lg:hidden" />
          </>
        )}

        {/* SOTA 2026 - FAB Unifié (Assistant + Upgrade) - Masqué dans les wizards */}
        {!pathname?.includes('/properties/new') && !pathname?.includes('/leases/new') && (
          <UnifiedFAB />
        )}

        {/* SOTA 2025 - Command Palette (⌘K) */}
        <CommandPalette role="owner" />

        {/* SOTA 2026 - Tour guidé d'onboarding */}
        <AutoTourPrompt />
      </div>
      </OnboardingTourProvider>
      </SubscriptionProvider>
    </ProtectedRoute>
  );
}

