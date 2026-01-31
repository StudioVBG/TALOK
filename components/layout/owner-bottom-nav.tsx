"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Euro, FileText, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";

/**
 * OwnerBottomNav - Navigation mobile 5 items pour propriétaire
 *
 * SOTA 2026:
 * - 5 items max (recommandé UX mobile)
 * - md:hidden (tablet a le rail sidebar)
 * - Touch targets 44px minimum
 * - Safe area iOS/Android
 * - aria-current pour page active
 */
const NAV_ITEMS = [
  {
    href: OWNER_ROUTES.dashboard.path,
    label: "Accueil",
    icon: LayoutDashboard,
  },
  {
    href: OWNER_ROUTES.properties.path,
    label: "Biens",
    icon: Building2,
  },
  {
    href: OWNER_ROUTES.money.path,
    label: "Loyers",
    icon: Euro,
  },
  {
    href: OWNER_ROUTES.contracts.path,
    label: "Baux",
    icon: FileText,
  },
  {
    href: OWNER_ROUTES.support.path,
    label: "Plus",
    icon: MoreHorizontal,
  },
];

export function OwnerBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-lg md:hidden"
      role="navigation"
      aria-label="Navigation principale mobile"
    >
      {/* Safe area pour iPhone (Dynamic Island, Home Indicator) et Android (gesture nav) */}
      <div className="safe-area-bottom pb-safe">
        <div className="grid grid-cols-5 h-14 xs:h-16">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  // Layout + touch target minimum 44px
                  "flex flex-col items-center justify-center gap-0.5 xs:gap-1",
                  "min-h-[44px] min-w-[44px]",
                  // Transitions et feedback tactile
                  "transition-colors active:bg-muted/50",
                  // États actif/inactif
                  isActive
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {/* Icône adaptative */}
                <Icon
                  className={cn(
                    "h-5 w-5 xs:h-6 xs:w-6 sm:h-5 sm:w-5",
                    isActive && "text-primary"
                  )}
                />
                {/* Label adaptatif */}
                <span className="text-[9px] xs:text-[10px] sm:text-xs font-medium truncate max-w-[52px] xs:max-w-[60px]">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
