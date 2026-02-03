"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkipLink {
  href: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
  className?: string;
}

const defaultLinks: SkipLink[] = [
  { href: "#main-content", label: "Aller au contenu principal" },
  { href: "#main-navigation", label: "Aller à la navigation" },
];

/**
 * SkipLinks - Composant d'accessibilité WCAG 2.1 AA
 *
 * Permet aux utilisateurs de clavier et lecteurs d'écran
 * de sauter directement au contenu principal.
 *
 * Usage:
 * 1. Ajouter <SkipLinks /> en début de layout
 * 2. Ajouter id="main-content" sur le <main>
 * 3. Ajouter id="main-navigation" sur la <nav> principale
 */
export function SkipLinks({ links = defaultLinks, className }: SkipLinksProps) {
  return (
    <div className={cn("skip-links", className)}>
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={cn(
            "sr-only focus:not-sr-only",
            "focus:fixed focus:top-4 focus:left-4 focus:z-[9999]",
            "focus:px-4 focus:py-2 focus:rounded-md",
            "focus:bg-primary focus:text-primary-foreground",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "focus:shadow-lg focus:font-medium",
            "transition-all duration-200"
          )}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

/**
 * MainContent - Wrapper pour le contenu principal avec id pour skip link
 */
export function MainContent({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={cn("outline-none", className)}
      {...props}
    >
      {children}
    </main>
  );
}

/**
 * MainNavigation - Wrapper pour la navigation avec id pour skip link
 */
export function MainNavigation({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav
      id="main-navigation"
      aria-label="Navigation principale"
      className={className}
      {...props}
    >
      {children}
    </nav>
  );
}

export { type SkipLink };
