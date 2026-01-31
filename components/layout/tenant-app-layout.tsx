"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Home,
  Wrench,
  ClipboardCheck,
  Gift,
  ShoppingBag,
  HelpCircle,
  User,
  ChevronDown,
  ChevronLeft,
  Search,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UnifiedFAB } from "@/components/layout/unified-fab";
import { SharedBottomNav } from "@/components/layout/shared-bottom-nav";
import { SkipLinks } from "@/components/ui/skip-links";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";

/**
 * Navigation groups for the tenant sidebar
 */
const navigationGroups = [
  {
    title: "Mon Foyer",
    items: [
      { name: "Tableau de bord", href: "/tenant/dashboard", icon: LayoutDashboard, tourId: "nav-dashboard" },
      { name: "Ma Vie au Logement", href: "/tenant/lease", icon: Home, tourId: "nav-lease" },
    ],
  },
  {
    title: "Mon Contrat",
    items: [
      { name: "Coffre-fort", href: "/tenant/documents", icon: FileText, tourId: "nav-documents" },
      { name: "Suivi Juridique", href: "/tenant/inspections", icon: ClipboardCheck, tourId: "nav-inspections" },
    ],
  },
  {
    title: "Mes Finances",
    items: [
      { name: "Loyers & Factures", href: "/tenant/payments", icon: CreditCard, tourId: "nav-payments" },
    ],
  },
  {
    title: "Assistance",
    items: [
      { name: "Demandes & SAV", href: "/tenant/requests", icon: Wrench, tourId: "nav-requests" },
      { name: "Messagerie", href: "/tenant/messages", icon: MessageSquare },
    ],
  },
  {
    title: "Mes Avantages",
    items: [
      { name: "Club Récompenses", href: "/tenant/rewards", icon: Gift },
      { name: "Marketplace", href: "/tenant/marketplace", icon: ShoppingBag },
    ],
  },
];

/** Flat list of all nav items for rail mode */
const allNavItems = navigationGroups.flatMap((g) => g.items);

/** Bottom sidebar items */
const bottomNavItems = [
  { name: "Aide & FAQ", href: "/tenant/help", icon: HelpCircle },
  { name: "Mon Profil", href: "/tenant/settings", icon: Settings },
];

interface TenantAppLayoutProps {
  children: React.ReactNode;
  profile?: {
    id: string;
    role: string;
    prenom?: string | null;
    nom?: string | null;
    avatar_url?: string | null;
  } | null;
}

export function TenantAppLayout({ children, profile: serverProfile }: TenantAppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { profile: clientProfile } = useAuth();

  const { signOut: handleSignOut, isLoading: isSigningOut } = useSignOut({
    redirectTo: "/auth/signin",
  });

  const profile = serverProfile || clientProfile;

  const closeMobileSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const closeUserMenu = useCallback(() => {
    setUserMenuOpen(false);
  }, []);

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

  const isCurrent = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  // Déterminer si on est dans un wizard
  const isInWizard = pathname?.includes("/onboarding") || pathname?.includes("/new") || pathname?.includes("/edit");

  // Page title dynamique
  const currentPageName =
    allNavItems.find((item) => isCurrent(item.href))?.name ||
    bottomNavItems.find((item) => isCurrent(item.href))?.name ||
    "Tableau de bord";

  return (
    <>
      {/* Skip Links pour accessibilité clavier */}
      <SkipLinks />

      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">

        {/* ============================================
            DESKTOP/TABLET SIDEBAR
            md (tablet): rail mode (68px, icônes + tooltips)
            lg+ (desktop): full ou collapsed selon l'état
            ============================================ */}
        <TooltipProvider delayDuration={0}>
          <aside
            id="main-navigation"
            className={cn(
              "hidden md:fixed md:inset-y-0 md:z-50 md:flex md:flex-col",
              "transition-all duration-300 ease-in-out",
              // Tablet: toujours rail
              "md:w-[68px]",
              // Desktop: full ou collapsed
              sidebarCollapsed ? "lg:w-[68px]" : "lg:w-64 xl:w-72"
            )}
            aria-label="Navigation principale"
          >
            <div className="flex grow flex-col gap-y-2 overflow-y-auto bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 px-3 lg:px-4 pb-4">
              {/* Logo */}
              <div className={cn(
                "flex h-16 shrink-0 items-center",
                sidebarCollapsed ? "lg:justify-center" : "lg:gap-2 lg:px-2"
              )}>
                <Link href="/tenant/dashboard" className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
                    <Home className="h-5 w-5 text-white" />
                  </div>
                  <div className={cn(
                    "hidden overflow-hidden transition-all duration-300",
                    sidebarCollapsed ? "lg:hidden" : "lg:block"
                  )}>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">Talok</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Locataire</p>
                  </div>
                </Link>
              </div>

              {/* Toggle Collapse - Desktop uniquement */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={cn(
                  "hidden lg:flex items-center justify-center h-8 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors",
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

              {/* Main Navigation */}
              <nav className="flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-4">
                  {navigationGroups.map((group) => (
                    <li key={group.title}>
                      {/* Group title - visible only in full mode */}
                      <p className={cn(
                        "hidden overflow-hidden whitespace-nowrap transition-all duration-300 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1",
                        sidebarCollapsed ? "lg:hidden" : "lg:block lg:px-2"
                      )}>
                        {group.title}
                      </p>
                      <ul role="list" className="space-y-0.5">
                        {group.items.map((item) => {
                          const isActive = isCurrent(item.href);
                          const navLink = (
                            <Link
                              href={item.href}
                              data-tour={item.tourId}
                              className={cn(
                                "group flex items-center rounded-lg transition-all duration-200",
                                // Rail mode
                                "md:justify-center md:p-2.5",
                                // Full mode
                                sidebarCollapsed
                                  ? "lg:justify-center lg:p-2.5"
                                  : "lg:justify-start lg:gap-x-3 lg:p-2.5 lg:text-sm lg:font-medium",
                                // Couleurs
                                isActive
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                              )}
                            >
                              <item.icon className={cn(
                                "h-5 w-5 shrink-0",
                                isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                              )} />
                              <span className={cn(
                                "hidden overflow-hidden whitespace-nowrap transition-all duration-300",
                                sidebarCollapsed ? "lg:hidden" : "lg:inline"
                              )}>
                                {item.name}
                              </span>
                            </Link>
                          );

                          return (
                            <li key={item.name}>
                              <Tooltip>
                                <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  className={cn(!sidebarCollapsed && "lg:hidden")}
                                >
                                  {item.name}
                                </TooltipContent>
                              </Tooltip>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Bottom items */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-3 space-y-0.5">
                {bottomNavItems.map((item) => {
                  const isActive = isCurrent(item.href);
                  const navLink = (
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center rounded-lg transition-colors",
                        "md:justify-center md:p-2.5",
                        sidebarCollapsed
                          ? "lg:justify-center lg:p-2.5"
                          : "lg:justify-start lg:gap-x-3 lg:p-2.5 lg:text-sm lg:font-medium",
                        isActive
                          ? "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                      )}
                    >
                      <item.icon className="h-5 w-5 text-slate-400 shrink-0" />
                      <span className={cn(
                        "hidden overflow-hidden whitespace-nowrap transition-all duration-300",
                        sidebarCollapsed ? "lg:hidden" : "lg:inline"
                      )}>
                        {item.name}
                      </span>
                    </Link>
                  );

                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className={cn(!sidebarCollapsed && "lg:hidden")}
                      >
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {/* Sign out button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className={cn(
                        "group flex items-center rounded-lg transition-colors w-full",
                        "md:justify-center md:p-2.5",
                        sidebarCollapsed
                          ? "lg:justify-center lg:p-2.5"
                          : "lg:justify-start lg:gap-x-3 lg:p-2.5 lg:text-sm lg:font-medium",
                        "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      )}
                    >
                      {isSigningOut ? (
                        <span className="h-5 w-5 inline-block animate-spin rounded-full border-2 border-red-400 border-t-transparent shrink-0" />
                      ) : (
                        <LogOut className="h-5 w-5 shrink-0" />
                      )}
                      <span className={cn(
                        "hidden overflow-hidden whitespace-nowrap transition-all duration-300",
                        sidebarCollapsed ? "lg:hidden" : "lg:inline"
                      )}>
                        {isSigningOut ? "Déconnexion..." : "Déconnexion"}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className={cn(!sidebarCollapsed && "lg:hidden")}
                  >
                    Déconnexion
                  </TooltipContent>
                </Tooltip>
              </div>
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
            <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-slate-800 shadow-2xl">
              <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                    <Home className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-lg font-bold text-slate-900 dark:text-white">Talok</h1>
                </div>
                <Button variant="ghost" size="icon" onClick={closeMobileSidebar} aria-label="Fermer le menu">
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* User Profile Card */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                  <Avatar className="h-11 w-11 ring-2 ring-white dark:ring-slate-700 shadow-sm">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                      {profile?.prenom?.[0]}
                      {profile?.nom?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="overflow-hidden flex-1">
                    <p className="text-sm font-semibold truncate">
                      {profile?.prenom} {profile?.nom}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">Locataire</p>
                  </div>
                </div>
              </div>

              {/* Main Navigation */}
              <nav className="px-4 py-4 overflow-y-auto max-h-[calc(100vh-240px)]">
                {navigationGroups.map((group) => (
                  <div key={group.title} className="mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
                      {group.title}
                    </p>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => {
                        const isActive = isCurrent(item.href);
                        return (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              data-tour={item.tourId}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                isActive
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                              )}
                              onClick={closeMobileSidebar}
                            >
                              <item.icon className={cn(
                                "h-5 w-5 shrink-0",
                                isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"
                              )} />
                              {item.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </nav>

              {/* Bottom section */}
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 safe-area-bottom space-y-1">
                {bottomNavItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isCurrent(item.href)
                        ? "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    )}
                    onClick={closeMobileSidebar}
                  >
                    <item.icon className="h-5 w-5 text-slate-400" />
                    {item.name}
                  </Link>
                ))}
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
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
            ============================================ */}
        <div className={cn(
          "transition-all duration-300 ease-in-out",
          // Tablet: décalé de la largeur du rail
          "md:pl-[68px]",
          // Desktop: décalé de la largeur du sidebar
          sidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-64 xl:pl-72"
        )}>
          {/* ============================================
              HEADER CONTEXTUEL
              Mobile: hamburger + titre
              Tablet: titre + search + actions
              Desktop: titre + search + toutes les actions
              ============================================ */}
          <header className="sticky top-0 z-40 flex h-14 md:h-16 shrink-0 items-center gap-x-2 md:gap-x-4 lg:gap-x-6 border-b border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm px-3 md:px-6 lg:px-8 shadow-sm">
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
            {pathname && pathname !== "/tenant" && pathname !== "/tenant/dashboard" && (
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

                {/* Search placeholder - Tablet+ */}
                <button
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  aria-label="Recherche rapide"
                >
                  <Search className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-400 hidden lg:inline">Recherche...</span>
                  <kbd className="hidden lg:inline px-1.5 py-0.5 text-xs font-mono bg-white dark:bg-slate-600 rounded border shadow-sm">⌘K</kbd>
                </button>
              </div>

              {/* Actions header */}
              <div className="flex items-center gap-x-2 md:gap-x-3">
                {/* Notifications */}
                <NotificationBell />

                {/* Dark mode - Masqué sur mobile */}
                <div className="hidden md:block">
                  <DarkModeToggle />
                </div>

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
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white text-sm">
                        {profile?.prenom?.[0]}
                        {profile?.nom?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:block text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                      {profile?.prenom || "Locataire"}
                    </span>
                    <ChevronDown className={cn(
                      "hidden sm:block h-4 w-4 text-slate-400 transition-transform duration-200",
                      userMenuOpen && "rotate-180"
                    )} />
                  </Button>

                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={closeUserMenu} aria-hidden="true" />
                      <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl bg-white dark:bg-slate-800 py-2 shadow-lg ring-1 ring-black/5 dark:ring-white/10" role="menu">
                        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {profile?.prenom} {profile?.nom}
                          </p>
                          <p className="text-xs text-muted-foreground">Locataire</p>
                        </div>
                        <Link
                          href="/tenant/settings"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          onClick={closeUserMenu}
                          role="menuitem"
                        >
                          <Settings className="h-4 w-4 text-slate-400" />
                          Paramètres
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
            ============================================ */}
        {!isInWizard && (
          <>
            <SharedBottomNav
              items={[
                { href: "/tenant/dashboard", label: "Accueil", icon: LayoutDashboard },
                { href: "/tenant/lease", label: "Logement", icon: Home },
                { href: "/tenant/payments", label: "Paiements", icon: CreditCard },
                { href: "/tenant/requests", label: "Demandes", icon: Wrench },
                { href: "/tenant/messages", label: "Messages", icon: MessageSquare },
              ]}
              hiddenOnPaths={["/tenant/onboarding"]}
            />
          </>
        )}

        {/* FAB Unifié */}
        {!isInWizard && <UnifiedFAB />}
      </div>
    </>
  );
}
