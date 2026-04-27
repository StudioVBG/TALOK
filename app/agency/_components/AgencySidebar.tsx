"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";
import { getSecondaryRoleManifest } from "@/lib/navigation/secondary-role-manifest";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SharedBottomNav } from "@/components/layout/shared-bottom-nav";

interface AgencySidebarProps {
  profile: {
    id: string;
    prenom: string | null;
    nom: string | null;
    role: string;
  };
  agencyName: string;
}

const manifest = getSecondaryRoleManifest("agency");
const navigation = [...manifest.navigation, ...manifest.footerNavigation];

/** Mappe un href agence à l'id ciblé par le tour guidé (data-tour). */
function agencyTourId(href: string): string | undefined {
  if (href.includes("/mandates")) return "nav-mandates";
  if (href.includes("/owners")) return "nav-owners";
  if (href.includes("/accounting")) return "nav-accounting";
  if (href.includes("/dashboard")) return "nav-dashboard";
  return undefined;
}

export function AgencySidebar({ profile, agencyName }: AgencySidebarProps) {
  const pathname = usePathname();

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
                  data-tour={agencyTourId(item.href)}
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
          <div className="flex-shrink-0 p-4 border-t border-border/50 space-y-3">
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
            <SignOutButton />
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation — SharedBottomNav (parité 13/13 via menu Plus) */}
      <SharedBottomNav
        items={manifest.navigation.slice(0, 4).map((item) => ({
          href: item.href,
          label: item.name,
          icon: item.icon,
          tourId: agencyTourId(item.href),
        }))}
        moreItems={[
          ...manifest.navigation.slice(4).map((item) => ({
            href: item.href,
            label: item.name,
            icon: item.icon,
            tourId: agencyTourId(item.href),
          })),
          ...manifest.footerNavigation.map((item) => ({
            href: item.href,
            label: item.name,
            icon: item.icon,
          })),
        ]}
        hideAbove="lg"
      />
    </>
  );
}
