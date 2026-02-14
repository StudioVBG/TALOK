export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerProfile } from "@/lib/helpers/auth-helper";
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
  Shield,
} from "lucide-react";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { ProviderBottomNav } from "@/components/layout/provider-bottom-nav";
import { ProviderRailNav } from "@/components/layout/provider-rail-nav";
import { ProviderSidebar } from "@/components/layout/provider-sidebar";
import { ErrorBoundary } from "@/components/error-boundary";
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

  // Récupérer le profil (avec fallback service role en cas de récursion RLS)
  const { profile } = await getServerProfile<{
    id: string;
    role: string;
    prenom: string | null;
    nom: string | null;
    avatar_url: string | null;
  }>(user.id, "id, role, prenom, nom, avatar_url");

  if (!profile || profile.role !== "provider") {
    // Redirections complètes par rôle
    if (profile?.role === "owner") redirect("/owner/dashboard");
    if (profile?.role === "tenant") redirect("/tenant/dashboard");
    if (profile?.role === "admin" || profile?.role === "platform_admin") redirect("/admin/dashboard");
    if (profile?.role === "agency") redirect("/agency/dashboard");
    if (profile?.role === "syndic") redirect("/syndic/dashboard");
    redirect("/dashboard");
  }

  const initials =
    [profile.prenom?.[0], profile.nom?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "P";

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-background via-orange-50/10 to-background dark:from-background dark:via-background dark:to-background">
        {/* Offline indicator */}
        <OfflineIndicator />

        {/* TABLET Rail Nav (md-lg) - Icônes + tooltip hover (client component) */}
        <ProviderRailNav navigation={navigation} secondaryNav={secondaryNav} />

        {/* Desktop Sidebar (lg+) - Client component avec état actif + déconnexion */}
        <ProviderSidebar
          navigation={navigation}
          secondaryNav={secondaryNav}
          profile={profile}
        />

        {/* Mobile header (< md) */}
        <div className="sticky top-0 z-40 flex items-center gap-x-4 bg-background/95 backdrop-blur-sm px-3 xs:px-4 sm:px-6 py-3 shadow-sm border-b border-border md:hidden">
          <div className="flex-1 text-sm font-semibold leading-6 text-foreground">
            Espace Prestataire
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold text-sm">
              {initials}
            </div>
          </div>
        </div>

        {/* Main content - Padding adapté: md: pl-16 (rail), lg: pl-64 */}
        <main className="md:pl-16 lg:pl-64">
          {/* Tablet header (md-lg) */}
          <div className="sticky top-0 z-40 hidden md:flex lg:hidden h-14 shrink-0 items-center gap-x-4 border-b border-border bg-background/80 backdrop-blur-sm px-4 sm:px-6">
            <div className="flex-1 text-sm font-semibold leading-6 text-foreground">
              Espace Prestataire
            </div>
            <div className="flex items-center gap-3">
              <NotificationCenter />
              <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold text-sm">
                {initials}
              </div>
            </div>
          </div>

          {/* Desktop header (lg+) */}
          <div className="sticky top-0 z-40 hidden lg:flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background/80 backdrop-blur-sm px-6">
            <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 justify-end items-center">
              <NotificationCenter />
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold text-sm">
                  {initials}
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-foreground">
                    {profile.prenom} {profile.nom}
                  </p>
                  <p className="text-xs text-muted-foreground">Prestataire</p>
                </div>
              </div>
            </div>
          </div>

          <div className="py-4 xs:py-5 sm:py-6 px-3 xs:px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom navigation (< md) */}
        <ProviderBottomNav />
      </div>
    </ErrorBoundary>
  );
}
