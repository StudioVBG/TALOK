"use client";

import { ReactNode } from "react";
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
} from "lucide-react";

interface AgencyLayoutProps {
  children: ReactNode;
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

export default function AgencyLayout({ children }: AgencyLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
          <div className="flex flex-col flex-grow pt-5 overflow-y-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50">
            {/* Logo / Titre */}
            <div className="flex items-center flex-shrink-0 px-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
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
            <nav className="flex-1 px-3 space-y-1">
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
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                        isActive
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-400 group-hover:text-slate-500"
                      )}
                    />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="flex-shrink-0 p-4 border-t border-slate-200/50 dark:border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                  AG
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    Mon Agence
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Plan Pro
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="md:pl-64 flex-1">
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

