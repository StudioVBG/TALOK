"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Euro,
  FileText,
  MoreHorizontal,
  CreditCard,
  HelpCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";

/**
 * OwnerBottomNav - Navigation mobile 5 items pour propriétaire
 *
 * SOTA 2026:
 * - 5 items max (recommandé UX mobile)
 * - 5th item "Plus" opens a sheet with secondary nav (Facturation, Aide)
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
];

const MORE_ITEMS = [
  {
    href: "/owner/settings/billing",
    label: "Facturation",
    icon: CreditCard,
  },
  {
    href: OWNER_ROUTES.support.path,
    label: "Aide & services",
    icon: HelpCircle,
  },
];

export function OwnerBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = MORE_ITEMS.some(
    (item) => pathname === item.href || pathname?.startsWith(item.href + "/")
  );

  return (
    <>
      {/* More sheet overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* More sheet */}
      {moreOpen && (
        <div
          className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-50 md:hidden animate-in slide-in-from-bottom-4 duration-200"
          role="dialog"
          aria-label="Plus d'options"
        >
          <div className="mx-4 mb-2 rounded-xl border bg-background shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="text-sm font-medium">Plus d&apos;options</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="py-1">
              {MORE_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 min-h-[44px] transition-colors",
                      isActive
                        ? "text-primary bg-primary/5"
                        : "text-foreground hover:bg-muted/50"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
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
                  <span className="text-[10px] xs:text-[11px] sm:text-xs font-medium truncate max-w-[64px] xs:max-w-[72px]">
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {/* More button */}
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 xs:gap-1",
                "min-h-[44px] min-w-[44px]",
                "transition-colors active:bg-muted/50",
                moreOpen || isMoreActive
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MoreHorizontal
                className={cn(
                  "h-5 w-5 xs:h-6 xs:w-6 sm:h-5 sm:w-5",
                  (moreOpen || isMoreActive) && "text-primary"
                )}
              />
              <span className="text-[10px] xs:text-[11px] sm:text-xs font-medium truncate max-w-[64px] xs:max-w-[72px]">
                Plus
              </span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
