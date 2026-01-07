"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/hooks/use-auth";
import { buildAvatarUrl, formatFullName } from "@/lib/helpers/format";
import {
  Home,
  Menu,
  User,
  LogOut,
  Settings,
  HelpCircle,
  Building2,
  FileText,
  Receipt,
  Wrench,
  Users,
  BarChart3,
  Shield,
  ChevronDown,
  Key,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    admin: "Administrateur",
    owner: "Propriétaire",
    tenant: "Locataire",
    provider: "Prestataire",
    guarantor: "Garant",
  };
  return labels[role] || role;
};

const getRoleColor = (role: string) => {
  const colors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    owner: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    tenant: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    provider: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    guarantor: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };
  return colors[role] || "bg-gray-100 text-gray-800";
};

export function Navbar() {
  const { user, profile, signOut, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Masquer la navbar pour les dashboards (elles ont leur propre layout avec sidebar)
  // Nouvelle structure SOTA 2025: /owner, /tenant, /provider, /admin
  // Ancien format: /owner, /tenant pour la compatibilité
  const hiddenPaths = ["/owner", "/tenant", "/provider", "/vendor", "/owner", "/tenant", "/provider", "/app/vendor", "/admin"];
  if (hiddenPaths.some(path => pathname?.startsWith(path))) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  const getInitials = () => {
    if (!profile) return "?";
    const first = profile.prenom?.[0]?.toUpperCase() || "";
    const last = profile.nom?.[0]?.toUpperCase() || "";
    return (first + last) || user?.email?.[0]?.toUpperCase() || "?";
  };

  const getMainNavItems = () => {
    if (!profile) return [];

    const items: Array<{ href: string; label: string; icon: React.ReactNode }> = [];

    if (profile.role === "admin") {
      // Admin pages now use sidebar navigation, only show dashboard link in top nav
      items.push(
        { href: "/admin/dashboard", label: "Admin", icon: <BarChart3 className="h-4 w-4" /> }
      );
    } else if (profile.role === "owner") {
      // Nouvelle structure SOTA 2025
      items.push(
        { href: "/owner", label: "Tableau de bord", icon: <Home className="h-4 w-4" /> },
        { href: "/owner/properties", label: "Mes biens", icon: <Building2 className="h-4 w-4" /> },
        { href: "/owner/leases", label: "Baux & locataires", icon: <FileText className="h-4 w-4" /> },
        { href: "/owner/money", label: "Loyers & revenus", icon: <Receipt className="h-4 w-4" /> },
        { href: "/owner/documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
        { href: "/owner/support", label: "Aide & services", icon: <HelpCircle className="h-4 w-4" /> }
      );
    } else if (profile.role === "tenant") {
      // Nouvelle structure SOTA 2025
      items.push(
        { href: "/tenant", label: "Tableau de bord", icon: <Home className="h-4 w-4" /> },
        { href: "/tenant/lease", label: "Mon logement", icon: <Building2 className="h-4 w-4" /> },
        { href: "/tenant/payments", label: "Paiements", icon: <Receipt className="h-4 w-4" /> },
        { href: "/tenant/requests", label: "Demandes", icon: <Wrench className="h-4 w-4" /> }
      );
    } else if (profile.role === "provider") {
      // Nouvelle structure SOTA 2025
      items.push(
        { href: "/provider", label: "Tableau de bord", icon: <Home className="h-4 w-4" /> },
        { href: "/provider/jobs", label: "Interventions", icon: <Wrench className="h-4 w-4" /> }
      );
    }

    return items;
  };

  const mainNavItems = getMainNavItems();

  if (loading) {
    return (
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 animate-pulse rounded bg-muted" />
              <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold hidden sm:inline-block">
                Talok
              </span>
            </Link>

            {/* Desktop Navigation */}
            {user && mainNavItems.length > 0 && (
              <nav className="hidden md:flex items-center gap-1">
                {mainNavItems.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={pathname === item.href ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "gap-2",
                        pathname === item.href && "bg-accent"
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Button>
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* Help Link */}
            <Link href="/blog" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                <span className="hidden lg:inline">Aide</span>
              </Button>
            </Link>

            {user ? (
              <>
                {/* Mobile Menu */}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="md:hidden">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                    <SheetHeader>
                      <SheetTitle>Menu</SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      {mainNavItems.map((item) => (
                        <Link key={item.href} href={item.href}>
                          <Button
                            variant={pathname === item.href ? "secondary" : "ghost"}
                            className="w-full justify-start gap-2"
                          >
                            {item.icon}
                            {item.label}
                          </Button>
                        </Link>
                      ))}
                      <div className="pt-4 border-t">
                        <Link href="/profile">
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-2"
                          >
                            <User className="h-4 w-4" />
                            Mon profil
                          </Button>
                        </Link>
                        <Link href="/blog">
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-2"
                          >
                            <HelpCircle className="h-4 w-4" />
                            Centre d&apos;aide
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2 text-destructive"
                          onClick={handleSignOut}
                        >
                          <LogOut className="h-4 w-4" />
                          Déconnexion
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 gap-2 px-2 sm:px-3"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={buildAvatarUrl(profile?.avatar_url) || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="hidden sm:flex flex-col items-start">
                        <span className="text-sm font-medium">
                          {formatFullName(profile?.prenom || null, profile?.nom || null) || user.email}
                        </span>
                        {profile?.role && (
                          <Badge
                            variant="secondary"
                            className={cn("text-xs h-4 px-1.5", getRoleColor(profile.role))}
                          >
                            {getRoleLabel(profile.role)}
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 hidden sm:block opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {formatFullName(profile?.prenom || null, profile?.nom || null) || "Utilisateur"}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                        {profile?.role && (
                          <Badge
                            variant="secondary"
                            className={cn("mt-1 w-fit text-xs", getRoleColor(profile.role))}
                          >
                            {getRoleLabel(profile.role)}
                          </Badge>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <Link href="/dashboard">
                      <DropdownMenuItem>
                        <Home className="mr-2 h-4 w-4" />
                        Tableau de bord
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/profile">
                      <DropdownMenuItem>
                        <User className="mr-2 h-4 w-4" />
                        Mon profil
                      </DropdownMenuItem>
                    </Link>
                    <Link href="/blog">
                      <DropdownMenuItem>
                        <HelpCircle className="mr-2 h-4 w-4" />
                        Centre d&apos;aide
                      </DropdownMenuItem>
                    </Link>
                    {profile?.role === "admin" && (
                      <>
                        <DropdownMenuSeparator />
                        <Link href="/admin/dashboard">
                          <DropdownMenuItem>
                            <Shield className="mr-2 h-4 w-4" />
                            Administration
                          </DropdownMenuItem>
                        </Link>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={handleSignOut}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Déconnexion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link href="/auth/signin">
                  <Button variant="ghost" size="sm">
                    Connexion
                  </Button>
                </Link>
                <Link href="/signup/role">
                  <Button size="sm">Inscription</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
