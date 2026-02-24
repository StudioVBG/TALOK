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
  FolderArchive,
  HelpCircle,
  User,
  LogOut,
  ChevronDown,
  ChevronLeft,
  CalendarClock,
  Wrench,
  Shield,
  CreditCard,
  ClipboardCheck,
  Search,
  Briefcase,
  Wallet,
} from "lucide-react";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";
import { SharedBottomNav } from "./shared-bottom-nav";
import { cn } from "@/lib/utils";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";
import { UnifiedFAB } from "@/components/layout/unified-fab";
import { SubscriptionProvider } from "@/components/subscription";
import { CommandPalette } from "@/components/command-palette";
import { NotificationCenter } from "@/components/notifications";
import { FavoritesList } from "@/components/ui/favorites-list";
import { KeyboardShortcutsHelp } from "@/components/ui/keyboard-shortcuts-help";
import { OnboardingTourProvider, AutoTourPrompt, StartTourButton, FirstLoginOrchestrator } from "@/components/onboarding";
import { SkipLinks } from "@/components/ui/skip-links";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { CompanySwitcher } from "@/components/entities/CompanySwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  tourId?: string;
  badge?: string;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    items: [
      { name: "Tableau de bord", href: OWNER_ROUTES.dashboard.path, icon: LayoutDashboard, tourId: "nav-dashboard" },
    ],
  },
  {
    label: "Gestion immobilière",
    items: [
      { name: "Mes biens", href: OWNER_ROUTES.properties.path, icon: Building2, tourId: "nav-properties" },
      { name: "Baux & locataires", href: OWNER_ROUTES.contracts.path, icon: FileText, tourId: "nav-leases" },
      { name: "États des lieux", href: "/owner/inspections", icon: ClipboardCheck, tourId: "nav-inspections" },
      { name: "Fin de bail", href: "/owner/end-of-lease", icon: CalendarClock, badge: "Premium" },
    ],
  },
  {
    label: "Finances",
    items: [
      { name: "Loyers & revenus", href: OWNER_ROUTES.money.path, icon: Euro, tourId: "nav-money" },
      { name: "Moyens de paiement", href: "/owner/settings/payments", icon: Wallet },
      { name: "Facturation", href: "/owner/settings/billing", icon: CreditCard },
    ],
  },
  {
    label: "Documents & Juridique",
    items: [
      { name: "Documents", href: OWNER_ROUTES.documents.path, icon: FileCheck, tourId: "nav-documents" },
      { name: "Coffre-fort", href: OWNER_ROUTES.ged.path, icon: FolderArchive, badge: "Nouveau" },
      { name: "Mes entités", href: "/owner/entities", icon: Briefcase, tourId: "nav-entities" },
      { name: "Protocoles juridiques", href: "/owner/legal-protocols", icon: Shield },
    ],
  },
  {
    label: "Support",
    items: [
      { name: "Tickets", href: OWNER_ROUTES.tickets.path, icon: Wrench, tourId: "nav-tickets" },
      { name: "Aide & services", href: OWNER_ROUTES.support.path, icon: HelpCircle, tourId: "nav-support" },
    ],
  },
];

// Flat list for page title lookup and bottom nav
const allNavItems = navigationGroups.flatMap((g) => g.items);

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

  // Trouver le titre de la page active
  const isProfilePage = pathname === "/owner/profile" || pathname?.startsWith("/owner/profile/");
  const activeNavItem = allNavItems.find(
    (item) => pathname === item.href || pathname?.startsWith(item.href + "/")
  );
  const pageTitle = isProfilePage ? "Mon profil" : (activeNavItem?.name || "Tableau de bord");

  // Déterminer si on peut afficher un bouton retour (page de détail)
  const isDetailPage = pathname?.split("/").filter(Boolean).length > 2;

  // Déterminer si on est dans un wizard (masquer bottom nav et FAB)
  const isInWizard = pathname?.includes('/properties/new') || pathname?.includes('/leases/new') || pathname?.includes('/onboarding');

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <SubscriptionProvider>
      <OnboardingTourProvider role="owner" profileId={profile?.id}>
      <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        {/* Offline indicator - visible when device loses connectivity */}
        <OfflineIndicator />

        {/* Skip Links pour accessibilité clavier */}
        <SkipLinks />

        {/* ============================================
            TABLET Rail Nav (md-lg) - Icônes + tooltip hover
            ============================================ */}
        <aside
          id="main-navigation"
          aria-label="Navigation principale"
          className="hidden md:flex lg:hidden fixed inset-y-0 left-0 z-50 w-16 flex-col bg-card border-r border-border"
        >
          {/* Logo compact */}
          <div className="flex h-14 shrink-0 items-center justify-center border-b border-border">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
          </div>

          {/* Navigation icônes avec tooltips, groupées */}
          <nav className="flex flex-1 flex-col items-center gap-1 py-3 overflow-y-auto">
            {navigationGroups.map((group, groupIndex) => (
              <div key={group.label ?? "main"} className="w-full flex flex-col items-center gap-1">
                {groupIndex > 0 && (
                  <div className="w-8 border-t border-border my-1" />
                )}
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          data-tour={item.tourId}
                          className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 touch-target",
                            isActive
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <item.icon className="h-5 w-5" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.name}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* User avatar en bas du rail */}
          <div className="flex flex-col items-center gap-2 py-3 border-t border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/owner/profile"
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200",
                    isProfilePage
                      ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white ring-2 ring-blue-300 ring-offset-2 ring-offset-background shadow-md"
                      : "bg-gradient-to-br from-blue-600 to-indigo-600 text-white hover:ring-2 hover:ring-blue-200 hover:ring-offset-2 hover:ring-offset-background"
                  )}
                  aria-current={isProfilePage ? "page" : undefined}
                >
                  <User className="h-4 w-4" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                {profile?.prenom || "Mon profil"}
              </TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* ============================================
            DESKTOP Full Sidebar (lg+) - Texte + icônes
            ============================================ */}
        <aside
          data-tour-sidebar
          aria-label="Navigation principale"
          className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 xl:w-72 lg:flex-col"
        >
          <div className="flex grow flex-col gap-y-4 lg:gap-y-5 overflow-y-auto bg-card border-r border-border px-4 lg:px-6 pb-4">
            <div className="flex h-16 shrink-0 items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Talok</h1>
                <p className="text-xs text-muted-foreground">Compte Propriétaire</p>
              </div>
            </div>

            {/* Company Switcher */}
            <CompanySwitcher variant="sidebar" />

            {/* Navigation groupée */}
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-4">
                {navigationGroups.map((group) => (
                  <li key={group.label ?? "main"}>
                    {group.label && (
                      <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </p>
                    )}
                    <ul role="list" className="flex flex-col gap-y-1">
                      {group.items.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                        return (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              data-tour={item.tourId}
                              className={cn(
                                "group flex gap-x-3 rounded-lg p-3 text-sm font-semibold leading-6 transition-all duration-200",
                                isActive
                                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                                  : "text-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              <item.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground")} />
                              {item.name}
                              {item.badge && (
                                <span className={cn(
                                  "ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                                  isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                                )}>
                                  {item.badge}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        {/* ============================================
            Main Content Area - Padding adapté au sidebar responsive
            md: pl-16 (rail), lg: pl-64, xl: pl-72
            ============================================ */}
        <div className="md:pl-16 lg:pl-64 xl:pl-72">
          {/* ============================================
              Top Header - Contextuel selon le device
              Mobile: Page title + back + actions
              Tablet/Desktop: Search + notifications + user
              ============================================ */}
          <header className="sticky top-0 z-40 flex h-14 xs:h-16 shrink-0 items-center gap-x-2 xs:gap-x-3 sm:gap-x-4 lg:gap-x-6 border-b border-border bg-background/95 backdrop-blur-sm px-3 xs:px-4 sm:px-6 lg:px-8 shadow-sm">
            {/* Mobile: Back button for detail pages */}
            {isDetailPage && (
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden shrink-0"
                onClick={() => router.back()}
                aria-label="Retour"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}

            <div className="flex flex-1 gap-x-2 xs:gap-x-4 self-stretch lg:gap-x-6">
              <div className="flex flex-1 items-center gap-2 xs:gap-4 min-w-0">
                {/* Titre de page - Visible partout */}
                <h2 className="text-sm xs:text-base sm:text-lg font-semibold text-foreground truncate">
                  {pageTitle}
                </h2>

                {/* Bouton recherche - Masqué sur mobile */}
                <button
                  data-tour="search-button"
                  onClick={() => {
                    const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
                    document.dispatchEvent(event);
                  }}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                >
                  <span className="text-muted-foreground">Recherche rapide...</span>
                  <kbd className="px-1.5 py-0.5 text-xs font-mono bg-background rounded border shadow-sm">⌘K</kbd>
                </button>
              </div>
              <div className="flex items-center gap-x-2 xs:gap-x-3 lg:gap-x-4">
                {/* SOTA 2026 - Éléments masqués sur mobile pour désencombrer */}
                <div className="hidden lg:flex items-center gap-x-3">
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

                {/* User Menu - DropdownMenu propre (remplace le menu custom) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 p-1.5"
                    >
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <span className="hidden sm:block text-sm font-medium text-foreground truncate max-w-[120px]">
                        {profile?.prenom || "Propriétaire"}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {[profile?.prenom, profile?.nom].filter(Boolean).join(" ") || "Propriétaire"}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          Propriétaire
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/owner/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        Mon profil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={OWNER_ROUTES.support.path} className="cursor-pointer">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Aide & services
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="text-red-600 cursor-pointer disabled:opacity-50"
                    >
                      {isSigningOut ? (
                        <>
                          <span className="mr-2 h-4 w-4 inline-block animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                          Déconnexion...
                        </>
                      ) : (
                        <>
                          <LogOut className="mr-2 h-4 w-4" />
                          Déconnexion
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* ============================================
              PAGE CONTENT
              Padding adaptatif: mobile -> tablet -> desktop
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
            Mobile Bottom Navigation (< md)
            Masquée sur tablette+ grâce à hideAbove="md"
            Masquée dans les wizards
            ============================================ */}
        {!isInWizard && (
          <SharedBottomNav
            items={[
              { href: OWNER_ROUTES.dashboard.path, label: "Dashboard", icon: LayoutDashboard },
              { href: OWNER_ROUTES.properties.path, label: "Biens", icon: Building2 },
              { href: OWNER_ROUTES.money.path, label: "Loyers", icon: Euro },
              { href: OWNER_ROUTES.contracts.path, label: "Baux", icon: FileText },
            ]}
            moreItems={[
              { href: "/owner/inspections", label: "États des lieux", icon: ClipboardCheck },
              { href: OWNER_ROUTES.tickets.path, label: "Tickets", icon: Wrench },
              { href: OWNER_ROUTES.documents.path, label: "Documents", icon: FileCheck },
              { href: OWNER_ROUTES.ged.path, label: "Coffre-fort", icon: FolderArchive },
              { href: "/owner/end-of-lease", label: "Fin de bail", icon: CalendarClock },
              { href: "/owner/entities", label: "Entités", icon: Briefcase },
              { href: "/owner/legal-protocols", label: "Protocoles juridiques", icon: Shield },
              { href: "/owner/settings/payments", label: "Moyens de paiement", icon: Wallet },
              { href: "/owner/settings/billing", label: "Facturation", icon: CreditCard },
              { href: OWNER_ROUTES.support.path, label: "Aide", icon: HelpCircle },
            ]}
            hideAbove="md"
            hiddenOnPaths={['/owner/properties/new', '/owner/leases/new', '/owner/onboarding']}
          />
        )}

        {/* FAB Unifié - Masqué dans les wizards */}
        {!isInWizard && <UnifiedFAB />}

        {/* Command Palette (⌘K) */}
        <CommandPalette role="owner" />

        {/* Tour guidé d'onboarding */}
        <AutoTourPrompt />

        {/* SOTA 2026 - Orchestrateur première connexion (WelcomeModal -> Tour) */}
        {profile?.id && (
          <FirstLoginOrchestrator
            profileId={profile.id}
            role="owner"
            userName={profile.prenom || ""}
          />
        )}
      </div>
      </TooltipProvider>
      </OnboardingTourProvider>
      </SubscriptionProvider>
    </ProtectedRoute>
  );
}
