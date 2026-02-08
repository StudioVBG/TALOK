"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { buildAvatarUrl, formatFullName } from "@/lib/helpers/format";
import {
  Home,
  Menu,
  User,
  LogOut,
  HelpCircle,
  Building2,
  FileText,
  Receipt,
  Wrench,
  Users,
  BarChart3,
  Shield,
  ChevronDown,
  FileSignature,
  MapPin,
  Calculator,
  BookOpen,
  MessageSquare,
  Star,
  Building,
  Briefcase,
  CreditCard,
  ClipboardCheck,
  PieChart,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============================================
// HELPERS
// ============================================

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

// ============================================
// MEGA-MENU DATA
// ============================================

const MEGA_MENU = {
  produit: {
    label: "Produit",
    sections: [
      {
        title: "Fonctionnalites",
        links: [
          { href: "/fonctionnalites/gestion-biens", label: "Gestion des biens", icon: Building2, desc: "Centralisez vos biens immobiliers" },
          { href: "/fonctionnalites/gestion-locataires", label: "Gestion locataires", icon: Users, desc: "Suivi complet de vos locataires" },
          { href: "/fonctionnalites/etats-des-lieux", label: "Etats des lieux", icon: ClipboardCheck, desc: "EDL numeriques avec photos" },
          { href: "/fonctionnalites/signature-electronique", label: "Signature electronique", icon: FileSignature, desc: "eIDAS, valeur juridique garantie" },
          { href: "/fonctionnalites/quittances-loyers", label: "Quittances & loyers", icon: Receipt, desc: "Automatisez vos quittances" },
          { href: "/fonctionnalites/comptabilite-fiscalite", label: "Comptabilite & fiscalite", icon: PieChart, desc: "Export comptable et 2044" },
          { href: "/fonctionnalites/paiements-en-ligne", label: "Paiements en ligne", icon: CreditCard, desc: "CB, SEPA, prelevement" },
        ],
      },
      {
        title: "Outils gratuits",
        links: [
          { href: "/outils/calcul-rendement-locatif", label: "Calcul rendement", icon: Calculator, desc: "Simulez votre rendement locatif" },
          { href: "/outils/calcul-revision-irl", label: "Calcul revision IRL", icon: Calculator, desc: "Calculez la revision de loyer" },
          { href: "/outils/calcul-frais-notaire", label: "Frais de notaire", icon: Calculator, desc: "Estimez vos frais de notaire" },
          { href: "/outils/simulateur-charges", label: "Simulateur charges", icon: Calculator, desc: "Evaluez les charges locatives" },
        ],
      },
    ],
  },
  solutions: {
    label: "Solutions",
    links: [
      { href: "/solutions/proprietaires-particuliers", label: "Proprietaires particuliers", icon: Home, desc: "1 a 3 biens, simplifiez tout" },
      { href: "/solutions/investisseurs", label: "Investisseurs", icon: Briefcase, desc: "Portefeuille multi-biens" },
      { href: "/solutions/administrateurs-biens", label: "Administrateurs de biens", icon: Building, desc: "Gestion professionnelle" },
      { href: "/solutions/sci-familiales", label: "SCI familiales", icon: Users, desc: "Multi-associes, multi-biens" },
      { href: "/solutions/dom-tom", label: "DOM-TOM", icon: MapPin, desc: "Le seul logiciel qui vous couvre" },
    ],
  },
  ressources: {
    label: "Ressources",
    links: [
      { href: "/blog", label: "Blog", icon: BookOpen, desc: "Actualites et conseils" },
      { href: "/guides", label: "Guides & modeles", icon: FileText, desc: "8 guides pratiques gratuits" },
      { href: "/faq", label: "FAQ", icon: HelpCircle, desc: "Questions frequentes" },
      { href: "/temoignages", label: "Temoignages", icon: Star, desc: "+500 avis, note 4.8/5" },
      { href: "/a-propos", label: "A propos", icon: Building2, desc: "Notre histoire et nos valeurs" },
      { href: "/contact", label: "Contact", icon: MessageSquare, desc: "Ecrivez-nous" },
    ],
  },
} as const;

// ============================================
// MEGA-MENU PANEL CONTENT (Desktop)
// Renders the inner content for a given menu key.
// Separated from the animated wrapper so that
// switching menus doesn't re-mount the container.
// ============================================

function MegaMenuContent({
  menuKey,
  onClose,
}: {
  menuKey: keyof typeof MEGA_MENU;
  onClose: () => void;
}) {
  const menu = MEGA_MENU[menuKey];

  const menuItemClasses = cn(
    "group flex items-start gap-3 rounded-xl p-3",
    "transition-all duration-150",
    "hover:bg-accent/80",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
  );

  if ("sections" in menu) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-8">
          {menu.sections.map((section) => (
            <div key={section.title} role="group" aria-label={section.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-3">
                {section.title}
              </h3>
              <div className="grid gap-0.5">
                {section.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onClose}
                      role="menuitem"
                      tabIndex={0}
                      className={menuItemClasses}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background shadow-sm group-hover:border-primary/30 group-hover:bg-primary/5 group-hover:shadow-md transition-all duration-150">
                        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-150" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-none mb-1 group-hover:text-primary transition-colors duration-150">
                          {link.label}
                        </p>
                        <p className="text-xs text-muted-foreground leading-snug">
                          {link.desc}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t flex items-center justify-between">
          <Link
            href="/fonctionnalites"
            onClick={onClose}
            className="text-sm font-medium text-primary hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded px-2 py-1"
          >
            Voir toutes les fonctionnalites &rarr;
          </Link>
        </div>
      </div>
    );
  }

  // Simple links layout (Solutions, Ressources)
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-0.5">
        {menu.links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              role="menuitem"
              tabIndex={0}
              className={menuItemClasses}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background shadow-sm group-hover:border-primary/30 group-hover:bg-primary/5 group-hover:shadow-md transition-all duration-150">
                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-150" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-none mb-1 group-hover:text-primary transition-colors duration-150">
                  {link.label}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">
                  {link.desc}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// MEGA-MENU PANEL WRAPPER (animated container)
// ============================================

function MegaMenuPanel({
  menuKey,
  onClose,
  onPanelEnter,
  onPanelLeave,
}: {
  menuKey: keyof typeof MEGA_MENU;
  onClose: () => void;
  onPanelEnter: () => void;
  onPanelLeave: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const menu = MEGA_MENU[menuKey];

  // Keyboard navigation within the panel
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!panelRef.current) return;
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]')
      );
      const currentIndex = items.indexOf(document.activeElement as HTMLAnchorElement);

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          items[(currentIndex + 1) % items.length]?.focus();
          break;
        case "ArrowUp":
          e.preventDefault();
          items[(currentIndex - 1 + items.length) % items.length]?.focus();
          break;
        case "Home":
          e.preventDefault();
          items[0]?.focus();
          break;
        case "End":
          e.preventDefault();
          items[items.length - 1]?.focus();
          break;
        case "Escape":
          onClose();
          break;
      }
    },
    [onClose]
  );

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "absolute top-full left-0 right-0 z-20",
        "bg-background/95 backdrop-blur-xl",
        "border-b border-border/50",
        "shadow-[0_20px_60px_-15px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)]"
      )}
      onMouseEnter={onPanelEnter}
      onMouseLeave={onPanelLeave}
      onKeyDown={handleKeyDown}
      role="menu"
      id={`mega-menu-${menuKey}`}
      aria-labelledby={`mega-trigger-${menuKey}`}
      aria-label={`Menu ${menu.label}`}
    >
      {/* Inner content crossfade when switching menus */}
      <AnimatePresence mode="wait">
        <motion.div
          key={menuKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          <MegaMenuContent menuKey={menuKey} onClose={onClose} />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================
// MOBILE MENU ACCORDION ITEM (with animation)
// ============================================

function MobileMenuSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-3 text-sm font-medium transition-colors hover:text-primary"
      >
        {title}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-3 pl-2 space-y-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// MAIN NAVBAR
// ============================================

export function Navbar() {
  const { user, profile, loading } = useAuth();
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const { signOut: handleSignOut, isLoading: isSigningOut } = useSignOut({
    redirectTo: "/",
  });

  const closeMenu = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpenMenu(null);
  }, []);

  // Close mega-menu on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openMenu) {
        closeMenu();
        // Return focus to the trigger button
        const trigger = document.getElementById(`mega-trigger-${openMenu}`);
        trigger?.focus();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [openMenu, closeMenu]);

  // Click-outside fallback
  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu, closeMenu]);

  // Hide on dashboard routes
  const hiddenPaths = ["/owner", "/tenant", "/provider", "/vendor", "/admin", "/syndic", "/agency", "/copro", "/guarantor"];
  if (hiddenPaths.some((path) => pathname?.startsWith(path))) {
    return null;
  }

  const handleMenuEnter = (key: string) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setOpenMenu(key);
  };

  const handleMenuLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setOpenMenu(null);
    }, 200);
  };

  const handlePanelEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const getInitials = () => {
    if (!profile) return "?";
    const first = profile.prenom?.[0]?.toUpperCase() || "";
    const last = profile.nom?.[0]?.toUpperCase() || "";
    return first + last || user?.email?.[0]?.toUpperCase() || "?";
  };

  const getMainNavItems = () => {
    if (!profile) return [];
    const items: Array<{ href: string; label: string; icon: React.ReactNode }> = [];

    if (profile.role === "admin") {
      items.push({ href: "/admin/dashboard", label: "Admin", icon: <BarChart3 className="h-4 w-4" /> });
    } else if (profile.role === "owner") {
      items.push(
        { href: "/owner", label: "Tableau de bord", icon: <Home className="h-4 w-4" /> },
        { href: "/owner/properties", label: "Mes biens", icon: <Building2 className="h-4 w-4" /> },
        { href: "/owner/leases", label: "Baux & locataires", icon: <FileText className="h-4 w-4" /> },
        { href: "/owner/money", label: "Loyers & revenus", icon: <Receipt className="h-4 w-4" /> },
        { href: "/owner/documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
        { href: "/owner/support", label: "Aide & services", icon: <HelpCircle className="h-4 w-4" /> }
      );
    } else if (profile.role === "tenant") {
      items.push(
        { href: "/tenant", label: "Tableau de bord", icon: <Home className="h-4 w-4" /> },
        { href: "/tenant/lease", label: "Mon logement", icon: <Building2 className="h-4 w-4" /> },
        { href: "/tenant/payments", label: "Paiements", icon: <Receipt className="h-4 w-4" /> },
        { href: "/tenant/requests", label: "Demandes", icon: <Wrench className="h-4 w-4" /> }
      );
    } else if (profile.role === "provider") {
      items.push(
        { href: "/provider", label: "Tableau de bord", icon: <Home className="h-4 w-4" /> },
        { href: "/provider/jobs", label: "Interventions", icon: <Wrench className="h-4 w-4" /> }
      );
    }

    return items;
  };

  const mainNavItems = getMainNavItems();

  // Loading skeleton
  if (loading) {
    return (
      <div className="sticky top-0 z-50">
        <nav className="relative border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <span className="text-xl font-bold hidden sm:inline-block">
                    Talok
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-20 animate-pulse rounded-md bg-muted hidden sm:block" />
                <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
              </div>
            </div>
          </div>
        </nav>
      </div>
    );
  }

  return (
    // Outer wrapper: sticky + z-50 but NO backdrop-filter/transform.
    // This ensures position:fixed children (backdrop overlay) are fixed
    // to the viewport, not trapped by a CSS containing block.
    <div ref={headerRef} className="sticky top-0 z-50">
      {/* Nav bar: visual styling with backdrop-blur */}
      <nav
        className="relative border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        aria-label="Navigation principale"
      >
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

              {/* Desktop Navigation - Authenticated */}
              {user && mainNavItems.length > 0 && (
                <div className="hidden md:flex items-center gap-1">
                  {mainNavItems.map((item) => (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={pathname === item.href ? "secondary" : "ghost"}
                        size="sm"
                        className={cn("gap-2", pathname === item.href && "bg-accent")}
                      >
                        {item.icon}
                        {item.label}
                      </Button>
                    </Link>
                  ))}
                </div>
              )}

              {/* Desktop Navigation - Public Mega-Menu */}
              {!user && (
                <div className="hidden lg:flex items-center gap-1">
                  {(Object.keys(MEGA_MENU) as Array<keyof typeof MEGA_MENU>).map(
                    (key) => (
                      <div
                        key={key}
                        onMouseEnter={() => handleMenuEnter(key)}
                        onMouseLeave={handleMenuLeave}
                        className="relative"
                      >
                        <Button
                          id={`mega-trigger-${key}`}
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "gap-1 text-sm transition-colors duration-150",
                            openMenu === key
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                          aria-expanded={openMenu === key}
                          aria-haspopup="true"
                          aria-controls={openMenu === key ? `mega-menu-${key}` : undefined}
                          onClick={(e) => {
                            if (openMenu === key) {
                              closeMenu();
                            } else {
                              handleMenuEnter(key);
                              // For keyboard activation (Enter/Space), focus first menu item
                              if (e.detail === 0) {
                                setTimeout(() => {
                                  const panel = document.getElementById(`mega-menu-${key}`);
                                  const firstItem = panel?.querySelector<HTMLAnchorElement>('[role="menuitem"]');
                                  firstItem?.focus();
                                }, 200);
                              }
                            }
                          }}
                        >
                          {MEGA_MENU[key].label}
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 opacity-60 transition-transform duration-200",
                              openMenu === key && "rotate-180"
                            )}
                            aria-hidden="true"
                          />
                        </Button>
                      </div>
                    )
                  )}
                  <Link href="/pricing">
                    <Button
                      variant={pathname === "/pricing" ? "secondary" : "ghost"}
                      size="sm"
                      className="text-sm"
                    >
                      Tarifs
                    </Button>
                  </Link>
                </div>
              )}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* Help Link (authenticated only) */}
              {user && (
                <Link href="/faq" className="hidden sm:block">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <HelpCircle className="h-4 w-4" />
                    <span className="hidden lg:inline">Aide</span>
                  </Button>
                </Link>
              )}

              {user ? (
                <>
                  {/* Mobile Menu (authenticated) */}
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
                            <Button variant="ghost" className="w-full justify-start gap-2">
                              <User className="h-4 w-4" />
                              Mon profil
                            </Button>
                          </Link>
                          <Link href="/faq">
                            <Button variant="ghost" className="w-full justify-start gap-2">
                              <HelpCircle className="h-4 w-4" />
                              Centre d&apos;aide
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 text-destructive disabled:opacity-50"
                            onClick={handleSignOut}
                            disabled={isSigningOut}
                          >
                            {isSigningOut ? (
                              <>
                                <span className="h-4 w-4 inline-block animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                                Deconnexion...
                              </>
                            ) : (
                              <>
                                <LogOut className="h-4 w-4" />
                                Deconnexion
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* User Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-10 gap-2 px-2 sm:px-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={buildAvatarUrl(profile?.avatar_url) || undefined} />
                          <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
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
                          <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
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
                      <Link href="/faq">
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
                        className="text-destructive focus:text-destructive disabled:opacity-50"
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                      >
                        {isSigningOut ? (
                          <>
                            <span className="mr-2 h-4 w-4 inline-block animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                            Deconnexion...
                          </>
                        ) : (
                          <>
                            <LogOut className="mr-2 h-4 w-4" />
                            Deconnexion
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  {/* Mobile hamburger (unauthenticated) */}
                  <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" className="lg:hidden">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[300px] sm:w-[380px] overflow-y-auto">
                      <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                            <Building2 className="h-4 w-4" />
                          </div>
                          Talok
                        </SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        {/* Produit section */}
                        <MobileMenuSection title="Produit">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-1">
                            Fonctionnalites
                          </p>
                          {MEGA_MENU.produit.sections[0].links.map((link) => {
                            const Icon = link.icon;
                            return (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm hover:bg-accent transition-colors min-h-[44px]"
                              >
                                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                {link.label}
                              </Link>
                            );
                          })}
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-4">
                            Outils gratuits
                          </p>
                          {MEGA_MENU.produit.sections[1].links.map((link) => {
                            const Icon = link.icon;
                            return (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm hover:bg-accent transition-colors min-h-[44px]"
                              >
                                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                {link.label}
                              </Link>
                            );
                          })}
                        </MobileMenuSection>

                        {/* Solutions section */}
                        <MobileMenuSection title="Solutions">
                          {MEGA_MENU.solutions.links.map((link) => {
                            const Icon = link.icon;
                            return (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm hover:bg-accent transition-colors min-h-[44px]"
                              >
                                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                {link.label}
                              </Link>
                            );
                          })}
                        </MobileMenuSection>

                        {/* Ressources section */}
                        <MobileMenuSection title="Ressources">
                          {MEGA_MENU.ressources.links.map((link) => {
                            const Icon = link.icon;
                            return (
                              <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-2.5 rounded-lg px-2 py-2.5 text-sm hover:bg-accent transition-colors min-h-[44px]"
                              >
                                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                {link.label}
                              </Link>
                            );
                          })}
                        </MobileMenuSection>

                        {/* Tarifs direct link */}
                        <Link
                          href="/pricing"
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center py-3 text-sm font-medium border-b hover:text-primary transition-colors min-h-[44px]"
                        >
                          Tarifs
                        </Link>

                        {/* Auth buttons */}
                        <div className="mt-6 space-y-3">
                          <Link href="/auth/signin" onClick={() => setMobileOpen(false)}>
                            <Button variant="outline" className="w-full">
                              Connexion
                            </Button>
                          </Link>
                          <Link href="/signup/role" onClick={() => setMobileOpen(false)}>
                            <Button className="w-full">
                              Inscription gratuite
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* Desktop auth buttons */}
                  <Link href="/auth/signin" className="hidden lg:block">
                    <Button variant="outline" size="sm" className="border-border/60 hover:bg-accent">
                      Connexion
                    </Button>
                  </Link>
                  <Link href="/signup/role" className="hidden lg:block">
                    <Button size="sm">Inscription</Button>
                  </Link>

                  {/* Tablet: show compact auth buttons */}
                  <Link href="/auth/signin" className="hidden sm:block lg:hidden">
                    <Button variant="outline" size="sm" className="border-border/60 hover:bg-accent">
                      Connexion
                    </Button>
                  </Link>
                  <Link href="/signup/role" className="hidden sm:block lg:hidden">
                    <Button size="sm">Inscription</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ============================================
         MEGA-MENU & BACKDROP
         Rendered OUTSIDE <nav> to avoid the CSS
         containing-block created by backdrop-filter.
         The sticky wrapper (no filter/transform) lets
         position:fixed children escape to the viewport.
         ============================================ */}

      {/* Backdrop overlay */}
      <AnimatePresence>
        {!user && openMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 top-16 z-10 bg-black/20"
            onClick={closeMenu}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Desktop Mega-Menu Panel */}
      <AnimatePresence>
        {!user && openMenu && (
          <MegaMenuPanel
            key={openMenu}
            menuKey={openMenu as keyof typeof MEGA_MENU}
            onClose={closeMenu}
            onPanelEnter={handlePanelEnter}
            onPanelLeave={handleMenuLeave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
