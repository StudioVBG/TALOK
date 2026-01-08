"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Gauge,
  FileSignature,
  Users,
  HelpCircle,
  Bell,
  ChevronDown,
  ClipboardCheck,
  Gift,
  ShoppingBag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AssistantPanel } from "@/components/ai/assistant-panel";

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile: clientProfile, signOut } = useAuth();

  const profile = serverProfile || clientProfile;

  const navigationGroups = [
    {
      title: "Mon Foyer",
      items: [
        {
          name: "Tableau de bord",
          href: "/tenant/dashboard",
          icon: LayoutDashboard,
          tourId: "nav-dashboard",
        },
        {
          name: "Ma Vie au Logement",
          href: "/tenant/lease",
          icon: Home,
          tourId: "nav-lease",
        },
      ],
    },
    {
      title: "Mon Contrat",
      items: [
        {
          name: "Coffre-fort (Documents)",
          href: "/tenant/documents",
          icon: FileText,
          tourId: "nav-documents",
        },
        {
          name: "Suivi Juridique (EDL/Sign)",
          href: "/tenant/inspections",
          icon: ClipboardCheck,
          tourId: "nav-inspections",
        },
      ],
    },
    {
      title: "Mes Finances",
      items: [
        {
          name: "Loyers & Factures",
          href: "/tenant/payments",
          icon: CreditCard,
          tourId: "nav-payments",
        },
      ],
    },
    {
      title: "Assistance",
      items: [
        {
          name: "Demandes & SAV",
          href: "/tenant/requests",
          icon: Wrench,
          tourId: "nav-requests",
        },
        {
          name: "Messagerie",
          href: "/tenant/messages",
          icon: MessageSquare,
        },
      ],
    },
    {
      title: "Mes Avantages",
      items: [
        {
          name: "Club Récompenses",
          href: "/tenant/rewards",
          icon: Gift,
        },
        {
          name: "Marketplace",
          href: "/tenant/marketplace",
          icon: ShoppingBag,
        },
      ],
    },
  ];

  const bottomNavigation = [
    {
      name: "Aide & FAQ",
      href: "/tenant/help",
      icon: HelpCircle,
    },
    {
      name: "Mon Profil",
      href: "/tenant/settings",
      icon: Settings,
    },
  ];

  const isCurrent = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
          <span className="font-bold text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Talok
          </span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
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
              <DropdownMenuItem
                onClick={() => signOut()}
                className="text-red-600 focus:text-red-600"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-slate-800 border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
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

        {/* User Profile Card */}
        <div className="p-4 border-b shrink-0">
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
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isCurrent(item.href)
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      isCurrent(item.href)
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-400"
                    )}
                  />
                  {item.name}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom Navigation */}
        <div className="p-4 border-t space-y-1 shrink-0">
          {bottomNavigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isCurrent(item.href)
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
              )}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon className="h-5 w-5 text-slate-400" />
              {item.name}
            </Link>
          ))}
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={() => signOut()}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:pl-64 min-h-screen transition-all duration-200">
        {children}
      </main>

      {/* AI Assistant */}
      <AssistantPanel />
    </div>
  );
}
