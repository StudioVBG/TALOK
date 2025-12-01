"use client";

import { cn } from "@/lib/utils";

/**
 * Liens de navigation rapide pour l'accessibilité
 * Permet aux utilisateurs de clavier de sauter directement au contenu principal
 */

interface SkipLinkItem {
  href: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLinkItem[];
  className?: string;
}

const defaultLinks: SkipLinkItem[] = [
  { href: "#main-content", label: "Aller au contenu principal" },
  { href: "#main-navigation", label: "Aller à la navigation" },
];

export function SkipLinks({ links = defaultLinks, className }: SkipLinksProps) {
  return (
    <div className={cn("skip-links", className)}>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={cn(
            "sr-only focus:not-sr-only",
            "fixed top-4 left-4 z-[9999]",
            "px-4 py-2 rounded-md",
            "bg-primary text-primary-foreground",
            "font-medium text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "transition-transform duration-200",
            "focus:translate-y-0 -translate-y-16"
          )}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

/**
 * Wrapper pour le contenu principal avec ID pour le skip link
 */
interface MainContentProps {
  children: React.ReactNode;
  className?: string;
}

export function MainContent({ children, className }: MainContentProps) {
  return (
    <main
      id="main-content"
      className={cn("focus:outline-none", className)}
      tabIndex={-1}
    >
      {children}
    </main>
  );
}

/**
 * Wrapper pour la navigation avec ID pour le skip link
 */
interface MainNavigationProps {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function MainNavigation({
  children,
  className,
  ariaLabel = "Navigation principale",
}: MainNavigationProps) {
  return (
    <nav
      id="main-navigation"
      className={cn("focus:outline-none", className)}
      aria-label={ariaLabel}
      tabIndex={-1}
    >
      {children}
    </nav>
  );
}

/**
 * Annonce pour les lecteurs d'écran (live region)
 */
interface LiveRegionProps {
  message: string;
  politeness?: "polite" | "assertive";
}

export function LiveRegion({ message, politeness = "polite" }: LiveRegionProps) {
  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

/**
 * Hook pour gérer le focus après navigation
 */
export function useFocusOnRouteChange() {
  // Utilisé avec useEffect dans les pages pour focus le contenu principal
  // après une navigation
  if (typeof document !== "undefined") {
    const main = document.getElementById("main-content");
    if (main) {
      main.focus();
    }
  }
}

export default SkipLinks;


