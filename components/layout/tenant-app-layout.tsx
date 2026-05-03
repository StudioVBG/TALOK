"use client";

import { useEffect, useState } from "react";
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
  FileSearch,
  Scale,
  Eye,
  Receipt,
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
import { OnboardingTourProvider, AutoTourPrompt, FirstLoginOrchestrator } from "@/components/onboarding";
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
import { PushNotificationPrompt } from "@/components/notifications/push-notification-prompt";
import { useTenantNavBadges } from "@/lib/hooks/use-tenant-nav-badges";
import { CoreShellHeader } from "@/components/layout/core-shell-header";
import { getCoreShellMetadata } from "@/lib/navigation/core-shell-metadata";
import { PlatformBroadcastBanner } from "@/components/platform-broadcast-banner";
import { buildAvatarUrl } from "@/lib/helpers/format";

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

// Navigation items - single source of truth (AUDIT UX SOTA 2026: suppression doublons, parité mobile/desktop)
// Quittances et Signatures retirés : ce sont des redirects vers /tenant/documents (doublons UX)
// Candidatures déplacé dans Mon Espace (concerne le parcours locataire, pas les documents)
// Ajout États des lieux et Compteurs pour parité avec le menu mobile
const allNavItems = [
  { name: "Tableau de bord", href: "/tenant/dashboard", icon: LayoutDashboard, tourId: "nav-dashboard", group: "Mon Espace" },
  { name: "Mon Logement", href: "/tenant/lease", icon: Home, tourId: "nav-lease", group: "Mon Espace" },
  { name: "Mon Garant", href: "/tenant/guarantor", icon: Users, tourId: "nav-guarantor", group: "Mon Espace" },
  { name: "Candidatures", href: "/tenant/applications", icon: FileSearch, tourId: "nav-applications", group: "Mon Espace" },
  { name: "Documents", href: "/tenant/documents", icon: FileText, tourId: "nav-documents", group: "Mes Documents" },
  { name: "États des lieux", href: "/tenant/inspections", icon: ClipboardCheck, tourId: "nav-inspections", group: "Mes Documents" },
  { name: "Loyers & Paiements", href: "/tenant/payments", icon: CreditCard, tourId: "nav-payments", group: "Mes Finances" },
  { name: "Relevé de compte", href: "/tenant/account-statement", icon: Receipt, tourId: "nav-statement", group: "Mes Finances" },
  { name: "Compteurs", href: "/tenant/meters", icon: Gauge, tourId: "nav-meters", group: "Mes Finances" },
  { name: "Demandes", href: "/tenant/requests", icon: Wrench, tourId: "nav-requests", group: "Assistance" },
  { name: "Messages", href: "/tenant/messages", icon: MessageSquare, tourId: "nav-messages", group: "Assistance" },
  { name: "Mes droits", href: "/tenant/legal-rights", icon: Scale, tourId: "nav-legal-rights", group: "Assistance" },
  { name: "Visites", href: "/tenant/visits", icon: Eye, tourId: "nav-visits", group: "Assistance" },
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

  // AUDIT UX: Badges de notification pour la sidebar
  const navBadges = useTenantNavBadges();
  const badgeMap: Record<string, number> = {
    "/tenant/messages": navBadges.messages,
    "/tenant/requests": navBadges.requests,
  };

  const profile = serverProfile || clientProfile;

  // Probe les espaces secondaires accessibles (copro pour les locataires
  // invités par leur syndic, guarantor pour les locataires qui sont aussi
  // garants pour un proche). Endpoint /api/me/workspaces dérive ces
  // éligibilités de user_site_roles + table guarantors. Voir fixes
  // app/copro/layout.tsx et app/guarantor/layout.tsx.
  const [secondaryWorkspaces, setSecondaryWorkspaces] = useState<
    Array<{ key: string; href: string; label: string; count?: number }>
  >([]);
  useEffect(() => {
    if (!profile || profile.role !== "tenant") return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/me/workspaces", { credentials: "include" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          workspaces?: Array<{ key: string; href: string; label: string; count?: number }>;
        };
        const extras = (data.workspaces ?? []).filter(
          (w) => w.key !== "tenant",
        );
        if (!cancelled) setSecondaryWorkspaces(extras);
      } catch {
        // Silent — feature non bloquante.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const isCurrent = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  // Page title from active nav item
  const activeItem = [...allNavItems, ...footerNavItems].find(item => isCurrent(item.href));
  const pageTitle = activeItem?.name || "Tableau de bord";
  const isDashboardPage = pathname === "/tenant/dashboard";
  const shellMeta = getCoreShellMetadata({
    role: "tenant",
    pathname,
    fallbackTitle: pageTitle,
  });

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
          <img
            src="/images/talok-icon.png"
            alt="TALOK"
            className="h-8 w-8 rounded-lg object-contain"
          />
        </div>

        {/* Navigation icônes avec tooltips */}
        <nav className="flex flex-1 flex-col items-center gap-1 py-3 overflow-y-auto">
          {allNavItems.map((item) => {
            const isActive = isCurrent(item.href);
            const badgeCount = badgeMap[item.href] || 0;
            return (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    data-tour={item.tourId}
                    className={cn(
                      "relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                      isActive
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <item.icon className="h-5 w-5" />
                    {badgeCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
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
            <img
              src="/images/talok-logo-horizontal.png"
              alt="TALOK"
              className="h-9 w-auto object-contain"
            />
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
              {group.items.map((item) => {
                const badgeCount = badgeMap[item.href] || 0;
                return (
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
                  <span className="flex-1">{item.name}</span>
                  {badgeCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1.5">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </Link>
                );
              })}
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
        <CoreShellHeader
          title={shellMeta.title}
          description={isDashboardPage ? shellMeta.description : "Concentrez-vous sur votre prochaine action utile."}
          roleLabel={shellMeta.roleLabel}
          isDetailPage={isDetailPage}
          onBack={() => router.back()}
          rightContent={
            <>
              <NotificationBell />

              <div className="hidden lg:block">
                <DarkModeToggle />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={buildAvatarUrl(profile?.avatar_url) ?? undefined} />
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
                      <span className="text-xs text-muted-foreground font-normal">Locataire</span>
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
                  {secondaryWorkspaces.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Autres espaces
                      </DropdownMenuLabel>
                      {secondaryWorkspaces.map((w) => (
                        <DropdownMenuItem key={w.key} asChild>
                          <Link href={w.href} className="flex items-center">
                            <Users className="mr-2 h-4 w-4 text-violet-600" />
                            <span>{w.label}</span>
                            {w.count ? (
                              <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                                {w.count}
                              </span>
                            ) : null}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="text-red-600 focus:text-red-600 disabled:opacity-50"
                  >
                    {isSigningOut ? (
                      <>
                        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
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
            </>
          }
        />

        {/* Main Content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-0 outline-none"
        >
          <PlatformBroadcastBanner />
          {children}
        </main>
      </div>

      {/* ============================================
          Mobile Bottom Navigation (< md)
          Hidden on tablet+ where rail nav takes over
          ============================================ */}
      {/* AUDIT UX SOTA 2026: Parité mobile/desktop — 14/14 items accessibles via menu Plus */}
      <SharedBottomNav
        items={[
          { href: "/tenant/dashboard", label: "Accueil", icon: LayoutDashboard, tourId: "nav-dashboard" },
          { href: "/tenant/documents", label: "Documents", icon: FileText, tourId: "nav-documents" },
          { href: "/tenant/payments", label: "Paiements", icon: CreditCard, tourId: "nav-payments" },
          { href: "/tenant/requests", label: "Demandes", icon: Wrench, tourId: "nav-requests" },
        ]}
        moreItems={[
          { href: "/tenant/lease", label: "Mon Logement", icon: Home, tourId: "nav-lease" },
          { href: "/tenant/inspections", label: "États des lieux", icon: ClipboardCheck, tourId: "nav-inspections" },
          { href: "/tenant/account-statement", label: "Relevé", icon: Receipt, tourId: "nav-statement" },
          { href: "/tenant/meters", label: "Compteurs", icon: Gauge, tourId: "nav-meters" },
          { href: "/tenant/messages", label: "Messages", icon: MessageSquare },
          { href: "/tenant/applications", label: "Candidatures", icon: FileSearch },
          { href: "/tenant/legal-rights", label: "Mes droits", icon: Scale, tourId: "nav-legal-rights" },
          { href: "/tenant/visits", label: "Visites", icon: Eye, tourId: "nav-visits" },
          { href: "/tenant/settings", label: "Mon Profil", icon: Settings },
          { href: "/tenant/help", label: "Aide", icon: HelpCircle },
        ]}
        hideAbove="md"
        hiddenOnPaths={['/tenant/onboarding']}
      />

      {/* Push notification prompt pour le locataire */}
      <PushNotificationPrompt />

      {/* SOTA 2026 - FAB Unifié (Assistant + Actions) */}
      <UnifiedFAB />

      {/* SOTA 2026 - Recherche globale (Cmd+K) */}
      <CommandPalette role="tenant" />

      {/* SOTA 2026 - Tour guidé d'onboarding */}
      <AutoTourPrompt />

      {/* SOTA 2026 - Orchestrateur première connexion (WelcomeModal → Tour) */}
      {profile?.id && (
        <FirstLoginOrchestrator
          profileId={profile.id}
          role="tenant"
          userName={profile.prenom || ""}
        />
      )}
    </div>
    </TooltipProvider>
    </OnboardingTourProvider>
  );
}
