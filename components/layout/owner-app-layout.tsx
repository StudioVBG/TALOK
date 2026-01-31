"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ProtectedRoute } from "@/components/protected-route";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  ChevronLeft,
  CalendarClock,
  Wrench,
  Shield,
  CreditCard,
  ClipboardCheck,
  PanelLeftClose,
  PanelLeft,
  Search,
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
import { SkipLinks } from "@/components/ui/skip-links";

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Hook SOTA 2026 pour la déconnexion avec loading state et redirection forcée
  const { signOut: handleSignOut, isLoading: isSigningOut } = useSignOut({
    redirectTo: "/auth/signin",
  });

  // Utiliser le profil du serveur si disponible, sinon celui du client
  const profile = serverProfile || clientProfile;

  // Fermer le menu mobile lors de la navigation
  const closeMobileSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Fermer le menu utilisateur au clic extérieur
  const closeUserMenu = useCallback(() => {
    setUserMenuOpen(false);
  }, []);

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

  // Keyboard shortcut pour toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "b" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Si pas de profil serveur et chargement côté client, afficher loading
  if (!serverProfile && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-busy="true">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">Chargement...</p>
          <span className="sr-only">Chargement de l'espace propriétaire</span>
        </div>
      </div>
    );
  }

  // Si pas de profil du tout, ne rien afficher (redirection en cours)
  if (!profile || profile.role !== "owner") {
    return null;
  }

  // Déterminer si on est dans un wizard (masquer bottom nav et FAB)
  const isInWizard = pathname?.includes('/properties/new') || pathname?.includes('/leases/new') || pathname?.includes('/onboarding');

  // Largeur sidebar: full (264px) ou rail (68px)
  const sidebarWidth = sidebarCollapsed ? "w-[68px]" : "w-64 xl:w-72";
  const mainPadding = sidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-64 xl:pl-72";

  // Page title dynamique
  const currentPageName = navigation.find((item) => pathname === item.href || pathname?.startsWith(item.href + "/"))?.name || "Tableau de bord";

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <SubscriptionProvider>
      <OnboardingTourProvider role="owner">
      {/* Skip Links pour accessibilité clavier */}
      <SkipLinks />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">

        {/* ============================================
            DESKTOP SIDEBAR - Responsive: full ou rail
            lg+: visible, avec toggle collapse
            md (tablet): rail mode (icônes seules avec tooltip)
            ============================================ */}
        <TooltipProvider delayDuration={0}>
        <aside
          id="main-navigation"
          className={cn(
            "hidden md:fixed md:inset-y-0 md:z-50 md:flex md:flex-col",
            "transition-all duration-300 ease-in-out",
            // Tablet (md-lg): toujours en mode rail
            "md:w-[68px]",
            // Desktop (lg+): full ou collapsed selon l'état
            sidebarCollapsed ? "lg:w-[68px]" : "lg:w-64 xl:w-72"
          )}
          aria-label="Navigation principale"
        >
          <div className="flex grow flex-col gap-y-2 overflow-y-auto bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-3 lg:px-4 pb-4">
            {/* Logo */}
            <div className={cn(
              "flex h-16 shrink-0 items-center",
              sidebarCollapsed ? "lg:justify-center" : "lg:gap-2 lg:px-2"
            )}>
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              {/* Texte masqué en mode rail / tablet */}
              <div className={cn(
                "hidden overflow-hidden transition-all duration-300",
                sidebarCollapsed ? "lg:hidden" : "lg:block"
              )}>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">Talok</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Propriétaire</p>
              </div>
            </div>

            {/* Toggle Collapse - Desktop uniquement */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={cn(
                "hidden lg:flex items-center justify-center h-8 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                "mb-1"
              )}
              aria-label={sidebarCollapsed ? "Étendre la barre latérale" : "Réduire la barre latérale"}
            >
              {sidebarCollapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>

            {/* Navigation */}
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                  const navItem = (
                    <Link
                      href={item.href}
                      data-tour={(item as any).tourId}
                      className={cn(
                        "group flex items-center rounded-lg transition-all duration-200",
                        // Taille et padding: rail vs full
                        "md:justify-center md:p-2.5",
                        sidebarCollapsed
                          ? "lg:justify-center lg:p-2.5"
                          : "lg:justify-start lg:gap-x-3 lg:p-3 lg:text-sm lg:font-semibold lg:leading-6",
                        // Couleurs
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <item.icon className={cn(
                        "h-5 w-5 shrink-0",
                        isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"
                      )} />
                      {/* Label: masqué en mode rail / tablet */}
                      <span className={cn(
                        "hidden overflow-hidden whitespace-nowrap transition-all duration-300",
                        sidebarCollapsed ? "lg:hidden" : "lg:inline"
                      )}>
                        {item.name}
                      </span>
                    </Link>
                  );

                  // En mode rail/tablet, wrapper avec Tooltip pour afficher le nom
                  return (
                    <li key={item.name}>
                      {/* Tooltip en mode rail (tablette ou collapsed) */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {navItem}
                        </TooltipTrigger>
                        <TooltipContent
                          side="right"
                          className={cn(
                            // Masquer le tooltip quand le sidebar est full width (desktop non-collapsed)
                            !sidebarCollapsed && "lg:hidden"
                          )}
                        >
                          {item.name}
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </aside>
        </TooltipProvider>

        {/* ============================================
            MOBILE SIDEBAR DRAWER
            ============================================ */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={closeMobileSidebar}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-900 shadow-2xl">
              <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">Talok</h1>
                </div>
                <Button variant="ghost" size="icon" onClick={closeMobileSidebar} aria-label="Fermer le menu">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* User info card mobile */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate text-slate-900 dark:text-white">
                      {profile?.prenom || "Propriétaire"} {profile?.nom || ""}
                    </p>
                    <p className="text-xs text-muted-foreground">Propriétaire</p>
                  </div>
                </div>
              </div>

              <nav className="px-4 py-4 overflow-y-auto max-h-[calc(100vh-180px)]">
                <ul className="space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={closeMobileSidebar}
                          className={cn(
                            "group flex gap-x-3 rounded-lg p-3 text-sm font-semibold transition-all duration-200",
                            isActive
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                        >
                          <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-slate-400")} />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {/* Déconnexion mobile */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 safe-area-bottom">
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="flex items-center gap-3 w-full p-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  {isSigningOut ? (
                    <>
                      <span className="h-5 w-5 inline-block animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                      Déconnexion...
                    </>
                  ) : (
                    <>
                      <LogOut className="h-5 w-5" />
                      Déconnexion
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================
            MAIN CONTENT AREA
            Padding adapté: mobile, tablet (rail), desktop (full/collapsed)
            ============================================ */}
        <div className={cn(
          "transition-all duration-300 ease-in-out",
          // Tablet (md): décalé de la largeur du rail
          "md:pl-[68px]",
          // Desktop (lg+): décalé de la largeur du sidebar
          sidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-64 xl:pl-72"
        )}>
          {/* ============================================
              HEADER CONTEXTUEL
              Mobile: hamburger + titre
              Tablet: titre + search compact + actions
              Desktop: titre + search + toutes les actions
              ============================================ */}
          <header className="sticky top-0 z-40 flex h-14 md:h-16 shrink-0 items-center gap-x-2 md:gap-x-4 lg:gap-x-6 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-3 md:px-6 lg:px-8 shadow-sm">
            {/* Burger menu - Mobile uniquement */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden min-h-[44px] min-w-[44px]"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-6 w-6" />
            </Button>

            {/* Bouton retour contextuel - Mobile */}
            {pathname && pathname !== "/owner" && pathname !== "/owner/dashboard" && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden min-h-[44px] min-w-[44px] -ml-1"
                onClick={() => router.back()}
                aria-label="Retour"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}

            <div className="flex flex-1 gap-x-4 self-stretch">
              <div className="flex flex-1 items-center gap-4 min-w-0">
                {/* Titre de page */}
                <h2 className="text-sm md:text-base lg:text-lg font-semibold text-slate-900 dark:text-white truncate">
                  {currentPageName}
                </h2>

                {/* Bouton recherche - Masqué sur mobile */}
                <button
                  data-tour="search-button"
                  onClick={() => {
                    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
                    document.dispatchEvent(event);
                  }}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  aria-label="Recherche rapide"
                >
                  <Search className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-400 hidden lg:inline">Recherche rapide...</span>
                  <kbd className="hidden lg:inline px-1.5 py-0.5 text-xs font-mono bg-white dark:bg-slate-700 rounded border shadow-sm">⌘K</kbd>
                </button>
              </div>

              {/* Actions header */}
              <div className="flex items-center gap-x-2 md:gap-x-3 lg:gap-x-4">
                {/* Shortcuts & Favoris - Desktop uniquement */}
                <div className="hidden xl:flex items-center gap-x-3">
                  <KeyboardShortcutsHelp />
                  <FavoritesList />
                </div>

                {/* Notifications - Toujours visible */}
                <NotificationCenter />

                {/* Dark mode - Masqué sur mobile */}
                <div className="hidden md:block">
                  <DarkModeToggle />
                </div>

                {/* Aide - Desktop uniquement */}
                <Button variant="outline" size="sm" asChild className="hidden lg:flex">
                  <Link href={OWNER_ROUTES.support.path}>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Aide
                  </Link>
                </Button>

                {/* User Menu */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 min-h-[44px]"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                    aria-label="Menu utilisateur"
                  >
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <span className="hidden lg:block text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                      {profile?.prenom || "Propriétaire"}
                    </span>
                    <ChevronDown className={cn(
                      "hidden sm:block h-4 w-4 text-slate-400 transition-transform duration-200",
                      userMenuOpen && "rotate-180"
                    )} />
                  </Button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={closeUserMenu} aria-hidden="true" />
                      <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl bg-white dark:bg-slate-800 py-2 shadow-lg ring-1 ring-black/5 dark:ring-white/10 animate-scale-in" role="menu">
                        {/* User info */}
                        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {profile?.prenom} {profile?.nom}
                          </p>
                          <p className="text-xs text-muted-foreground">Propriétaire</p>
                        </div>
                        <Link
                          href="/owner/profile"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          onClick={closeUserMenu}
                          role="menuitem"
                        >
                          <User className="h-4 w-4 text-slate-400" />
                          Mon profil
                        </Link>
                        <Link
                          href="/settings/billing"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          onClick={closeUserMenu}
                          role="menuitem"
                        >
                          <CreditCard className="h-4 w-4 text-slate-400" />
                          Facturation
                        </Link>
                        <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                        <button
                          onClick={handleSignOut}
                          disabled={isSigningOut}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          role="menuitem"
                        >
                          {isSigningOut ? (
                            <>
                              <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                              Déconnexion...
                            </>
                          ) : (
                            <>
                              <LogOut className="h-4 w-4" />
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

          {/* ============================================
              PAGE CONTENT
              Padding adaptatif: mobile → tablet → desktop
              ============================================ */}
          <main
            id="main-content"
            tabIndex={-1}
            className="py-4 md:py-5 lg:py-6 px-3 md:px-6 lg:px-8 outline-none"
          >
            {children}
          </main>
        </div>

        {/* ============================================
            MOBILE BOTTOM NAVIGATION
            Visible: mobile uniquement (< md)
            Masquée dans les wizards
            ============================================ */}
        {!isInWizard && (
          <>
            <OwnerBottomNav />
            {/* Spacer pour éviter que le contenu soit caché derrière la bottom nav */}
            <div className="h-14 xs:h-16 md:hidden" aria-hidden="true" />
          </>
        )}

        {/* FAB Unifié - Masqué dans les wizards */}
        {!isInWizard && <UnifiedFAB />}

        {/* Command Palette (⌘K) */}
        <CommandPalette role="owner" />

        {/* Tour guidé d'onboarding */}
        <AutoTourPrompt />
      </div>
      </OnboardingTourProvider>
      </SubscriptionProvider>
    </ProtectedRoute>
  );
}
