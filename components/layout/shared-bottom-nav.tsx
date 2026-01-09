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
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

interface SharedBottomNavProps {
  items: NavItem[];
  /** Paths où la nav doit être masquée (wizards, formulaires full-screen) */
  hiddenOnPaths?: string[];
  className?: string;
}

export function SharedBottomNav({ 
  items, 
  hiddenOnPaths = [],
  className 
}: SharedBottomNavProps) {
  const pathname = usePathname();

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

  // Limiter à 5 items max pour mobile
  const visibleItems = items.slice(0, 5);

  return (
    <>
      {/* Spacer pour éviter que le contenu soit caché derrière la nav */}
      <div className="h-16 lg:hidden" aria-hidden="true" />
      
      {/* Navigation fixe en bas */}
      <nav 
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50",
          "border-t bg-background/95 backdrop-blur-lg",
          "lg:hidden", // Masquer sur desktop
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
              visibleItems.length === 4 && "grid-cols-4",
              visibleItems.length === 5 && "grid-cols-5",
              visibleItems.length === 3 && "grid-cols-3",
              visibleItems.length <= 2 && "grid-cols-2",
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
                    // Layout de base
                    "flex flex-col items-center justify-center",
                    "gap-0.5 xs:gap-1",
                    // Touch target minimum 44px (accessibilité)
                    "min-h-[44px] min-w-[44px]",
                    // Transitions
                    "transition-colors active:bg-muted/50",
                    // États
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {/* Icône avec badge optionnel */}
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
                      "text-[9px] xs:text-[10px] sm:text-xs",
                      "font-medium truncate max-w-[56px] xs:max-w-[64px]"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

export default SharedBottomNav;

