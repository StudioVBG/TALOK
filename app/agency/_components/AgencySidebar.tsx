"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Settings,
  Euro,
  UserCog,
  ClipboardList,
  HelpCircle,
  PieChart,
  FolderOpen,
  MoreHorizontal,
  X,
} from "lucide-react";

interface AgencySidebarProps {
  profile: {
    id: string;
    prenom: string | null;
    nom: string | null;
    role: string;
  };
  agencyName: string;
}

const navigation = [
  {
    name: "Dashboard",
    href: "/agency/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Mandats",
    href: "/agency/mandates",
    icon: FileText,
  },
  {
    name: "Propriétaires",
    href: "/agency/owners",
    icon: Users,
  },
  {
    name: "Biens gérés",
    href: "/agency/properties",
    icon: Building2,
  },
  {
    name: "Locataires",
    href: "/agency/tenants",
    icon: UserCog,
  },
  {
    name: "Finances",
    href: "/agency/finances",
    icon: Euro,
  },
  {
    name: "Commissions",
    href: "/agency/commissions",
    icon: PieChart,
  },
  {
    name: "Documents",
    href: "/agency/documents",
    icon: FolderOpen,
  },
  {
    name: "Équipe",
    href: "/agency/team",
    icon: ClipboardList,
  },
  {
    name: "Paramètres",
    href: "/agency/settings",
    icon: Settings,
  },
  {
    name: "Aide",
    href: "/agency/help",
    icon: HelpCircle,
  },
];

export function AgencySidebar({ profile, agencyName }: AgencySidebarProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const mobileMainItems = navigation.slice(0, 4);
  const mobileMoreItems = navigation.slice(4);

  return (
    <>
      {/* Sidebar Desktop - SOTA 2026: Breakpoint lg unifié */}
      <aside
        className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0"
        role="navigation"
        aria-label="Navigation principale agence"
      >
        <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-card/80 backdrop-blur-xl border-r border-border/50">
          {/* Logo / Titre */}
          <div className="flex items-center flex-shrink-0 px-4 mb-6">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25"
                aria-hidden="true"
              >
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  Espace Agence
                </h1>
                <p className="text-xs text-muted-foreground">
                  Talok Pro
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1" aria-label="Menu agence">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50"
                      : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={item.name}
                >
                  <item.icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                      isActive
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="flex-shrink-0 p-4 border-t border-border/50">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold"
                aria-hidden="true"
              >
                {agencyName.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {agencyName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Plan Pro
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation - 4 items + bouton "Plus" */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/50"
        role="navigation"
        aria-label="Navigation mobile"
      >
        {/* Panel "Plus" - menu déroulant vers le haut */}
        {moreOpen && (
          <>
            {/* Backdrop */}
            <button
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setMoreOpen(false)}
              aria-label="Fermer le menu"
            />
            {/* Panel */}
            <div className="absolute bottom-full left-0 right-0 z-50 bg-background border-t border-border/50 rounded-t-2xl shadow-2xl p-4 pb-2 animate-in slide-in-from-bottom-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-foreground">Plus</span>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="p-1 rounded-lg hover:bg-muted"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {mobileMoreItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 p-3 rounded-xl min-h-[68px] transition-colors",
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      )}
                      aria-label={item.name}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <item.icon className="w-5 h-5" aria-hidden="true" />
                      <span className="text-[10px] font-medium text-center leading-tight">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
        <div className="pb-safe">
          <div className="grid grid-cols-5 h-14">
            {mobileMainItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors",
                    isActive
                      ? "text-indigo-600 dark:text-indigo-400"
                      : "text-muted-foreground hover:text-indigo-500"
                  )}
                  aria-label={item.name}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[10px] font-medium truncate max-w-[56px]">{item.name.slice(0, 8)}</span>
                </Link>
              );
            })}
            {/* Bouton "Plus" */}
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors",
                moreOpen
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-muted-foreground hover:text-indigo-500"
              )}
              aria-label="Plus d'options"
              aria-expanded={moreOpen}
            >
              <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
              <span className="text-[10px] font-medium">Plus</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Spacer pour bottom nav mobile */}
      <div className="h-14 lg:hidden" aria-hidden="true" />
    </>
  );
}
