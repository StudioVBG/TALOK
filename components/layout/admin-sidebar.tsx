"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Users,
  FileText,
  BookOpen,
  Key,
  ShieldCheck,
  Calculator,
  Lock,
  Shield,
  Building2,
  Menu,
  X,
  Search,
  ImageIcon,
  ScrollText,
  CreditCard,
  Wallet,
  Mail,
  Palette,
  Brain,
  FolderOpen,
  LogOut,
  Flag,
  Ticket,
  TrendingUp,
  Clock,
  Zap,
  Megaphone,
  Tag,
  Activity,
  Gauge,
} from "lucide-react";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavCategory {
  category: string;
  items: NavItem[];
}

const adminNavItems: NavCategory[] = [
  {
    category: "À traiter",
    items: [
      { href: "/admin/dashboard", label: "Tableau de bord", icon: BarChart3 },
      { href: "/admin/support", label: "Support", icon: Ticket },
      { href: "/admin/moderation", label: "Modération IA", icon: Brain },
      { href: "/admin/providers/pending", label: "Validation Prestataires", icon: ShieldCheck },
      { href: "/admin/compliance", label: "Conformité prestataires", icon: Shield },
    ],
  },
  {
    category: "Utilisateurs & parc",
    items: [
      { href: "/admin/people", label: "Annuaire", icon: Users },
      { href: "/admin/properties", label: "Parc immobilier", icon: Building2 },
      { href: "/admin/documents", label: "Documents", icon: FolderOpen },
    ],
  },
  {
    category: "Contenu & communication",
    items: [
      { href: "/admin/broadcasts", label: "Annonces globales", icon: Megaphone },
      { href: "/admin/site-content", label: "Contenu du site", icon: FileText },
      { href: "/admin/templates", label: "Templates Baux", icon: ScrollText },
      { href: "/admin/email-templates", label: "Templates Email", icon: Mail },
      { href: "/admin/blog", label: "Blog", icon: BookOpen },
      { href: "/admin/landing-images", label: "Images Vitrine", icon: ImageIcon },
    ],
  },
  {
    category: "Offre & revenus",
    items: [
      { href: "/admin/plans", label: "Forfaits & Tarifs", icon: CreditCard },
      { href: "/admin/subscriptions", label: "Abonnements", icon: Wallet },
      { href: "/admin/promo-codes", label: "Codes promo", icon: Tag },
      { href: "/admin/accounting", label: "Comptabilité", icon: Calculator },
      { href: "/admin/stripe", label: "Stripe Connect", icon: Zap },
    ],
  },
  {
    category: "Analyse & rapports",
    items: [
      { href: "/admin/metrics", label: "Métriques", icon: TrendingUp },
      { href: "/admin/metrics-saas", label: "Métriques abonnements", icon: Activity },
      { href: "/admin/reports", label: "Rapports", icon: FileText },
    ],
  },
  {
    category: "Plateforme",
    items: [
      { href: "/admin/platform-health", label: "Santé plateforme", icon: Activity },
      { href: "/admin/branding", label: "Branding", icon: Palette },
      { href: "/admin/integrations", label: "Intégrations", icon: Key },
      { href: "/admin/google-places-usage", label: "Quota Google Places", icon: Gauge },
      { href: "/admin/flags", label: "Feature Flags", icon: Flag },
      { href: "/admin/crons", label: "Tâches planifiées", icon: Clock },
    ],
  },
  {
    category: "Sécurité & Conformité",
    items: [
      { href: "/admin/privacy", label: "RGPD", icon: Lock },
      { href: "/admin/audit-logs", label: "Journal d'audit", icon: ScrollText },
    ],
  },
];

// Flatten all items for search
const allNavItems = adminNavItems.flatMap((cat) =>
  cat.items.map((item) => ({ ...item, category: cat.category }))
);

export function AdminSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const { signOut: handleSignOut, isLoading: signingOut } = useSignOut({ redirectTo: "/login" });

  // Keyboard shortcut for search (Cmd+K / Ctrl+K)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setSearchOpen(false);
    command();
  }, []);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-40 lg:pt-16",
          "bg-background border-r border-border h-screen",
          className
        )}
      >
        {/* Search Button */}
        <div className="p-4 border-b border-border">
          <Button
            variant="outline"
            className="w-full justify-start text-muted-foreground"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="mr-2 h-4 w-4" />
            Recherche rapide...
            <CommandShortcut>⌘K</CommandShortcut>
          </Button>
        </div>

        {/* Navigation — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <nav className="p-4 space-y-6">
            {adminNavItems.map((category) => (
              <div key={category.category} className="space-y-2">
                <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {category.category}
                </h3>
                <div className="space-y-1">
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                          "hover:bg-accent hover:text-accent-foreground",
                          isActive
                            ? "bg-accent text-accent-foreground shadow-sm"
                            : "text-muted-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 transition-transform duration-200",
                            isActive && "scale-110",
                            "group-hover:scale-110"
                          )}
                        />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer — always visible at bottom */}
        <div className="mt-auto border-t border-border">
          <div className="p-4 space-y-2">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Building2 className="h-4 w-4" />
              <span>Retour au site</span>
            </Link>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex w-full items-center gap-2 rounded-lg px-0 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 transition-colors disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              <span>{signingOut ? "Déconnexion..." : "Déconnexion"}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden fixed top-3 left-2 sm:top-16 sm:left-4 z-50 bg-background/95 backdrop-blur-sm border border-border/50 shadow-sm"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Ouvrir le menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            {/* Mobile Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Administration</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer le menu"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground"
                onClick={() => {
                  setOpen(false);
                  setSearchOpen(true);
                }}
              >
                <Search className="mr-2 h-4 w-4" />
                Recherche rapide...
              </Button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 overflow-y-auto p-4 space-y-6">
              {adminNavItems.map((category) => (
                <div key={category.category} className="space-y-2">
                  <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {category.category}
                  </h3>
                  <div className="space-y-1">
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                            "hover:bg-accent hover:text-accent-foreground",
                            isActive
                              ? "bg-accent text-accent-foreground shadow-sm"
                              : "text-muted-foreground"
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              isActive && "scale-110",
                              "group-hover:scale-110"
                            )}
                          />
                          <span className="flex-1">{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            {/* Mobile Footer — always visible at bottom */}
            <div className="mt-auto p-4 border-t border-border">
              <button
                onClick={() => {
                  setOpen(false);
                  handleSignOut();
                }}
                disabled={signingOut}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                <span>{signingOut ? "Déconnexion..." : "Déconnexion"}</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Command Palette (Search) */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput placeholder="Rechercher une page..." />
        <CommandList>
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          {adminNavItems.map((category) => (
            <CommandGroup key={category.category} heading={category.category}>
              {category.items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    onSelect={() => {
                      runCommand(() => {
                        window.location.href = item.href;
                      });
                    }}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

