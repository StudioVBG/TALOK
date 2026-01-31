"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Building2, Euro, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";

const NAV_ITEMS = [
  {
    href: OWNER_ROUTES.dashboard.path,
    label: "Dashboard",
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
    label: "Plus",
    icon: MoreHorizontal,
  },
];

export function OwnerBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-lg lg:hidden">
      {/* Safe area pour iPhone (Dynamic Island, Home Indicator) et Android (gesture nav) */}
      <div className="safe-area-bottom">
        <div className="grid grid-cols-4 h-14 xs:h-16">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname?.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                  // Layout + touch target minimum 44px
                  "flex flex-col items-center justify-center gap-0.5 xs:gap-1 touch-target",
                  // Transitions et feedback tactile
                  "transition-colors active:bg-muted/50",
                  // États actif/inactif
                isActive
                  ? "text-primary bg-primary/5"
                    : "text-muted-foreground"
              )}
            >
                {/* Icône plus grande sur petits écrans pour accessibilité */}
                <Icon className={cn(
                  "h-5 w-5 xs:h-6 xs:w-6 sm:h-5 sm:w-5",
                  isActive && "text-primary"
                )} />
                {/* Label adaptatif */}
                <span className="text-[10px] xs:text-[11px] sm:text-xs font-medium truncate max-w-[64px] xs:max-w-[72px]">
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

