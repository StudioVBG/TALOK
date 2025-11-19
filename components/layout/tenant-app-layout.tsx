"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/hooks/use-auth";

interface TenantAppLayoutProps {
  children: React.ReactNode;
  profile?: { id: string; role: string; prenom?: string | null; nom?: string | null; avatar_url?: string | null } | null;
}

export function TenantAppLayout({ children, profile: serverProfile }: TenantAppLayoutProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile: clientProfile, signOut } = useAuth();
  
  const profile = serverProfile || clientProfile;

  const navigation = [
    { name: "Tableau de bord", href: "/app/tenant/dashboard", icon: LayoutDashboard },
    { name: "Mon bail", href: "/app/tenant/lease", icon: FileText },
    { name: "Paiements", href: "/app/tenant/payments", icon: Wallet },
    { name: "Demandes", href: "/app/tenant/requests", icon: MessageSquare },
    { name: "Paramètres", href: "/app/tenant/settings", icon: Settings },
  ];

  const isCurrent = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="font-bold text-xl text-blue-600">Espace Locataire</div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              ImmoGestion
            </span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              Locataire
            </span>
          </div>

          {/* User Profile */}
          <div className="p-4 border-b bg-slate-50/50">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-blue-100 text-blue-700">
                  {profile?.prenom?.[0]}{profile?.nom?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">
                  {profile?.prenom} {profile?.nom}
                </p>
                <p className="text-xs text-muted-foreground truncate">Locataire</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isCurrent(item.href)
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className={cn("h-5 w-5", isCurrent(item.href) ? "text-blue-600" : "text-slate-400")} />
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:pl-64 pt-0 lg:pt-0 min-h-screen transition-all duration-200">
        {children}
      </main>
    </div>
  );
}

