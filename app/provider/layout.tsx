export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// @ts-nocheck
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
  Shield
} from "lucide-react";
import { NotificationCenter } from "@/components/notifications/notification-center";

const navigation = [
  { name: "Tableau de bord", href: "/provider/dashboard", icon: LayoutDashboard },
  { name: "Mes missions", href: "/provider/jobs", icon: Briefcase },
  { name: "Calendrier", href: "/provider/calendar", icon: Calendar },
  { name: "Mes devis", href: "/provider/quotes", icon: FileText },
  { name: "Mes factures", href: "/provider/invoices", icon: Receipt },
  { name: "Mes documents", href: "/provider/documents", icon: FileText },
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
  } = await supabase.auth.getUser();

  if (!user) {
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
      {/* Desktop Sidebar - SOTA 2026: Largeur unifiée 64 (comme Owner/Tenant/Admin) */}
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

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-white px-4 py-4 shadow-sm sm:px-6 lg:hidden">
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

      {/* Main content - SOTA 2026: Padding unifié */}
      <main className="lg:pl-64">
        {/* Desktop header */}
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

        <div className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* SOTA 2026 - Mobile bottom navigation avec safe area */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 z-50">
        <div className="pb-safe">
          <div className="grid grid-cols-5 h-14">
            {navigation.slice(0, 5).map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center justify-center gap-0.5 min-h-[44px] text-slate-600 hover:text-orange-600 active:bg-orange-50/50 transition-colors"
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[9px] xs:text-[10px] font-medium truncate max-w-[56px]">
                  {item.name.replace("Mes ", "")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </nav>
      {/* Spacer */}
      <div className="h-14 lg:hidden" />
    </div>
  );
}

