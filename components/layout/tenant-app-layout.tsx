"use client";

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
  Home,
  Wrench,
  HelpCircle,
  ChevronLeft,
  ClipboardCheck,
  Gauge,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UnifiedFAB } from "@/components/layout/unified-fab";
import { SharedBottomNav, type NavItem } from "@/components/layout/shared-bottom-nav";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { OnboardingTourProvider, AutoTourPrompt } from "@/components/onboarding";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SkipLinks } from "@/components/ui/skip-links";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";
import { CommandPalette } from "@/components/command-palette/CommandPalette";

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

// Navigation items - single source of truth (AUDIT UX: simplifié de 14 à 7 items)
const allNavItems = [
  { name: "Tableau de bord", href: "/tenant/dashboard", icon: LayoutDashboard, tourId: "nav-dashboard", group: "Mon Espace" },
  { name: "Mon Logement", href: "/tenant/lease", icon: Home, tourId: "nav-lease", group: "Mon Espace" },
  { name: "Documents", href: "/tenant/documents", icon: FileText, tourId: "nav-documents", group: "Mes Documents" },
  { name: "Loyers & Paiements", href: "/tenant/payments", icon: CreditCard, tourId: "nav-payments", group: "Mes Finances" },
  { name: "Demandes", href: "/tenant/requests", icon: Wrench, tourId: "nav-requests", group: "Assistance" },
  { name: "Messages", href: "/tenant/messages", icon: MessageSquare, tourId: "nav-messages", group: "Assistance" },
];

const footerNavItems = [
  { name: "Aide", href: "/tenant/help", icon: HelpCircle },
  { name: "Mon Profil", href: "/tenant/settings", icon: Settings },
];

// Group navigation for desktop sidebar
const navigationGroups = [
  { title: "Mon Espace", items: allNavItems.filter(i => i.group === "Mon Espace") },
  { title: "Mes Documents", items: allNavItems.filter(i => i.group === "Mes Documents") },
  { title: "Mes Finances", items: allNavItems.filter(i => i.group === "Mes Finances") },
  { title: "Assistance", items: allNavItems.filter(i => i.group === "Assistance") },
];

export function TenantAppLayout({ children, profile: serverProfile }: TenantAppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile: clientProfile } = useAuth();

  // Hook SOTA 2026 pour la déconnexion avec loading state et redirection forcée
  const { signOut: handleSignOut, isLoading: isSigningOut } = useSignOut({
    redirectTo: "/auth/signin",
  });

  const profile = serverProfile || clientProfile;

  const isCurrent = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  // Page title from active nav item
  const activeItem = [...allNavItems, ...footerNavItems].find(item => isCurrent(item.href));
  const pageTitle = activeItem?.name || "Tableau de bord";

  // Back button for detail pages (depth > 2)
  const isDetailPage = pathname?.split("/").filter(Boolean).length > 2;

  return (
    <OnboardingTourProvider role="tenant" profileId={profile?.id}>
    <TooltipProvider delayDuration={0}>
    <div className="min-h-screen bg-background">
      {/* Offline indicator */}
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
          <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            T
          </span>
        </div>

        {/* Navigation icônes avec tooltips */}
        <nav className="flex flex-1 flex-col items-center gap-1 py-3 overflow-y-auto">
          {allNavItems.map((item) => {
            const isActive = isCurrent(item.href);
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    data-tour={item.tourId}
                    className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
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
        </nav>

        {/* Footer items: aide + profil */}
        <div className="flex flex-col items-center gap-1 py-3 border-t border-border">
          {footerNavItems.map((item) => (
            <Tooltip key={item.name}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg transition-colors touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                    isCurrent(item.href)
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                {item.name}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </aside>

      {/* ============================================
          DESKTOP Full Sidebar (lg+) - Texte + icônes groupés
          ============================================ */}
      <aside data-tour-sidebar className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col bg-card border-r">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b shrink-0">
          <Link href="/tenant/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Talok
            </span>
            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
              Locataire
            </Badge>
          </Link>
        </div>

        {/* Main Navigation - Grouped */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          {navigationGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
                {group.title}
              </p>
              {group.items.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  data-tour={item.tourId}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                    isCurrent(item.href)
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      isCurrent(item.href)
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-muted-foreground"
                    )}
                  />
                  {item.name}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer Navigation */}
        <div className="p-4 border-t space-y-1 shrink-0">
          {footerNavItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                isCurrent(item.href)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-5 w-5 text-muted-foreground" />
              {item.name}
            </Link>
          ))}
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <>
                <span className="mr-3 h-5 w-5 inline-block animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                Déconnexion...
              </>
            ) : (
              <>
                <LogOut className="mr-3 h-5 w-5" />
                Déconnexion
              </>
            )}
          </Button>
        </div>
      </aside>

      {/* ============================================
          Main Content Area
          md: pl-16 (rail), lg: pl-64
          ============================================ */}
      <div className="md:pl-16 lg:pl-64">
        {/* ============================================
            Top Header - Contextuel
            Mobile: Brand + actions (no hamburger)
            Tablet+: Page title + actions
            ============================================ */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-3 xs:px-4 sm:px-6 lg:px-8 py-3 bg-card border-b shadow-sm">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Mobile: back button for detail pages */}
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

            {/* Mobile: Brand (when no sidebar visible) */}
            <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent md:hidden">
              Talok
            </span>

            {/* Tablet+: Page title */}
            <h2 className="hidden md:block text-base lg:text-lg font-semibold text-foreground truncate">
              {pageTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />

            {/* Dark mode toggle - Masqué sur mobile */}
            <div className="hidden md:block">
              <DarkModeToggle />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 p-0 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                      {profile?.prenom?.[0]}
                      {profile?.nom?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>
                      {profile?.prenom} {profile?.nom}
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">
                      Locataire
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/tenant/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Paramètres
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/tenant/help">
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Aide & FAQ
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="text-red-600 focus:text-red-600 disabled:opacity-50"
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
        </header>

        {/* Main Content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-[calc(100vh-4rem)] outline-none"
        >
          {children}
        </main>
      </div>

      {/* ============================================
          Mobile Bottom Navigation (< md)
          Hidden on tablet+ where rail nav takes over
          ============================================ */}
      {/* AUDIT UX: Documents en accès direct (plus dans "Plus"), Logement déplacé dans "Plus" */}
      <SharedBottomNav
        items={[
          { href: "/tenant/dashboard", label: "Accueil", icon: LayoutDashboard },
          { href: "/tenant/documents", label: "Documents", icon: FileText },
          { href: "/tenant/payments", label: "Paiements", icon: CreditCard },
          { href: "/tenant/requests", label: "Demandes", icon: Wrench },
        ]}
        moreItems={[
          { href: "/tenant/lease", label: "Mon Logement", icon: Home },
          { href: "/tenant/messages", label: "Messages", icon: MessageSquare },
          { href: "/tenant/inspections", label: "États des lieux", icon: ClipboardCheck },
          { href: "/tenant/meters", label: "Compteurs", icon: Gauge },
          { href: "/tenant/colocation", label: "Colocation", icon: Users },
          { href: "/tenant/settings", label: "Mon Profil", icon: Settings },
          { href: "/tenant/help", label: "Aide", icon: HelpCircle },
        ]}
        hideAbove="md"
        hiddenOnPaths={['/tenant/onboarding']}
      />

      {/* SOTA 2026 - FAB Unifié (Assistant + Actions) */}
      <UnifiedFAB />

      {/* SOTA 2026 - Recherche globale (Cmd+K) */}
      <CommandPalette role="tenant" />

      {/* SOTA 2026 - Tour guidé d'onboarding */}
      <AutoTourPrompt />
    </div>
    </TooltipProvider>
    </OnboardingTourProvider>
  );
}
