"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FileText,
  Euro,
  FileCheck,
  HelpCircle,
  Wrench,
  Menu,
  X,
  User,
  LogOut,
  ChevronDown,
  Bell,
  Settings,
  Home,
  CreditCard,
  Gauge,
  FileSignature,
  MessageSquare,
  Users,
  Sun,
  Moon,
  LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { APP_CONFIG, roleStyles, type UserRole } from "@/lib/design-system/tokens";
import { getInitials } from "@/lib/design-system/utils";
import { useSignOut } from "@/lib/hooks/use-sign-out";

// ============================================================================
// NAVIGATION CONFIG
// ============================================================================

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const ownerNavigation: NavSection[] = [
  {
    items: [
      { name: "Tableau de bord", href: "/owner", icon: LayoutDashboard },
      { name: "Mes biens", href: "/owner/properties", icon: Building2 },
      { name: "Baux", href: "/owner/leases", icon: FileText },
      { name: "Finances", href: "/owner/money", icon: Euro },
    ],
  },
  {
    title: "Gestion",
    items: [
      { name: "Tickets", href: "/owner/tickets", icon: Wrench },
      { name: "Documents", href: "/owner/documents", icon: FileCheck },
      { name: "Inspections", href: "/owner/inspections", icon: FileSignature },
    ],
  },
  {
    items: [
      { name: "Aide", href: "/owner/support", icon: HelpCircle },
      { name: "Paramètres", href: "/owner/settings", icon: Settings },
    ],
  },
];

const tenantNavigation: NavSection[] = [
  {
    items: [
      { name: "Tableau de bord", href: "/tenant", icon: LayoutDashboard },
      { name: "Mon logement", href: "/tenant/lease", icon: Home },
      { name: "Paiements", href: "/tenant/payments", icon: CreditCard },
      { name: "Documents", href: "/tenant/documents", icon: FileText },
    ],
  },
  {
    title: "Gestion",
    items: [
      { name: "Demandes", href: "/tenant/requests", icon: Wrench },
      { name: "Compteurs", href: "/tenant/meters", icon: Gauge },
      { name: "Signatures", href: "/tenant/signatures", icon: FileSignature },
      { name: "Messages", href: "/tenant/messages", icon: MessageSquare },
    ],
  },
  {
    items: [
      { name: "Colocation", href: "/tenant/colocation", icon: Users },
      { name: "Aide", href: "/tenant/help", icon: HelpCircle },
      { name: "Paramètres", href: "/tenant/settings", icon: Settings },
    ],
  },
];

const providerNavigation: NavSection[] = [
  {
    items: [
      { name: "Tableau de bord", href: "/provider", icon: LayoutDashboard },
      { name: "Interventions", href: "/provider/jobs", icon: Wrench },
      { name: "Devis", href: "/provider/quotes", icon: FileText },
    ],
  },
  {
    items: [
      { name: "Paramètres", href: "/provider/settings", icon: Settings },
    ],
  },
];

const navigationByRole: Record<UserRole, NavSection[]> = {
  owner: ownerNavigation,
  tenant: tenantNavigation,
  provider: providerNavigation,
  admin: [], // Admin uses a different layout
};

const roleLabels: Record<UserRole, string> = {
  owner: "Propriétaire",
  tenant: "Locataire",
  provider: "Prestataire",
  admin: "Admin",
};

// ============================================================================
// COMPONENT
// ============================================================================

interface AppShellProps {
  children: React.ReactNode;
  role: UserRole;
  profile: {
    id: string;
    prenom?: string | null;
    nom?: string | null;
    avatar_url?: string | null;
  };
  onSignOut?: () => void;
}

export function AppShell({ children, role, profile, onSignOut }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Hook SOTA 2026 pour la déconnexion avec loading state et redirection forcée
  const { signOut: performSignOut, isLoading: isSigningOut } = useSignOut({
    redirectTo: "/auth/signin",
    onSuccess: onSignOut,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const navigation = navigationByRole[role] || [];
  const styles = roleStyles[role];

  const handleSignOut = async () => {
    await performSignOut();
  };

  const isCurrent = (href: string) =>
    pathname === href || (href !== `/${role}` && pathname?.startsWith(href + "/"));

  // Get current page title
  const getCurrentPageTitle = () => {
    for (const section of navigation) {
      for (const item of section.items) {
        if (isCurrent(item.href)) {
          return item.name;
        }
      }
    }
    return "Tableau de bord";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r bg-card px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-3">
            <div className={cn(
              "h-9 w-9 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br from-primary to-primary/60"
            )}>
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{APP_CONFIG.name}</h1>
              <p className="text-xs text-muted-foreground">{roleLabels[role]}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              {navigation.map((section, sectionIdx) => (
                <li key={sectionIdx}>
                  {section.title && (
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
                      {section.title}
                    </p>
                  )}
                  <ul role="list" className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = isCurrent(item.href);
                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            className={cn(
                              "group flex gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <item.icon
                              className={cn(
                                "h-5 w-5 shrink-0 transition-colors",
                                isActive
                                  ? "text-primary"
                                  : "text-muted-foreground group-hover:text-foreground"
                              )}
                            />
                            {item.name}
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

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r">
            <div className="flex h-16 items-center justify-between px-6 border-b">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-9 w-9 rounded-xl flex items-center justify-center",
                  "bg-gradient-to-br from-primary to-primary/60"
                )}>
                  <Building2 className="h-5 w-5 text-primary-foreground" />
                </div>
                <h1 className="text-lg font-bold">{APP_CONFIG.name}</h1>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="px-4 py-4 space-y-6">
              {navigation.map((section, sectionIdx) => (
                <div key={sectionIdx}>
                  {section.title && (
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
                      {section.title}
                    </p>
                  )}
                  <ul className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = isCurrent(item.href);
                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-4 sm:gap-x-6 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>

          {/* Page Title */}
          <div className="flex flex-1 items-center">
            <h2 className="text-lg font-semibold hidden sm:block">
              {getCurrentPageTitle()}
            </h2>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-x-3 lg:gap-x-4">
            {/* Theme Toggle */}
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            )}

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-rose-500 rounded-full" />
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(profile.prenom, profile.nom)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden lg:block text-sm font-medium">
                    {profile.prenom || roleLabels[role]}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden lg:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span>{profile.prenom} {profile.nom}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {roleLabels[role]}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/${role}/settings`}>
                    <User className="mr-2 h-4 w-4" />
                    Mon profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${role}/settings`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Paramètres
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="text-rose-600 focus:text-rose-600 disabled:opacity-50"
                >
                  {isSigningOut ? (
                    <>
                      <span className="mr-2 h-4 w-4 inline-block animate-spin rounded-full border-2 border-rose-400 border-t-transparent" />
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

        {/* Page Content */}
        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav role={role} navigation={navigation} isCurrent={isCurrent} />
    </div>
  );
}

// ============================================================================
// MOBILE BOTTOM NAV
// ============================================================================

interface MobileBottomNavProps {
  role: UserRole;
  navigation: NavSection[];
  isCurrent: (href: string) => boolean;
}

// SOTA 2026: Bottom nav unifiée avec safe area et touch targets
function MobileBottomNav({ role, navigation, isCurrent }: MobileBottomNavProps) {
  // Get first 4 items from navigation for bottom nav
  const bottomItems = navigation[0]?.items.slice(0, 4) || [];

  return (
    <>
      {/* Spacer pour éviter que le contenu soit caché */}
      <div className="h-14 xs:h-16 lg:hidden" aria-hidden="true" />
      
      {/* Navigation avec safe area iOS/Android */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t lg:hidden">
        <div className="pb-safe">
          <div className="grid grid-cols-4 h-14 xs:h-16">
            {bottomItems.map((item) => {
              const isActive = isCurrent(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    // Layout + touch target minimum 44px
                    "flex flex-col items-center justify-center gap-0.5 xs:gap-1",
                    "min-h-[44px] min-w-[44px]",
                    // Transitions et feedback tactile
                    "transition-colors active:bg-muted/50",
                    // États
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className={cn(
                    "h-5 w-5 xs:h-6 xs:w-6",
                    isActive && "text-primary"
                  )} />
                  <span className="text-[9px] xs:text-[10px] sm:text-xs font-medium truncate max-w-[56px] xs:max-w-[64px]">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

