"use client";

/**
 * SharedBottomNav - SOTA 2026
 * Navigation mobile unifiée pour tous les rôles (owner, tenant, provider)
 *
 * Features:
 * - Safe area iOS/Android
 * - Touch targets 44px minimum
 * - Design cohérent
 * - Masquage conditionnel (wizards, formulaires)
 * - Menu "Plus" avec sheet pour items secondaires
 */

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon, MoreHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

interface SharedBottomNavProps {
  items: NavItem[];
  /** Items secondaires affichés dans le menu "Plus" */
  moreItems?: NavItem[];
  /** Label du bouton "Plus" (défaut: "Plus") */
  moreLabel?: string;
  /** Paths où la nav doit être masquée (wizards, formulaires full-screen) */
  hiddenOnPaths?: string[];
  /** Breakpoint at which to hide the bottom nav (default: "lg"). Use "md" when a tablet rail nav is present. */
  hideAbove?: "md" | "lg";
  className?: string;
}

export function SharedBottomNav({
  items,
  moreItems,
  moreLabel = "Plus",
  hiddenOnPaths = [],
  hideAbove = "lg",
  className
}: SharedBottomNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Masquer sur certains paths (wizards, formulaires)
  const defaultHiddenPaths = [
    '/new',
    '/edit',
    '/onboarding',
    '/wizard',
  ];

  const allHiddenPaths = [...defaultHiddenPaths, ...hiddenOnPaths];

  if (allHiddenPaths.some(path => pathname?.includes(path))) {
    return null;
  }

  // Limiter les items principaux (4 si moreItems existe, 5 sinon)
  const maxMainItems = moreItems && moreItems.length > 0 ? 4 : 5;
  const visibleItems = items.slice(0, maxMainItems);
  const hasMore = moreItems && moreItems.length > 0;
  const totalCols = visibleItems.length + (hasMore ? 1 : 0);

  // Vérifier si un item secondaire est actif
  const isMoreActive = hasMore && moreItems.some(
    item => pathname === item.href || pathname?.startsWith(item.href + "/")
  );

  const hideClass = hideAbove === "md" ? "md:hidden" : "lg:hidden";

  return (
    <>
      {/* Spacer pour éviter que le contenu soit caché derrière la nav */}
      <div className={cn("h-16", hideClass)} aria-hidden="true" />

      {/* Navigation fixe en bas */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "border-t bg-background/95 backdrop-blur-lg",
          hideClass,
          className
        )}
        role="navigation"
        aria-label="Navigation principale"
      >
        {/* Container avec safe area pour iOS */}
        <div className="pb-safe">
          <div
            className={cn(
              "grid h-14 xs:h-16",
              totalCols === 5 && "grid-cols-5",
              totalCols === 4 && "grid-cols-4",
              totalCols === 3 && "grid-cols-3",
              totalCols <= 2 && "grid-cols-2",
            )}
          >
            {visibleItems.map((item) => {
              const isActive = pathname === item.href ||
                              pathname?.startsWith(item.href + "/");
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center",
                    "gap-0.5 xs:gap-1",
                    "min-h-[44px] min-w-[44px]",
                    "transition-colors active:bg-muted/50",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <div className="relative">
                    <Icon
                      className={cn(
                        "h-5 w-5 xs:h-6 xs:w-6",
                        isActive && "text-primary"
                      )}
                    />
                    {item.badge && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                        {typeof item.badge === 'number' && item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </div>
                  {/* Label tronqué */}
                  <span
                    className={cn(
                      "text-[10px] xs:text-[11px] sm:text-xs",
                      "font-medium truncate max-w-[64px] xs:max-w-[72px]"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}

            {/* Bouton "Plus" pour ouvrir le sheet */}
            {hasMore && (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className={cn(
                  "flex flex-col items-center justify-center",
                  "gap-0.5 xs:gap-1",
                  "min-h-[44px] min-w-[44px]",
                  "transition-colors active:bg-muted/50",
                  isMoreActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Voir plus de pages"
                aria-expanded={moreOpen}
              >
                <MoreHorizontal className={cn(
                  "h-5 w-5 xs:h-6 xs:w-6",
                  isMoreActive && "text-primary"
                )} />
                <span className={cn(
                  "text-[9px] xs:text-[10px] sm:text-xs",
                  "font-medium"
                )}>
                  {moreLabel}
                </span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Sheet "Plus" avec items secondaires */}
      {hasMore && (
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base">Navigation</SheetTitle>
            </SheetHeader>
            <nav className="grid grid-cols-3 gap-2 py-4" aria-label="Navigation secondaire">
              {moreItems.map((item) => {
                const isActive = pathname === item.href ||
                                pathname?.startsWith(item.href + "/");
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2",
                      "rounded-xl p-4 min-h-[80px]",
                      "transition-colors active:scale-95 active:bg-muted/50",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-muted/50 text-foreground hover:bg-muted"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className={cn(
                      "h-6 w-6",
                      isActive && "text-primary"
                    )} />
                    <span className="text-xs font-medium text-center leading-tight">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

export default SharedBottomNav;
