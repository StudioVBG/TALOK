"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { LucideIcon, LogOut } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface ProviderSidebarProps {
  navigation: NavItem[];
  secondaryNav: NavItem[];
  profile: {
    prenom: string | null;
    nom: string | null;
    avatar_url: string | null;
  };
}

export function ProviderSidebar({
  navigation,
  secondaryNav,
  profile,
}: ProviderSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const initials = [profile.prenom?.[0], profile.nom?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "P";

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/signin");
  };

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-card border-r border-border px-6 pb-4">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="font-bold text-lg text-foreground">Prestataire</span>
        </div>

        {/* Navigation principale */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex gap-x-3 rounded-lg p-2 text-sm leading-6 font-semibold transition-colors",
                          active
                            ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400"
                            : "text-muted-foreground hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon
                          className={cn(
                            "h-5 w-5 shrink-0 transition-colors",
                            active
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-muted-foreground group-hover:text-orange-600"
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>

            {/* Navigation secondaire */}
            <li className="mt-auto">
              <ul role="list" className="-mx-2 space-y-1">
                {secondaryNav.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group flex gap-x-3 rounded-lg p-2 text-sm leading-6 font-semibold transition-colors",
                          active
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-muted"
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
                {/* Bouton déconnexion */}
                <li>
                  <button
                    onClick={handleSignOut}
                    className="group flex w-full gap-x-3 rounded-lg p-2 text-sm leading-6 font-semibold text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
                    Déconnexion
                  </button>
                </li>
              </ul>
            </li>
          </ul>
        </nav>

        {/* Footer profil */}
        <div className="flex items-center gap-3 px-2 py-3 border-t border-border">
          <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 font-semibold text-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {profile.prenom} {profile.nom}
            </p>
            <p className="text-xs text-muted-foreground">Prestataire</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
