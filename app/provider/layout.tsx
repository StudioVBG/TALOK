export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  LayoutDashboard,
  Briefcase,
  Receipt,
  Calendar,
  Star,
  Settings,
  HelpCircle,
  FileText,
  FolderOpen,
  Shield
} from "lucide-react";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ProviderBottomNav } from "@/components/layout/provider-bottom-nav";
import { ProviderRailNav } from "@/components/layout/provider-rail-nav";
import { OfflineIndicator } from "@/components/ui/offline-indicator";

const navigation = [
  { name: "Tableau de bord", href: "/provider/dashboard", icon: LayoutDashboard },
  { name: "Mes missions", href: "/provider/jobs", icon: Briefcase },
  { name: "Calendrier", href: "/provider/calendar", icon: Calendar },
  { name: "Mes devis", href: "/provider/quotes", icon: FileText },
  { name: "Mes factures", href: "/provider/invoices", icon: Receipt },
  { name: "Mes documents", href: "/provider/documents", icon: FolderOpen },
  { name: "Mes avis", href: "/provider/reviews", icon: Star },
  { name: "Conformité", href: "/provider/compliance", icon: Shield },
];

const secondaryNav = [
  { name: "Paramètres", href: "/provider/settings", icon: Settings },
  { name: "Aide", href: "/provider/help", icon: HelpCircle },
];

export default async function VendorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, prenom, nom, avatar_url")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "provider") {
    redirect("/dashboard");
  }

  const initials = [profile.prenom?.[0], profile.nom?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "P";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-slate-50">
      {/* Offline indicator - visible when device loses connectivity */}
      <OfflineIndicator />

      {/* TABLET Rail Nav (md-lg) - Icônes + tooltip hover (client component) */}
      <ProviderRailNav navigation={navigation} secondaryNav={secondaryNav} />

      {/* Desktop Sidebar (lg+) - Texte + icônes */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-slate-200 px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg">Prestataire</span>
          </div>

          {/* Navigation principale */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-slate-700 hover:text-orange-600 hover:bg-orange-50"
                      >
                        <item.icon className="h-6 w-6 shrink-0" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>

              {/* Navigation secondaire */}
              <li className="mt-auto">
                <ul role="list" className="-mx-2 space-y-1">
                  {secondaryNav.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-slate-600 hover:text-orange-600 hover:bg-orange-50"
                      >
                        <item.icon className="h-6 w-6 shrink-0" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </nav>
        </div>
      </aside>

      {/* Mobile header (< md) - No hamburger, rely on bottom nav */}
      <div className="sticky top-0 z-40 flex items-center gap-x-4 bg-white px-3 xs:px-4 sm:px-6 py-3 shadow-sm md:hidden">
        <div className="flex-1 text-sm font-semibold leading-6 text-slate-900">
          Espace Prestataire
        </div>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-sm">
            {initials}
          </div>
        </div>
      </div>

      {/* Main content - Padding adapté: md: pl-16 (rail), lg: pl-64 */}
      <main className="md:pl-16 lg:pl-64">
        {/* Tablet header (md-lg) - Shows in rail nav mode */}
        <div className="sticky top-0 z-40 hidden md:flex lg:hidden h-14 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-4 sm:px-6">
          <div className="flex-1 text-sm font-semibold leading-6 text-slate-900">
            Espace Prestataire
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter />
            <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-sm">
              {initials}
            </div>
          </div>
        </div>

        {/* Desktop header (lg+) */}
        <div className="sticky top-0 z-40 hidden lg:flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6">
          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 justify-end items-center">
            <NotificationCenter />
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-sm">
                {initials}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-slate-900">
                  {profile.prenom} {profile.nom}
                </p>
                <p className="text-xs text-slate-500">Prestataire</p>
              </div>
            </div>
          </div>
        </div>

        <div className="py-4 xs:py-5 sm:py-6 px-3 xs:px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation (< md) - Hidden on tablet+ where rail nav takes over */}
      <ProviderBottomNav />
    </div>
  );
}
